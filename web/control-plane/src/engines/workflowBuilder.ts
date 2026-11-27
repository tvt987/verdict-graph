export type WorkflowNodeRole =
  | 'planner'
  | 'rag_retriever'
  | 'sql_sandbox'
  | 'policy_guardrail'
  | 'critic_verifier'
  | 'hitl_gate'
  | 'final_synthesizer';

export type WorkflowModelId =
  | 'gemini-2.5-pro'
  | 'claude-3.7-sonnet'
  | 'gpt-4o'
  | 'vllm-qwen-72b'
  | 'policy-classifier-v3'
  | 'human-operator-gate';

export interface WorkflowModelSpec {
  id: WorkflowModelId;
  label: string;
  provider: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  baseTtftMs: number;
  tokensPerSec: number;
  qualityScore: number;
}

export interface WorkflowRoleMeta {
  role: WorkflowNodeRole;
  code: string;
  label: string;
  labelVi: string;
  protocolBadge: string;
  accentHex: string;
  defaultModel: WorkflowModelId;
  defaultMaxTokens: number;
  defaultTemperature: number;
  defaultRetryBudget: number;
  defaultPromptDirective: string;
  description: string;
}

export interface WorkflowNodeConfig {
  id: string;
  role: WorkflowNodeRole;
  title: string;
  model: WorkflowModelId;
  maxTokens: number;
  temperature: number;
  retryBudget: number;
  promptDirective: string;
}

export interface WorkflowEdge {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  kind: 'forward' | 'feedback';
}

export interface WorkflowTraceStep {
  stepIndex: number;
  nodeId: string;
  role: WorkflowNodeRole;
  title: string;
  model: WorkflowModelId;
  edgeId: string | null;
  status: 'completed' | 'retried' | 'guarded' | 'hitl_verified';
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  ttftMs: number;
  costUsd: number;
  retriesUsed: number;
  groundedness: number;
  outputSummary: string;
  stateDelta: Record<string, string | number | boolean>;
}

export interface WorkflowValidationIssue {
  code: string;
  severity: 'warn' | 'error';
  message: string;
}

export interface WorkflowTraceResult {
  traceId: string;
  prompt: string;
  nodesCount: number;
  steps: WorkflowTraceStep[];
  edges: WorkflowEdge[];
  totalLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgGroundedness: number;
  totalRetries: number;
  guardrailProtected: boolean;
  hitlGated: boolean;
  validationIssues: WorkflowValidationIssue[];
  executedAt: string;
}

export type WorkflowPresetId =
  | 'enterprise_rag_sql'
  | 'zero_trust_audit'
  | 'low_latency_vllm';

export interface WorkflowPreset {
  id: WorkflowPresetId;
  label: string;
  labelVi: string;
  description: string;
  roles: WorkflowNodeRole[];
}

export const WORKFLOW_MODEL_SPECS: Record<WorkflowModelId, WorkflowModelSpec> = {
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'Google Vertex',
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10.0,
    baseTtftMs: 340,
    tokensPerSec: 112,
    qualityScore: 95.4,
  },
  'claude-3.7-sonnet': {
    id: 'claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    provider: 'Anthropic',
    inputUsdPer1M: 3.0,
    outputUsdPer1M: 15.0,
    baseTtftMs: 410,
    tokensPerSec: 88,
    qualityScore: 97.2,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    label: 'GPT-4o',
    provider: 'OpenAI',
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 10.0,
    baseTtftMs: 310,
    tokensPerSec: 104,
    qualityScore: 94.1,
  },
  'vllm-qwen-72b': {
    id: 'vllm-qwen-72b',
    label: 'Local vLLM Qwen-72B',
    provider: 'Self-Hosted GPU',
    inputUsdPer1M: 0.18,
    outputUsdPer1M: 0.42,
    baseTtftMs: 145,
    tokensPerSec: 148,
    qualityScore: 88.6,
  },
  'policy-classifier-v3': {
    id: 'policy-classifier-v3',
    label: 'Policy Classifier v3',
    provider: 'Local ONNX Guard',
    inputUsdPer1M: 0.05,
    outputUsdPer1M: 0.05,
    baseTtftMs: 24,
    tokensPerSec: 650,
    qualityScore: 96.8,
  },
  'human-operator-gate': {
    id: 'human-operator-gate',
    label: 'Human Operator Gate',
    provider: 'RBAC Sign-Off',
    inputUsdPer1M: 0.0,
    outputUsdPer1M: 0.0,
    baseTtftMs: 95,
    tokensPerSec: 1000,
    qualityScore: 99.5,
  },
};

