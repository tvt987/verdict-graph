"""Immutable LangGraph-compatible Checkpointer with DAG lineage and Branch Forking."""

from __future__ import annotations

import copy
from typing import Any, Literal
from app.models import Checkpoint, NodeId


class ImmutableCheckpointer:
    """Stores immutable state snapshots indexed by checkpoint_id with parent-child DAG tracking."""

    def __init__(self) -> None:
        self._checkpoints: dict[str, Checkpoint] = {}
        self._branch_order: dict[str, list[str]] = {}

    def save(
        self,
        *,
        run_id: str,
        branch_id: str,
        node_id: NodeId,
        label: str,
        state_snapshot: dict[str, Any],
        parent_checkpoint_id: str | None = None,
        input_tokens: int = 0,
        output_tokens: int = 0,
        latency_ms: float = 0.0,
        cost_usd: float = 0.0,
        groundedness: float | None = None,
        guardrail_status: Literal["pass", "rerouted", "blocked", "pending"] = "pass",
    ) -> Checkpoint:
        branch_list = self._branch_order.setdefault(branch_id, [])
        step_index = len(branch_list) + 1
        prefix = "CP" if branch_id == "main" else f"{branch_id.upper()}-CP"
        cp_id = f"{prefix}-{step_index:02d}"

        # Deep copy enforces snapshot immutability against external mutation
        frozen_state = copy.deepcopy(state_snapshot)

        if parent_checkpoint_id is None and branch_list:
            parent_checkpoint_id = branch_list[-1]

        cp = Checkpoint(
            checkpoint_id=cp_id,
            run_id=run_id,
            branch_id=branch_id,
            parent_checkpoint_id=parent_checkpoint_id,
            step_index=step_index,
            node_id=node_id,
            label=label,
            state_snapshot=frozen_state,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            latency_ms=round(latency_ms, 1),
            cost_usd=round(cost_usd, 6),
            groundedness=groundedness,
            guardrail_status=guardrail_status,
        )
        self._checkpoints[cp_id] = cp
        branch_list.append(cp_id)
        return cp.model_copy(deep=True)

    def get(self, checkpoint_id: str) -> Checkpoint:
        if checkpoint_id not in self._checkpoints:
            raise KeyError(f"Checkpoint '{checkpoint_id}' not found")
        return self._checkpoints[checkpoint_id].model_copy(deep=True)

    def get_branch(self, branch_id: str) -> list[Checkpoint]:
        ids = self._branch_order.get(branch_id, [])
        return [self._checkpoints[cid].model_copy(deep=True) for cid in ids]

    def get_lineage(self, checkpoint_id: str) -> list[Checkpoint]:
        """Walk parent pointers from checkpoint back to root, returning root -> leaf order."""
        chain: list[Checkpoint] = []
        cursor: str | None = checkpoint_id
        visited: set[str] = set()
        while cursor is not None:
            if cursor in visited:
                raise RuntimeError(f"Cycle detected in checkpoint DAG at {cursor}")
            visited.add(cursor)
            cp = self.get(cursor)
            chain.append(cp)
            cursor = cp.parent_checkpoint_id
        chain.reverse()
        return chain

    def fork_state(
        self,
        *,
        checkpoint_id: str,
        new_branch_id: str,
        state_overrides: dict[str, Any],
    ) -> tuple[Checkpoint, dict[str, Any]]:
        """Create a forked initial state snapshot from an existing immutable checkpoint without altering the original."""
        if new_branch_id in self._branch_order:
            raise ValueError(f"Branch '{new_branch_id}' already exists")

        source = self.get(checkpoint_id)
        merged_state = copy.deepcopy(source.state_snapshot)
        merged_state.update(copy.deepcopy(state_overrides))
        merged_state["_forked_from"] = checkpoint_id
        merged_state["_branch_id"] = new_branch_id

        # Seed branch history with cloned ancestor prefix up to fork point for clear DAG ancestry
        self._branch_order[new_branch_id] = []
        return source, merged_state

    def list_branches(self) -> list[str]:
        return list(self._branch_order.keys())
