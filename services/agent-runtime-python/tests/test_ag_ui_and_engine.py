"""Tests for AG-UI SSE Stream, All 4 Enterprise Scenarios, HITL Resume, and Time-Travel Fork Diff."""

from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_scenario_a_hitl_pause_and_canary_resume() -> None:
    start = client.post("/api/runs", json={"scenario_id": "outage_rollback"})
    assert start.status_code == 200
    run = start.json()
    assert run["status"] == "paused_hitl"
    assert run["hitl_context"]["checkpoint_id"] == "CP-05"
    assert any(ev["type"] == "INTERRUPT_REQUIRED" for ev in run["ag_ui_events"])

    resume = client.post(
        f"/api/runs/{run['run_id']}/resume",
        json={"action": "modify_canary", "canary_percent": 25, "operator_note": "25% canary verification"},
    )
    assert resume.status_code == 200
    resumed = resume.json()
    assert resumed["status"] == "completed"
    assert "25% traffic" in resumed["branches"]["main"]["verdict_summary"]
    assert any(ev["type"] == "RUN_FINISHED" for ev in resumed["ag_ui_events"])


def test_scenario_b_prompt_injection_cyclic_reroute() -> None:
    res = client.post("/api/runs", json={"scenario_id": "prompt_injection"})
    assert res.status_code == 200
    run = res.json()
    assert run["status"] == "completed"
    main_branch = run["branches"]["main"]
    assert main_branch["guardrail_status"] == "rerouted"
    node_sequence = [cp["node_id"] for cp in main_branch["checkpoints"]]
    # Cyclic graph verification: planner -> mcp -> guardrail -> planner -> synthesizer
    assert node_sequence == [
        "supervisor_planner",
        "mcp_context_scout",
        "policy_guardrail",
        "supervisor_planner",
        "grounded_synthesizer",
    ]


def test_scenario_c_cross_org_a2a_audit() -> None:
    res = client.post("/api/runs", json={"scenario_id": "a2a_financial_audit"})
    assert res.status_code == 200
    run = res.json()
    assert run["status"] == "completed"
    assert len(run["a2a_logs"]) == 2
    assert run["a2a_logs"][0]["operation"] == "agent_card_discovery"
    assert run["a2a_logs"][1]["operation"] == "artifact_exchange"


def test_scenario_d_time_travel_fork_improves_groundedness_and_reduces_cost() -> None:
    res = client.post("/api/runs", json={"scenario_id": "hallucination_fork"})
    assert res.status_code == 200
    run = res.json()
    main_branch = run["branches"]["main"]
    assert main_branch["groundedness"] == 0.61

    fork_res = client.post(
        f"/api/runs/{run['run_id']}/fork",
        json={
            "checkpoint_id": "CP-02",
            "state_overrides": {"top_k": 8, "rerank": True, "strict_grounding": True},
        },
    )
    assert fork_res.status_code == 200
    body = fork_res.json()
    diff = body["diff"]
    fork_branch = body["run"]["branches"]["fork-1"]

    assert fork_branch["groundedness"] == 0.99
    assert diff["groundedness_delta"] == 0.38
    assert diff["cost_delta_usd"] < 0
    assert diff["cost_delta_pct"] <= -35.0
    assert diff["tokens_delta"] < 0


def test_ag_ui_sse_stream_frames() -> None:
    res = client.get("/ag-ui/stream", params={"scenario_id": "outage_rollback"})
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    text = res.text
    assert "event: RUN_STARTED" in text
    assert "event: INTERRUPT_REQUIRED" in text
    assert "event: STATE_DELTA" in text
