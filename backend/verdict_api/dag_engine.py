"""Core DAG Validation, Budget Circuit Breaker, OWASP LLM01-LLM10 Prompt Firewall, and FinOps Pareto Router."""

from __future__ import annotations

import hashlib
import math
import re
from collections import deque
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field


# ============================================================================
# Domain Exceptions
# ============================================================================


class DagValidationError(ValueError):
    """Base error raised when a submitted workflow graph violates DAG invariants."""

    def __init__(self, code: str, message: str, cycle_nodes: list[str] | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.cycle_nodes = cycle_nodes or []


class CyclicDagError(DagValidationError):
    """Raised when a cycle is detected during topological validation."""

    def __init__(self, cycle_nodes: list[str]) -> None:
        cycle_repr = " -> ".join(cycle_nodes)
        super().__init__(
            code="DAG_CYCLE_DETECTED",
            message=f"Cyclic dependency detected in workflow DAG: {cycle_repr}",
            cycle_nodes=cycle_nodes,
        )


# ============================================================================
# Model Pricing & Telemetry Catalog
# ============================================================================


@dataclass(frozen=True)
class ModelSpec:
    model_id: str
    label: str
    provider: str
    tier: Literal["frontier", "flash", "local_gpu", "guard"]
    input_usd_per_1m: float
    output_usd_per_1m: float
    ttft_ms: float
    p95_latency_ms: float
    tokens_per_sec: float
    quality_index: float
    context_window: int


MODEL_CATALOG: dict[str, ModelSpec] = {
    "claude-3.7-sonnet": ModelSpec(
        model_id="claude-3.7-sonnet",
        label="Claude 3.7 Sonnet",
        provider="Anthropic",
        tier="frontier",
        input_usd_per_1m=3.00,
        output_usd_per_1m=15.00,
        ttft_ms=410.0,
        p95_latency_ms=920.0,
        tokens_per_sec=88.0,
        quality_index=97.4,
        context_window=200_000,
    ),
    "gemini-2.5-pro": ModelSpec(
        model_id="gemini-2.5-pro",
        label="Gemini 2.5 Pro",
        provider="Google Vertex",
        tier="frontier",
        input_usd_per_1m=1.25,
        output_usd_per_1m=10.00,
        ttft_ms=325.0,
        p95_latency_ms=740.0,
        tokens_per_sec=112.0,
        quality_index=96.1,
        context_window=2_000_000,
    ),
    "gpt-4o": ModelSpec(
        model_id="gpt-4o",
        label="GPT-4o",
        provider="OpenAI",
        tier="frontier",
        input_usd_per_1m=2.50,
        output_usd_per_1m=10.00,
        ttft_ms=310.0,
        p95_latency_ms=690.0,
        tokens_per_sec=104.0,
        quality_index=94.2,
        context_window=128_000,
    ),
    "gemini-2.5-flash": ModelSpec(
        model_id="gemini-2.5-flash",
        label="Gemini 2.5 Flash",
        provider="Google Vertex",
        tier="flash",
        input_usd_per_1m=0.15,
        output_usd_per_1m=0.60,
        ttft_ms=135.0,
        p95_latency_ms=290.0,
        tokens_per_sec=195.0,
        quality_index=90.8,
        context_window=1_000_000,
    ),
    "vllm-qwen-72b": ModelSpec(
        model_id="vllm-qwen-72b",
        label="Local vLLM Qwen-72B",
        provider="Self-Hosted H100",
        tier="local_gpu",
        input_usd_per_1m=0.18,
        output_usd_per_1m=0.42,
        ttft_ms=142.0,
        p95_latency_ms=315.0,
        tokens_per_sec=148.0,
        quality_index=88.9,
        context_window=128_000,
    ),
    "policy-classifier-v3": ModelSpec(
        model_id="policy-classifier-v3",
        label="Policy Classifier v3",
        provider="Local ONNX Guard",
        tier="guard",
        input_usd_per_1m=0.05,
        output_usd_per_1m=0.05,
        ttft_ms=22.0,
        p95_latency_ms=48.0,
        tokens_per_sec=650.0,
        quality_index=96.8,
        context_window=32_000,
    ),
}


def compute_token_cost_usd(spec: ModelSpec, input_tokens: int, output_tokens: int) -> float:
    return round(
        (input_tokens / 1_000_000.0) * spec.input_usd_per_1m
        + (output_tokens / 1_000_000.0) * spec.output_usd_per_1m,
        6,
    )


def compute_node_latency_ms(spec: ModelSpec, output_tokens: int) -> tuple[float, float]:
    gen_ms = (output_tokens / max(1.0, spec.tokens_per_sec)) * 1000.0
    mean_ms = round(spec.ttft_ms + gen_ms * 0.30, 1)
    p95_ms = round(max(mean_ms * 1.18, spec.p95_latency_ms * 0.65 + gen_ms * 0.35), 1)
    return mean_ms, p95_ms


# ============================================================================
# OWASP LLM01-LLM10 Prompt Firewall Engine
# ============================================================================

OwaspId = Literal[
    "LLM01",
    "LLM02",
    "LLM03",
    "LLM04",
    "LLM05",
    "LLM06",
    "LLM07",
    "LLM08",
    "LLM09",
    "LLM10",
]

FirewallSeverity = Literal["SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
FirewallDecision = Literal["ALLOW", "SANITIZE_WARN", "BLOCK"]


@dataclass(frozen=True)
class OwaspRule:
    owasp_id: OwaspId
    category: str
    rule_id: str
    vector_label: str
    severity: Literal["MEDIUM", "HIGH", "CRITICAL"]
    weight: int
    pattern: re.Pattern[str]
    remediation: str


OWASP_FIREWALL_RULES: tuple[OwaspRule, ...] = (
    OwaspRule(
        owasp_id="LLM01",
        category="LLM01:2025 Prompt Injection & Jailbreak Roleplay",
        rule_id="FW-LLM01-JAILBREAK",
        vector_label="Direct Prompt Injection / Jailbreak Roleplay",
        severity="CRITICAL",
        weight=46,
        pattern=re.compile(
            r"(ignore\s+(all\s+)?(previous|prior)\s+instructions"
            r"|disregard\s+(the\s+)?system\s+prompt"
            r"|enter\s+unrestricted\s+developer\s+mode"
            r"|disable\s+(all\s+)?(policy\s+)?guardrails?"
            r"|you\s+are\s+now\s+dan\b"
            r"|do\s+anything\s+now"
            r"|pretend\s+you\s+have\s+no\s+(safety|ethical)\s+(rules|limits)"
            r"|\[system\s+override\])",
            re.IGNORECASE,
        ),
        remediation="Quarantine untrusted instruction override and lock planner context to read-only user role.",
    ),
    OwaspRule(
        owasp_id="LLM02",
        category="LLM02:2025 Sensitive Information & PII Exfiltration",
        rule_id="FW-LLM02-PII-EXFIL",
        vector_label="PII / Credential Secret Exfiltration",
        severity="CRITICAL",
        weight=44,
        pattern=re.compile(
            r"(\b\d{3}-\d{2}-\d{4}\b"
            r"|\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6011)[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{3,4}\b"
            r"|sk-[a-zA-Z0-9]{16,}"
            r"|ghp_[a-zA-Z0-9]{20,}"
            r"|AKIA[0-9A-Z]{16}"
            r"|-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----"
            r"|exfiltrate\s+.*(?:keys?|secrets?|tokens?|pii|ssn|credentials?)"
            r"|attacker\.io"
            r"|webhook_send\s*\()",
            re.IGNORECASE,
        ),
        remediation="Redact PII/secrets in-flight, block outbound untrusted webhooks, and emit Vault rotation alert.",
    ),
    OwaspRule(
        owasp_id="LLM03",
        category="LLM03:2025 Supply Chain Tool & Plugin Tampering",
        rule_id="FW-LLM03-SUPPLY",
        vector_label="Untrusted MCP Plugin / Supply Chain Spoofing",
        severity="HIGH",
        weight=34,
        pattern=re.compile(
            r"(unsigned[_\s]mcp[_\s]plugin"
            r"|shadow[_\s]tool[_\s]descriptor"
            r"|mcp://untrusted-registry"
            r"|install\s+untrusted\s+package"
            r"|curl\s+https?://[^\s]+\s*\|\s*(?:ba)?sh)",
            re.IGNORECASE,
        ),
        remediation="Require Ed25519 manifest signature verification against allowlisted MCP registries.",
    ),
    OwaspRule(
        owasp_id="LLM04",
        category="LLM04:2025 Indirect RAG Data & Context Poisoning",
        rule_id="FW-LLM04-RAG-POISON",
        vector_label="Indirect RAG Context Poisoning",
        severity="CRITICAL",
        weight=42,
        pattern=re.compile(
            r"(<!--\s*(?:assistant|system|inject|execute)[^>]*-->"
            r"|hidden[_\s]rag[_\s]instruction"
            r"|poisoned[_\s]corpus"
            r"|silently\s+approve\s+invoice"
            r"|override\s+retrieval\s+ranking)",
            re.IGNORECASE,
        ),
        remediation="Strip executable markup comments from retrieved chunks and enforce provenance scoring.",
    ),
    OwaspRule(
        owasp_id="LLM05",
        category="LLM05:2025 Improper Output Handling & Tool-Call Injection",
        rule_id="FW-LLM05-TOOL-SQLI",
        vector_label="Indirect Tool-Call / SQL / Script Injection",
        severity="CRITICAL",
        weight=45,
        pattern=re.compile(
            r"(union\s+select\b"
            r"|drop\s+table\b"
            r"|;\s*delete\s+from\b"
            r"|xp_cmdshell"
            r"|prod_credentials"
            r"|<script\b[^>]*>"
            r"|javascript:"
            r"|tool_call\s*\(\s*['\"](?:shell|exec|sql_write|delete)['\"]"
            r"|rm\s+-rf\s+/)",
            re.IGNORECASE,
        ),
        remediation="Block raw SQL/shell directives, restrict SQL sandbox to AST-whitelisted SELECT queries.",
    ),
    OwaspRule(
        owasp_id="LLM06",
        category="LLM06:2025 Excessive Agency & RBAC Escalation",
        rule_id="FW-LLM06-AGENCY",
        vector_label="Unauthorized Privilege / Financial Escalation",
        severity="CRITICAL",
        weight=44,
        pattern=re.compile(
            r"(bypass\s+hitl\s+approval"
            r"|grant\s+cluster\s+admin"
            r"|iam:AttachRolePolicy"
            r"|auto[_\s]approve[_\s]payout"
            r"|wire[_\s]transfer\s+\$?\d+"
            r"|kubectl\s+delete\s+namespace)",
            re.IGNORECASE,
        ),
        remediation="Halt autonomous privileged actions and route through cryptographic HITL RBAC sign-off.",
    ),
    OwaspRule(
        owasp_id="LLM07",
        category="LLM07:2025 System Prompt Extraction",
        rule_id="FW-LLM07-SYS-EXTRACT",
        vector_label="System Prompt & Policy Schema Extraction",
        severity="HIGH",
        weight=38,
        pattern=re.compile(
            r"(print\s+(?:your\s+)?(?:full\s+)?system\s+prompt"
            r"|reveal\s+(?:your\s+)?(?:hidden\s+|initial\s+)?(?:system\s+)?(?:prompt|instructions)"
            r"|dump\s+hidden\s+policy\s+rules"
            r"|verbatim\s+developer\s+instructions"
            r"|repeat\s+everything\s+above\s+this\s+line"
            r"|output\s+your\s+hidden\s+system\s+instructions)",
            re.IGNORECASE,
        ),
        remediation="Reject meta-prompt reflection queries and never serialize internal system directives.",
    ),
    OwaspRule(
        owasp_id="LLM08",
        category="LLM08:2025 Vector & Embedding Cross-Tenant Bleed",
        rule_id="FW-LLM08-VECTOR-BLEED",
        vector_label="Cross-Tenant Vector Namespace Isolation Breach",
        severity="HIGH",
        weight=36,
        pattern=re.compile(
            r"(namespace\s*=\s*['\"]?\*['\"]?"
            r"|cross[_\s]tenant[_\s]embeddings"
            r"|bypass[_\s]tenant[_\s]acl"
            r"|dump\s+all\s+customer\s+vectors)",
            re.IGNORECASE,
        ),
        remediation="Inject mandatory signed tenant_id filter predicate at the vector database gateway.",
    ),
    OwaspRule(
        owasp_id="LLM09",
        category="LLM09:2025 Misinformation & Fabricated Citation Bait",
        rule_id="FW-LLM09-HALLUC-BAIT",
        vector_label="Forced Citation Fabrication / Misinformation",
        severity="MEDIUM",
        weight=28,
        pattern=re.compile(
            r"(fabricate\s+audit\s+citations"
            r"|invent\s+sec\s+filing"
            r"|fake\s+soc2\s+certificate"
            r"|bypass\s+citation\s+grounding)",
            re.IGNORECASE,
        ),
        remediation="Enforce strict groundedness threshold (>= 0.95) and verify every citation against MCP sources.",
    ),
    OwaspRule(
        owasp_id="LLM10",
        category="LLM10:2025 Token Exhaustion DoS & Unbounded Consumption",
        rule_id="FW-LLM10-TOKEN-DOS",
        vector_label="Token Exhaustion / Recursive Fan-Out DoS",
        severity="CRITICAL",
        weight=42,
        pattern=re.compile(
            r"(while\s+true"
            r"|recursively\s+spawn"
            r"|infinite\s+loop"
            r"|bypass\s+(?:finops\s+)?budget(?:\s+cap)?"
            r"|exhaust\s+(?:token\s+)?quota"
            r"|max_tokens\s*=\s*\d{5,}"
            r"|repeat\s+\d{4,}\s+times"
            r"|spawn\s+\d{2,}\s+.*agent)",
            re.IGNORECASE,
        ),
        remediation="Enforce hard token/USD circuit breaker caps and cap agent recursion depth (max_cycles=3).",
    ),
)

ALL_OWASP_IDS: tuple[OwaspId, ...] = (
    "LLM01",
    "LLM02",
    "LLM03",
    "LLM04",
    "LLM05",
    "LLM06",
    "LLM07",
    "LLM08",
    "LLM09",
    "LLM10",
)


class FirewallScanRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=64_000)
    block_threshold: int = Field(default=35, ge=10, le=95)
    max_prompt_tokens: int = Field(default=2048, ge=128, le=32_768)


class FirewallFinding(BaseModel):
    owasp_id: OwaspId
    category: str
    rule_id: str
    vector_label: str
    severity: Literal["MEDIUM", "HIGH", "CRITICAL"]
    weight: int
    start: int
    end: int
    matched_text: str
    remediation: str


class FirewallScanResponse(BaseModel):
    decision: FirewallDecision
    risk_score: int
    severity: FirewallSeverity
    findings: list[FirewallFinding]
    sanitized_prompt: str
    owasp_matrix: dict[str, Literal["CLEAN", "FLAGGED"]]
    estimated_tokens: int
    scan_latency_ms: float


def estimate_tokens(text: str) -> int:
    if not text.strip():
        return 0
    return max(1, math.ceil(len(text) / 3.8))


def _has_excessive_repetition(prompt: str) -> bool:
    tokens = re.findall(r"\S+", prompt.lower())
    if len(tokens) < 40:
        return False
    unique_ratio = len(set(tokens)) / len(tokens)
    return unique_ratio < 0.12


def scan_prompt_owasp(req: FirewallScanRequest) -> FirewallScanResponse:
    prompt = req.prompt
    est_tokens = estimate_tokens(prompt)
    findings: list[FirewallFinding] = []
    spans_to_redact: list[tuple[int, int, str]] = []

    for rule in OWASP_FIREWALL_RULES:
        for match in rule.pattern.finditer(prompt):
            findings.append(
                FirewallFinding(
                    owasp_id=rule.owasp_id,
                    category=rule.category,
                    rule_id=rule.rule_id,
                    vector_label=rule.vector_label,
                    severity=rule.severity,
                    weight=rule.weight,
                    start=match.start(),
                    end=match.end(),
                    matched_text=match.group(0)[:120],
                    remediation=rule.remediation,
                )
            )
            spans_to_redact.append((match.start(), match.end(), f"[BLOCKED:{rule.owasp_id}]"))

    # Structural LLM10 check: token flood / repetitive padding DoS
    if est_tokens > req.max_prompt_tokens or _has_excessive_repetition(prompt):
        findings.append(
            FirewallFinding(
                owasp_id="LLM10",
                category="LLM10:2025 Token Exhaustion DoS & Unbounded Consumption",
                rule_id="FW-LLM10-STRUCTURAL-FLOOD",
                vector_label="Structural Token Flood / Repetitive Prompt Padding DoS",
                severity="CRITICAL",
                weight=45,
                start=0,
                end=min(len(prompt), 80),
                matched_text=f"estimated_tokens={est_tokens} (cap={req.max_prompt_tokens})",
                remediation="Reject oversized or low-entropy repetitive payloads before LLM invocation.",
            )
        )

    # Deduplicate overlapping spans for deterministic sanitized output
    spans_to_redact.sort(key=lambda s: (s[0], -(s[1] - s[0])))
    merged_spans: list[tuple[int, int, str]] = []
    for start, end, tag in spans_to_redact:
        if not merged_spans or start >= merged_spans[-1][1]:
            merged_spans.append((start, end, tag))

    sanitized_parts: list[str] = []
    cursor = 0
    for start, end, tag in merged_spans:
        sanitized_parts.append(prompt[cursor:start])
        sanitized_parts.append(tag)
        cursor = end
    sanitized_parts.append(prompt[cursor:])
    sanitized_prompt = "".join(sanitized_parts)

    # Risk score: combine unique rule weights capped at 100
    seen_rules: set[str] = set()
    raw_score = 0
    for finding in findings:
        if finding.rule_id not in seen_rules:
            seen_rules.add(finding.rule_id)
            raw_score += finding.weight
        else:
            raw_score += 6
    risk_score = min(100, raw_score)

    if risk_score == 0:
        severity: FirewallSeverity = "SAFE"
        decision: FirewallDecision = "ALLOW"
    elif risk_score < req.block_threshold:
        severity = "LOW" if risk_score < 20 else "MEDIUM"
        decision = "SANITIZE_WARN"
    else:
        severity = "CRITICAL" if risk_score >= 60 or any(f.severity == "CRITICAL" for f in findings) else "HIGH"
        decision = "BLOCK"

    flagged_ids = {f.owasp_id for f in findings}
    owasp_matrix: dict[str, Literal["CLEAN", "FLAGGED"]] = {
        oid: ("FLAGGED" if oid in flagged_ids else "CLEAN") for oid in ALL_OWASP_IDS
    }

    digest_byte = hashlib.sha256(prompt.encode("utf-8")).digest()[0]
    scan_latency_ms = round(4.2 + (digest_byte % 50) / 10.0 + len(findings) * 1.1, 1)

    return FirewallScanResponse(
        decision=decision,
        risk_score=risk_score,
        severity=severity,
        findings=findings,
        sanitized_prompt=sanitized_prompt,
        owasp_matrix=owasp_matrix,
        estimated_tokens=est_tokens,
        scan_latency_ms=scan_latency_ms,
    )


# ============================================================================
# DAG Topological Sort, Cycle Detection & Budget Circuit Breaker Simulator
# ============================================================================

BreakerMode = Literal["HARD_STOP", "DOWNGRADE_MODEL"]
BreakerState = Literal["CLOSED", "DOWNGRADED_FLASH", "TRIPPED_HARD_STOP"]
NodeExecStatus = Literal[
    "COMPLETED",
    "DOWNGRADED",
    "HALTED_BUDGET",
    "SKIPPED_CIRCUIT_OPEN",
    "BLOCKED_FIREWALL",
]


class DagNodeSpec(BaseModel):
    id: str = Field(..., min_length=1, max_length=64)
    role: str = Field(default="agent", min_length=1, max_length=64)
    model: str = Field(default="claude-3.7-sonnet")
    estimated_input_tokens: int = Field(default=1400, ge=1, le=250_000)
    estimated_output_tokens: int = Field(default=380, ge=1, le=64_000)
    prompt_snippet: str = Field(default="")


class DagEdgeSpec(BaseModel):
    source: str = Field(..., min_length=1, max_length=64)
    target: str = Field(..., min_length=1, max_length=64)


class BudgetCircuitBreakerConfig(BaseModel):
    max_tokens: int = Field(default=12_000, ge=256, le=2_000_000)
    max_usd: float = Field(default=0.05, gt=0.0, le=100.0)
    soft_threshold_ratio: float = Field(default=0.70, ge=0.10, le=0.98)
    mode: BreakerMode = Field(default="DOWNGRADE_MODEL")
    fallback_model: str = Field(default="gemini-2.5-flash")


class DagRunRequest(BaseModel):
    nodes: list[DagNodeSpec] = Field(..., min_length=1, max_length=64)
    edges: list[DagEdgeSpec] = Field(default_factory=list)
    budget: BudgetCircuitBreakerConfig = Field(default_factory=BudgetCircuitBreakerConfig)
    enable_firewall: bool = Field(default=True)


class DagNodeTrace(BaseModel):
    step_index: int
    node_id: str
    role: str
    dag_level: int
    requested_model: str
    executed_model: str
    status: NodeExecStatus
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cumulative_tokens: int
    node_cost_usd: float
    cumulative_cost_usd: float
    latency_ms: float
    p95_latency_ms: float
    cumulative_p95_ms: float
    note: str


class CircuitBreakerSummary(BaseModel):
    mode: BreakerMode
    state: BreakerState
    tripped: bool
    tripped_at_node_id: str | None
    trip_reason: str | None
    fallback_model: str
    token_utilization_pct: float
    usd_utilization_pct: float
    usd_saved_vs_frontier: float


class DagRunResponse(BaseModel):
    trace_id: str
    acyclic: bool
    topological_order: list[str]
    dag_levels: dict[str, int]
    node_traces: list[DagNodeTrace]
    total_tokens: int
    total_cost_usd: float
    baseline_frontier_cost_usd: float
    total_latency_ms: float
    critical_path_p95_ms: float
    circuit_breaker: CircuitBreakerSummary
    firewall_blocked_nodes: list[str]


def _find_cycle_path(node_ids: list[str], adj: dict[str, list[str]]) -> list[str]:
    state: dict[str, int] = {nid: 0 for nid in node_ids}  # 0=unvisited, 1=visiting, 2=done
    parent: dict[str, str | None] = {nid: None for nid in node_ids}

    def dfs(u: str) -> list[str] | None:
        state[u] = 1
        for v in adj[u]:
            if state[v] == 1:
                cycle = [v]
                cur: str | None = u
                while cur is not None and cur != v:
                    cycle.append(cur)
                    cur = parent[cur]
                cycle.append(v)
                cycle.reverse()
                return cycle
            if state[v] == 0:
                parent[v] = u
                found = dfs(v)
                if found:
                    return found
        state[u] = 2
        return None

    for nid in node_ids:
        if state[nid] == 0:
            found = dfs(nid)
            if found:
                return found
    return []


def topological_sort_dag(
    nodes: list[DagNodeSpec], edges: list[DagEdgeSpec]
) -> tuple[list[str], dict[str, int]]:
    """Validate acyclicity and compute deterministic Kahn topological order + parallel DAG levels."""
    node_ids: list[str] = []
    seen: set[str] = set()
    for node in nodes:
        if node.id in seen:
            raise DagValidationError("DUPLICATE_NODE_ID", f"Duplicate node id '{node.id}' in workflow DAG.")
        seen.add(node.id)
        node_ids.append(node.id)

    adj: dict[str, list[str]] = {nid: [] for nid in node_ids}
    indegree: dict[str, int] = {nid: 0 for nid in node_ids}

    for edge in edges:
        if edge.source not in seen:
            raise DagValidationError(
                "INVALID_DAG_EDGE",
                f"Edge references unknown source node '{edge.source}'.",
            )
        if edge.target not in seen:
            raise DagValidationError(
                "INVALID_DAG_EDGE",
                f"Edge references unknown target node '{edge.target}'.",
            )
        if edge.source == edge.target:
            raise CyclicDagError([edge.source, edge.target])
        adj[edge.source].append(edge.target)
        indegree[edge.target] += 1

    queue: deque[str] = deque([nid for nid in node_ids if indegree[nid] == 0])
    levels: dict[str, int] = {nid: 0 for nid in queue}
    order: list[str] = []

    while queue:
        current = queue.popleft()
        order.append(current)
        for nxt in adj[current]:
            levels[nxt] = max(levels.get(nxt, 0), levels[current] + 1)
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)

    if len(order) != len(node_ids):
        cycle_path = _find_cycle_path(node_ids, adj)
        raise CyclicDagError(cycle_path or [nid for nid in node_ids if indegree[nid] > 0])

    return order, levels


