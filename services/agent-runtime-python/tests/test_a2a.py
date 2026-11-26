"""Tests for A2A AgentCard Discovery and Task Lifecycle."""

from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_a2a_agent_card_schema() -> None:
    res = client.get("/.well-known/agent.json")
    assert res.status_code == 200
    card = res.json()
    assert card["protocolVersion"] == "0.2.2"
    assert card["capabilities"]["stateTransitionHistory"] is True
    skill_ids = {s["id"] for s in card["skills"]}
    assert {"sre-safe-rollback", "iso27001-ledger-verify"} <= skill_ids


def test_a2a_task_submission_and_retrieval() -> None:
    send_res = client.post(
        "/a2a/tasks/send",
        json={
            "skillId": "iso27001-ledger-verify",
            "message": {"role": "user", "parts": [{"type": "text", "text": "Verify Q4 ledger"}]},
        },
    )
    assert send_res.status_code == 200
    task = send_res.json()
    assert task["status"]["state"] == "completed"
    assert [h["state"] for h in task["history"]] == ["submitted", "working", "completed"]
    assert task["artifacts"][0]["signature"].startswith("ed25519-sim:")

    get_res = client.get(f"/a2a/tasks/{task['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == task["id"]

    missing = client.get("/a2a/tasks/nonexistent-id")
    assert missing.status_code == 404