export const WORKFLOW_ROLE_CATALOG: WorkflowRoleMeta[] = [
  {
    role: 'planner',
    code: 'PLN',
    label: 'Planner',
    labelVi: 'Lập Kế Hoạch',
    protocolBadge: 'A2A PLAN',
    accentHex: '#38BDF8',
    defaultModel: 'gemini-2.5-pro',
    defaultMaxTokens: 2048,
    defaultTemperature: 0.2,
    defaultRetryBudget: 2,
    defaultPromptDirective: 'Decompose enterprise intent into typed MCP/SQL steps with strict SLA bounds.',
    description: 'Task decomposition, budget framing, and step routing',
  },
  {
    role: 'rag_retriever',
    code: 'RAG',
    label: 'RAG Retriever',
    labelVi: 'Truy Xuất RAG',
    protocolBadge: 'MCP RAG',
    accentHex: '#0EA5E9',
    defaultModel: 'vllm-qwen-72b',
    defaultMaxTokens: 4096,
    defaultTemperature: 0.0,
    defaultRetryBudget: 2,
    defaultPromptDirective: 'Hybrid BM25 + dense vector search with cross-encoder top_k=8 reranking.',
    description: 'Hybrid semantic retrieval with reranked citation grounding',
  },
  {
    role: 'sql_sandbox',
    code: 'SQL',
    label: 'SQL Sandbox',
    labelVi: 'Hộp Cát SQL',
    protocolBadge: 'MCP SQL',
    accentHex: '#818CF8',
    defaultModel: 'gpt-4o',
    defaultMaxTokens: 1536,
    defaultTemperature: 0.0,
    defaultRetryBudget: 3,
    defaultPromptDirective: 'Generate read-only parameterized SQL validated against read-replica AST whitelist.',
    description: 'Read-only parameterized SQL execution in isolated replica',
  },
  {
    role: 'policy_guardrail',
    code: 'GRD',
    label: 'Policy Guardrail',
    labelVi: 'Lá Chắn Policy',
    protocolBadge: 'OWASP',
    accentHex: '#F43F5E',
    defaultModel: 'policy-classifier-v3',
    defaultMaxTokens: 512,
    defaultTemperature: 0.0,
    defaultRetryBudget: 1,
    defaultPromptDirective: 'Enforce OWASP LLM Top-10 injection, PII redaction, and SQL escape policy gates.',
    description: 'Deterministic injection, PII, and compliance boundary',
  },
  {
    role: 'critic_verifier',
    code: 'CRT',
    label: 'Critic Verifier',
    labelVi: 'Kiểm Chứng Critic',
    protocolBadge: 'VERIFY',
    accentHex: '#A855F7',
    defaultModel: 'claude-3.7-sonnet',
    defaultMaxTokens: 2048,
    defaultTemperature: 0.1,
    defaultRetryBudget: 2,
    defaultPromptDirective: 'Cross-check every numeric claim against retrieved citations; fail unsupported statements.',
    description: 'Self-correction critic loop and hallucination auditor',
  },
  {
    role: 'hitl_gate',
    code: 'HITL',
    label: 'Human-in-the-Loop Gate',
    labelVi: 'Cổng Phê Duyệt HITL',
    protocolBadge: 'RBAC',
    accentHex: '#F59E0B',
    defaultModel: 'human-operator-gate',
    defaultMaxTokens: 512,
    defaultTemperature: 0.0,
    defaultRetryBudget: 0,
    defaultPromptDirective: 'Require cryptographic operator sign-off before production mutation or wire release.',
    description: 'Interruptible RBAC human approval checkpoint',
  },
  {
    role: 'final_synthesizer',
    code: 'SYN',
    label: 'Final Synthesizer',
    labelVi: 'Tổng Hợp Kết Luận',
    protocolBadge: 'AG-UI',
    accentHex: '#10B981',
    defaultModel: 'claude-3.7-sonnet',
    defaultMaxTokens: 4096,
    defaultTemperature: 0.15,
    defaultRetryBudget: 2,
    defaultPromptDirective: 'Emit structured executive verdict with verified inline citations and OTel metrics.',
    description: 'Grounded final response & AG-UI structured artifact',
  },
];

