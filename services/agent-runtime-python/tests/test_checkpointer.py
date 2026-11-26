"""Tests for ImmutableCheckpointer DAG lineage & branch forking."""

import pytest
from app.checkpointer import ImmutableCheckpointer
from app.models import NodeId


def test_checkpoint_immutability_against_external_mutation() -> None:
    cp = ImmutableCheckpointer()
    original_state = {"top_k": 24, "nested": {"flags": ["a"]}}
    saved = cp.save(
        run_id="run-1",
        branch_id="main",
        node_id=NodeId.PLANNER,
        label="Step 1",
        state_snapshot=original_state,
    )
    # Mutate both input dict and returned snapshot
    original_state["top_k"] = 999
    original_state["nested"]["flags"].append("corrupted")
    saved.state_snapshot["top_k"] = -1

    fetched = cp.get("CP-01")
    assert fetched.state_snapshot["top_k"] == 24
    assert fetched.state_snapshot["nested"]["flags"] == ["a"]


def test_checkpoint_lineage_and_fork_isolation() -> None:
    cp = ImmutableCheckpointer()
    cp1 = cp.save(run_id="run-1", branch_id="main", node_id=NodeId.PLANNER, label="Plan", state_snapshot={"top_k": 24, "rerank": False})
    cp2 = cp.save(run_id="run-1", branch_id="main", node_id=NodeId.MCP_SCOUT, label="Scout", state_snapshot={"top_k": 24, "rerank": False})
    cp3 = cp.save(run_id="run-1", branch_id="main", node_id=NodeId.SYNTHESIZER, label="Verdict", state_snapshot={"groundedness": 0.61})

    assert cp2.parent_checkpoint_id == cp1.checkpoint_id
    assert cp3.parent_checkpoint_id == cp2.checkpoint_id

    source, forked_state = cp.fork_state(
        checkpoint_id="CP-02",
        new_branch_id="fork-1",
        state_overrides={"top_k": 8, "rerank": True, "strict_grounding": True},
    )
    assert source.checkpoint_id == "CP-02"
    assert forked_state["top_k"] == 8
    assert forked_state["rerank"] is True

    f1 = cp.save(
        run_id="run-1",
        branch_id="fork-1",
        node_id=NodeId.MCP_SCOUT,
        label="Forked Scout",
        state_snapshot=forked_state,
        parent_checkpoint_id=source.checkpoint_id,
    )

    lineage = cp.get_lineage(f1.checkpoint_id)
    assert [c.checkpoint_id for c in lineage] == ["CP-01", "CP-02", "FORK-1-CP-01"]
    # Original CP-02 must remain untouched
    assert cp.get("CP-02").state_snapshot["top_k"] == 24
    assert cp.get("CP-02").state_snapshot["rerank"] is False


def test_duplicate_branch_fork_raises_value_error() -> None:
    cp = ImmutableCheckpointer()
    cp.save(run_id="run-1", branch_id="main", node_id=NodeId.PLANNER, label="Init", state_snapshot={})
    cp.fork_state(checkpoint_id="CP-01", new_branch_id="fork-1", state_overrides={})
    with pytest.raises(ValueError, match="already exists"):
        cp.fork_state(checkpoint_id="CP-01", new_branch_id="fork-1", state_overrides={})
