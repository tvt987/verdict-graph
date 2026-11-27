# ADR-001: Deterministic DAG Topological Validation & Immutable Time-Travel State Diff

- **Status:** Accepted
- **Date:** 2026-11-28
- **Author:** Truong Van Tinh (Solution Architect)
- **Scope:** `backend/verdict_api/dag_engine.py`, `services/agent-runtime-python/app/checkpointer.py`, `web/control-plane/src/engine/protocolEngine.ts`, `web/control-plane/src/components/DagWaterfallReplay.tsx`

---

## 1. Context & Architectural Problem

Enterprise multi-agent orchestrations frequently fail in two catastrophic ways in production:
1. **Unbounded Graph Cycles:** User-composed or dynamically planned agent graphs introduce silent cycles (`Planner -> Scout -> Critic -> Planner`), causing infinite execution loops, runaway cloud spend, and cascading latency spikes across downstream MCP/A2A tool servers.
2. **Non-Reproducible Post-Mortems:** Mutable in-memory agent state overwrites intermediate tool outputs and prompt overrides, making it impossible to answer *"What would have happened if Node 02 retrieved `top_k=8` with cross-encoder reranking and ran on `gemini-2.5-pro` instead of `claude-3.7-sonnet`?"*

We require a dual-plane deterministic architecture where:
- Submitted custom workflow DAGs are mathematically proven acyclic **prior** to execution in `O(V + E)` time, returning exact cycle witnesses (`HTTP 400 DAG_CYCLE_DETECTED`) rather than timing out mid-flight.
- Runtime execution persists immutable parent-child checkpoint snapshots so any historical checkpoint can be forked into a side-by-side comparison branch (`Branch A vs Branch B`) with RFC 6902 JSON state diffs and per-branch P95 latency / USD waterfall replay.

---

## 2. Decision

### 2.1 Kahn Topological Sort + Explicit DFS Cycle Witness Extraction
In `backend/verdict_api/dag_engine.py`, `topological_sort_dag()` enforces four structural invariants before any LLM or tool node executes:
1. **Unique Node Identity:** Duplicate `node.id` submissions fail fast with `400 DUPLICATE_NODE_ID`.
2. **Referential Edge Integrity:** Any edge targeting or originating from an unregistered node ID fails fast with `400 INVALID_DAG_EDGE`.
3. **Self-Loop & Cycle Witness Detection:** Kahn's BFS queue resolves in-degree-0 nodes while computing parallel execution levels (`dag_levels[v] = max(dag_levels[v], dag_levels[u] + 1)`). If `len(order) != len(nodes)`, a 3-color DFS (`0=unvisited, 1=visiting, 2=done`) extracts the exact minimal cycle path (`["planner", "scout", "critic", "planner"]`) and raises `CyclicDagError` -> HTTP `400`.
4. **Critical-Path P95 Computation:** Because parallel sibling nodes share the same `dag_level`, critical-path P95 latency is computed as `sum(max(p95_ms for node in level) for level in levels)`, cleanly distinguishing parallel diamond DAG speedup from serial sums.

### 2.2 Immutable Checkpoint DAG & Structured State Diff
For cyclic governance runtimes (where bounded policy-violation reroutes `04 -> 01` are explicitly capped via `max_cycles`), each node transition commits a deep-copied `Checkpoint` record linking `parent_checkpoint_id -> checkpoint_id`.
- Forking at `CP-02` clones the ancestor prefix without mutating `main`, injects state/model/prompt overrides (`top_k=8`, `rerank=true`, `model='vllm-qwen-72b'`), and replays only the suffix.
- `computeStructuredStateDiff()` computes exact `/path` diffs (`added`, `removed`, `changed`, `unchanged`) alongside latency, token, groundedness, and USD deltas.
- `buildDagWaterfallReplay()` & `computeReplayFrame()` project multi-branch node spans into a step-by-step animated P95 + USD waterfall timeline on the frontend.

---

## 3. Alternatives Considered

| Option | Pros | Cons | Decision |
| :--- | :--- | :--- | :--- |
| **Runtime Recursion Counter Only** | Easy to implement | Wastes tokens and external tool calls before discovering infinite cycle | Rejected for DAG Builder |
| **Mutable Shared State Dictionary** | Lower memory footprint | Destroys ancestor state; impossible to run A/B Time-Travel Forks | Rejected |
| **Kahn + DFS Witness + Immutable Checkpointer** | `O(V+E)` pre-flight rejection, parallel critical-path latency, exact A/B fork diffs | Slight serialization overhead per checkpoint (mitigated by Redis/JSON snapshots) | **Selected** |

---

## 4. Consequences & Verification

- **Positive:** Zero wasted tokens on malformed cyclic DAGs; deterministic testability across both TypeScript Vitest (`91` tests) and Python FastAPI Pytest (`30` control-plane API tests + `20` legacy runtime tests).
- **Trade-Off:** Explicit cycle boundaries mean intentional feedback loops (e.g., Policy Guardrail quarantine `04 -> 01`) are modeled as bounded runtime edges inside the 6-node state machine, whereas user-authored workflow pipelines in `/api/v1/dag/validate-and-run` enforce strict DAG acyclicity.
- **Verification:** Verified via `test_dag_rejects_two_node_cycle_with_400`, `test_dag_rejects_three_node_cycle_with_400`, `test_dag_rejects_self_loop_with_400`, `test_dag_diamond_parallel_branch_computes_critical_path_below_serial_sum`, and `promptFirewallEngine.test.ts` waterfall replay invariants.