def validate_and_run_dag(req: DagRunRequest) -> DagRunResponse:
    topo_order, levels = topological_sort_dag(req.nodes, req.edges)
    node_map = {n.id: n for n in req.nodes}

    fallback_spec = MODEL_CATALOG.get(req.budget.fallback_model, MODEL_CATALOG["gemini-2.5-flash"])

    # Compute baseline unguarded cost across requested models
    baseline_frontier_cost_usd = round(
        sum(
            compute_token_cost_usd(
                MODEL_CATALOG.get(node_map[nid].model, MODEL_CATALOG["claude-3.7-sonnet"]),
                node_map[nid].estimated_input_tokens,
                node_map[nid].estimated_output_tokens,
            )
            for nid in topo_order
        ),
        6,
    )

    traces: list[DagNodeTrace] = []
    firewall_blocked_nodes: list[str] = []

    cum_tokens = 0
    cum_cost_usd = 0.0
    cum_p95_ms = 0.0
    total_latency_ms = 0.0
    level_max_p95: dict[int, float] = {}

    breaker_state: BreakerState = "CLOSED"
    tripped_at_node_id: str | None = None
    trip_reason: str | None = None
    circuit_open = False
    downgraded = False

    for idx, nid in enumerate(topo_order, start=1):
        node = node_map[nid]
        req_spec = MODEL_CATALOG.get(node.model, MODEL_CATALOG["claude-3.7-sonnet"])
        node_tokens = node.estimated_input_tokens + node.estimated_output_tokens
        lvl = levels[nid]

        if circuit_open:
            traces.append(
                DagNodeTrace(
                    step_index=idx,
                    node_id=nid,
                    role=node.role,
                    dag_level=lvl,
                    requested_model=req_spec.model_id,
                    executed_model=req_spec.model_id,
                    status="SKIPPED_CIRCUIT_OPEN",
                    input_tokens=0,
                    output_tokens=0,
                    total_tokens=0,
                    cumulative_tokens=cum_tokens,
                    node_cost_usd=0.0,
                    cumulative_cost_usd=round(cum_cost_usd, 6),
                    latency_ms=0.0,
                    p95_latency_ms=0.0,
                    cumulative_p95_ms=round(cum_p95_ms, 1),
                    note="Skipped because Token/USD Budget Circuit Breaker is OPEN.",
                )
            )
            continue

        # Optional per-node prompt firewall check
        if req.enable_firewall and node.prompt_snippet.strip():
            fw = scan_prompt_owasp(FirewallScanRequest(prompt=node.prompt_snippet))
            if fw.decision == "BLOCK":
                firewall_blocked_nodes.append(nid)
                traces.append(
                    DagNodeTrace(
                        step_index=idx,
                        node_id=nid,
                        role=node.role,
                        dag_level=lvl,
                        requested_model=req_spec.model_id,
                        executed_model="policy-classifier-v3",
                        status="BLOCKED_FIREWALL",
                        input_tokens=fw.estimated_tokens,
                        output_tokens=0,
                        total_tokens=fw.estimated_tokens,
                        cumulative_tokens=cum_tokens + fw.estimated_tokens,
                        node_cost_usd=0.0,
                        cumulative_cost_usd=round(cum_cost_usd, 6),
                        latency_ms=fw.scan_latency_ms,
                        p95_latency_ms=fw.scan_latency_ms,
                        cumulative_p95_ms=round(cum_p95_ms + fw.scan_latency_ms, 1),
                        note=f"Blocked by OWASP Prompt Firewall (risk={fw.risk_score}, rules={','.join(f.owasp_id for f in fw.findings)}).",
                    )
                )
                cum_tokens += fw.estimated_tokens
                cum_p95_ms = round(cum_p95_ms + fw.scan_latency_ms, 1)
                total_latency_ms = round(total_latency_ms + fw.scan_latency_ms, 1)
                level_max_p95[lvl] = max(level_max_p95.get(lvl, 0.0), fw.scan_latency_ms)
                continue

        active_spec = fallback_spec if downgraded else req_spec
        projected_cost = compute_token_cost_usd(active_spec, node.estimated_input_tokens, node.estimated_output_tokens)
        projected_tokens = cum_tokens + node_tokens
        projected_usd = round(cum_cost_usd + projected_cost, 6)

        soft_token_limit = req.budget.max_tokens * req.budget.soft_threshold_ratio
        soft_usd_limit = req.budget.max_usd * req.budget.soft_threshold_ratio

        if req.budget.mode == "HARD_STOP":
            if projected_tokens > req.budget.max_tokens or projected_usd > req.budget.max_usd:
                breaker_state = "TRIPPED_HARD_STOP"
                circuit_open = True
                tripped_at_node_id = nid
                reason_parts: list[str] = []
                if projected_tokens > req.budget.max_tokens:
                    reason_parts.append(
                        f"projected tokens {projected_tokens} > cap {req.budget.max_tokens}"
                    )
                if projected_usd > req.budget.max_usd:
                    reason_parts.append(
                        f"projected USD ${projected_usd:.5f} > cap ${req.budget.max_usd:.5f}"
                    )
                trip_reason = "HARD_STOP tripped: " + "; ".join(reason_parts)
                traces.append(
                    DagNodeTrace(
                        step_index=idx,
                        node_id=nid,
                        role=node.role,
                        dag_level=lvl,
                        requested_model=req_spec.model_id,
                        executed_model=req_spec.model_id,
                        status="HALTED_BUDGET",
                        input_tokens=0,
                        output_tokens=0,
                        total_tokens=0,
                        cumulative_tokens=cum_tokens,
                        node_cost_usd=0.0,
                        cumulative_cost_usd=round(cum_cost_usd, 6),
                        latency_ms=0.0,
                        p95_latency_ms=0.0,
                        cumulative_p95_ms=round(cum_p95_ms, 1),
                        note=trip_reason,
                    )
                )
                continue
        else:
            # DOWNGRADE_MODEL mode: switch Frontier -> Flash when approaching soft cap or exceeding hard cap
            approaching_cap = (
                projected_tokens >= soft_token_limit
                or projected_usd >= soft_usd_limit
                or projected_usd > req.budget.max_usd
            )
            if not downgraded and approaching_cap and active_spec.model_id != fallback_spec.model_id:
                downgraded = True
                breaker_state = "DOWNGRADED_FLASH"
                tripped_at_node_id = nid
                trip_reason = (
                    f"Budget approaching cap at node '{nid}': downgraded {active_spec.model_id} -> {fallback_spec.model_id}."
                )
                active_spec = fallback_spec
                projected_cost = compute_token_cost_usd(
                    active_spec, node.estimated_input_tokens, node.estimated_output_tokens
                )
                projected_usd = round(cum_cost_usd + projected_cost, 6)

            # Ultimate hard safety guard if even fallback exceeds absolute token or USD ceiling by >100%
            if projected_tokens > req.budget.max_tokens or projected_usd > req.budget.max_usd:
                breaker_state = "TRIPPED_HARD_STOP"
                circuit_open = True
                tripped_at_node_id = tripped_at_node_id or nid
                trip_reason = (
                    f"Hard ceiling breached even after fallback ({projected_tokens} tok / ${projected_usd:.5f})."
                )
                traces.append(
                    DagNodeTrace(
                        step_index=idx,
                        node_id=nid,
                        role=node.role,
                        dag_level=lvl,
                        requested_model=req_spec.model_id,
                        executed_model=active_spec.model_id,
                        status="HALTED_BUDGET",
                        input_tokens=0,
                        output_tokens=0,
                        total_tokens=0,
                        cumulative_tokens=cum_tokens,
                        node_cost_usd=0.0,
                        cumulative_cost_usd=round(cum_cost_usd, 6),
                        latency_ms=0.0,
                        p95_latency_ms=0.0,
                        cumulative_p95_ms=round(cum_p95_ms, 1),
                        note=trip_reason,
                    )
                )
                continue

        # Execute node cleanly
        mean_ms, p95_ms = compute_node_latency_ms(active_spec, node.estimated_output_tokens)
        cum_tokens += node_tokens
        cum_cost_usd = round(cum_cost_usd + projected_cost, 6)
        cum_p95_ms = round(cum_p95_ms + p95_ms, 1)
        total_latency_ms = round(total_latency_ms + mean_ms, 1)
        level_max_p95[lvl] = max(level_max_p95.get(lvl, 0.0), p95_ms)

        exec_status: NodeExecStatus = (
            "DOWNGRADED" if active_spec.model_id != req_spec.model_id else "COMPLETED"
        )
        note = (
            f"Executed on downgraded flash model '{active_spec.model_id}' (requested '{req_spec.model_id}')."
            if exec_status == "DOWNGRADED"
            else f"Executed cleanly on '{active_spec.model_id}'."
        )

        traces.append(
            DagNodeTrace(
                step_index=idx,
                node_id=nid,
                role=node.role,
                dag_level=lvl,
                requested_model=req_spec.model_id,
                executed_model=active_spec.model_id,
                status=exec_status,
                input_tokens=node.estimated_input_tokens,
                output_tokens=node.estimated_output_tokens,
                total_tokens=node_tokens,
                cumulative_tokens=cum_tokens,
                node_cost_usd=projected_cost,
                cumulative_cost_usd=cum_cost_usd,
                latency_ms=mean_ms,
                p95_latency_ms=p95_ms,
                cumulative_p95_ms=cum_p95_ms,
                note=note,
            )
        )

    critical_path_p95_ms = round(sum(level_max_p95.values()), 1)
    token_util_pct = round(min(100.0, (cum_tokens / req.budget.max_tokens) * 100.0), 1)
    usd_util_pct = round(min(100.0, (cum_cost_usd / req.budget.max_usd) * 100.0), 1)
    usd_saved = round(max(0.0, baseline_frontier_cost_usd - cum_cost_usd), 6)

    seed = f"{','.join(topo_order)}:{req.budget.mode}:{req.budget.max_tokens}:{req.budget.max_usd}"
    trace_id = "vg4-" + hashlib.sha256(seed.encode("utf-8")).hexdigest()[:12]

    return DagRunResponse(
        trace_id=trace_id,
        acyclic=True,
        topological_order=topo_order,
        dag_levels=levels,
        node_traces=traces,
        total_tokens=cum_tokens,
        total_cost_usd=cum_cost_usd,
        baseline_frontier_cost_usd=baseline_frontier_cost_usd,
        total_latency_ms=total_latency_ms,
        critical_path_p95_ms=critical_path_p95_ms,
        circuit_breaker=CircuitBreakerSummary(
            mode=req.budget.mode,
            state=breaker_state,
            tripped=breaker_state != "CLOSED",
            tripped_at_node_id=tripped_at_node_id,
            trip_reason=trip_reason,
            fallback_model=fallback_spec.model_id,
            token_utilization_pct=token_util_pct,
            usd_utilization_pct=usd_util_pct,
            usd_saved_vs_frontier=usd_saved,
        ),
        firewall_blocked_nodes=firewall_blocked_nodes,
    )


