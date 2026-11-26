"""OpenTelemetry GenAI Semantic Conventions Span Collector & FinOps Pricing Engine."""

from __future__ import annotations

import hashlib
from typing import Any, Literal
from app.models import NodeId, OTelGenAISpan


# Pricing per 1M tokens (USD) for transparent FinOps accounting
MODEL_PRICING_PER_1M: dict[str, tuple[float, float]] = {
    "gpt-4.1": (2.00, 8.00),
    "gpt-4.1-mini": (0.40, 1.60),
    "claude-sonnet-4": (3.00, 15.00),
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.5-flash": (0.15, 0.60),
    "policy-classifier-v3": (0.05, 0.05),
    "mcp-tool-runtime": (0.0, 0.0),
    "a2a-remote-peer": (1.50, 6.00),
}


def compute_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    """Compute exact USD cost from token counts using FinOps model rate table."""
    in_rate, out_rate = MODEL_PRICING_PER_1M.get(model, (1.00, 4.00))
    cost = (input_tokens / 1_000_000.0) * in_rate + (output_tokens / 1_000_000.0) * out_rate
    return round(cost, 6)


def make_trace_id(seed: str) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:32]


def make_span_id(seed: str) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]


class GenAITelemetryCollector:
    """Collects OpenTelemetry GenAI Semantic Convention spans for a run."""

    def __init__(self, run_id: str, branch_id: str = "main") -> None:
        self.run_id = run_id
        self.branch_id = branch_id
        self.trace_id = make_trace_id(f"{run_id}:{branch_id}")
        self.spans: list[OTelGenAISpan] = []
        self._cursor_ms = 0.0

    def record_span(
        self,
        *,
        name: str,
        node_id: NodeId,
        operation: str,
        model: str,
        system: str,
        duration_ms: float,
        input_tokens: int = 0,
        output_tokens: int = 0,
        ttft_ms: float | None = None,
        parent_span_id: str | None = None,
        status: Literal["OK", "ERROR", "PAUSED"] = "OK",
        extra_attributes: dict[str, Any] | None = None,
    ) -> OTelGenAISpan:
        cost_usd = compute_cost_usd(model, input_tokens, output_tokens)
        span_id = make_span_id(f"{self.trace_id}:{len(self.spans)}:{name}")
        attrs: dict[str, Any] = {
            "gen_ai.operation.name": operation,
            "gen_ai.system": system,
            "gen_ai.request.model": model,
            "gen_ai.usage.input_tokens": input_tokens,
            "gen_ai.usage.output_tokens": output_tokens,
            "gen_ai.usage.total_tokens": input_tokens + output_tokens,
            "gen_ai.response.ttft_ms": ttft_ms if ttft_ms is not None else round(duration_ms * 0.28, 1),
            "verdict.finops.cost_usd": cost_usd,
            "verdict.graph.branch_id": self.branch_id,
            "verdict.graph.node_id": node_id.value,
        }
        if extra_attributes:
            attrs.update(extra_attributes)

        span = OTelGenAISpan(
            trace_id=self.trace_id,
            span_id=span_id,
            parent_span_id=parent_span_id,
            name=name,
            node_id=node_id,
            start_ms=round(self._cursor_ms, 1),
            duration_ms=round(duration_ms, 1),
            status=status,
            attributes=attrs,
        )
        self.spans.append(span)
        self._cursor_ms += duration_ms + 14.0
        return span

    def summarize(self) -> dict[str, float | int]:
        total_input = sum(int(s.attributes.get("gen_ai.usage.input_tokens", 0)) for s in self.spans)
        total_output = sum(int(s.attributes.get("gen_ai.usage.output_tokens", 0)) for s in self.spans)
        total_cost = round(sum(float(s.attributes.get("verdict.finops.cost_usd", 0.0)) for s in self.spans), 6)
        total_latency = round(sum(s.duration_ms for s in self.spans), 1)
        return {
            "span_count": len(self.spans),
            "total_input_tokens": total_input,
            "total_output_tokens": total_output,
            "total_tokens": total_input + total_output,
            "total_cost_usd": total_cost,
            "total_latency_ms": total_latency,
        }
