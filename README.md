# VERDICT GRAPH — Visual Multi-Agent Control Plane & Time-Travel Protocol Debugger

**Author:** Truong Van Tinh ([github.com/tvt987](https://github.com/tvt987))  
**Stack:** `MCP JSON-RPC 2.0` · `A2A v0.2.2` · `AG-UI SSE (RFC 6902)` · `LangGraph-style Immutable Checkpointer` · `OpenTelemetry GenAI` · `Python 3.12 FastAPI` · `React 19 + TypeScript + Vite 6 + Tailwind v4`

VERDICT GRAPH is a polyglot dual-runtime observability and control plane engineered to inspect, govern, pause, fork, and replay cyclic multi-agent workflows across the three foundational agentic wire protocols (`MCP`, `A2A`, `AG-UI`) with OpenTelemetry GenAI semantic tracing and FinOps token accounting.

---

## Architecture Overview

```text
+------------------------------------------------------------------------------+
|                       VERDICT GRAPH MISSION CONTROL                          |
|     React 19 + TypeScript + Tailwind v4 + Interactive Pan/Zoom SVG DAG       |
|  [Browser Protocol Engine] <--> [Optional Local Python :8090] <--> [BYOK]    |
+--------------------------------------+---------------------------------------+
                                       |
         +-----------------------------+-----------------------------+
         |                             |                             |
         v                             v                             v
+------------------+         +-------------------+         +-------------------+
|  MCP JSON-RPC 2  |         |  A2A Protocol 0.2 |         | AG-UI SSE Stream  |
|  POST /mcp       |         | /.well-known/     |         | GET /ag-ui/stream |
|  initialize      |         |   agent.json      |         | RUN_STARTED       |
|  tools/list      |         | POST /a2a/tasks/  |         | STATE_DELTA       |
|  tools/call      |         |   send            |         |   (RFC 6902 Patch)|
|  resources/read  |         | Signed Artifacts  |         | INTERRUPT_REQUIRED|
+------------------+         +-------------------+         +-------------------+
         |                             |                             |
         +-----------------------------+-----------------------------+
                                       |
                                       v
+------------------------------------------------------------------------------+
|                  CYCLIC 6-NODE GRAPH & IMMUTABLE CHECKPOINTER                |
|  01. Supervisor Planner <-> 04. Policy Guardrail (Violation Reroute Loop)    |
|  02. MCP Context Scout  <-> 06. Grounded Synthesizer (Time-Travel Fork Loop) |
|  03. A2A Specialist     <-> 05. HITL Approval Gate (Canary Re-Plan Loop)     |
|                                                                              |
|  Immutable Checkpoints (CP-01..CP-08) -> Parent-Child DAG -> Branch Diff     |
|  OpenTelemetry GenAI Semantic Spans (gen_ai.* + FinOps USD Cost Accounting)  |
+------------------------------------------------------------------------------+
```

---

## Core Capabilities

### 1. Cyclic 6-Node Execution Graph
- **01. Supervisor Planner:** Routes tasks, enforces FinOps budget ceilings, and handles cyclic re-entry after guardrail sanitization.
- **02. MCP Context Scout:** Performs `initialize`, `tools/list`, `tools/call`, and `resources/read` over JSON-RPC 2.0.
- **03. A2A Specialist Agent:** Discovers peer `/.well-known/agent.json` AgentCards, matches skills, tracks `submitted -> working -> completed` transitions, and validates Ed25519 signed artifacts.
- **04. Policy & Injection Guardrail:** Evaluates untrusted payloads for indirect prompt injection (`INJ-OVERRIDE-001`), outbound data exfiltration (`INJ-EXFIL-001`), credential/PII leaks (`PII-SECRET-001`, `PII-SSN-002`), and destructive cluster mutations (`POL-MUTATE-001`). Routes violations cyclically back to Node 01.
- **05. HITL Approval Gate:** True execution interrupt checkpoint pausing before high-risk production mutations (`Approve 100%`, `Modify Canary % & Approve`, or `Reject & Escalate`).
- **06. Grounded Synthesizer:** Emits cited verdicts and structured AG-UI generative widgets.

### 2. Four Enterprise Scenarios
| Code | Scenario | Protocols Exercised | Key Governance Pattern |
| :--- | :--- | :--- | :--- |
| `SCN-A` | **Production Outage & Safe Rollback** | `MCP`, `A2A`, `AG-UI`, `HITL` | Pauses at `CP-05` before mutating 712-store voucher cluster (`842ms -> 42.1ms`). |
| `SCN-B` | **Indirect Prompt Injection Defense** | `MCP`, `POLICY`, `AG-UI` | Detects `INJ-EXFIL-001` (`risk=0.98`) in external memo targeting `attacker.io`; sanitizes & loops `04 -> 01`. |
| `SCN-C` | **Cross-Org A2A Financial Audit** | `A2A`, `MCP`, `POLICY` | Discovers `audit-verifier.finops.org`, verifies 14,820 hashed ledger entries with Ed25519 attestation. |
| `SCN-D` | **Hallucination Recovery via Time-Travel Fork** | `MCP`, `FORK`, `OTel` | Main branch scores `0.61` groundedness (`top_k=24`). Forking `CP-02` with `top_k=8, rerank=true, strict_grounding=true` recovers `0.99` groundedness at **>42% lower USD cost**. |

### 3. Guardrail Evaluation Benchmarks
Validated automatically in `services/agent-runtime-python/tests/test_guardrails.py` and `web/control-plane/src/engine/__tests__/protocolEngine.test.ts`:
- **Adversarial Recall (Prompt Injection & Exfiltration):** `100%` (`risk >= 0.96`, deterministic redaction to `[REDACTED_ADVERSARIAL_DIRECTIVE]`)
- **Credential & PII Detection (`sk-*`, `ghp_*`, `AKIA*`, SSN):** `100%`
- **Benign Enterprise False Positive Rate:** `0.0%` across production telemetry, SQL/Redis architecture specs, and ledger payloads.

### 4. Wire Protocol Schemas Implemented
- **MCP JSON-RPC 2.0 (`POST /mcp`):** Full JSON-RPC 2.0 envelope validation including `-32600` (Invalid Request), `-32601` (Method/Tool Not Found), and `-32602` (Invalid Params).
- **A2A Protocol (`GET /.well-known/agent.json`, `POST /a2a/tasks/send`, `GET /a2a/tasks/{id}`):** Canonical `AgentCard` capability/skill descriptors, state transition history, and cryptographically signed artifacts.
- **AG-UI Stream (`GET /ag-ui/stream`):** RFC-compliant `text/event-stream` emitting `RUN_STARTED`, `STEP_STARTED`, `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_RESULT`, `STATE_DELTA` (RFC 6902 JSON Patch), `INTERRUPT_REQUIRED`, `TEXT_MESSAGE_CONTENT`, and `RUN_FINISHED`.
- **OpenTelemetry GenAI Spans:** Captures `trace_id`, `span_id`, `parent_span_id`, `gen_ai.operation.name`, `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.response.ttft_ms`, and `verdict.finops.cost_usd`.

---

## Local Development & Verification

### 1. Run Python 3.12 Backend (`http://127.0.0.1:8090`)
```bash
cd services/agent-runtime-python
pip install -r requirements.txt
pytest -v
uvicorn app.main:app --host 127.0.0.1 --port 8090 --reload
```

### 2. Run Web Control Plane (`http://127.0.0.1:5173/verdict-graph/`)
```bash
cd web/control-plane
npm install
npm test
npm run build
npm run dev
```

### 3. Run Full Dual-Runtime Stack via Docker Compose
```bash
docker compose up --build
```
- Web Control Plane: `http://127.0.0.1:4173/verdict-graph/`
- Python Agent Runtime: `http://127.0.0.1:8090/health`

---

## Repository Structure

```text
verdict-graph/
├── .github/workflows/ci-and-deploy.yml   # Python pytest + Node Vitest + GitHub Pages deploy
├── docker-compose.yml                    # Full polyglot local cluster
├── services/agent-runtime-python/        # Python 3.12 FastAPI runtime + 20 pytest tests
│   ├── app/
│   │   ├── checkpointer.py               # Immutable DAG Checkpointer & Fork engine
│   │   ├── engine.py                     # Cyclic 6-node state machine
│   │   ├── guardrails.py                 # Prompt Injection, Exfiltration, PII scanner
│   │   ├── telemetry.py                  # OpenTelemetry GenAI & FinOps pricing engine
│   │   ├── protocols/
│   │   │   ├── mcp.py                    # MCP JSON-RPC 2.0 handler
│   │   │   ├── a2a.py                    # A2A AgentCard & Task store
│   │   │   └── ag_ui.py                  # AG-UI SSE & RFC 6902 JSON Patch encoder
│   │   └── main.py                       # FastAPI ASGI entrypoint
│   └── tests/                            # Comprehensive pytest suite
└── web/control-plane/                    # React 19 + TS + Vite 6 + Tailwind v4
    └── src/
        ├── engine/                       # Browser Protocol Engine + Remote/BYOK Bridge + Vitest
        └── components/                   # ExecutionGraph, TimeTravelPanel, WireInspector, HITL
```
