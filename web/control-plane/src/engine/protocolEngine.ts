import type {
  A2AWireEnvelope,
  BranchDiff,
  BranchSummary,
  Checkpoint,
  ControlPlaneRun,
  ExecutionStepSpec,
  HitlAction,
  McpWireEnvelope,
  NodeId,
  OTelGenAISpan,
  RunStatus,
  ScenarioId,
  StructuredDiffEntry,
} from '../types/protocol';
import { buildHitlResolutionSteps, buildScenarioSteps } from './scenarios';

export interface ForkModelProfile {
  id: string;
  label: string;
  system: string;
  inputRatePer1M: number;
  outputRatePer1M: number;
  synthLatencyMs: number;
  groundednessBonus: number;
}

export const ALTERNATE_FORK_MODELS: ForkModelProfile[] = [
  {
    id: 'claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    system: 'anthropic',
    inputRatePer1M: 3.0,
    outputRatePer1M: 15.0,
    synthLatencyMs: 218.0,
    groundednessBonus: 0.0,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    system: 'google',
    inputRatePer1M: 1.25,
    outputRatePer1M: 10.0,
    synthLatencyMs: 168.0,
    groundednessBonus: 0.0,
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    system: 'openai',
    inputRatePer1M: 2.5,
    outputRatePer1M: 10.0,
    synthLatencyMs: 184.0,
    groundednessBonus: -0.01,
  },
  {
    id: 'vllm-qwen-72b',
    label: 'Local vLLM Qwen-72B',
    system: 'vllm_local',
    inputRatePer1M: 0.18,
    outputRatePer1M: 0.42,
    synthLatencyMs: 92.0,
    groundednessBonus: -0.03,
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    system: 'google',
    inputRatePer1M: 0.15,
    outputRatePer1M: 0.6,
    synthLatencyMs: 84.0,
    groundednessBonus: -0.04,
  },
];

const MODEL_RATES_PER_1M: Record<string, [number, number]> = {
  'gpt-4.1': [2.0, 8.0],
  'gpt-4.1-mini': [0.4, 1.6],
  'gpt-4o': [2.5, 10.0],
  'claude-sonnet-4': [3.0, 15.0],
  'claude-3.7-sonnet': [3.0, 15.0],
  'gemini-2.5-pro': [1.25, 10.0],
  'gemini-2.5-flash': [0.15, 0.6],
  'vllm-qwen-72b': [0.18, 0.42],
  'policy-classifier-v3': [0.05, 0.05],
  'mcp-tool-runtime': [0.0, 0.0],
  'a2a-remote-peer': [1.5, 6.0],
  'human-operator-gate': [0.0, 0.0],
};

export function computeStructuredStateDiff(
  beforeObj: Record<string, unknown>,
  afterObj: Record<string, unknown>
): StructuredDiffEntry[] {
  const keys = Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])).sort();
  return keys.map((key) => {
    const hasBefore = Object.prototype.hasOwnProperty.call(beforeObj, key);
    const hasAfter = Object.prototype.hasOwnProperty.call(afterObj, key);
    const beforeVal = beforeObj[key];
    const afterVal = afterObj[key];
    if (!hasBefore && hasAfter) {
      return { path: `/${key}`, kind: 'added', before: undefined, after: afterVal };
    }
    if (hasBefore && !hasAfter) {
      return { path: `/${key}`, kind: 'removed', before: beforeVal, after: undefined };
    }
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      return { path: `/${key}`, kind: 'changed', before: beforeVal, after: afterVal };
    }
    return { path: `/${key}`, kind: 'unchanged', before: beforeVal, after: afterVal };
  });
}

export function computeCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const [inRate, outRate] = MODEL_RATES_PER_1M[model] ?? [1.0, 4.0];
  const raw = (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
  return Number(raw.toFixed(6));
}

