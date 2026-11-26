"""Core Pydantic v2 domain models for Verdict Graph."""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class NodeId(str, Enum):
    PLANNER = "supervisor_planner"
    MCP_SCOUT = "mcp_context_scout"
    A2A_SPECIALIST = "a2a_specialist"
    GUARDRAIL = "policy_guardrail"
    HITL_GATE = "hitl_approval_gate"
    SYNTHESIZER = "grounded_synthesizer"


class ScenarioId(str, Enum):
    OUTAGE_ROLLBACK = "outage_rollback"
    PROMPT_INJECTION = "prompt_injection"
    A2A_AUDIT = "a2a_financial_audit"
    TIME_TRAVEL_FORK = "hallucination_fork"


class RunStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    PAUSED_HITL = "paused_hitl"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    REJECTED = "rejected"


class HitlAction(str, Enum):
    APPROVE_ROLLBACK = "approve_rollback"
    MODIFY_CANARY = "modify_canary"
    REJECT_ESCALATE = "reject_escalate"


class GuardrailSeverity(str, Enum):
    PASS = "pass"
    WARN = "warn"
    CRITICAL = "critical"


class GuardrailFinding(BaseModel):
    rule_id: str
    category: Literal["prompt_injection", "data_exfiltration", "pii_leak", "policy_mutation"]
    severity: GuardrailSeverity
    risk_score: float = Field(ge=0.0, le=1.0)
    matched_snippet: str
    mitigation: str


class GuardrailReport(BaseModel):
    passed: bool
    action: Literal["allow", "sanitize_and_reroute", "block"]
    max_risk_score: float = Field(ge=0.0, le=1.0)
    findings: list[GuardrailFinding] = Field(default_factory=list)
    sanitized_text: str
    evaluated_at: str = Field(default_factory=utc_now_iso)


class OTelGenAISpan(BaseModel):
    trace_id: str
    span_id: str
    parent_span_id: str | None = None
    name: str
    node_id: NodeId
    start_ms: float
    duration_ms: float
    status: Literal["OK", "ERROR", "PAUSED"] = "OK"
    attributes: dict[str, Any] = Field(default_factory=dict)


class McpWireEnvelope(BaseModel):
    id: str
    timestamp: str = Field(default_factory=utc_now_iso)
    method: str
    server: str
    rtt_ms: float
    request: dict[str, Any]
    response: dict[str, Any]
    node_id: NodeId = NodeId.MCP_SCOUT


class A2AWireEnvelope(BaseModel):
    id: str
    timestamp: str = Field(default_factory=utc_now_iso)
    operation: Literal["agent_card_discovery", "tasks/send", "tasks/status", "artifact_exchange"]
    peer_agent: str
    rtt_ms: float
    task_id: str | None = None
    state: Literal["discovered", "submitted", "working", "input-required", "completed", "failed"]
    payload: dict[str, Any]


class AgUiEvent(BaseModel):
    id: str
    type: Literal[
        "RUN_STARTED",
        "STEP_STARTED",
        "STEP_FINISHED",
        "TOOL_CALL_START",
        "TOOL_CALL_ARGS",
        "TOOL_CALL_RESULT",
        "STATE_DELTA",
        "INTERRUPT_REQUIRED",
        "TEXT_MESSAGE_CONTENT",
        "RUN_FINISHED",
    ]
    timestamp: str = Field(default_factory=utc_now_iso)
    run_id: str
    branch_id: str
    node_id: NodeId | None = None
    data: dict[str, Any] = Field(default_factory=dict)


class Checkpoint(BaseModel):
    checkpoint_id: str
    run_id: str
    branch_id: str
    parent_checkpoint_id: str | None = None
    step_index: int
    node_id: NodeId
    label: str
    timestamp: str = Field(default_factory=utc_now_iso)
    state_snapshot: dict[str, Any]
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    cost_usd: float = 0.0
    groundedness: float | None = None
    guardrail_status: Literal["pass", "rerouted", "blocked", "pending"] = "pass"


class BranchSummary(BaseModel):
    branch_id: str
    parent_branch_id: str | None = None
    forked_from_checkpoint_id: str | None = None
    status: RunStatus
    total_latency_ms: float
    total_input_tokens: int
    total_output_tokens: int
    total_cost_usd: float
    groundedness: float
    guardrail_status: Literal["pass", "rerouted", "blocked"]
    verdict_summary: str
    checkpoints: list[Checkpoint] = Field(default_factory=list)


class BranchDiff(BaseModel):
    base_branch_id: str
    compare_branch_id: str
    fork_checkpoint_id: str
    latency_delta_ms: float
    latency_delta_pct: float
    tokens_delta: int
    tokens_delta_pct: float
    cost_delta_usd: float
    cost_delta_pct: float
    groundedness_delta: float
    base_guardrail: str
    compare_guardrail: str
    state_changes: list[dict[str, Any]]
    output_diff: list[dict[str, str]]


class HitlDecisionRequest(BaseModel):
    action: HitlAction
    canary_percent: int = Field(default=100, ge=5, le=100)
    operator_note: str = Field(default="Verified via Verdict Graph Control Plane")


class ForkRequest(BaseModel):
    checkpoint_id: str
    branch_name: str | None = None
    state_overrides: dict[str, Any] = Field(default_factory=dict)


class StartRunRequest(BaseModel):
    scenario_id: ScenarioId
    auto_approve_hitl: bool = False


class RunRecord(BaseModel):
    run_id: str
    scenario_id: ScenarioId
    active_branch_id: str = "main"
    status: RunStatus = RunStatus.IDLE
    hitl_context: dict[str, Any] | None = None
    branches: dict[str, BranchSummary] = Field(default_factory=dict)
    mcp_logs: list[McpWireEnvelope] = Field(default_factory=list)
    a2a_logs: list[A2AWireEnvelope] = Field(default_factory=list)
    ag_ui_events: list[AgUiEvent] = Field(default_factory=list)
    otel_spans: list[OTelGenAISpan] = Field(default_factory=list)
    branch_diffs: list[BranchDiff] = Field(default_factory=list)
