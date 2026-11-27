# VERDICT GRAPH v4.0 — Full-Stack Multi-Agent DAG, OWASP Prompt Firewall & FinOps Control Plane

**Author:** Truong Van Tinh ([github.com/tvt987](https://github.com/tvt987))  
**Live Control Plane:** [tvt987.github.io/verdict-graph](https://tvt987.github.io/verdict-graph/)  
**Stack:** `Python 3.12 FastAPI` · `React 19 + TypeScript + Vite 6 + Tailwind v4` · `OWASP LLM01–LLM10 Prompt Firewall` · `Token/USD Budget Circuit Breaker` · `DAG Cycle Detector` · `FinOps Pareto Router` · `MCP JSON-RPC 2.0` · `A2A v0.2.2` · `AG-UI SSE (RFC 6902)` · `OpenTelemetry GenAI` · `Docker + Nginx + Redis + Qdrant`

VERDICT GRAPH v4.0 is a full-stack production multi-agent observability, security guardrail, and FinOps control plane monorepo. It unites a real `Python 3.12 FastAPI` control-plane API (`backend/verdict_api/`) with a code-split `React 19` mission-control cockpit (`web/control-plane/`) and polyglot protocol runtime (`services/agent-runtime-python/`).

---

## System Architecture (v4.0 Full-Stack Monorepo)

```text
+----------------------------------------------------------------------------------+
|                     NGINX REVERSE PROXY + STRICT CSP (:4173)                     |
|   React 19 + TS + Tailwind v4 SPA (Code-Split Entry: 69.79 kB / 20.82 kB gzip)   |
|  [Execution Graph] [Prompt Firewall & Breaker] [P95/USD Waterfall] [DAG Builder] |
|  [OWASP Top-10 Suite] [FinOps Pareto Router] [Time-Travel Diff] [Wire Inspector] |
+----------------------------------------+-----------------------------------------+
                                         |  /api/v1/* (HTTP/1.1 JSON)
                                         v
+----------------------------------------------------------------------------------+
|             PYTHON 3.12 FASTAPI MULTI-AGENT CONTROL PLANE API (:8000)            |
|  GET  /health                     -> Service & guardrail capability metadata     |
|  POST /api/v1/dag/validate-and-run-> Kahn+DFS cycle check (400) + Budget Breaker |
|  POST /api/v1/firewall/scan       -> OWASP LLM01-LLM10 scanner + safe redaction  |
|  POST /api/v1/finops/route        -> Pareto-optimal SLA model selection engine   |
+------------------+-----------------------------+---------------------------------+
                   |                             |
                   v                             v
      +------------------------+    +--------------------------+
      |   REDIS 7 (AOF :6379)  |    | QDRANT VECTOR DB (:6333) |
      | Checkpoints & KV Cache |    | Tenant-Scoped Embeddings |
      +------------------------+    +--------------------------+
```

---

## Flagship v4.0 Capabilities

### 1. Real-Time OWASP LLM01–LLM10 Prompt Firewall & Live Token Budget Circuit Breaker
- **Multi-Vector Prompt Scanner (`promptFirewallEngine.ts` & `POST /api/v1/firewall/scan`):** Inspects arbitrary user prompts in real time against all 10 **OWASP LLM Top-10** categories (`LLM01` Jailbreak Roleplay, `LLM02` PII/Secret Exfiltration, `LLM03` Untrusted MCP Supply Chain, `LLM04` Indirect RAG Poisoning, `LLM05` Tool-Call & SQL/Script Injection, `LLM06` Excessive Agency, `LLM07` System Prompt Extraction, `LLM08` Cross-Tenant Vector Bleed, `LLM09` Fabricated Citation Bait, `LLM10` Token Exhaustion DoS + structural flood).
- **Zero-`innerHTML` Risky Span Highlighting:** Partitions raw prompts into lossless React `<span>` highlight segments (`0` `dangerouslySetInnerHTML`, strict CSP intact) with one-click sanitized redaction (`[BLOCKED:LLM0x]`).
- **Configurable Token/USD Budget Circuit Breaker:** Supports **`HARD_STOP`** (halts offending node and skips downstream nodes before exceeding Token/USD cap) and **`DOWNGRADE_MODEL`** (auto-downgrades from Frontier models like `Claude 3.7 Sonnet` / `GPT-4o` -> `Gemini 2.5 Flash` or `Local vLLM Qwen-72B` when spend approaches threshold, saving >90% per remaining node).

### 2. Interactive DAG Latency & Cost Waterfall Replay
- Step-by-step animated replay (`Play`, `Pause`, `Step`, `Reset`, interactive scrubber) tracking cumulative **P95 latency (`ms`)** and **USD spend** across multi-agent branches (`Branch A: Frontier Serial` vs `Branch B: Parallel Hybrid` vs `Branch C: Circuit-Breaker Flash`, or live active Time-Travel Fork runs).

### 3. Deterministic DAG Topological Validator & Cycle Detector (`POST /api/v1/dag/validate-and-run`)
- Executes `O(V + E)` Kahn topological sort with 3-color DFS cycle witness extraction (`HTTP 400 DAG_CYCLE_DETECTED` with exact `cycle_nodes`), duplicate-node/unknown-edge validation, parallel level critical-path P95 calculation, inline firewall scanning, and Token/USD circuit-breaker enforcement.

### 4. Multi-Model FinOps Pareto Router (`POST /api/v1/finops/route`)
- Evaluates `Claude 3.7 Sonnet`, `Gemini 2.5 Pro`, `GPT-4o`, `Gemini 2.5 Flash`, and `Local vLLM Qwen-72B` against `max_p95_latency_ms`, `max_cost_per_1k_usd`, `min_quality_index`, and semantic/KV cache hit rates (`0%–85%`), isolating non-dominated Pareto-frontier models.

### 5. Cyclic 6-Node Protocol Control Plane & Time-Travel Forking
- Full interactive support for **MCP JSON-RPC 2.0**, **A2A v0.2.2**, **AG-UI SSE (RFC 6902 JSON Patch)**, **OpenTelemetry GenAI OTLP export**, **HITL Canary Approval Gates**, **Immutable Checkpoint Forking & Structured State Diff**, and **Custom 7-Role Workflow DAG Builder**.

---

## Architecture Documentation & OpenAPI 3.1

- **OpenAPI 3.1 Specification:** [`docs/openapi.yaml`](docs/openapi.yaml)
- **ADR-001:** [`docs/ADR-001-Deterministic-DAG-TimeTravel-Diff.md`](docs/ADR-001-Deterministic-DAG-TimeTravel-Diff.md)
- **ADR-002:** [`docs/ADR-002-OWASP-LLM-Firewall-FinOps-CircuitBreaker.md`](docs/ADR-002-OWASP-LLM-Firewall-FinOps-CircuitBreaker.md)

---

## Quick Start (Docker Compose & Local Development)

### 1. Run Complete Full-Stack Cluster via Docker Compose (`web` + `api` + `redis` + `qdrant`)
```bash
docker compose up --build
```
- **Web Control Plane (Nginx + Strict CSP):** `http://127.0.0.1:4173`
- **FastAPI Control Plane API (Swagger UI):** `http://127.0.0.1:8000/docs`
- **Health Check:** `http://127.0.0.1:8000/health`
- **Redis 7:** `127.0.0.1:6379` | **Qdrant Vector DB:** `http://127.0.0.1:6333`

### 2. Run Python 3.12 FastAPI Backend & Pytest Locally
```bash
pip install -r backend/requirements.txt
python -m pytest backend/tests -v
uvicorn verdict_api.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

### 3. Run Frontend Control Plane & Vitest Locally
```bash
cd web/control-plane
npm ci
npm test
npm run build
npm run preview
```

### 4. Run Legacy Dual-Protocol Runtime Suite
```bash
cd services/agent-runtime-python
pip install -r requirements.txt
pytest -v
```

---

## Verification & Benchmark Matrix

| Verification Gate | Command | Verified Result |
| :--- | :--- | :--- |
| **Frontend Unit Tests (Vitest)** | `cd web/control-plane && npm test` | **91 / 91 passed** (`4` test suites: `protocolEngine`, `v2Upgrades`, `v3Upgrades`, `promptFirewallEngine`) |
| **Backend Control Plane API (Pytest)** | `python -m pytest backend/tests -v` | **30 / 30 passed** (FastAPI `TestClient`: cycle detection `400`, budget breaker, OWASP LLM01–LLM10, Pareto routing) |
| **Legacy Polyglot Runtime (Pytest)** | `cd services/agent-runtime-python && pytest -v` | **20 / 20 passed** (MCP JSON-RPC 2.0, A2A, AG-UI SSE, immutable checkpointer, OTel GenAI) |
| **Production Build & Code-Splitting** | `cd web/control-plane && npm run build` | **0 errors** · Entry `index.js`: **69.79 kB** (`20.82 kB` gzip) · `engines.js`: **117.76 kB** · `react.js`: **223.21 kB** · 9 lazy lab chunks (`5.5–21.2 kB`) |
| **Playwright Headless E2E QA** | `1440x900` Desktop + `390x844` Mobile | **0** console errors · **0** page errors · **0** failed requests · **0px** horizontal overflow · Live Firewall block + Circuit Breaker trip + Waterfall replay verified |

---

## Repository Structure

```text
verdict-graph/
├── Dockerfile                            # Multi-stage Vite build + hardened Nginx runtime
├── nginx.conf                            # Strict CSP, gzip, /api/v1 reverse proxy, SPA routing
├── docker-compose.yml                    # Full stack: web + api + redis + qdrant
├── backend/                              # Python 3.12 FastAPI v4.0 Control Plane API
│   ├── Dockerfile                        # Non-root Python 3.12-slim multi-stage container
│   ├── requirements.txt
│   ├── verdict_api/
│   │   ├── dag_engine.py                 # Kahn+DFS cycle detector, Budget Breaker, OWASP Firewall, Pareto Router
│   │   └── main.py                       # FastAPI routes (/health, /api/v1/dag/*, /firewall/*, /finops/*)
│   └── tests/
│       └── test_verdict_api.py           # 30 FastAPI TestClient integration tests
├── docs/
│   ├── openapi.yaml                      # OpenAPI 3.1.0 specification matching FastAPI routes
│   ├── ADR-001-Deterministic-DAG-TimeTravel-Diff.md
│   └── ADR-002-OWASP-LLM-Firewall-FinOps-CircuitBreaker.md
├── services/agent-runtime-python/        # Polyglot MCP / A2A / AG-UI runtime (20 pytest tests)
└── web/control-plane/                    # React 19 + TS + Vite 6 + Tailwind v4 SPA (91 Vitest tests)
    └── src/
        ├── engine/                       # promptFirewallEngine, protocolEngine, redTeamClassifier, finopsSimulator
        ├── engines/                      # workflowBuilder (7-role DAG builder)
        └── components/                   # Lazy-loaded PromptFirewallLab, DagWaterfallReplay, WorkflowDagBuilder, etc.
```
