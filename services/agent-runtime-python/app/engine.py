"""Cyclic Multi-Agent Execution Engine supporting 4 Enterprise Scenarios, HITL Interrupts, and Time-Travel Forking."""

from __future__ import annotations

import uuid
from typing import Any

from app.checkpointer import ImmutableCheckpointer
from app.guardrails import evaluate_guardrails
from app.models import (
    A2AWireEnvelope,
    AgUiEvent,
    BranchDiff,
    BranchSummary,
    ForkRequest,
    HitlAction,
    HitlDecisionRequest,
    McpWireEnvelope,
    NodeId,
    RunRecord,
    RunStatus,
    ScenarioId,
)
from app.protocols.a2a import A2ATaskStore, build_agent_card
from app.protocols.ag_ui import build_state_delta_event
from app.protocols.mcp import handle_mcp_jsonrpc
from app.telemetry import GenAITelemetryCollector, compute_cost_usd


class VerdictGraphEngine:
    """Orchestrates cyclic state-machine executions with MCP, A2A, AG-UI, OTel GenAI, and immutable checkpoints."""

    def __init__(self) -> None:
        self.runs: dict[str, RunRecord] = {}
        self.checkpointers: dict[str, ImmutableCheckpointer] = {}
        self.a2a_store = A2ATaskStore()

    def _emit_ag_ui(
        self,
        run: RunRecord,
        event_type: Any,
        branch_id: str,
        node_id: NodeId | None,
        data: dict[str, Any],
    ) -> None:
        ev = AgUiEvent(
            id=f"agui-{len(run.ag_ui_events) + 1:03d}",
            type=event_type,
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=node_id,
            data=data,
        )
        run.ag_ui_events.append(ev)

    def start_run(self, scenario_id: ScenarioId, auto_approve_hitl: bool = False) -> RunRecord:
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        cp = ImmutableCheckpointer()
        collector = GenAITelemetryCollector(run_id=run_id, branch_id="main")
        run = RunRecord(run_id=run_id, scenario_id=scenario_id, active_branch_id="main", status=RunStatus.RUNNING)

        self.runs[run_id] = run
        self.checkpointers[run_id] = cp

        self._emit_ag_ui(run, "RUN_STARTED", "main", NodeId.PLANNER, {"scenario_id": scenario_id.value})

        if scenario_id == ScenarioId.OUTAGE_ROLLBACK:
            self._run_outage_rollback(run, cp, collector, auto_approve_hitl)
        elif scenario_id == ScenarioId.PROMPT_INJECTION:
            self._run_prompt_injection(run, cp, collector)
        elif scenario_id == ScenarioId.A2A_AUDIT:
            self._run_a2a_audit(run, cp, collector)
        elif scenario_id == ScenarioId.TIME_TRAVEL_FORK:
            self._run_hallucination_main(run, cp, collector)

        run.otel_spans.extend(collector.spans)
        return run

    def _run_outage_rollback(
        self,
        run: RunRecord,
        cp: ImmutableCheckpointer,
        collector: GenAITelemetryCollector,
        auto_approve_hitl: bool,
    ) -> None:
        branch_id = "main"
        # Step 1: Supervisor Planner
        self._emit_ag_ui(run, "STEP_STARTED", branch_id, NodeId.PLANNER, {"label": "Triage P99 Checkout Alert"})
        s1 = collector.record_span(
            name="supervisor_planner.triage",
            node_id=NodeId.PLANNER,
            operation="chat",
            model="gpt-4.1",
            system="openai",
            duration_ms=148.0,
            input_tokens=620,
            output_tokens=190,
        )
        state: dict[str, Any] = {
            "incident_id": "INC-2026-8841",
            "cluster": "concung-voucher-prod",
            "slo_p99_ms": 45,
            "observed_p99_ms": 842.4,
            "budget_usd": 0.10,
            "route": "mcp_context_scout",
        }
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.PLANNER,
            label="Supervisor Triage Plan",
            state_snapshot=state,
            input_tokens=620,
            output_tokens=190,
            latency_ms=148.0,
            cost_usd=s1.attributes["verdict.finops.cost_usd"],
        )

        # Step 2: MCP Context Scout
        self._emit_ag_ui(run, "TOOL_CALL_START", branch_id, NodeId.MCP_SCOUT, {"tool": "k8s_telemetry.query_logs"})
        mcp_req = {
            "jsonrpc": "2.0",
            "id": "mcp-01",
            "method": "tools/call",
            "params": {
                "name": "k8s_telemetry.query_logs",
                "arguments": {"cluster": "concung-voucher-prod", "service": "voucher-redemption-api", "window_minutes": 15},
            },
        }
        mcp_res = handle_mcp_jsonrpc(mcp_req)
        run.mcp_logs.append(
            McpWireEnvelope(
                id="mcp-env-01",
                method="tools/call",
                server="mcp://k8s-telemetry.internal",
                rtt_ms=64.2,
                request=mcp_req,
                response=mcp_res,
            )
        )
        self._emit_ag_ui(run, "TOOL_CALL_RESULT", branch_id, NodeId.MCP_SCOUT, {"tool": "k8s_telemetry.query_logs", "ok": True})
        s2 = collector.record_span(
            name="mcp_context_scout.query_logs",
            node_id=NodeId.MCP_SCOUT,
            operation="execute_tool",
            model="mcp-tool-runtime",
            system="mcp",
            duration_ms=64.2,
            parent_span_id=s1.span_id,
            extra_attributes={"mcp.method": "tools/call", "mcp.tool.name": "k8s_telemetry.query_logs"},
        )
        state = {
            **state,
            "root_cause": "Redis Lua lock contention in v4.19.0-rc2",
            "stable_revision": "v4.18.2",
            "rps": 5140,
        }
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.MCP_SCOUT,
            label="MCP Telemetry Collected",
            state_snapshot=state,
            latency_ms=64.2,
            cost_usd=s2.attributes["verdict.finops.cost_usd"],
        )

        # Step 3: A2A Specialist Agent
        card = build_agent_card()
        run.a2a_logs.append(
            A2AWireEnvelope(
                id="a2a-01",
                operation="agent_card_discovery",
                peer_agent="sre-remediator.internal",
                rtt_ms=22.5,
                state="discovered",
                payload=card,
            )
        )
        task = self.a2a_store.submit_task(
            {
                "skillId": "sre-safe-rollback",
                "message": {"role": "user", "parts": [{"type": "text", "text": "Prepare safe rollback v4.19.0-rc2 -> v4.18.2"}]},
            }
        )
        run.a2a_logs.append(
            A2AWireEnvelope(
                id="a2a-02",
                operation="tasks/send",
                peer_agent="sre-remediator.internal",
                rtt_ms=192.4,
                task_id=task["id"],
                state="completed",
                payload=task,
            )
        )
        s3 = collector.record_span(
            name="a2a_specialist.sre_rollback_plan",
            node_id=NodeId.A2A_SPECIALIST,
            operation="delegate_a2a",
            model="a2a-remote-peer",
            system="a2a",
            duration_ms=214.9,
            input_tokens=780,
            output_tokens=310,
            parent_span_id=s1.span_id,
            extra_attributes={"a2a.task.id": task["id"], "a2a.skill": "sre-safe-rollback"},
        )
        state = {**state, "a2a_task_id": task["id"], "rollback_plan": task["artifacts"][0]["parts"][0]["data"]}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.A2A_SPECIALIST,
            label="A2A Rollback Plan Ready",
            state_snapshot=state,
            input_tokens=780,
            output_tokens=310,
            latency_ms=214.9,
            cost_usd=s3.attributes["verdict.finops.cost_usd"],
        )

        # Step 4: Policy & Injection Guardrail
        report = evaluate_guardrails("Execute staged rollback of voucher-redemption-api to v4.18.2 with HITL approval.")
        s4 = collector.record_span(
            name="policy_guardrail.verify",
            node_id=NodeId.GUARDRAIL,
            operation="guardrail_scan",
            model="policy-classifier-v3",
            system="verdict_policy",
            duration_ms=34.0,
            input_tokens=420,
            output_tokens=60,
            parent_span_id=s1.span_id,
            extra_attributes={"verdict.guardrail.risk_score": report.max_risk_score, "verdict.guardrail.passed": report.passed},
        )
        state = {**state, "guardrail_risk": report.max_risk_score, "guardrail_action": report.action}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.GUARDRAIL,
            label="Policy Guardrail Verified",
            state_snapshot=state,
            input_tokens=420,
            output_tokens=60,
            latency_ms=34.0,
            cost_usd=s4.attributes["verdict.finops.cost_usd"],
            guardrail_status="pass",
        )

        # Step 5: HITL Approval Gate (PAUSE unless auto_approve_hitl)
        hitl_ctx = {
            "checkpoint_id": "CP-05",
            "title": "High-Risk Production Mutation Requires Operator Sign-Off",
            "cluster": "concung-voucher-prod (712 retail stores)",
            "proposed_action": "Rollback voucher-redemption-api from v4.19.0-rc2 to v4.18.2",
            "default_canary_percent": 100,
        }
        state = {**state, "hitl_status": "awaiting_operator", "canary_percent": 100}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.HITL_GATE,
            label="HITL Interrupt Checkpoint",
            state_snapshot=state,
            latency_ms=12.0,
            guardrail_status="pending",
        )
        self._emit_ag_ui(run, "INTERRUPT_REQUIRED", branch_id, NodeId.HITL_GATE, hitl_ctx)
        run.ag_ui_events.append(
            build_state_delta_event(
                event_id=f"agui-{len(run.ag_ui_events) + 1:03d}",
                run_id=run.run_id,
                branch_id=branch_id,
                node_id=NodeId.HITL_GATE,
                patches=[{"op": "replace", "path": "/status", "value": "paused_hitl"}],
            )
        )

        run.hitl_context = hitl_ctx
        run.status = RunStatus.PAUSED_HITL
        self._update_branch_summary(
            run,
            branch_id,
            cp,
            status=RunStatus.PAUSED_HITL,
            groundedness=0.96,
            guardrail_status="pass",
            verdict_summary="Paused at HITL Gate awaiting operator rollback authorization.",
        )

        if auto_approve_hitl:
            self.resume_hitl(run.run_id, HitlDecisionRequest(action=HitlAction.APPROVE_ROLLBACK, canary_percent=100))

    def resume_hitl(self, run_id: str, decision: HitlDecisionRequest) -> RunRecord:
        if run_id not in self.runs:
            raise KeyError(f"Run '{run_id}' not found")
        run = self.runs[run_id]
        cp = self.checkpointers[run_id]
        if run.status != RunStatus.PAUSED_HITL:
            raise ValueError(f"Run '{run_id}' is not paused at HITL gate (status={run.status})")

        branch_id = run.active_branch_id
        latest = cp.get_branch(branch_id)[-1]
        collector = GenAITelemetryCollector(run_id=run_id, branch_id=branch_id)
        if run.otel_spans:
            collector._cursor_ms = run.otel_spans[-1].start_ms + run.otel_spans[-1].duration_ms + 20.0

        new_state = dict(latest.state_snapshot)
        new_state["hitl_decision"] = decision.action.value
        new_state["canary_percent"] = decision.canary_percent
        new_state["operator_note"] = decision.operator_note

        if decision.action == HitlAction.REJECT_ESCALATE:
            verdict = "Rollback REJECTED by operator. Incident escalated to L3 SRE War Room with cluster traffic pinned."
            status = RunStatus.REJECTED
        elif decision.action == HitlAction.MODIFY_CANARY:
            verdict = (
                f"Staged Canary Rollback ({decision.canary_percent}% traffic) to v4.18.2 EXECUTED. "
                "Canary p99 stabilized at 41.8ms across 712 stores."
            )
            status = RunStatus.COMPLETED
        else:
            verdict = "Full Rollback (100% traffic) to v4.18.2 EXECUTED. Voucher cluster p99 recovered from 842ms to 42.1ms."
            status = RunStatus.COMPLETED

        span = collector.record_span(
            name="grounded_synthesizer.hitl_verdict",
            node_id=NodeId.SYNTHESIZER,
            operation="chat",
            model="claude-sonnet-4",
            system="anthropic",
            duration_ms=176.0,
            input_tokens=840,
            output_tokens=295,
        )
        run.otel_spans.extend(collector.spans)

        new_state["verdict"] = verdict
        new_state["groundedness"] = 0.99
        cp.save(
            run_id=run_id,
            branch_id=branch_id,
            node_id=NodeId.SYNTHESIZER,
            label="Grounded Rollback Verdict",
            state_snapshot=new_state,
            input_tokens=840,
            output_tokens=295,
            latency_ms=176.0,
            cost_usd=span.attributes["verdict.finops.cost_usd"],
            groundedness=0.99,
            guardrail_status="pass",
        )
        run.ag_ui_events.append(
            build_state_delta_event(
                event_id=f"agui-{len(run.ag_ui_events) + 1:03d}",
                run_id=run_id,
                branch_id=branch_id,
                node_id=NodeId.SYNTHESIZER,
                patches=[
                    {"op": "replace", "path": "/status", "value": status.value},
                    {"op": "add", "path": "/canary_percent", "value": decision.canary_percent},
                ],
            )
        )
        self._emit_ag_ui(run, "TEXT_MESSAGE_CONTENT", branch_id, NodeId.SYNTHESIZER, {"text": verdict})
        self._emit_ag_ui(run, "RUN_FINISHED", branch_id, NodeId.SYNTHESIZER, {"status": status.value})

        run.hitl_context = None
        run.status = status
        self._update_branch_summary(
            run,
            branch_id,
            cp,
            status=status,
            groundedness=0.99,
            guardrail_status="pass",
            verdict_summary=verdict,
        )
        return run

    def _run_prompt_injection(self, run: RunRecord, cp: ImmutableCheckpointer, collector: GenAITelemetryCollector) -> None:
        branch_id = "main"
        # Step 1: Planner
        s1 = collector.record_span(
            name="supervisor_planner.init",
            node_id=NodeId.PLANNER,
            operation="chat",
            model="gpt-4.1",
            system="openai",
            duration_ms=122.0,
            input_tokens=510,
            output_tokens=140,
        )
        state: dict[str, Any] = {"task": "Summarize Q4 vendor SLA penalties", "cycle_count": 0}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.PLANNER,
            label="Initial SLA Summary Plan",
            state_snapshot=state,
            input_tokens=510,
            output_tokens=140,
            latency_ms=122.0,
            cost_usd=s1.attributes["verdict.finops.cost_usd"],
        )

        # Step 2: MCP resource read returns poisoned document
        mcp_req = {
            "jsonrpc": "2.0",
            "id": "mcp-inj-01",
            "method": "resources/read",
            "params": {"uri": "mcp://vendor-docs/q4-partner-memo.md"},
        }
        mcp_res = handle_mcp_jsonrpc(mcp_req)
        doc_text = mcp_res["result"]["contents"][0]["text"]
        run.mcp_logs.append(
            McpWireEnvelope(
                id="mcp-env-inj-01",
                method="resources/read",
                server="mcp://vendor-docs.gateway",
                rtt_ms=48.3,
                request=mcp_req,
                response=mcp_res,
            )
        )
        collector.record_span(
            name="mcp_context_scout.read_memo",
            node_id=NodeId.MCP_SCOUT,
            operation="execute_tool",
            model="mcp-tool-runtime",
            system="mcp",
            duration_ms=48.3,
            parent_span_id=s1.span_id,
        )
        state = {**state, "raw_document": doc_text}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.MCP_SCOUT,
            label="Untrusted Vendor Memo Loaded",
            state_snapshot=state,
            latency_ms=48.3,
        )

        # Step 3: Policy Guardrail detects INJ-EXFIL-001 -> blocks & sanitizes -> cyclic reroute to Planner!
        report = evaluate_guardrails(doc_text)
        s3 = collector.record_span(
            name="policy_guardrail.injection_scan",
            node_id=NodeId.GUARDRAIL,
            operation="guardrail_scan",
            model="policy-classifier-v3",
            system="verdict_policy",
            duration_ms=29.5,
            input_tokens=480,
            output_tokens=75,
            parent_span_id=s1.span_id,
            status="ERROR",
            extra_attributes={
                "verdict.guardrail.risk_score": report.max_risk_score,
                "verdict.guardrail.rules": [f.rule_id for f in report.findings],
                "verdict.guardrail.action": report.action,
            },
        )
        state = {
            **state,
            "guardrail_blocked_rules": [f.rule_id for f in report.findings],
            "risk_score": report.max_risk_score,
            "sanitized_document": report.sanitized_text,
            "cycle_count": 1,
        }
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.GUARDRAIL,
            label="INJ-EXFIL-001 Blocked & Sanitized",
            state_snapshot=state,
            input_tokens=480,
            output_tokens=75,
            latency_ms=29.5,
            cost_usd=s3.attributes["verdict.finops.cost_usd"],
            guardrail_status="rerouted",
        )
        run.ag_ui_events.append(
            build_state_delta_event(
                event_id=f"agui-{len(run.ag_ui_events) + 1:03d}",
                run_id=run.run_id,
                branch_id=branch_id,
                node_id=NodeId.GUARDRAIL,
                patches=[
                    {"op": "add", "path": "/guardrail_violation", "value": "INJ-EXFIL-001"},
                    {"op": "replace", "path": "/risk_score", "value": report.max_risk_score},
                ],
            )
        )

        # Step 4: Cyclic Re-Entry to Supervisor Planner
        s4 = collector.record_span(
            name="supervisor_planner.replan_sanitized",
            node_id=NodeId.PLANNER,
            operation="chat",
            model="gpt-4.1-mini",
            system="openai",
            duration_ms=94.0,
            input_tokens=390,
            output_tokens=115,
            parent_span_id=s3.span_id,
        )
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.PLANNER,
            label="Cyclic Re-Plan (Sanitized Context)",
            state_snapshot={**state, "outbound_tools_disabled": True},
            input_tokens=390,
            output_tokens=115,
            latency_ms=94.0,
            cost_usd=s4.attributes["verdict.finops.cost_usd"],
            guardrail_status="rerouted",
        )

        # Step 5: Grounded Synthesizer
        verdict = (
            "Neutralized indirect prompt injection (INJ-EXFIL-001, risk=0.98) targeting attacker.io. "
            "Sanitized SLA Summary: 48-hour Tier-1 settlement window; credits trigger above 0.8% delayed shipments."
        )
        s5 = collector.record_span(
            name="grounded_synthesizer.safe_summary",
            node_id=NodeId.SYNTHESIZER,
            operation="chat",
            model="claude-sonnet-4",
            system="anthropic",
            duration_ms=152.0,
            input_tokens=540,
            output_tokens=185,
            parent_span_id=s4.span_id,
        )
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.SYNTHESIZER,
            label="Sanitized Verdict & Security Audit",
            state_snapshot={**state, "verdict": verdict, "groundedness": 0.99},
            input_tokens=540,
            output_tokens=185,
            latency_ms=152.0,
            cost_usd=s5.attributes["verdict.finops.cost_usd"],
            groundedness=0.99,
            guardrail_status="rerouted",
        )
        self._emit_ag_ui(run, "TEXT_MESSAGE_CONTENT", branch_id, NodeId.SYNTHESIZER, {"text": verdict})
        self._emit_ag_ui(run, "RUN_FINISHED", branch_id, NodeId.SYNTHESIZER, {"status": "completed"})

        run.status = RunStatus.COMPLETED
        self._update_branch_summary(
            run,
            branch_id,
            cp,
            status=RunStatus.COMPLETED,
            groundedness=0.99,
            guardrail_status="rerouted",
            verdict_summary=verdict,
        )

    def _run_a2a_audit(self, run: RunRecord, cp: ImmutableCheckpointer, collector: GenAITelemetryCollector) -> None:
        branch_id = "main"
        s1 = collector.record_span(
            name="supervisor_planner.audit_scope",
            node_id=NodeId.PLANNER,
            operation="chat",
            model="gemini-2.5-pro",
            system="google",
            duration_ms=136.0,
            input_tokens=590,
            output_tokens=165,
        )
        state: dict[str, Any] = {"quarter": "2026-Q4", "compliance_standard": "ISO-27001", "hash_only": True}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.PLANNER,
            label="Audit Scope & Peer Selection",
            state_snapshot=state,
            input_tokens=590,
            output_tokens=165,
            latency_ms=136.0,
            cost_usd=s1.attributes["verdict.finops.cost_usd"],
        )

        # MCP Ledger read
        mcp_req = {
            "jsonrpc": "2.0",
            "id": "mcp-audit-01",
            "method": "tools/call",
            "params": {"name": "ledger_vault.fetch_receipts", "arguments": {"quarter": "2026-Q4", "hash_only": True}},
        }
        mcp_res = handle_mcp_jsonrpc(mcp_req)
        run.mcp_logs.append(
            McpWireEnvelope(
                id="mcp-env-audit-01",
                method="tools/call",
                server="mcp://ledger-vault.internal",
                rtt_ms=52.1,
                request=mcp_req,
                response=mcp_res,
            )
        )
        collector.record_span(
            name="mcp_context_scout.ledger_merkle",
            node_id=NodeId.MCP_SCOUT,
            operation="execute_tool",
            model="mcp-tool-runtime",
            system="mcp",
            duration_ms=52.1,
            parent_span_id=s1.span_id,
        )
        state = {**state, "ledger_summary": mcp_res["result"]["content"][0]["json"]}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.MCP_SCOUT,
            label="Hashed Ledger Receipts Fetched",
            state_snapshot=state,
            latency_ms=52.1,
        )

        # Cross-Org A2A Discovery + Task Delegation
        card = build_agent_card("https://audit-verifier.finops.org")
        run.a2a_logs.append(
            A2AWireEnvelope(
                id="a2a-audit-01",
                operation="agent_card_discovery",
                peer_agent="audit-verifier.finops.org",
                rtt_ms=31.0,
                state="discovered",
                payload=card,
            )
        )
        task = self.a2a_store.submit_task(
            {
                "skillId": "iso27001-ledger-verify",
                "message": {"role": "user", "parts": [{"type": "text", "text": "Verify 2026-Q4 Merkle root settlement integrity"}]},
            }
        )
        run.a2a_logs.append(
            A2AWireEnvelope(
                id="a2a-audit-02",
                operation="artifact_exchange",
                peer_agent="audit-verifier.finops.org",
                rtt_ms=228.5,
                task_id=task["id"],
                state="completed",
                payload=task,
            )
        )
        s3 = collector.record_span(
            name="a2a_specialist.cross_org_audit",
            node_id=NodeId.A2A_SPECIALIST,
            operation="delegate_a2a",
            model="a2a-remote-peer",
            system="a2a",
            duration_ms=259.5,
            input_tokens=640,
            output_tokens=240,
            parent_span_id=s1.span_id,
        )
        state = {**state, "a2a_attestation": task["artifacts"][0]}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.A2A_SPECIALIST,
            label="Signed A2A Compliance Artifact",
            state_snapshot=state,
            input_tokens=640,
            output_tokens=240,
            latency_ms=259.5,
            cost_usd=s3.attributes["verdict.finops.cost_usd"],
        )

        # Guardrail PII zero-leak verification
        report = evaluate_guardrails("Verified 14,820 hashed ledger entries; zero raw PAN or SSN present.")
        s4 = collector.record_span(
            name="policy_guardrail.pii_check",
            node_id=NodeId.GUARDRAIL,
            operation="guardrail_scan",
            model="policy-classifier-v3",
            system="verdict_policy",
            duration_ms=27.0,
            input_tokens=310,
            output_tokens=45,
            parent_span_id=s3.span_id,
        )
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.GUARDRAIL,
            label="Zero-PII Export Verified",
            state_snapshot={**state, "pii_risk": report.max_risk_score},
            input_tokens=310,
            output_tokens=45,
            latency_ms=27.0,
            cost_usd=s4.attributes["verdict.finops.cost_usd"],
        )

        verdict = (
            "Cross-Org A2A Financial Audit PASSED. Verified 14,820 Q4 settlement entries with zero discrepancies "
            f"and Ed25519 signature {task['artifacts'][0]['signature']}."
        )
        s5 = collector.record_span(
            name="grounded_synthesizer.audit_dossier",
            node_id=NodeId.SYNTHESIZER,
            operation="chat",
            model="claude-sonnet-4",
            system="anthropic",
            duration_ms=144.0,
            input_tokens=680,
            output_tokens=220,
            parent_span_id=s4.span_id,
        )
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.SYNTHESIZER,
            label="Signed Compliance Dossier",
            state_snapshot={**state, "verdict": verdict, "groundedness": 0.99},
            input_tokens=680,
            output_tokens=220,
            latency_ms=144.0,
            cost_usd=s5.attributes["verdict.finops.cost_usd"],
            groundedness=0.99,
        )
        self._emit_ag_ui(run, "TEXT_MESSAGE_CONTENT", branch_id, NodeId.SYNTHESIZER, {"text": verdict})
        self._emit_ag_ui(run, "RUN_FINISHED", branch_id, NodeId.SYNTHESIZER, {"status": "completed"})

        run.status = RunStatus.COMPLETED
        self._update_branch_summary(
            run,
            branch_id,
            cp,
            status=RunStatus.COMPLETED,
            groundedness=0.99,
            guardrail_status="pass",
            verdict_summary=verdict,
        )

    def _run_hallucination_main(self, run: RunRecord, cp: ImmutableCheckpointer, collector: GenAITelemetryCollector) -> None:
        """Main branch deliberately uses suboptimal broad retrieval (top_k=24, rerank=False) yielding weak 0.61 groundedness."""
        branch_id = "main"
        s1 = collector.record_span(
            name="supervisor_planner.broad_plan",
            node_id=NodeId.PLANNER,
            operation="chat",
            model="gpt-4.1",
            system="openai",
            duration_ms=165.0,
            input_tokens=920,
            output_tokens=280,
        )
        state: dict[str, Any] = {
            "query": "How does the voucher cluster prevent double-spending at 5,000 RPS?",
            "top_k": 24,
            "rerank": False,
            "strict_grounding": False,
            "model": "claude-sonnet-4",
        }
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.PLANNER,
            label="Broad Unranked Retrieval Plan",
            state_snapshot=state,
            input_tokens=920,
            output_tokens=280,
            latency_ms=165.0,
            cost_usd=s1.attributes["verdict.finops.cost_usd"],
        )

        # CP-02: Ideal fork point!
        mcp_req = {
            "jsonrpc": "2.0",
            "id": "mcp-rag-01",
            "method": "tools/call",
            "params": {
                "name": "vector_corpus.hybrid_search",
                "arguments": {"query": state["query"], "top_k": 24, "rerank": False},
            },
        }
        mcp_res = handle_mcp_jsonrpc(mcp_req)
        run.mcp_logs.append(
            McpWireEnvelope(
                id="mcp-env-rag-01",
                method="tools/call",
                server="mcp://vector-corpus.internal",
                rtt_ms=188.0,
                request=mcp_req,
                response=mcp_res,
            )
        )
        collector.record_span(
            name="mcp_context_scout.broad_retrieval",
            node_id=NodeId.MCP_SCOUT,
            operation="execute_tool",
            model="mcp-tool-runtime",
            system="mcp",
            duration_ms=188.0,
            parent_span_id=s1.span_id,
            extra_attributes={"rag.top_k": 24, "rag.rerank": False},
        )
        state = {**state, "retrieved_chunks": mcp_res["result"]["content"][0]["json"]["chunks"]}
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.MCP_SCOUT,
            label="Unfiltered Broad Chunks (top_k=24)",
            state_snapshot=state,
            latency_ms=188.0,
            groundedness=0.61,
        )

        # Step 3: Guardrail flags low citation confidence
        s3 = collector.record_span(
            name="policy_guardrail.grounding_audit",
            node_id=NodeId.GUARDRAIL,
            operation="guardrail_scan",
            model="policy-classifier-v3",
            system="verdict_policy",
            duration_ms=54.0,
            input_tokens=2400,
            output_tokens=120,
            parent_span_id=s1.span_id,
        )
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.GUARDRAIL,
            label="Weak Citation Density Warning",
            state_snapshot={**state, "citation_warning": "Legacy unverified docs mixed into context window."},
            input_tokens=2400,
            output_tokens=120,
            latency_ms=54.0,
            cost_usd=s3.attributes["verdict.finops.cost_usd"],
            groundedness=0.61,
        )

        # Step 4: Synthesizer produces noisy high-cost ungrounded answer
        verdict = (
            "The voucher cluster relies on pessimistic SQL table locking with roughly 250ms checkout overhead "
            "[UNVERIFIED: conflates archived 2022 draft with current production architecture]."
        )
        s4 = collector.record_span(
            name="grounded_synthesizer.noisy_verdict",
            node_id=NodeId.SYNTHESIZER,
            operation="chat",
            model="claude-sonnet-4",
            system="anthropic",
            duration_ms=412.0,
            input_tokens=6400,
            output_tokens=980,
            parent_span_id=s3.span_id,
            extra_attributes={"verdict.groundedness": 0.61},
        )
        cp.save(
            run_id=run.run_id,
            branch_id=branch_id,
            node_id=NodeId.SYNTHESIZER,
            label="Low-Groundedness Verdict (0.61)",
            state_snapshot={**state, "verdict": verdict, "groundedness": 0.61},
            input_tokens=6400,
            output_tokens=980,
            latency_ms=412.0,
            cost_usd=s4.attributes["verdict.finops.cost_usd"],
            groundedness=0.61,
        )
        self._emit_ag_ui(run, "TEXT_MESSAGE_CONTENT", branch_id, NodeId.SYNTHESIZER, {"text": verdict})
        self._emit_ag_ui(run, "RUN_FINISHED", branch_id, NodeId.SYNTHESIZER, {"status": "completed", "groundedness": 0.61})

        run.status = RunStatus.COMPLETED
        self._update_branch_summary(
            run,
            branch_id,
            cp,
            status=RunStatus.COMPLETED,
            groundedness=0.61,
            guardrail_status="pass",
            verdict_summary=verdict,
        )

    def fork_and_replay(self, run_id: str, request: ForkRequest) -> tuple[RunRecord, BranchDiff]:
        if run_id not in self.runs:
            raise KeyError(f"Run '{run_id}' not found")
        run = self.runs[run_id]
        cp = self.checkpointers[run_id]

        existing_forks = [b for b in cp.list_branches() if b.startswith("fork-")]
        new_branch_id = request.branch_name or f"fork-{len(existing_forks) + 1}"

        source_cp, forked_state = cp.fork_state(
            checkpoint_id=request.checkpoint_id,
            new_branch_id=new_branch_id,
            state_overrides=request.state_overrides,
        )
        collector = GenAITelemetryCollector(run_id=run_id, branch_id=new_branch_id)
        top_k = int(forked_state.get("top_k", 8))
        rerank = bool(forked_state.get("rerank", True))
        strict_grounding = bool(forked_state.get("strict_grounding", True))
        optimized = rerank and top_k <= 10 and strict_grounding

        # Fork Step 1: Re-run MCP Context Scout with mutated parameters
        mcp_req = {
            "jsonrpc": "2.0",
            "id": f"mcp-fork-{new_branch_id}",
            "method": "tools/call",
            "params": {
                "name": "vector_corpus.hybrid_search",
                "arguments": {"query": forked_state.get("query", "voucher double-spending"), "top_k": top_k, "rerank": rerank},
            },
        }
        mcp_res = handle_mcp_jsonrpc(mcp_req)
        run.mcp_logs.append(
            McpWireEnvelope(
                id=f"mcp-env-{new_branch_id}",
                method="tools/call",
                server="mcp://vector-corpus.internal",
                rtt_ms=72.0 if optimized else 140.0,
                request=mcp_req,
                response=mcp_res,
            )
        )
        s1 = collector.record_span(
            name=f"mcp_context_scout.fork_{new_branch_id}",
            node_id=NodeId.MCP_SCOUT,
            operation="execute_tool",
            model="mcp-tool-runtime",
            system="mcp",
            duration_ms=72.0 if optimized else 140.0,
            extra_attributes={"rag.top_k": top_k, "rag.rerank": rerank},
        )
        forked_state["retrieved_chunks"] = mcp_res["result"]["content"][0]["json"]["chunks"]
        cp.save(
            run_id=run_id,
            branch_id=new_branch_id,
            node_id=NodeId.MCP_SCOUT,
            label=f"Forked Retrieval (top_k={top_k}, rerank={rerank})",
            state_snapshot=forked_state,
            parent_checkpoint_id=source_cp.checkpoint_id,
            latency_ms=s1.duration_ms,
            groundedness=0.99 if optimized else 0.78,
        )

        # Fork Step 2: Guardrail verification
        s2 = collector.record_span(
            name="policy_guardrail.strict_verify",
            node_id=NodeId.GUARDRAIL,
            operation="guardrail_scan",
            model="policy-classifier-v3",
            system="verdict_policy",
            duration_ms=31.0,
            input_tokens=980 if optimized else 1800,
            output_tokens=65,
            parent_span_id=s1.span_id,
        )
        cp.save(
            run_id=run_id,
            branch_id=new_branch_id,
            node_id=NodeId.GUARDRAIL,
            label="Strict Grounding Gate Passed" if optimized else "Partial Grounding Gate",
            state_snapshot={**forked_state, "strict_grounding_verified": optimized},
            input_tokens=980 if optimized else 1800,
            output_tokens=65,
            latency_ms=31.0,
            cost_usd=s2.attributes["verdict.finops.cost_usd"],
            groundedness=0.99 if optimized else 0.78,
        )

        # Fork Step 3: Grounded Synthesizer
        if optimized:
            verdict = (
                "Verified against SPEC-2026-04 & BENCH-2026-11: Voucher double-spending is prevented via Redis WATCH + "
                "atomic Lua CAS locks (120ms TTL, bounded exponential backoff) paired with Dapper zero-allocation reads "
                "holding p99 at 42ms under 5,200 RPS."
            )
            syn_in, syn_out, syn_ms, groundedness = 2650, 410, 198.0, 0.99
        else:
            verdict = (
                "Partial recovery: retrieval window narrowed, but strict grounding or cross-encoder reranking remains disabled."
            )
            syn_in, syn_out, syn_ms, groundedness = 4200, 640, 290.0, 0.78

        s3 = collector.record_span(
            name="grounded_synthesizer.fork_verdict",
            node_id=NodeId.SYNTHESIZER,
            operation="chat",
            model="claude-sonnet-4",
            system="anthropic",
            duration_ms=syn_ms,
            input_tokens=syn_in,
            output_tokens=syn_out,
            parent_span_id=s2.span_id,
            extra_attributes={"verdict.groundedness": groundedness},
        )
        cp.save(
            run_id=run_id,
            branch_id=new_branch_id,
            node_id=NodeId.SYNTHESIZER,
            label=f"Forked Verdict ({groundedness:.2f})",
            state_snapshot={**forked_state, "verdict": verdict, "groundedness": groundedness},
            input_tokens=syn_in,
            output_tokens=syn_out,
            latency_ms=syn_ms,
            cost_usd=s3.attributes["verdict.finops.cost_usd"],
            groundedness=groundedness,
        )

        run.otel_spans.extend(collector.spans)
        run.ag_ui_events.append(
            build_state_delta_event(
                event_id=f"agui-{len(run.ag_ui_events) + 1:03d}",
                run_id=run_id,
                branch_id=new_branch_id,
                node_id=NodeId.SYNTHESIZER,
                patches=[
                    {"op": "replace", "path": "/active_branch_id", "value": new_branch_id},
                    {"op": "replace", "path": "/groundedness", "value": groundedness},
                ],
            )
        )
        self._emit_ag_ui(run, "TEXT_MESSAGE_CONTENT", new_branch_id, NodeId.SYNTHESIZER, {"text": verdict})
        self._emit_ag_ui(run, "RUN_FINISHED", new_branch_id, NodeId.SYNTHESIZER, {"status": "completed", "branch_id": new_branch_id})

        # Compute full lineage metrics (ancestor prefix before fork + forked steps)
        prefix_cps = [c for c in cp.get_lineage(source_cp.checkpoint_id) if c.checkpoint_id != source_cp.checkpoint_id]
        fork_cps = cp.get_branch(new_branch_id)
        all_fork_cps = prefix_cps + fork_cps

        total_latency = round(sum(c.latency_ms for c in all_fork_cps), 1)
        total_in = sum(c.input_tokens for c in all_fork_cps)
        total_out = sum(c.output_tokens for c in all_fork_cps)
        total_cost = round(sum(c.cost_usd for c in all_fork_cps), 6)

        run.branches[new_branch_id] = BranchSummary(
            branch_id=new_branch_id,
            parent_branch_id=source_cp.branch_id,
            forked_from_checkpoint_id=source_cp.checkpoint_id,
            status=RunStatus.COMPLETED,
            total_latency_ms=total_latency,
            total_input_tokens=total_in,
            total_output_tokens=total_out,
            total_cost_usd=total_cost,
            groundedness=groundedness,
            guardrail_status="pass",
            verdict_summary=verdict,
            checkpoints=fork_cps,
        )
        run.active_branch_id = new_branch_id

        base_branch = run.branches[source_cp.branch_id]
        compare_branch = run.branches[new_branch_id]
        base_tokens = base_branch.total_input_tokens + base_branch.total_output_tokens
        comp_tokens = compare_branch.total_input_tokens + compare_branch.total_output_tokens

        def pct(delta: float, base: float) -> float:
            return round((delta / base) * 100.0, 1) if base > 0 else 0.0

        lat_delta = round(compare_branch.total_latency_ms - base_branch.total_latency_ms, 1)
        tok_delta = comp_tokens - base_tokens
        cost_delta = round(compare_branch.total_cost_usd - base_branch.total_cost_usd, 6)

        state_changes = [
            {
                "key": k,
                "before": source_cp.state_snapshot.get(k),
                "after": v,
            }
            for k, v in request.state_overrides.items()
        ]
        diff = BranchDiff(
            base_branch_id=base_branch.branch_id,
            compare_branch_id=compare_branch.branch_id,
            fork_checkpoint_id=source_cp.checkpoint_id,
            latency_delta_ms=lat_delta,
            latency_delta_pct=pct(lat_delta, base_branch.total_latency_ms),
            tokens_delta=tok_delta,
            tokens_delta_pct=pct(tok_delta, base_tokens),
            cost_delta_usd=cost_delta,
            cost_delta_pct=pct(cost_delta, base_branch.total_cost_usd),
            groundedness_delta=round(compare_branch.groundedness - base_branch.groundedness, 2),
            base_guardrail=base_branch.guardrail_status,
            compare_guardrail=compare_branch.guardrail_status,
            state_changes=state_changes,
            output_diff=[
                {"kind": "removed", "text": base_branch.verdict_summary},
                {"kind": "added", "text": compare_branch.verdict_summary},
            ],
        )
        run.branch_diffs.append(diff)
        return run, diff

    def _update_branch_summary(
        self,
        run: RunRecord,
        branch_id: str,
        cp: ImmutableCheckpointer,
        *,
        status: RunStatus,
        groundedness: float,
        guardrail_status: Any,
        verdict_summary: str,
    ) -> None:
        cps = cp.get_branch(branch_id)
        run.branches[branch_id] = BranchSummary(
            branch_id=branch_id,
            status=status,
            total_latency_ms=round(sum(c.latency_ms for c in cps), 1),
            total_input_tokens=sum(c.input_tokens for c in cps),
            total_output_tokens=sum(c.output_tokens for c in cps),
            total_cost_usd=round(sum(c.cost_usd for c in cps), 6),
            groundedness=groundedness,
            guardrail_status=guardrail_status,
            verdict_summary=verdict_summary,
            checkpoints=cps,
        )