export const WORKFLOW_ROLE_MAP: Record<WorkflowNodeRole, WorkflowRoleMeta> =
  WORKFLOW_ROLE_CATALOG.reduce(
    (acc, item) => {
      acc[item.role] = item;
      return acc;
    },
    {} as Record<WorkflowNodeRole, WorkflowRoleMeta>
  );

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'enterprise_rag_sql',
    label: 'Enterprise RAG + SQL + Critic',
    labelVi: 'RAG + SQL + Critic Doanh Nghiệp',
    description: '6-stage high-precision retrieval, SQL sandbox, OWASP guard, and critic verification',
    roles: [
      'planner',
      'rag_retriever',
      'sql_sandbox',
      'policy_guardrail',
      'critic_verifier',
      'final_synthesizer',
    ],
  },
  {
    id: 'zero_trust_audit',
    label: 'Zero-Trust Full 7-Node Governance',
    labelVi: 'Quản Trị Zero-Trust 7 Node Đầy Đủ',
    description: 'Complete 7-agent chain including Human-in-the-Loop RBAC sign-off before synthesis',
    roles: [
      'planner',
      'rag_retriever',
      'sql_sandbox',
      'policy_guardrail',
      'critic_verifier',
      'hitl_gate',
      'final_synthesizer',
    ],
  },
  {
    id: 'low_latency_vllm',
    label: 'Ultra-Low-Latency Hybrid vLLM',
    labelVi: 'Độ Trễ Siêu Thấp Hybrid vLLM',
    description: 'Fast 4-stage pipeline prioritizing Local vLLM Qwen-72B + OWASP edge guard',
    roles: ['planner', 'rag_retriever', 'policy_guardrail', 'final_synthesizer'],
  },
];

function stableHash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createWorkflowNode(role: WorkflowNodeRole, ordinal: number): WorkflowNodeConfig {
  const meta = WORKFLOW_ROLE_MAP[role];
  return {
    id: `wf-${meta.code.toLowerCase()}-${ordinal}`,
    role,
    title: meta.label,
    model: meta.defaultModel,
    maxTokens: meta.defaultMaxTokens,
    temperature: meta.defaultTemperature,
    retryBudget: meta.defaultRetryBudget,
    promptDirective: meta.defaultPromptDirective,
  };
}

export function createDefaultWorkflow(presetId: WorkflowPresetId = 'enterprise_rag_sql'): WorkflowNodeConfig[] {
  const preset = WORKFLOW_PRESETS.find((p) => p.id === presetId) ?? WORKFLOW_PRESETS[0];
  return preset.roles.map((role, idx) => {
    const node = createWorkflowNode(role, idx + 1);
    if (presetId === 'low_latency_vllm' && (role === 'planner' || role === 'rag_retriever')) {
      node.model = 'vllm-qwen-72b';
    }
    if (presetId === 'low_latency_vllm' && role === 'final_synthesizer') {
      node.model = 'gemini-2.5-pro';
    }
    return node;
  });
}

export function addWorkflowNode(
  nodes: WorkflowNodeConfig[],
  role: WorkflowNodeRole,
  insertAfterId?: string
): WorkflowNodeConfig[] {
  const existingIds = new Set(nodes.map((n) => n.id));
  let seq = nodes.length + 1;
  let candidate = createWorkflowNode(role, seq);
  while (existingIds.has(candidate.id)) {
    seq += 1;
    candidate = createWorkflowNode(role, seq);
  }

  if (!insertAfterId) {
    return [...nodes, candidate];
  }
  const idx = nodes.findIndex((n) => n.id === insertAfterId);
  if (idx === -1) {
    return [...nodes, candidate];
  }
  const next = [...nodes];
  next.splice(idx + 1, 0, candidate);
  return next;
}

