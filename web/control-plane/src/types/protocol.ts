export type NodeId =
  | 'supervisor_planner'
  | 'mcp_context_scout'
  | 'a2a_specialist'
  | 'policy_guardrail'
  | 'hitl_approval_gate'
  | 'grounded_synthesizer';

export type ScenarioId =
  | 'outage_rollback'
  | 'prompt_injection'
  | 'a2a_financial_audit'
  | 'hallucination_fork';

export type RunStatus =
  | 'idle'
  | 'running'
  | 'paused_hitl'
  | 'completed'
  | 'blocked'
  | 'rejected';

export type HitlAction =
  | 'approve_rollback'
  | 'modify_canary'
  | 'reject_escalate';

export type SpeedMode = '0.5x' | '1x' | '2x' | 'instant';
export type RuntimeMode = 'browser' | 'python' | 'byok';
export type Locale = 'en' | 'vi';
export type WireTab = 'mcp' | 'a2a' | 'agui' | 'otel';

export interface NodeMeta {
  id: NodeId;
  index: string;
  title: string;
  subtitle: string;
  protocolBadge: string;
  x: number;
  y: number;
  accentVar: string;
}

export interface GraphEdgeDef {
  id: string;
  from: NodeId;
  to: NodeId;
  label: string;
  cyclic?: boolean;
  tone?: 'cyan' | 'amber' | 'crimson' | 'emerald';
}

export interface GuardrailFinding {
  rule_id: string;
  category: 'prompt_injection' | 'data_exfiltration' | 'pii_leak' | 'policy_mutation';
  severity: 'pass' | 'warn' | 'critical';
  risk_score: number;
  matched_snippet: string;
  mitigation: string;
}

export interface GuardrailReport {
  passed: boolean;
  action: 'allow' | 'sanitize_and_reroute' | 'block';
  max_risk_score: number;
  findings: GuardrailFinding[];
  sanitized_text: string;
}

export interface McpWireEnvelope {
  id: string;
  timestamp: string;
  method: 'initialize' | 'tools/list' | 'tools/call' | 'resources/read';
  server: string;
  rtt_ms: number;
  branch_id: string;
  node_id: NodeId;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
}

export interface A2AWireEnvelope {
  id: string;
  timestamp: string;
  operation: 'agent_card_discovery' | 'tasks/send' | 'tasks/status' | 'artifact_exchange';
  peer_agent: string;
  rtt_ms: number;
  branch_id: string;
  task_id?: string;
  state: 'discovered' | 'submitted' | 'working' | 'completed' | 'failed';
  payload: Record<string, unknown>;
}

export interface JsonPatchOp {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value?: unknown;
}

export interface AgUiEvent {
  id: string;
  type:
    | 'RUN_STARTED'
    | 'STEP_STARTED'
    | 'STEP_FINISHED'
    | 'TOOL_CALL_START'
    | 'TOOL_CALL_ARGS'
    | 'TOOL_CALL_RESULT'
    | 'STATE_DELTA'
    | 'INTERRUPT_REQUIRED'
    | 'TEXT_MESSAGE_CONTENT'
    | 'RUN_FINISHED';
  timestamp: string;
  run_id: string;
  branch_id: string;
  node_id?: NodeId;
  data: Record<string, unknown>;
}

export interface OTelGenAISpan {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  node_id: NodeId;
  branch_id: string;
  start_ms: number;
  duration_ms: number;
  status: 'OK' | 'ERROR' | 'PAUSED';
  attributes: {
    'gen_ai.operation.name': string;
    'gen_ai.system': string;
    'gen_ai.request.model': string;
    'gen_ai.usage.input_tokens': number;
    'gen_ai.usage.output_tokens': number;
    'gen_ai.usage.total_tokens': number;
    'gen_ai.response.ttft_ms': number;
    'verdict.finops.cost_usd': number;
    [key: string]: unknown;
  };
}

export interface VerdictCitation {
  id: string;
  source: string;
  protocol: 'MCP' | 'A2A' | 'POLICY' | 'HITL';
  excerpt: string;
  verified: boolean;
}

export interface GenerativeWidget {
  kind: 'slo_recovery' | 'security_quarantine' | 'merkle_attestation' | 'grounding_audit';
  title: string;
  metrics: Array<{
    label: string;
    value: string;
    tone: 'cyan' | 'emerald' | 'amber' | 'crimson';
  }>;
  callout: string;
}

