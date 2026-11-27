# VERDICT GRAPH v5.0 — Multi-Agent DAG, OWASP Firewall & Multi-Model Pareto Routing Arena

**Author:** Truong Van Tinh ([github.com/tvt987](https://github.com/tvt987))  
**Live Control Plane:** [tvt987.github.io/verdict-graph](https://tvt987.github.io/verdict-graph/)  
**Stack:** `Python 3.12 FastAPI` · `React 19 + TypeScript + Vite 6 + Tailwind v4` · `Multi-Model Pareto Routing Arena (6 LLMs)` · `Daylight Studio & Obsidian Graphite Dual Theme` · `OWASP LLM01–LLM10 Prompt Firewall` · `Token/USD Budget Circuit Breaker` · `DAG Cycle Detector` · `MCP JSON-RPC 2.0` · `A2A v0.2.2` · `AG-UI SSE (RFC 6902)` · `OpenTelemetry GenAI` · `Docker + Nginx + Redis + Qdrant`

VERDICT GRAPH v5.0 is a full-stack production multi-agent observability, security guardrail, and FinOps routing control plane monorepo. It pairs a breathable **Anthropic Console / LangSmith-caliber React 19 Studio** (`web/control-plane/`, with **Daylight Studio ↔ Obsidian Graphite** dual themes and clean 4-tab workspace architecture) with a real **Python 3.12 FastAPI Control Plane API** (`backend/verdict_api/`) and a polyglot MCP/A2A/AG-UI protocol runtime (`services/agent-runtime-python/`).

---

## System Architecture (v5.0 Full-Stack Monorepo)

```text
+-------------------------------------------------------------------------------------+
|                       NGINX REVERSE PROXY + STRICT CSP (:4173)                      |
|      React 19 + TS + Tailwind v4 Studio (Entry: 76.01 kB / 22.26 kB gzip, Lazy)     |
|  [01 Orchestrator DAG] [02 OWASP Firewall] [03 Model Routing Arena] [04 Audit/OTLP] |
|          Crisp Engineering Daylight Studio  <-->  Obsidian Graphite Theme           |
+------------------------------------------+------------------------------------------+
                                           |  /api/v1/* (HTTP/1.1 JSON)
                                           v
+-------------------------------------------------------------------------------------+
|              PYTHON 3.12 FASTAPI MULTI-AGENT CONTROL PLANE API (:8000)              |
|  GET  /health                         -> Service & guardrail capability metadata    |
|  POST /api/v1/dag/validate-and-run    -> Kahn+DFS cycle check (400) + Budget Breaker|
|  POST /api/v1/firewall/scan           -> OWASP LLM01-LLM10 scanner + safe redaction |
|  POST /api/v1/finops/route            -> Single-model SLA Pareto selector           |
|  POST /api/v1/routing/pareto-optimize -> 6-Model Pareto Frontier & Cascade Optimizer|
+--------------------+---------------------------------+------------------------------+
                     |                                 |
                     v                                 v
        +------------------------+        +--------------------------+
        |   REDIS 7 (AOF :6379)  |        | QDRANT VECTOR DB (:6333) |
        | Checkpoints & KV Cache |        | Tenant-Scoped Embeddings |
        +------------------------+        +--------------------------+
```

---

## Flagship v5.0 Capabilities

### 1. Multi-Model FinOps Routing & Pareto Frontier Arena (`modelRoutingEngine.ts` + `POST /api/v1/routing/pareto-optimize`)
- **6 Frontier & Open-Weight LLM Profiles:** Models `Claude 4.5 Sonnet`, `GPT-5`, `Gemini 2.5 Pro`, `DeepSeek-R1`, `Gemini 2.5 Flash`, and `Llama 4 70B Self-Hosted` with real input/output pricing (`$/1M tokens`), TTFT (`ms`), P95 latency (`ms`), groundedness accuracy (`%`), and JSON schema adherence (`%`).
- **4 Live Interactive FinOps & SLA Controls:** Real-time sliders for **Monthly Request Volume (`100K – 20M req/mo`)**, **Quality Floor (`85% – 99%`)**, **P95 Latency Budget (`400ms – 3000ms`)**, and **Prompt Caching Hit Rate (`0% – 85%`)**.
- **Deterministic Pareto-Optimal Cascading Router Policy:** Solves for the minimum-cost 3-tier cascade (`Fast Tier + Frontier Verifier + Human Escalation`) that strictly satisfies both quality floor and P95 latency SLA, quantifies exact monthly/annual spend savings vs single-frontier deployment (`Claude 4.5 Sonnet` or `GPT-5`), and renders an interactive **SVG Cost-vs-Quality Pareto Frontier Scatter Chart** with highlighted Pareto envelope curve.

### 2. Breathable Studio UI & Daylight ↔ Obsidian Dual Theme
- **Clean Single-Row Segmented Workspace Tabs:** Streamlined top header (`Orchestrator DAG`, `OWASP Firewall`, `Model Routing Arena`, `Audit & OTLP`) with zero cramped wrapping on both `1440px` desktop and `390px` mobile viewports.
- **Crisp Engineering Daylight (`#F8FAFC` / `#FFFFFF` / `#0F172A` / `#4F46E5` Indigo + `#059669` Emerald) ↔ Obsidian Graphite** theme toggle with full contrast parity across SVG nodes, Bezier photonic edges, trace pills, charts, and JSON inspectors.
- **Prominent 6-Node Cyclic Photonic Execution Graph:** Elevated interactive canvas with smooth 60fps photonic protocol packets, latency heat badges, node contract inspector, and contextual HITL Canary Approval Gates.

### 3. Real-Time OWASP LLM01–LLM10 Prompt Firewall & Live Token Budget Circuit Breaker
- **Multi-Vector Prompt Scanner (`promptFirewallEngine.ts` & `POST /api/v1/firewall/scan`):** Inspects arbitrary prompts in real time against all 10 **OWASP LLM Top-10** categories (`LLM01`–`LLM10`), highlighting risky spans with zero `dangerouslySetInnerHTML` and producing `[BLOCKED:LLM0x]` redactions.
- **Configurable Token/USD Budget Circuit Breaker:** Supports **`HARD_STOP`** and **`DOWNGRADE_MODEL`** (auto-downgrading Frontier models -> `Gemini 2.5 Flash` / `Local vLLM Qwen-72B` when nearing budget threshold).

### 4. Deterministic DAG Topological Validator, Time-Travel Diff & 3-Protocol Wire Telemetry
- `O(V + E)` Kahn topological sort + 3-color DFS cycle detection (`HTTP 400 DAG_CYCLE_DETECTED`), **Interactive DAG P95/USD Waterfall Replay**, **Custom 7-Role Workflow DAG Builder**, **Immutable Checkpoint Forking & State Diff**, **MCP JSON-RPC 2.0**, **A2A v0.2.2**, **AG-UI SSE (RFC 6902)**, and **Signed Ed25519 + OpenTelemetry OTLP Audit Export**.

---

## Architecture Documentation & OpenAPI 3.1

- **OpenAPI 3.1 Specification:** [`docs/openapi.yaml`](docs/openapi.yaml)
- **ADR-001:** [`docs/ADR-001-Deterministic-DAG-TimeTravel-Diff.md`](docs/ADR-001-Deterministic-DAG-TimeTravel-Diff.md)
- **ADR-002:** [`docs/ADR-002-OWASP-LLM-Firewall-FinOps-CircuitBreaker.md`](docs/ADR-002-OWASP-LLM-Firewall-FinOps-CircuitBreaker.md)

---

## Quick Start (Docker Compose & Local Development)

### 1. Run Full-Stack Cluster via Docker Compose (`web` + `api` + `redis` + `qdrant`)
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

### 4. Run Dual-Protocol Agent Runtime Suite
```bash
cd services/agent-runtime-python
pip install -r requirements.txt
pytest -v
```

---

## Verification & Benchmark Matrix (v5.0)

| Verification Gate | Command | Verified Result |
| :--- | :--- | :--- |
| **Frontend Unit Tests (Vitest)** | `cd web/control-plane && npm test` | **114 / 114 passed** (`5` suites: `modelRoutingEngine` (`23`), `promptFirewallEngine` (`21`), `protocolEngine` (`7`), `v2Upgrades` (`16`), `v3Upgrades` (`47`)) |
| **Backend Control Plane API (Pytest)** | `python -m pytest backend/tests -v` | **47 / 47 passed** (FastAPI `TestClient`: `/api/v1/routing/pareto-optimize` (`17`), `/api/v1/dag/validate-and-run`, `/api/v1/firewall/scan`, `/api/v1/finops/route`) |
| **Polyglot Protocol Runtime (Pytest)** | `cd services/agent-runtime-python && pytest -v` | **20 / 20 passed** (MCP JSON-RPC 2.0, A2A, AG-UI SSE, immutable checkpointer, OTel GenAI) |
| **Production Build & Code-Splitting** | `cd web/control-plane && npm run build` | **0 errors** · Entry `index.js`: **76.01 kB** (`22.26 kB` gzip) · Lazy `ModelRoutingArena.js`: **30.19 kB** (`6.61 kB` gzip) · `engines.js`: **126.88 kB** · `react.js`: **223.21 kB** |
| **Playwright Headless E2E QA** | `1440x900` Desktop + `390x844` Mobile | **0** console errors · **0** page errors · **0** failed requests · **0px** horizontal overflow · Dual theme toggle, live Pareto Arena sliders + SVG curve, OWASP Firewall & Circuit Breaker verified |

---

## Repository Structure

```text
verdict-graph/
├── Dockerfile                            # Multi-stage Vite build + hardened Nginx runtime
├── nginx.conf                            # Strict CSP, gzip, /api/v1 reverse proxy, SPA routing
├── docker-compose.yml                    # Full stack: web + api + redis + qdrant
├── backend/                              # Python 3.12 FastAPI v5.0 Control Plane API
│   ├── Dockerfile                        # Non-root Python 3.12-slim multi-stage container
│   ├── requirements.txt
│   ├── verdict_api/
│   │   ├── dag_engine.py                 # Kahn+DFS cycle detector, Budget Breaker, OWASP Firewall, FinOps Router
│   │   ├── routing_engine.py             # v5.0 6-Model Pareto Frontier & Cascading Router Optimizer
│   │   └── main.py                       # FastAPI routes (/health, /api/v1/dag/*, /firewall/*, /finops/*, /routing/*)
│   └── tests/
│       └── test_verdict_api.py           # 47 FastAPI TestClient integration tests
├── docs/
│   ├── openapi.yaml                      # OpenAPI 3.1.0 specification matching all FastAPI routes
│   ├── ADR-001-Deterministic-DAG-TimeTravel-Diff.md
│   └── ADR-002-OWASP-LLM-Firewall-FinOps-CircuitBreaker.md
├── services/agent-runtime-python/        # Polyglot MCP / A2A / AG-UI runtime (20 pytest tests)
└── web/control-plane/                    # React 19 + TS + Vite 6 + Tailwind v4 Studio (114 Vitest tests)
    └── src/
        ├── engine/                       # modelRoutingEngine, promptFirewallEngine, protocolEngine, redTeamClassifier, finopsSimulator
        ├── engines/                      # workflowBuilder (7-role DAG builder)
        └── components/                   # Lazy ModelRoutingArena, PromptFirewallLab, DagWaterfallReplay, WorkflowDagBuilder, etc.
```