export function removeWorkflowNode(
  nodes: WorkflowNodeConfig[],
  nodeId: string
): WorkflowNodeConfig[] {
  if (nodes.length <= 1) return nodes;
  return nodes.filter((n) => n.id !== nodeId);
}

export function reorderWorkflowNode(
  nodes: WorkflowNodeConfig[],
  nodeId: string,
  direction: 'left' | 'right'
): WorkflowNodeConfig[] {
  const idx = nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return nodes;
  const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= nodes.length) return nodes;
  const next = [...nodes];
  const [moved] = next.splice(idx, 1);
  next.splice(targetIdx, 0, moved);
  return next;
}

export function updateWorkflowNode(
  nodes: WorkflowNodeConfig[],
  nodeId: string,
  patch: Partial<Pick<WorkflowNodeConfig, 'title' | 'model' | 'maxTokens' | 'temperature' | 'retryBudget' | 'promptDirective'>>
): WorkflowNodeConfig[] {
  return nodes.map((node) => {
    if (node.id !== nodeId) return node;
    const nextMaxTokens =
      patch.maxTokens !== undefined
        ? Math.max(256, Math.min(32768, Math.round(patch.maxTokens)))
        : node.maxTokens;
    const nextTemp =
      patch.temperature !== undefined
        ? Number(Math.max(0, Math.min(1, patch.temperature)).toFixed(2))
        : node.temperature;
    const nextRetry =
      patch.retryBudget !== undefined
        ? Math.max(0, Math.min(5, Math.round(patch.retryBudget)))
        : node.retryBudget;

    return {
      ...node,
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 48) } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      maxTokens: nextMaxTokens,
      temperature: nextTemp,
      retryBudget: nextRetry,
      ...(patch.promptDirective !== undefined
        ? { promptDirective: patch.promptDirective.slice(0, 320) }
        : {}),
    };
  });
}

export function deriveWorkflowEdges(nodes: WorkflowNodeConfig[]): WorkflowEdge[] {
  const edges: WorkflowEdge[] = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const from = nodes[i];
    const to = nodes[i + 1];
    edges.push({
      id: `wfe-${from.id}-${to.id}`,
      fromId: from.id,
      toId: to.id,
      label: `${WORKFLOW_ROLE_MAP[from.role].code} -> ${WORKFLOW_ROLE_MAP[to.role].code}`,
      kind: 'forward',
    });
  }

  // Add cyclic verification/guardrail feedback arc if Planner precedes Guardrail or Critic
  const planner = nodes.find((n) => n.role === 'planner');
  const critic = nodes.find((n) => n.role === 'critic_verifier');
  const guardrail = nodes.find((n) => n.role === 'policy_guardrail');

  if (planner && critic && nodes.indexOf(critic) > nodes.indexOf(planner)) {
    edges.push({
      id: `wfe-fb-${critic.id}-${planner.id}`,
      fromId: critic.id,
      toId: planner.id,
      label: 'CRITIC REPLAN LOOP',
      kind: 'feedback',
    });
  } else if (planner && guardrail && nodes.indexOf(guardrail) > nodes.indexOf(planner)) {
    edges.push({
      id: `wfe-fb-${guardrail.id}-${planner.id}`,
      fromId: guardrail.id,
      toId: planner.id,
      label: 'POLICY QUARANTINE LOOP',
      kind: 'feedback',
    });
  }

  return edges;
}

export function validateWorkflowDag(nodes: WorkflowNodeConfig[]): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  if (nodes.length === 0) {
    issues.push({
      code: 'DAG-EMPTY',
      severity: 'error',
      message: 'Workflow DAG must contain at least one executable agent node.',
    });
    return issues;
  }

  const guardIdx = nodes.findIndex((n) => n.role === 'policy_guardrail');
  const synthIdx = nodes.findIndex((n) => n.role === 'final_synthesizer');
  const sqlIdx = nodes.findIndex((n) => n.role === 'sql_sandbox');
  const hitlIdx = nodes.findIndex((n) => n.role === 'hitl_gate');

  if (guardIdx === -1) {
    issues.push({
      code: 'SEC-NO-GUARD',
      severity: 'warn',
      message: 'No Policy Guardrail node detected — OWASP LLM Top-10 enforcement is bypassed.',
    });
  } else if (synthIdx !== -1 && guardIdx > synthIdx) {
    issues.push({
      code: 'SEC-LATE-GUARD',
      severity: 'warn',
      message: 'Policy Guardrail runs after Final Synthesizer; move it upstream to prevent unsafe emission.',
    });
  }

  if (sqlIdx !== -1 && hitlIdx === -1 && guardIdx === -1) {
    issues.push({
      code: 'SQL-UNPROTECTED',
      severity: 'warn',
      message: 'SQL Sandbox has neither Policy Guardrail nor HITL Gate in the chain.',
    });
  }

  if (synthIdx === -1) {
    issues.push({
      code: 'OUT-NO-SYNTH',
      severity: 'warn',
      message: 'Add a Final Synthesizer node to emit grounded citations and structured AG-UI verdicts.',
    });
  }

  return issues;
}