export interface Checkpoint {
  checkpoint_id: string;
  run_id: string;
  branch_id: string;
  parent_checkpoint_id: string | null;
  step_index: number;
  node_id: NodeId;
  label: string;
  timestamp: string;
  input_state: Record<string, unknown>;
  state_snapshot: Record<string, unknown>;
  prompt_or_args: Record<string, unknown>;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_usd: number;
  groundedness?: number;
  guardrail_status: 'pass' | 'rerouted' | 'blocked' | 'pending';
  edge_taken?: string;
}

export interface BranchSummary {
  branch_id: string;
  parent_branch_id: string | null;
  forked_from_checkpoint_id: string | null;
  status: RunStatus;
  total_latency_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
  groundedness: number;
  guardrail_status: 'pass' | 'rerouted' | 'blocked';
  verdict_summary: string;
  citations: VerdictCitation[];
  widget: GenerativeWidget | null;
  checkpoints: Checkpoint[];
}

export interface StructuredDiffEntry {
  path: string;
  kind: 'added' | 'removed' | 'changed' | 'unchanged';
  before: unknown;
  after: unknown;
}

export interface BranchDiff {
  base_branch_id: string;
  compare_branch_id: string;
  fork_checkpoint_id: string;
  latency_delta_ms: number;
  latency_delta_pct: number;
  tokens_delta: number;
  tokens_delta_pct: number;
  cost_delta_usd: number;
  cost_delta_pct: number;
  groundedness_delta: number;
  base_guardrail: string;
  compare_guardrail: string;
  state_changes: Array<{ key: string; before: unknown; after: unknown }>;
  output_diff: Array<{ kind: 'removed' | 'added'; text: string }>;
  // v3.0 Alternate Model / Prompt & Side-by-Side Structured State Diff
  base_model?: string;
  compare_model?: string;
  prompt_override?: string;
  base_state_snapshot?: Record<string, unknown>;
  compare_state_snapshot?: Record<string, unknown>;
  structured_state_diff?: StructuredDiffEntry[];
  base_structured_output?: Record<string, unknown>;
  compare_structured_output?: Record<string, unknown>;
}

export interface HitlContext {
  checkpoint_id: string;
  title: string;
  cluster: string;
  proposed_action: string;
  blast_radius: string;
  current_p99_ms: number;
  target_p99_ms: number;
  default_canary_percent: number;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  code: string;
  title: string;
  titleVi: string;
  subtitle: string;
  subtitleVi: string;
  tags: string[];
  accent: 'cyan' | 'crimson' | 'emerald' | 'amber';
  recommendedActionHint: string;
  recommendedActionHintVi: string;
}

export interface ExecutionStepSpec {
  node_id: NodeId;
  from_node?: NodeId;
  edge_id?: string;
  label: string;
  model: string;
  system: string;
  operation: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  groundedness?: number;
  guardrail_status?: 'pass' | 'rerouted' | 'blocked' | 'pending';
  prompt_or_args: Record<string, unknown>;
  state_patch: Record<string, unknown>;
  mcp_envelopes?: Array<Omit<McpWireEnvelope, 'timestamp' | 'branch_id'>>;
  a2a_envelopes?: Array<Omit<A2AWireEnvelope, 'timestamp' | 'branch_id'>>;
  ag_ui_patches?: JsonPatchOp[];
  extra_span_attrs?: Record<string, unknown>;
  pause_for_hitl?: HitlContext;
  verdict_text?: string;
  citations?: VerdictCitation[];
  widget?: GenerativeWidget;
}

export interface ControlPlaneRun {
  run_id: string;
  scenario_id: ScenarioId;
  active_branch_id: string;
  status: RunStatus;
  active_node_id: NodeId | null;
  active_edge_id: string | null;
  visited_nodes: NodeId[];
  visited_edges: string[];
  hitl_context: HitlContext | null;
  branches: Record<string, BranchSummary>;
  mcp_logs: McpWireEnvelope[];
  a2a_logs: A2AWireEnvelope[];
  ag_ui_events: AgUiEvent[];
  otel_spans: OTelGenAISpan[];
  branch_diffs: BranchDiff[];
  pending_steps: ExecutionStepSpec[];
  total_planned_steps: number;
}