function deterministicHex(seed: string, length: number): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  let out = '';
  for (let round = 0; out.length < length; round += 1) {
    for (let i = 0; i < seed.length; i += 1) {
      const ch = seed.charCodeAt(i) + round * 31;
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    out += (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }
  return out.slice(0, length);
}

function nowIso(): string {
  return new Date().toISOString();
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createInitialRun(scenarioId: ScenarioId): ControlPlaneRun {
  const runId = `run-${deterministicHex(`${scenarioId}-${Date.now()}`, 8)}`;
  const steps = buildScenarioSteps(scenarioId);

  const emptyMain: BranchSummary = {
    branch_id: 'main',
    parent_branch_id: null,
    forked_from_checkpoint_id: null,
    status: 'idle',
    total_latency_ms: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cost_usd: 0,
    groundedness: 0,
    guardrail_status: 'pass',
    verdict_summary: '',
    citations: [],
    widget: null,
    checkpoints: [],
  };

  return {
    run_id: runId,
    scenario_id: scenarioId,
    active_branch_id: 'main',
    status: 'idle',
    active_node_id: null,
    active_edge_id: null,
    visited_nodes: [],
    visited_edges: [],
    hitl_context: null,
    branches: { main: emptyMain },
    mcp_logs: [],
    a2a_logs: [],
    ag_ui_events: [],
    otel_spans: [],
    branch_diffs: [],
    pending_steps: steps,
    total_planned_steps: steps.length,
  };
}

export function stepRun(prev: ControlPlaneRun): ControlPlaneRun {
  if (prev.status === 'paused_hitl' || prev.pending_steps.length === 0) {
    return prev;
  }

  const next = deepClone(prev);
  const branchId = next.active_branch_id;
  const branch = next.branches[branchId];
  const step = next.pending_steps.shift() as ExecutionStepSpec;
  const ts = nowIso();

  // Emit RUN_STARTED on the very first step of main
  if (next.ag_ui_events.length === 0) {
    next.ag_ui_events.push({
      id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
      type: 'RUN_STARTED',
      timestamp: ts,
      run_id: next.run_id,
      branch_id: branchId,
      node_id: step.node_id,
      data: { scenario_id: next.scenario_id, protocol: 'ag-ui/1.0' },
    });
  }

  next.ag_ui_events.push({
    id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
    type: 'STEP_STARTED',
    timestamp: ts,
    run_id: next.run_id,
    branch_id: branchId,
    node_id: step.node_id,
    data: { label: step.label, model: step.model },
  });

  const priorCp = branch.checkpoints.length > 0 ? branch.checkpoints[branch.checkpoints.length - 1] : null;
  const inputState = priorCp ? deepClone(priorCp.state_snapshot) : { scenario_id: next.scenario_id };
  const mergedState = { ...inputState, ...deepClone(step.state_patch) };
  const costUsd = computeCostUsd(step.model, step.input_tokens, step.output_tokens);

  // Append MCP wire logs & corresponding AG-UI TOOL_CALL events
  if (step.mcp_envelopes) {
    for (const env of step.mcp_envelopes) {
      const fullEnv: McpWireEnvelope = { ...env, timestamp: ts, branch_id: branchId };
      next.mcp_logs.push(fullEnv);
      next.ag_ui_events.push(
        {
          id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
          type: 'TOOL_CALL_START',
          timestamp: ts,
          run_id: next.run_id,
          branch_id: branchId,
          node_id: step.node_id,
          data: { toolCallId: env.id, method: env.method, server: env.server },
        },
        {
          id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
          type: 'TOOL_CALL_ARGS',
          timestamp: ts,
          run_id: next.run_id,
          branch_id: branchId,
          node_id: step.node_id,
          data: { toolCallId: env.id, delta: env.request.params ?? {} },
        },
        {
          id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
          type: 'TOOL_CALL_RESULT',
          timestamp: ts,
          run_id: next.run_id,
          branch_id: branchId,
          node_id: step.node_id,
          data: { toolCallId: env.id, rtt_ms: env.rtt_ms, ok: !('error' in env.response) },
        }
      );
    }
  }

  // Append A2A wire logs
  if (step.a2a_envelopes) {
    for (const env of step.a2a_envelopes) {
      const fullA2A: A2AWireEnvelope = { ...env, timestamp: ts, branch_id: branchId };
      next.a2a_logs.push(fullA2A);
    }
  }

  // Append RFC 6902 STATE_DELTA if provided
  if (step.ag_ui_patches && step.ag_ui_patches.length > 0) {
    next.ag_ui_events.push({
      id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
      type: 'STATE_DELTA',
      timestamp: ts,
      run_id: next.run_id,
      branch_id: branchId,
      node_id: step.node_id,
      data: { delta: step.ag_ui_patches },
    });
  }

  // Record OpenTelemetry GenAI Span
  const branchSpans = next.otel_spans.filter((s) => s.branch_id === branchId);
  const lastSpan = branchSpans.length > 0 ? branchSpans[branchSpans.length - 1] : null;
  const startMs = lastSpan ? Number((lastSpan.start_ms + lastSpan.duration_ms + 14).toFixed(1)) : 0;
  const traceId = deterministicHex(`${next.run_id}:${branchId}`, 32);
  const spanId = deterministicHex(`${traceId}:${branchSpans.length}:${step.node_id}`, 16);
  const rootSpanId = branchSpans.length > 0 ? branchSpans[0].span_id : null;

  const span: OTelGenAISpan = {
    trace_id: traceId,
    span_id: spanId,
    parent_span_id: branchSpans.length === 0 ? null : rootSpanId,
    name: `${step.node_id}.${step.operation}`,
    node_id: step.node_id,
    branch_id: branchId,
    start_ms: startMs,
    duration_ms: Number(step.latency_ms.toFixed(1)),
    status: step.guardrail_status === 'rerouted' ? 'ERROR' : step.pause_for_hitl ? 'PAUSED' : 'OK',
    attributes: {
      'gen_ai.operation.name': step.operation,
      'gen_ai.system': step.system,
      'gen_ai.request.model': step.model,
      'gen_ai.usage.input_tokens': step.input_tokens,
      'gen_ai.usage.output_tokens': step.output_tokens,
      'gen_ai.usage.total_tokens': step.input_tokens + step.output_tokens,
      'gen_ai.response.ttft_ms': Number((step.latency_ms * 0.28).toFixed(1)),
      'verdict.finops.cost_usd': costUsd,
      'verdict.graph.branch_id': branchId,
      'verdict.graph.node_id': step.node_id,
      ...(step.extra_span_attrs ?? {}),
    },
  };
  next.otel_spans.push(span);

  // Save immutable checkpoint
  const stepIndex = branch.checkpoints.length + 1;
  const cpPrefix = branchId === 'main' ? 'CP' : `${branchId.toUpperCase()}-CP`;
  const cpId = `${cpPrefix}-${String(stepIndex).padStart(2, '0')}`;
  const parentCpId = priorCp ? priorCp.checkpoint_id : branch.forked_from_checkpoint_id;

  const cp: Checkpoint = {
    checkpoint_id: cpId,
    run_id: next.run_id,
    branch_id: branchId,
    parent_checkpoint_id: parentCpId,
    step_index: stepIndex,
    node_id: step.node_id,
    label: step.label,
    timestamp: ts,
    input_state: inputState,
    state_snapshot: mergedState,
    prompt_or_args: deepClone(step.prompt_or_args),
    input_tokens: step.input_tokens,
    output_tokens: step.output_tokens,
    latency_ms: step.latency_ms,
    cost_usd: costUsd,
    groundedness: step.groundedness,
    guardrail_status: step.guardrail_status ?? 'pass',
    edge_taken: step.edge_id,
  };
  branch.checkpoints.push(cp);

  // Update visual graph state
  next.active_node_id = step.node_id;
  next.active_edge_id = step.edge_id ?? null;
  if (!next.visited_nodes.includes(step.node_id)) {
    next.visited_nodes.push(step.node_id);
  }
  if (step.edge_id && !next.visited_edges.includes(step.edge_id)) {
    next.visited_edges.push(step.edge_id);
  }

  // Update branch rollups
  branch.total_latency_ms = Number((branch.total_latency_ms + step.latency_ms).toFixed(1));
  branch.total_input_tokens += step.input_tokens;
  branch.total_output_tokens += step.output_tokens;
  branch.total_cost_usd = Number((branch.total_cost_usd + costUsd).toFixed(6));
  if (step.groundedness !== undefined) {
    branch.groundedness = step.groundedness;
  }
  if (step.guardrail_status === 'rerouted') {
    branch.guardrail_status = 'rerouted';
  } else if (step.guardrail_status === 'blocked') {
    branch.guardrail_status = 'blocked';
  }

  // Handle HITL interrupt vs completion
  if (step.pause_for_hitl) {
    next.hitl_context = { ...step.pause_for_hitl, checkpoint_id: cpId };
    next.status = 'paused_hitl';
    branch.status = 'paused_hitl';
    branch.verdict_summary = 'Paused at HITL Approval Gate awaiting operator authorization.';
    next.ag_ui_events.push({
      id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
      type: 'INTERRUPT_REQUIRED',
      timestamp: ts,
      run_id: next.run_id,
      branch_id: branchId,
      node_id: step.node_id,
      data: { ...next.hitl_context },
    });
    return next;
  }

  if (step.verdict_text) {
    branch.verdict_summary = step.verdict_text;
    branch.citations = step.citations ?? [];
    branch.widget = step.widget ?? null;
    next.ag_ui_events.push({
      id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
      type: 'TEXT_MESSAGE_CONTENT',
      timestamp: ts,
      run_id: next.run_id,
      branch_id: branchId,
      node_id: step.node_id,
      data: { text: step.verdict_text },
    });
  }

  if (next.pending_steps.length === 0) {
    const finalStatus: RunStatus =
      mergedState.hitl_decision === 'reject_escalate' ? 'rejected' : 'completed';
    next.status = finalStatus;
    branch.status = finalStatus;
    if (branch.groundedness === 0) {
      branch.groundedness = 0.99;
    }
    next.ag_ui_events.push({
      id: `agui-${String(next.ag_ui_events.length + 1).padStart(3, '0')}`,
      type: 'RUN_FINISHED',
      timestamp: ts,
      run_id: next.run_id,
      branch_id: branchId,
      node_id: step.node_id,
      data: { status: finalStatus, groundedness: branch.groundedness },
    });
  } else {
    next.status = 'running';
    branch.status = 'running';
  }

  return next;
}

export function runUntilPauseOrComplete(initial: ControlPlaneRun): ControlPlaneRun {
  let current = initial;
  let guard = 0;
  while (current.pending_steps.length > 0 && current.status !== 'paused_hitl' && guard < 24) {
    current = stepRun(current);
    guard += 1;
  }
  return current;
}

export function applyHitlDecision(
  prev: ControlPlaneRun,
  action: HitlAction,
  canaryPercent = 100
): ControlPlaneRun {
  if (prev.status !== 'paused_hitl') {
    return prev;
  }
  const next = deepClone(prev);
  const followUpSteps = buildHitlResolutionSteps(action, canaryPercent);
  next.hitl_context = null;
  next.status = 'running';
  next.branches[next.active_branch_id].status = 'running';
  next.pending_steps = [...followUpSteps, ...next.pending_steps];
  next.total_planned_steps += followUpSteps.length;
  return runUntilPauseOrComplete(next);
}

export function forkAndReplayFromCheckpoint(
  prev: ControlPlaneRun,
  checkpointId: string,
  stateOverrides: Record<string, unknown>
): { run: ControlPlaneRun; diff: BranchDiff } {
  const next = deepClone(prev);

  // Locate source checkpoint across branches
  let sourceCp: Checkpoint | null = null;
  let sourceBranch: BranchSummary | null = null;
  for (const b of Object.values(next.branches)) {
    const found = b.checkpoints.find((c) => c.checkpoint_id === checkpointId);
    if (found) {
      sourceCp = deepClone(found);
      sourceBranch = b;
      break;
    }
  }

  if (!sourceCp || !sourceBranch) {
    throw new Error(`Checkpoint '${checkpointId}' not found`);
  }

  const existingForks = Object.keys(next.branches).filter((k) => k.startsWith('fork-'));
  const newBranchId = `fork-${existingForks.length + 1}`;
  const forkedState: Record<string, unknown> = {
    ...deepClone(sourceCp.state_snapshot),
    ...deepClone(stateOverrides),
    _forked_from: checkpointId,
    _branch_id: newBranchId,
  };

  // Compute ancestor cost/tokens/latency strictly BEFORE the forked checkpoint
  const ancestorPrefix = sourceBranch.checkpoints.filter((c) => c.step_index < sourceCp.step_index);
  const prefixLatency = Number(ancestorPrefix.reduce((acc, c) => acc + c.latency_ms, 0).toFixed(1));
  const prefixIn = ancestorPrefix.reduce((acc, c) => acc + c.input_tokens, 0);
  const prefixOut = ancestorPrefix.reduce((acc, c) => acc + c.output_tokens, 0);
  const prefixCost = Number(ancestorPrefix.reduce((acc, c) => acc + c.cost_usd, 0).toFixed(6));

  const topK = Number(forkedState.top_k ?? 8);
  const rerank = Boolean(forkedState.rerank ?? true);
  const strictGrounding = Boolean(forkedState.strict_grounding ?? true);
  const isOptimal = rerank && topK <= 10 && strictGrounding;

  const requestedModel =
    typeof stateOverrides.model === 'string' && stateOverrides.model.trim().length > 0
      ? stateOverrides.model.trim()
      : null;
  const modelProfile = requestedModel
    ? ALTERNATE_FORK_MODELS.find((m) => m.id === requestedModel) ?? null
    : null;
  const synthModel = modelProfile ? modelProfile.id : 'claude-sonnet-4';
  const synthSystem = modelProfile ? modelProfile.system : 'anthropic';
  const promptOverride =
    typeof stateOverrides.prompt_override === 'string' && stateOverrides.prompt_override.trim().length > 0
      ? stateOverrides.prompt_override.trim()
      : undefined;

  const baseSynthGroundedness = isOptimal ? 0.99 : 0.78;
  const effectiveGroundedness = Number(
    Math.max(
      0.62,
      Math.min(
        0.99,
        baseSynthGroundedness +
          (modelProfile ? modelProfile.groundednessBonus : 0) +
          (promptOverride && promptOverride.toLowerCase().includes('strict') ? 0.01 : 0)
      )
    ).toFixed(2)
  );
  const synthLatencyMs = modelProfile
    ? Number((isOptimal ? modelProfile.synthLatencyMs : modelProfile.synthLatencyMs * 1.38).toFixed(1))
    : isOptimal
      ? 198.0
      : 290.0;
  const synthInputTokens = isOptimal ? 2650 : 4200;
  const synthOutputTokens = promptOverride && promptOverride.toLowerCase().includes('concise')
    ? isOptimal
      ? 290
      : 460
    : isOptimal
      ? 410
      : 640;

  const newBranch: BranchSummary = {
    branch_id: newBranchId,
    parent_branch_id: sourceBranch.branch_id,
    forked_from_checkpoint_id: checkpointId,
    status: 'running',
    total_latency_ms: prefixLatency,
    total_input_tokens: prefixIn,
    total_output_tokens: prefixOut,
    total_cost_usd: prefixCost,
    groundedness: 0,
    guardrail_status: 'pass',
    verdict_summary: '',
    citations: [],
    widget: null,
    checkpoints: [],
  };

  next.branches[newBranchId] = newBranch;
  next.active_branch_id = newBranchId;
  next.status = 'running';

  const queryText = String(
    forkedState.query ?? 'How does the voucher cluster prevent double-spending at 5,000 RPS?'
  );

  const forkSteps: ExecutionStepSpec[] = [
    {
      node_id: 'mcp_context_scout',
      from_node: 'grounded_synthesizer',
      edge_id: 'e-synth-mcp',
      label: `Forked MCP Retrieval (top_k=${topK}, rerank=${String(rerank)})`,
      model: 'mcp-tool-runtime',
      system: 'mcp',
      operation: 'execute_tool',
      latency_ms: isOptimal ? 72.0 : 142.0,
      input_tokens: 0,
      output_tokens: 0,
      groundedness: effectiveGroundedness,
      prompt_or_args: {
        forked_from: checkpointId,
        tool: 'vector_corpus.hybrid_search',
        arguments: { query: queryText, top_k: topK, rerank },
      },
      state_patch: {
        ...forkedState,
        model: synthModel,
        ...(promptOverride ? { prompt_override: promptOverride } : {}),
        retrieved_docs: isOptimal
          ? ['SPEC-2026-04 (rerank 0.97)', 'BENCH-2026-11 (rerank 0.95)']
          : ['SPEC-2026-04 (score 0.81)', 'LEGACY-2022-01 (score 0.62)'],
      },
      mcp_envelopes: [
        {
          id: `mcp-fork-${newBranchId}`,
          method: 'tools/call',
          server: 'mcp://vector-corpus.internal',
          rtt_ms: isOptimal ? 72.0 : 142.0,
          node_id: 'mcp_context_scout',
          request: {
            jsonrpc: '2.0',
            id: `rag-${newBranchId}`,
            method: 'tools/call',
            params: {
              name: 'vector_corpus.hybrid_search',
              arguments: { query: queryText, top_k: topK, rerank },
            },
          },
          response: {
            jsonrpc: '2.0',
            id: `rag-${newBranchId}`,
            result: {
              isError: false,
              content: [
                {
                  type: 'json',
                  json: {
                    top_k: topK,
                    rerank,
                    context_tokens: synthInputTokens,
                    chunks: isOptimal
                      ? [
                          {
                            doc_id: 'SPEC-2026-04',
                            score: 0.97,
                            excerpt: 'Redis WATCH + atomic Lua CAS lock (120ms TTL, bounded exponential backoff) prevents double-spending.',
                          },
                          {
                            doc_id: 'BENCH-2026-11',
                            score: 0.95,
                            excerpt: 'Dapper zero-allocation query path holds p99 at 42ms under 5,200 RPS across 712 stores.',
                          },
                        ]
                      : [
                          {
                            doc_id: 'SPEC-2026-04',
                            score: 0.81,
                            excerpt: 'Redis optimistic concurrency control handles voucher contention.',
                          },
                        ],
                  },
                },
              ],
            },
          },
        },
      ],
      ag_ui_patches: [
        { op: 'replace', path: '/top_k', value: topK },
        { op: 'replace', path: '/rerank', value: rerank },
        { op: 'replace', path: '/strict_grounding', value: strictGrounding },
        { op: 'replace', path: '/model', value: synthModel },
      ],
      extra_span_attrs: {
        'rag.top_k': topK,
        'rag.rerank': rerank,
        'verdict.fork.source': checkpointId,
        'verdict.fork.model': synthModel,
      },
    },
    {
      node_id: 'policy_guardrail',
      from_node: 'mcp_context_scout',
      edge_id: 'e-mcp-guard',
      label: isOptimal ? 'Strict Grounding & Citation Gate Passed' : 'Partial Grounding Gate',
      model: 'policy-classifier-v3',
      system: 'verdict_policy',
      operation: 'guardrail_scan',
      latency_ms: 31.0,
      input_tokens: isOptimal ? 980 : 1800,
      output_tokens: 65,
      groundedness: effectiveGroundedness,
      guardrail_status: 'pass',
      prompt_or_args: {
        strict_grounding: strictGrounding,
        stale_chunks_filtered: isOptimal ? 22 : 12,
      },
      state_patch: {
        strict_grounding_verified: isOptimal,
        unsupported_claims: isOptimal ? 0 : 1,
      },
    },
    {
      node_id: 'grounded_synthesizer',
      from_node: 'policy_guardrail',
      edge_id: 'e-guard-synth',
      label: isOptimal
        ? `Forked Grounded Verdict (${effectiveGroundedness.toFixed(2)} · ${synthModel})`
        : `Forked Verdict (${effectiveGroundedness.toFixed(2)} · ${synthModel})`,
      model: synthModel,
      system: synthSystem,
      operation: 'chat',
      latency_ms: synthLatencyMs,
      input_tokens: synthInputTokens,
      output_tokens: synthOutputTokens,
      groundedness: effectiveGroundedness,
      guardrail_status: 'pass',
      prompt_or_args: {
        strict_grounding: strictGrounding,
        branch_id: newBranchId,
        model: synthModel,
        ...(promptOverride ? { prompt_override: promptOverride } : {}),
      },
      state_patch: {
        groundedness: effectiveGroundedness,
        synthesizer_model: synthModel,
        ...(promptOverride ? { prompt_directive_applied: promptOverride } : {}),
      },
      ag_ui_patches: [
        { op: 'replace', path: '/active_branch_id', value: newBranchId },
        { op: 'replace', path: '/groundedness', value: effectiveGroundedness },
        { op: 'replace', path: '/synthesizer_model', value: synthModel },
      ],
      verdict_text: isOptimal
        ? `[${synthModel}] Verified against SPEC-2026-04 & BENCH-2026-11: Voucher double-spending at 5,000+ RPS is prevented via Redis WATCH + atomic Lua CAS locking (120ms TTL, bounded exponential backoff) combined with Dapper zero-allocation SQL reads holding p99 latency at 42ms across 712 retail stores.${promptOverride ? ` Directive applied: "${promptOverride.slice(0, 96)}".` : ''}`
        : `[${synthModel}] Partial recovery on forked branch: context window was narrowed, but enabling rerank=true, top_k<=10, and strict_grounding=true is required for 0.99 groundedness.`,
      citations: isOptimal
        ? [
            {
              id: 'SPEC-2026-04',
              source: 'Production Architecture Spec · Rerank 0.97',
              protocol: 'MCP',
              excerpt: 'Redis WATCH + Lua CAS atomic locks with 120ms TTL eliminate double-spending.',
              verified: true,
            },
            {
              id: 'BENCH-2026-11',
              source: 'Load Test Report · Rerank 0.95',
              protocol: 'MCP',
              excerpt: 'Dapper zero-allocation queries sustain 5,200 RPS at 42ms p99.',
              verified: true,
            },
          ]
        : [
            {
              id: 'SPEC-2026-04',
              source: 'Production Architecture Spec · Score 0.81',
              protocol: 'MCP',
              excerpt: 'Redis optimistic concurrency controls voucher contention.',
              verified: true,
            },
          ],
      widget: {
        kind: 'grounding_audit',
        title: `Time-Travel Fork Recovery (${newBranchId.toUpperCase()} · ${synthModel})`,
        metrics: [
          {
            label: 'GROUNDEDNESS',
            value: `${effectiveGroundedness.toFixed(2)}`,
            tone: effectiveGroundedness >= 0.95 ? 'emerald' : 'amber',
          },
          { label: 'UNSUPPORTED CLAIMS', value: isOptimal ? '0 (CLEAN)' : '1', tone: isOptimal ? 'emerald' : 'amber' },
          { label: 'SYNTH MODEL', value: synthModel.toUpperCase(), tone: 'cyan' },
          { label: 'LATENCY', value: `${synthLatencyMs.toFixed(0)}ms`, tone: 'emerald' },
        ],
        callout: isOptimal
          ? `Replayed via ${synthModel} with cross-encoder reranking + top_k=${topK}, eliminating hallucination while cutting run cost.`
          : 'Try setting top_k: 8, rerank: true, strict_grounding: true for optimal groundedness and FinOps savings.',
      },
    },
  ];

  next.pending_steps = forkSteps;
  const completedRun = runUntilPauseOrComplete(next);

  const baseBranch = completedRun.branches[sourceBranch.branch_id];
  const compBranch = completedRun.branches[newBranchId];
  const baseTokens = baseBranch.total_input_tokens + baseBranch.total_output_tokens;
  const compTokens = compBranch.total_input_tokens + compBranch.total_output_tokens;

  const pct = (delta: number, base: number): number =>
    base > 0 ? Number(((delta / base) * 100).toFixed(1)) : 0;

  const latDelta = Number((compBranch.total_latency_ms - baseBranch.total_latency_ms).toFixed(1));
  const tokDelta = compTokens - baseTokens;
  const costDelta = Number((compBranch.total_cost_usd - baseBranch.total_cost_usd).toFixed(6));

  const stateChanges = Object.entries(stateOverrides).map(([key, after]) => ({
    key,
    before: sourceCp.state_snapshot[key],
    after,
  }));

  const baseLastCp = baseBranch.checkpoints[baseBranch.checkpoints.length - 1];
  const compLastCp = compBranch.checkpoints[compBranch.checkpoints.length - 1];
  const baseSnapshot = baseLastCp ? baseLastCp.state_snapshot : sourceCp.state_snapshot;
  const compSnapshot = compLastCp ? compLastCp.state_snapshot : forkedState;
  const structuredStateDiff = computeStructuredStateDiff(baseSnapshot, compSnapshot);

  const baseSpanModel =
    completedRun.otel_spans
      .filter((s) => s.branch_id === baseBranch.branch_id && s.node_id === 'grounded_synthesizer')
      .map((s) => String(s.attributes['gen_ai.request.model']))
      .pop() ?? 'claude-sonnet-4';

  const baseStructuredOutput: Record<string, unknown> = {
    branch_id: baseBranch.branch_id,
    model: baseSpanModel,
    groundedness: baseBranch.groundedness,
    tokens: baseTokens,
    latency_ms: baseBranch.total_latency_ms,
    cost_usd: baseBranch.total_cost_usd,
    citations_count: baseBranch.citations.length,
    verdict: baseBranch.verdict_summary,
  };

  const compareStructuredOutput: Record<string, unknown> = {
    branch_id: compBranch.branch_id,
    model: synthModel,
    ...(promptOverride ? { prompt_override: promptOverride } : {}),
    groundedness: compBranch.groundedness,
    tokens: compTokens,
    latency_ms: compBranch.total_latency_ms,
    cost_usd: compBranch.total_cost_usd,
    citations_count: compBranch.citations.length,
    verdict: compBranch.verdict_summary,
  };

  const diff: BranchDiff = {
    base_branch_id: baseBranch.branch_id,
    compare_branch_id: compBranch.branch_id,
    fork_checkpoint_id: checkpointId,
    latency_delta_ms: latDelta,
    latency_delta_pct: pct(latDelta, baseBranch.total_latency_ms),
    tokens_delta: tokDelta,
    tokens_delta_pct: pct(tokDelta, baseTokens),
    cost_delta_usd: costDelta,
    cost_delta_pct: pct(costDelta, baseBranch.total_cost_usd),
    groundedness_delta: Number((compBranch.groundedness - baseBranch.groundedness).toFixed(2)),
    base_guardrail: baseBranch.guardrail_status,
    compare_guardrail: compBranch.guardrail_status,
    state_changes: stateChanges,
    output_diff: [
      { kind: 'removed', text: baseBranch.verdict_summary },
      { kind: 'added', text: compBranch.verdict_summary },
    ],
    base_model: baseSpanModel,
    compare_model: synthModel,
    prompt_override: promptOverride,
    base_state_snapshot: baseSnapshot,
    compare_state_snapshot: compSnapshot,
    structured_state_diff: structuredStateDiff,
    base_structured_output: baseStructuredOutput,
    compare_structured_output: compareStructuredOutput,
  };

  completedRun.branch_diffs.push(diff);
  return { run: completedRun, diff };
}

export function getLatestNodeCheckpoint(
  run: ControlPlaneRun,
  nodeId: NodeId
): Checkpoint | null {
  const activeBranch = run.branches[run.active_branch_id];
  if (!activeBranch) return null;
  for (let i = activeBranch.checkpoints.length - 1; i >= 0; i -= 1) {
    if (activeBranch.checkpoints[i].node_id === nodeId) {
      return activeBranch.checkpoints[i];
    }
  }
  // Fallback: inspect parent branch (useful after fork)
  if (activeBranch.parent_branch_id && run.branches[activeBranch.parent_branch_id]) {
    const parent = run.branches[activeBranch.parent_branch_id];
    for (let i = parent.checkpoints.length - 1; i >= 0; i -= 1) {
      if (parent.checkpoints[i].node_id === nodeId) {
        return parent.checkpoints[i];
      }
    }
  }
  return null;
}