# ============================================================================
# FinOps Pareto Model Router
# ============================================================================

RoutingStrategy = Literal["quality_first", "balanced_hybrid", "cost_optimized"]


class FinOpsRouteRequest(BaseModel):
    monthly_calls: int = Field(default=2_000_000, ge=1_000, le=100_000_000)
    avg_input_tokens: int = Field(default=1850, ge=50, le=128_000)
    avg_output_tokens: int = Field(default=420, ge=10, le=32_000)
    max_p95_latency_ms: float = Field(default=850.0, gt=0.0, le=10_000.0)
    max_cost_per_1k_usd: float | None = Field(default=None, gt=0.0, le=1000.0)
    min_quality_index: float = Field(default=88.0, ge=50.0, le=100.0)
    cache_hit_rate_pct: int = Field(default=35, ge=0, le=85)
    strategy: RoutingStrategy = Field(default="balanced_hybrid")


class FinOpsCandidateEvaluation(BaseModel):
    model_id: str
    label: str
    provider: str
    tier: str
    cost_per_1k_calls_usd: float
    monthly_spend_usd: float
    effective_ttft_ms: float
    effective_p95_latency_ms: float
    quality_index: float
    meets_sla: bool
    sla_violations: list[str]
    is_pareto_optimal: bool


class FinOpsRouteResponse(BaseModel):
    strategy: RoutingStrategy
    recommended_model: str
    sla_satisfied: bool
    monthly_spend_usd: float
    single_frontier_monthly_usd: float
    monthly_savings_usd: float
    annual_savings_usd: float
    savings_pct: float
    effective_p95_latency_ms: float
    quality_index: float
    pareto_frontier_models: list[str]
    candidates: list[FinOpsCandidateEvaluation]


