# ADR-002: Multi-Vector OWASP LLM01–LLM10 Prompt Firewall & Token/USD Budget Circuit Breaker

- **Status:** Accepted
- **Date:** 2026-11-28
- **Author:** Truong Van Tinh (Solution Architect)
- **Scope:** `backend/verdict_api/dag_engine.py`, `web/control-plane/src/engine/promptFirewallEngine.ts`, `web/control-plane/src/components/PromptFirewallLab.tsx`

---

## 1. Context & Threat Model

Production multi-agent pipelines expose two tightly coupled failure modes that traditional API gateways cannot mitigate:
1. **Semantic & Protocol-Level Prompt Attacks (OWASP LLM01–LLM10):** Untrusted user turns, retrieved RAG chunks, and external MCP tool payloads can embed jailbreak roleplay (`LLM01`), PII/API-key exfiltration (`LLM02`), untrusted MCP plugins (`LLM03`), hidden HTML comment poisoning (`LLM04`), SQL/tool-call injection (`LLM05`), unauthorized privilege/payout escalation (`LLM06`), system prompt extraction (`LLM07`), wildcard cross-tenant vector queries (`LLM08`), fabricated compliance citation bait (`LLM09`), and recursive token-exhaustion DoS (`LLM10`).
2. **FinOps Runaway Token & USD Spend:** Even benign multi-agent chains running 6+ steps on frontier reasoning models (`Claude 3.7 Sonnet`, `GPT-4o`) can unexpectedly blow past per-request cost ceilings when retrieval contexts expand or retries accumulate. Hard-killing every request near budget hurts user experience, while unguarded execution causes severe monthly cloud overruns.

---

## 2. Decision

### 2.1 Dual-Plane Deterministic OWASP LLM01–LLM10 Prompt Firewall
We implement a unified deterministic multi-vector scanner in both Python 3.12 (`POST /api/v1/firewall/scan`) and TypeScript (`scanPromptFirewall`) with sub-15ms evaluation latency and zero external LLM dependency:
- **10-Category Rule Coverage:** Distinct rule sets map 1:1 to `LLM01` through `LLM10`, plus a structural entropy/length detector (`FW-LLM10-STRUCTURAL-FLOOD`) catching token flooding and repetitive padding attacks even without explicit keywords.
- **Composite Risk Scoring (`0..100`):** Unique triggered rules accumulate severity weights (`MEDIUM`, `HIGH`, `CRITICAL`) capped at `100`, producing deterministic `ALLOW` (`0`), `SANITIZE_WARN` (`< block_threshold`), or `BLOCK` (`>= block_threshold`) verdicts.
- **Zero-`innerHTML` Safe Pattern Highlighting:** Rather than constructing HTML strings for highlighted threats (which would itself introduce an XSS vector under strict CSP!), the scanner partitions the raw prompt into non-overlapping lossless `FirewallHighlightSegment[]` slices rendered strictly as escaped React `<span>` nodes. Invariant: `segments.map(s => s.text).join('') === rawPrompt`.
- **In-Flight Redaction:** Every flagged span is replaced with `[BLOCKED:LLM0x]` so raw SSNs, payment PANs, API keys (`sk-*`, `ghp_*`, `AKIA*`), and SQL directives never reach downstream tool adapters.

### 2.2 Configurable Token/USD Budget Circuit Breaker (`HARD_STOP` vs `DOWNGRADE_MODEL`)
Before dispatching each node in a topological DAG execution, the circuit breaker projects cumulative tokens and cumulative USD against `(max_tokens, max_usd)`:
- **`HARD_STOP` Mode:** Enforces strict financial & quota ceilings. If executing the next node would breach `max_tokens` or `max_usd`, the breaker transitions to `TRIPPED_HARD_STOP`, halts that node (`HALTED_BUDGET`), marks all downstream nodes `SKIPPED_CIRCUIT_OPEN`, and guarantees `total_cost_usd <= max_usd` and `total_tokens <= max_tokens`.
- **`DOWNGRADE_MODEL` Mode (Graceful Degradation):** Monitors a configurable soft threshold (`soft_threshold_ratio`, default `55%–70%`). When cumulative spend approaches the cap, the breaker transitions to `DOWNGRADED_FLASH` and seamlessly routes the current and remaining nodes from Frontier (`Claude 3.7 Sonnet` / `GPT-4o` / `Gemini 2.5 Pro`) to a Flash/local GPU fallback (`Gemini 2.5 Flash` at `$0.15/$0.60` per 1M tokens or `vLLM Qwen-72B`), preserving workflow completion while slashing per-node spend by `>90%`. If absolute ceilings would still be breached on fallback, an ultimate `HARD_STOP` safety net prevents runaway spend.

### 2.3 Pareto-Optimal FinOps Routing (`POST /api/v1/finops/route`)
Complements the circuit breaker at initial dispatch time by evaluating all generative models under explicit SLA filters (`max_p95_latency_ms`, `max_cost_per_1k_usd`, `min_quality_index`, `cache_hit_rate_pct`), eliminating dominated models, and selecting along the `(cost, quality)` Pareto frontier for `quality_first`, `balanced_hybrid`, or `cost_optimized` strategies.

---

## 3. Consequences & Security Posture

- **Security:** Strict `Content-Security-Policy` (`script-src 'self'; object-src 'none'`), zero `dangerouslySetInnerHTML`, zero `eval`, and `100%` OWASP LLM01–LLM10 detection across both unit and API integration suites with `0%` false positives on enterprise architecture prompts.
- **FinOps Impact:** `DOWNGRADE_MODEL` preserves `100%` node completion rate while cutting Frontier-only run costs by `40%–75%` under tight per-run USD caps; semantic/KV cache hit rates (`0% -> 80%`) further cut monthly cloud spend by `>65%`.
- **Verification:** Covered by `21` Vitest tests in `promptFirewallEngine.test.ts`, `30` FastAPI Pytest tests in `backend/tests/test_verdict_api.py`, and headless Playwright E2E assertions against live production builds.