function buildRoleOutputSummary(
  node: WorkflowNodeConfig,
  retriesUsed: number,
  groundedness: number
): string {
  switch (node.role) {
    case 'planner':
      return `Decomposed task into typed DAG plan (temp=${node.temperature.toFixed(2)}, max_tok=${node.maxTokens}).`;
    case 'rag_retriever':
      return `Retrieved & reranked 8 high-signal context chunks (relevance 0.96, grounded ${groundedness.toFixed(2)}).`;
    case 'sql_sandbox':
      return retriesUsed > 0
        ? `Recovered AST syntax via retry #${retriesUsed}; executed read-only aggregate on replica (42ms).`
        : 'Validated read-only parameterized SQL AST and fetched verified telemetry slice.';
    case 'policy_guardrail':
      return 'Scanned 14 OWASP LLM Top-10 & PII rules: 0 violations, zero leaked bytes.';
    case 'critic_verifier':
      return `Audited claims against retrieved citations; groundedness boosted to ${groundedness.toFixed(2)}.`;
    case 'hitl_gate':
      return 'Operator RBAC cryptographic approval verified (Ed25519 sign-off logged).';
    case 'final_synthesizer':
      return `Synthesized cited executive verdict via ${WORKFLOW_MODEL_SPECS[node.model].label} (grounded ${groundedness.toFixed(2)}).`;
  }
}