CACHED_COST_FACTOR = 0.08
CACHED_TTFT_MS = 38.0
CACHED_P95_MS = 58.0


def route_finops_pareto(req: FinOpsRouteRequest) -> FinOpsRouteResponse:
    cache_frac = req.cache_hit_rate_pct / 100.0

    # Evaluate the 5 generative models (exclude classifier-only guard model)
    eval_specs = [m for m in MODEL_CATALOG.values() if m.tier != "guard"]

    # Baseline: 100% uncached Claude 3.7 Sonnet
    frontier = MODEL_CATALOG["claude-3.7-sonnet"]
    frontier_cost_per_call = compute_token_cost_usd(
        frontier, req.avg_input_tokens, req.avg_output_tokens
    )
    single_frontier_monthly_usd = round(frontier_cost_per_call * req.monthly_calls, 2)

    raw_rows: list[dict[str, object]] = []
    for spec in eval_specs:
        uncached_per_call = compute_token_cost_usd(spec, req.avg_input_tokens, req.avg_output_tokens)
        eff_per_call = (
            uncached_per_call * (1.0 - cache_frac)
            + uncached_per_call * CACHED_COST_FACTOR * cache_frac
        )
        cost_per_1k = round(eff_per_call * 1000.0, 4)
        monthly_spend = round(eff_per_call * req.monthly_calls, 2)
        eff_ttft = round(spec.ttft_ms * (1.0 - cache_frac) + CACHED_TTFT_MS * cache_frac, 1)
        eff_p95 = round(spec.p95_latency_ms * (1.0 - cache_frac) + CACHED_P95_MS * cache_frac, 1)

        violations: list[str] = []
        if eff_p95 > req.max_p95_latency_ms:
            violations.append(
                f"p95 latency {eff_p95}ms exceeds SLA {req.max_p95_latency_ms}ms"
            )
        if req.max_cost_per_1k_usd is not None and cost_per_1k > req.max_cost_per_1k_usd:
            violations.append(
                f"cost/1k ${cost_per_1k:.4f} exceeds cap ${req.max_cost_per_1k_usd:.4f}"
            )
        if spec.quality_index < req.min_quality_index:
            violations.append(
                f"quality {spec.quality_index} below minimum {req.min_quality_index}"
            )

        raw_rows.append(
            {
                "spec": spec,
                "cost_per_1k": cost_per_1k,
                "monthly_spend": monthly_spend,
                "eff_ttft": eff_ttft,
                "eff_p95": eff_p95,
                "violations": violations,
                "meets_sla": len(violations) == 0,
            }
        )

    # Identify non-dominated Pareto frontier in (minimize cost_per_1k, maximize quality_index)
    candidates: list[FinOpsCandidateEvaluation] = []
    for row in raw_rows:
        spec = row["spec"]
        assert isinstance(spec, ModelSpec)
        cost = float(row["cost_per_1k"])  # type: ignore[arg-type]
        qual = spec.quality_index
        dominated = any(
            (other["spec"] is not spec)
            and float(other["cost_per_1k"]) <= cost  # type: ignore[arg-type]
            and other["spec"].quality_index >= qual  # type: ignore[union-attr]
            and (
                float(other["cost_per_1k"]) < cost  # type: ignore[arg-type]
                or other["spec"].quality_index > qual  # type: ignore[union-attr]
            )
            for other in raw_rows
        )
        candidates.append(
            FinOpsCandidateEvaluation(
                model_id=spec.model_id,
                label=spec.label,
                provider=spec.provider,
                tier=spec.tier,
                cost_per_1k_calls_usd=cost,
                monthly_spend_usd=float(row["monthly_spend"]),  # type: ignore[arg-type]
                effective_ttft_ms=float(row["eff_ttft"]),  # type: ignore[arg-type]
                effective_p95_latency_ms=float(row["eff_p95"]),  # type: ignore[arg-type]
                quality_index=qual,
                meets_sla=bool(row["meets_sla"]),
                sla_violations=list(row["violations"]),  # type: ignore[arg-type]
                is_pareto_optimal=not dominated,
            )
        )

    eligible = [c for c in candidates if c.meets_sla]
    sla_satisfied = len(eligible) > 0
    pool = eligible if sla_satisfied else candidates

    # Prefer Pareto-optimal candidates inside the eligible pool when available
    pareto_pool = [c for c in pool if c.is_pareto_optimal] or pool

    if req.strategy == "quality_first":
        chosen = max(pareto_pool, key=lambda c: (c.quality_index, -c.cost_per_1k_calls_usd))
    elif req.strategy == "cost_optimized":
        chosen = min(pareto_pool, key=lambda c: (c.cost_per_1k_calls_usd, -c.quality_index))
    else:
        # balanced_hybrid: maximize utility = normalized quality - 0.45 * normalized cost - 0.20 * normalized latency
        max_cost = max(c.cost_per_1k_calls_usd for c in candidates) or 1.0
        max_lat = max(c.effective_p95_latency_ms for c in candidates) or 1.0
        chosen = max(
            pareto_pool,
            key=lambda c: (
                (c.quality_index / 100.0)
                - 0.45 * (c.cost_per_1k_calls_usd / max_cost)
                - 0.20 * (c.effective_p95_latency_ms / max_lat)
            ),
        )

    monthly_savings = round(max(0.0, single_frontier_monthly_usd - chosen.monthly_spend_usd), 2)
    annual_savings = round(monthly_savings * 12.0, 2)
    savings_pct = (
        round((monthly_savings / single_frontier_monthly_usd) * 100.0, 1)
        if single_frontier_monthly_usd > 0
        else 0.0
    )

    return FinOpsRouteResponse(
        strategy=req.strategy,
        recommended_model=chosen.model_id,
        sla_satisfied=sla_satisfied,
        monthly_spend_usd=chosen.monthly_spend_usd,
        single_frontier_monthly_usd=single_frontier_monthly_usd,
        monthly_savings_usd=monthly_savings,
        annual_savings_usd=annual_savings,
        savings_pct=savings_pct,
        effective_p95_latency_ms=chosen.effective_p95_latency_ms,
        quality_index=chosen.quality_index,
        pareto_frontier_models=[c.model_id for c in candidates if c.is_pareto_optimal],
        candidates=candidates,
    )
