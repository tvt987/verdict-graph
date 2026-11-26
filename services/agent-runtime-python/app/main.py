"""FastAPI ASGI Control Plane Runtime exposing MCP, A2A, AG-UI SSE, Guardrails, and Time-Travel APIs."""

from __future__ import annotations

from typing import Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.engine import VerdictGraphEngine
from app.guardrails import evaluate_guardrails
from app.models import ForkRequest, HitlDecisionRequest, ScenarioId, StartRunRequest
from app.protocols.a2a import build_agent_card
from app.protocols.ag_ui import stream_ag_ui_events
from app.protocols.mcp import handle_mcp_jsonrpc


app = FastAPI(
    title="Verdict Graph Agent Runtime",
    version="1.0.0",
    description="Multi-Agent Control Plane Runtime supporting MCP JSON-RPC 2.0, A2A, AG-UI SSE, Time-Travel Checkpoints, and OpenTelemetry GenAI.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = VerdictGraphEngine()


class GuardrailEvalRequest(BaseModel):
    text: str
    allow_mutation_with_hitl: bool = True


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "verdict-graph-runtime",
        "protocols": ["mcp-jsonrpc-2.0", "a2a-0.2.2", "ag-ui-sse", "otel-genai"],
        "active_runs": len(engine.runs),
    }


# --- MCP JSON-RPC 2.0 Streamable HTTP Endpoint ---
@app.post("/mcp")
def mcp_endpoint(payload: dict[str, Any]) -> dict[str, Any]:
    return handle_mcp_jsonrpc(payload)


# --- A2A Discovery & Task Endpoints ---
@app.get("/.well-known/agent.json")
def a2a_agent_card() -> dict[str, Any]:
    return build_agent_card()


@app.post("/a2a/tasks/send")
def a2a_send_task(payload: dict[str, Any]) -> dict[str, Any]:
    return engine.a2a_store.submit_task(payload)


@app.get("/a2a/tasks/{task_id}")
def a2a_get_task(task_id: str) -> dict[str, Any]:
    task = engine.a2a_store.get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f"A2A task '{task_id}' not found")
    return task


# --- AG-UI Server-Sent Events Stream ---
@app.get("/ag-ui/stream")
def ag_ui_stream(
    run_id: str | None = Query(default=None),
    scenario_id: ScenarioId = Query(default=ScenarioId.OUTAGE_ROLLBACK),
) -> StreamingResponse:
    if run_id and run_id in engine.runs:
        run = engine.runs[run_id]
    else:
        run = engine.start_run(scenario_id=scenario_id)
    return StreamingResponse(
        stream_ag_ui_events(run.ag_ui_events),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --- Control Plane Run, HITL, Time-Travel Fork & Guardrails ---
@app.post("/api/runs")
def start_run(req: StartRunRequest) -> dict[str, Any]:
    run = engine.start_run(req.scenario_id, auto_approve_hitl=req.auto_approve_hitl)
    return run.model_dump()


@app.get("/api/runs/{run_id}")
def get_run(run_id: str) -> dict[str, Any]:
    if run_id not in engine.runs:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found")
    return engine.runs[run_id].model_dump()


@app.post("/api/runs/{run_id}/resume")
def resume_hitl(run_id: str, req: HitlDecisionRequest) -> dict[str, Any]:
    try:
        run = engine.resume_hitl(run_id, req)
        return run.model_dump()
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/runs/{run_id}/fork")
def fork_run(run_id: str, req: ForkRequest) -> dict[str, Any]:
    try:
        run, diff = engine.fork_and_replay(run_id, req)
        return {"run": run.model_dump(), "diff": diff.model_dump()}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/guardrails/evaluate")
def guardrails_evaluate(req: GuardrailEvalRequest) -> dict[str, Any]:
    report = evaluate_guardrails(req.text, allow_mutation_with_hitl=req.allow_mutation_with_hitl)
    return report.model_dump()