export function simulateWorkflowTrace(
  nodes: WorkflowNodeConfig[],
  prompt = 'Audit Q4 voucher double-spending risk across 712 retail stores and validate rollback SLO.'
): WorkflowTraceResult {
  const edges = deriveWorkflowEdges(nodes);
  const validationIssues = validateWorkflowDag(nodes);
  const hasRag = nodes.some((n) => n.role === 'rag_retriever');
  const hasCritic = nodes.some((n) => n.role === 'critic_verifier');
  const hasGuard = nodes.some((n) => n.role === 'policy_guardrail');
  const hasHitl = nodes.some((n) => n.role === 'hitl_gate');

  const seedStr = `${prompt}|${nodes.map((n) => `${n.id}:${n.model}:${n.maxTokens}:${n.temperature}:${n.retryBudget}`).join(',')}`;
  const traceId = `dag-${stableHash(seedStr).toString(16).padStart(8, '0')}`;

  const steps: WorkflowTraceStep[] = [];
  let runningGroundedness = hasRag ? 0.89 : 0.78;
  let totalLatencyMs = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let totalRetries = 0;

  for (let idx = 0; idx < nodes.length; idx += 1) {
    const node = nodes[idx];
    const spec = WORKFLOW_MODEL_SPECS[node.model];
    const hash = stableHash(`${traceId}:${node.id}:${idx}`);

    // Deterministic token footprint shaped by role & configured maxTokens
    const roleInputBase: Record<WorkflowNodeRole, number> = {
      planner: 740,
      rag_retriever: 1620,
      sql_sandbox: 980,
      policy_guardrail: 860,
      critic_verifier: 1940,
      hitl_gate: 320,
      final_synthesizer: 2180,
    };
    const roleOutputRatio: Record<WorkflowNodeRole, number> = {
      planner: 0.14,
      rag_retriever: 0.11,
      sql_sandbox: 0.18,
      policy_guardrail: 0.14,
      critic_verifier: 0.16,
      hitl_gate: 0.1,
      final_synthesizer: 0.22,
    };

    const inputTokens = roleInputBase[node.role] + (hash % 180);
    const rawOut = Math.round(node.maxTokens * roleOutputRatio[node.role]) + (hash % 64);
    const outputTokens = Math.min(node.maxTokens, Math.max(48, rawOut));

    // Retry simulation when high temperature or SQL sandbox with retry budget available
    const needsRetry =
      node.retryBudget > 0 &&
      (node.temperature >= 0.65 || (node.role === 'sql_sandbox' && node.temperature >= 0.35));
    const retriesUsed = needsRetry ? Math.min(node.retryBudget, 1) : 0;

    // Groundedness evolution across DAG
    const modelQualityBoost = (spec.qualityScore - 88) * 0.005;
    const tempPenalty = node.temperature > 0.5 ? (node.temperature - 0.5) * 0.14 : 0;
    if (node.role === 'rag_retriever') runningGroundedness += 0.04;
    if (node.role === 'policy_guardrail') runningGroundedness += 0.02;
    if (node.role === 'critic_verifier') runningGroundedness += 0.04;
    if (node.role === 'hitl_gate') runningGroundedness += 0.02;
    const stepGroundedness = Number(
      Math.max(0.58, Math.min(0.99, runningGroundedness + modelQualityBoost - tempPenalty)).toFixed(2)
    );
    runningGroundedness = stepGroundedness;

    const genMs = (outputTokens / spec.tokensPerSec) * 1000;
    const retryOverheadMs = retriesUsed * (spec.baseTtftMs * 0.75 + 95);
    const latencyMs = Number((spec.baseTtftMs + genMs * 0.32 + retryOverheadMs).toFixed(1));
    const ttftMs = Number((spec.baseTtftMs * (1 + (hash % 9) * 0.01)).toFixed(1));

    const effectiveIn = inputTokens * (1 + retriesUsed * 0.5);
    const effectiveOut = outputTokens * (1 + retriesUsed * 0.6);
    const costUsd = Number(
      (
        (effectiveIn / 1_000_000) * spec.inputUsdPer1M +
        (effectiveOut / 1_000_000) * spec.outputUsdPer1M
      ).toFixed(6)
    );

    const incomingEdge =
      idx > 0
        ? edges.find((e) => e.fromId === nodes[idx - 1].id && e.toId === node.id)?.id ?? null
        : null;

    const status: WorkflowTraceStep['status'] =
      node.role === 'policy_guardrail'
        ? 'guarded'
        : node.role === 'hitl_gate'
          ? 'hitl_verified'
          : retriesUsed > 0
            ? 'retried'
            : 'completed';

    totalLatencyMs = Number((totalLatencyMs + latencyMs).toFixed(1));
    totalInputTokens += Math.round(effectiveIn);
    totalOutputTokens += Math.round(effectiveOut);
    totalCostUsd = Number((totalCostUsd + costUsd).toFixed(6));
    totalRetries += retriesUsed;

    steps.push({
      stepIndex: idx + 1,
      nodeId: node.id,
      role: node.role,
      title: node.title,
      model: node.model,
      edgeId: incomingEdge,
      status,
      inputTokens: Math.round(effectiveIn),
      outputTokens: Math.round(effectiveOut),
      latencyMs,
      ttftMs,
      costUsd,
      retriesUsed,
      groundedness: stepGroundedness,
      outputSummary: buildRoleOutputSummary(node, retriesUsed, stepGroundedness),
      stateDelta: {
        role: node.role,
        model: node.model,
        retries: retriesUsed,
        groundedness: stepGroundedness,
        critic_verified: hasCritic && idx >= nodes.findIndex((n) => n.role === 'critic_verifier'),
      },
    });
  }

  const avgGroundedness =
    steps.length > 0
      ? Number((steps.reduce((acc, s) => acc + s.groundedness, 0) / steps.length).toFixed(2))
      : 0;

  return {
    traceId,
    prompt,
    nodesCount: nodes.length,
    steps,
    edges,
    totalLatencyMs,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    avgGroundedness,
    totalRetries,
    guardrailProtected: hasGuard,
    hitlGated: hasHitl,
    validationIssues,
    executedAt: new Date().toISOString(),
  };
}
