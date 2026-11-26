"""Tests for Real MCP JSON-RPC 2.0 Streamable HTTP endpoint."""

from fastapi.testclient import TestClient
from app.main import app


client = TestClient(app)


def test_mcp_initialize_and_tools_list() -> None:
    init_res = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
    assert init_res.status_code == 200
    body = init_res.json()
    assert body["jsonrpc"] == "2.0"
    assert body["id"] == 1
    assert body["result"]["serverInfo"]["name"] == "verdict-graph-mcp-gateway"

    list_res = client.post("/mcp", json={"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    tools = list_res.json()["result"]["tools"]
    names = {t["name"] for t in tools}
    assert {"k8s_telemetry.query_logs", "vector_corpus.hybrid_search", "ledger_vault.fetch_receipts"} <= names


def test_mcp_tools_call_and_resources_read() -> None:
    call_res = client.post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": "c-1",
            "method": "tools/call",
            "params": {"name": "k8s_telemetry.query_logs", "arguments": {"cluster": "concung-voucher-prod", "service": "voucher-api"}},
        },
    )
    payload = call_res.json()["result"]["content"][0]["json"]
    assert payload["p99_latency_ms"] == 842.4
    assert payload["revision_stable"] == "v4.18.2"

    res_read = client.post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": "r-1",
            "method": "resources/read",
            "params": {"uri": "mcp://vendor-docs/q4-partner-memo.md"},
        },
    )
    assert "IGNORE PREVIOUS INSTRUCTIONS" in res_read.json()["result"]["contents"][0]["text"]


def test_mcp_jsonrpc_spec_error_codes() -> None:
    bad_req = client.post("/mcp", json={"id": 9, "method": "initialize"})
    assert bad_req.json()["error"]["code"] == -32600

    unknown_method = client.post("/mcp", json={"jsonrpc": "2.0", "id": 10, "method": "prompts/nonexistent"})
    assert unknown_method.json()["error"]["code"] == -32601

    bad_resource = client.post(
        "/mcp",
        json={"jsonrpc": "2.0", "id": 11, "method": "resources/read", "params": {"uri": "mcp://missing"}},
    )
    assert bad_resource.json()["error"]["code"] == -32602
