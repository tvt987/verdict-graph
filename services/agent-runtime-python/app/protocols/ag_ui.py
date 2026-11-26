"""Real AG-UI Protocol Server-Sent Events (SSE) Encoder & RFC 6902 JSON Patch Helpers."""

from __future__ import annotations

import json
from typing import Any, Iterator
from app.models import AgUiEvent, NodeId


def build_state_delta_event(
    *,
    event_id: str,
    run_id: str,
    branch_id: str,
    node_id: NodeId,
    patches: list[dict[str, Any]],
) -> AgUiEvent:
    """Create an AG-UI STATE_DELTA event carrying valid RFC 6902 JSON Patch operations."""
    return AgUiEvent(
        id=event_id,
        type="STATE_DELTA",
        run_id=run_id,
        branch_id=branch_id,
        node_id=node_id,
        data={"delta": patches},
    )


def format_sse_frame(event: AgUiEvent) -> str:
    """Serialize an AgUiEvent as an RFC-compliant Server-Sent Events frame."""
    payload = event.model_dump_json()
    return f"id: {event.id}\nevent: {event.type}\ndata: {payload}\n\n"


def stream_ag_ui_events(events: list[AgUiEvent]) -> Iterator[str]:
    """Yield SSE frames sequentially for FastAPI StreamingResponse."""
    for ev in events:
        yield format_sse_frame(ev)
