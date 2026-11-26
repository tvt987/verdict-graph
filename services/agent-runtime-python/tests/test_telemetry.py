"""Tests for OpenTelemetry GenAI Semantic Conventions Span Collector & FinOps Pricing."""

from app.models import NodeId
from app.telemetry import GenAITelemetryCollector, compute_cost_usd


def test_finops_cost_calculation_precision() -> None:
    # claude-sonnet-4: $3/1M input, $15/1M output
    cost = compute_cost_usd("claude-sonnet-4", input_tokens=10_000, output_tokens=2_000)
    assert cost == 0.06


def test_otel_genai_semantic_conventions_attributes() -> None:
    collector = GenAITelemetryCollector(run_id="run-otel-1", branch_id="main")
    s1 = collector.record_span(
        name="supervisor_planner.route",
        node_id=NodeId.PLANNER,
        operation="chat",
        model="gpt-4.1",
        system="openai",
        duration_ms=120.0,
        input_tokens=1000,
        output_tokens=250,
    )
    s2 = collector.record_span(
        name="mcp.query",
        node_id=NodeId.MCP_SCOUT,
        operation="execute_tool",
        model="mcp-tool-runtime",
        system="mcp",
        duration_ms=50.0,
        parent_span_id=s1.span_id,
    )

    assert len(s1.trace_id) == 32
    assert len(s1.span_id) == 16
    assert s2.parent_span_id == s1.span_id
    assert s1.attributes["gen_ai.operation.name"] == "chat"
    assert s1.attributes["gen_ai.request.model"] == "gpt-4.1"
    assert s1.attributes["gen_ai.usage.input_tokens"] == 1000
    assert s1.attributes["gen_ai.usage.output_tokens"] == 250
    assert s1.attributes["verdict.finops.cost_usd"] == 0.004

    summary = collector.summarize()
    assert summary["span_count"] == 2
    assert summary["total_tokens"] == 1250
    assert summary["total_latency_ms"] == 170.0
    assert summary["total_cost_usd"] == 0.004
