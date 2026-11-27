"""Verdict Graph v4.0 FastAPI Multi-Agent Control Plane API."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .dag_engine import (
    MODEL_CATALOG,
    OWASP_FIREWALL_RULES,
    DagRunRequest,
    DagRunResponse,
    DagValidationError,
    FinOpsRouteRequest,
    FinOpsRouteResponse,
    FirewallScanRequest,
    FirewallScanResponse,
    route_finops_pareto,
    scan_prompt_owasp,
    validate_and_run_dag,
)


app = FastAPI(
    title="Verdict Graph v4.0 Multi-Agent Control Plane API",
    version=__version__,
    description=(
        "Production Python 3.12 FastAPI control plane exposing deterministic DAG validation & cycle detection, "
        "Token/USD Budget Circuit Breakers, OWASP LLM01-LLM10 Prompt Firewall scanning, and FinOps Pareto routing."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health", tags=["System"])
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "verdict-graph-control-plane-api",
        "version": __version__,
        "models_registered": len(MODEL_CATALOG),
        "owasp_rules_loaded": len(OWASP_FIREWALL_RULES),
        "capabilities": [
            "dag-topological-cycle-detection",
            "token-usd-budget-circuit-breaker",
            "owasp-llm-top10-prompt-firewall",
            "finops-pareto-model-router",
        ],
    }


@app.post("/api/v1/dag/validate-and-run", response_model=DagRunResponse, tags=["DAG Engine"])
def dag_validate_and_run(req: DagRunRequest) -> DagRunResponse:
    """Validate DAG acyclicity via Kahn + DFS cycle detection and execute trace with Budget Circuit Breaker."""
    try:
        return validate_and_run_dag(req)
    except DagValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": exc.code,
                "message": exc.message,
                "cycle_nodes": exc.cycle_nodes,
            },
        ) from exc


@app.post("/api/v1/firewall/scan", response_model=FirewallScanResponse, tags=["Prompt Firewall"])
def firewall_scan(req: FirewallScanRequest) -> FirewallScanResponse:
    """Scan an arbitrary prompt against OWASP LLM01-LLM10 threat vectors and return ALLOW/SANITIZE_WARN/BLOCK."""
    return scan_prompt_owasp(req)


@app.post("/api/v1/finops/route", response_model=FinOpsRouteResponse, tags=["FinOps Router"])
def finops_route(req: FinOpsRouteRequest) -> FinOpsRouteResponse:
    """Select the Pareto-optimal LLM under latency, cost, and quality SLA constraints."""
    return route_finops_pareto(req)
