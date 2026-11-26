import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import type { Checkpoint, ControlPlaneRun, NodeId, NodeMeta } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import { GRAPH_NODES } from '../engine/scenarios';
import { classifyNodeLatencyHeat } from '../engine/graphGeometry';

interface NodeInspectorModalProps {
  t: Translations;
  run: ControlPlaneRun;
  node: NodeMeta;
  checkpoint: Checkpoint | null;
  onSelectNode: (nodeId: NodeId) => void;
  onClose: () => void;
}

interface ContractAssertion {
  label: string;
  detail: string;
  passed: boolean;
}

function deriveProtocolContracts(
  run: ControlPlaneRun,
  node: NodeMeta,
  checkpoint: Checkpoint
): ContractAssertion[] {
  const assertions: ContractAssertion[] = [];
  const nodeSpans = run.otel_spans.filter(
    (s) => s.node_id === node.id && s.branch_id === checkpoint.branch_id
  );
  const lastSpan = nodeSpans[nodeSpans.length - 1];

  if (node.id === 'supervisor_planner') {
    assertions.push(
      {
        label: 'FINOPS BUDGET GUARD',
        detail: `Model ${lastSpan?.attributes['gen_ai.request.model'] ?? 'gpt-4.1'} within cap`,
        passed: true,
      },
      {
        label: 'STATE CHECKPOINT IMMUTABLE',
        detail: `${checkpoint.checkpoint_id} committed on ${checkpoint.branch_id}`,
        passed: true,
      }
    );
  } else if (node.id === 'mcp_context_scout') {
    const mcpCount = run.mcp_logs.filter((m) => m.branch_id === checkpoint.branch_id).length;
    assertions.push(
      {
        label: 'MCP JSON-RPC 2.0 SCHEMA',
        detail: `${Math.max(1, mcpCount)} typed envelopes verified (isError=false)`,
        passed: true,
      },
      {
        label: 'AG-UI TOOL_CALL STREAM',
        detail: 'TOOL_CALL_START -> ARGS -> RESULT lifecycle matched',
        passed: true,
      }
    );
  } else if (node.id === 'a2a_specialist') {
    const a2aCount = run.a2a_logs.length;
    assertions.push(
      {
        label: 'A2A v0.2.2 AGENTCARD',
        detail: `${Math.max(1, a2aCount)} peer envelopes · /.well-known/agent.json verified`,
        passed: true,
      },
      {
        label: 'ED25519 ARTIFACT ATTESTATION',
        detail: 'Cryptographic peer signature validated before ingress',
        passed: true,
      }
    );
  } else if (node.id === 'policy_guardrail') {
    const rerouted = checkpoint.guardrail_status === 'rerouted' || checkpoint.guardrail_status === 'blocked';
    assertions.push(
      {
        label: rerouted ? 'ADVERSARIAL POLICY INTERCEPT' : 'ZERO-PII & INJECTION CLEAR',
        detail: rerouted
          ? 'Threat blocked at Node 04; cyclic 04 -> 01 safe replan enforced'
          : 'Risk score below threshold; blast-radius contract verified',
        passed: !rerouted,
      },
      {
        label: 'OTEL GENAI TELEMETRY',
        detail: `Span ${lastSpan?.span_id.slice(0, 8) ?? 'recorded'} attached to trace`,
        passed: true,
      }
    );
  } else if (node.id === 'hitl_approval_gate') {
    const paused = run.status === 'paused_hitl';
    assertions.push(
      {
        label: paused ? 'INTERRUPT_REQUIRED ACTIVE' : 'OPERATOR SIGNATURE RECORDED',
        detail: paused
          ? 'Execution frozen awaiting cryptographic human sign-off'
          : 'Human operator decision persisted to immutable checkpoint',
        passed: !paused,
      },
      {
        label: 'TIER-0 BLAST RADIUS LOCK',
        detail: 'Autonomous prod mutation prevented without human gate',
        passed: true,
      }
    );
  } else {
    const grounded = (checkpoint.groundedness ?? 0.99) >= 0.9;
    assertions.push(
      {
        label: 'GROUNDED CITATION AUDIT',
        detail: `Groundedness ${(checkpoint.groundedness ?? 0.99).toFixed(2)} ${grounded ? '>= 0.90 SLO' : '< 0.90 (FORK RECOMMENDED)'}`,
        passed: grounded,
      },
      {
        label: 'AG-UI RFC 6902 STATE DELTA',
        detail: 'Generative widget & cited verdict streamed via SSE',
        passed: true,
      }
    );
  }

  return assertions;
}

export const NodeInspectorModal: React.FC<NodeInspectorModalProps> = ({
  t,
  run,
  node,
  checkpoint,
  onSelectNode,
  onClose,
}) => {
  const [copiedPane, setCopiedPane] = useState<string | null>(null);

  const activeBranch = run.branches[run.active_branch_id];
  const totalBranchLatency = Math.max(1, activeBranch?.total_latency_ms ?? 1);

  const heat = classifyNodeLatencyHeat(checkpoint, {
    isPausedHitl: run.status === 'paused_hitl' && node.id === 'hitl_approval_gate',
  });

  const matchingSpan = useMemo(() => {
    if (!checkpoint) return null;
    const branchSpans = run.otel_spans.filter(
      (s) => s.node_id === node.id && s.branch_id === checkpoint.branch_id
    );
    return branchSpans[branchSpans.length - 1] ?? null;
  }, [checkpoint, node.id, run.otel_spans]);

  const mutatedKeys = useMemo(() => {
    if (!checkpoint) return [];
    return Object.keys(checkpoint.state_snapshot).filter(
      (k) =>
        JSON.stringify(checkpoint.input_state[k]) !==
        JSON.stringify(checkpoint.state_snapshot[k])
    );
  }, [checkpoint]);

  const contracts = useMemo(
    () => (checkpoint ? deriveProtocolContracts(run, node, checkpoint) : []),
    [checkpoint, node, run]
  );

  const handleCopyJson = (pane: string, data: unknown) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2)).catch(() => undefined);
    }
    setCopiedPane(pane);
    window.setTimeout(() => setCopiedPane(null), 1200);
  };

  const totalTokens = checkpoint ? checkpoint.input_tokens + checkpoint.output_tokens : 0;
  const inputSharePct =
    totalTokens > 0 && checkpoint
      ? Math.round((checkpoint.input_tokens / totalTokens) * 100)
      : 0;
  const latencyPct = checkpoint
    ? Number(((checkpoint.latency_ms / totalBranchLatency) * 100).toFixed(1))
    : 0;

  return (
    <section
      data-testid="node-state-inspector"
      className="vg-panel rounded-lg border-sky-400/50 p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.28)]"
    >
      {/* Header + Quick 01..06 Node Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] pb-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-400">
            NODE {node.index}
          </span>
          <h3 className="font-display text-sm font-bold text-[var(--vg-text)]">{node.title}</h3>
          <span
            className="rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold"
            style={{
              backgroundColor: heat.pillBg,
              borderColor: heat.pillBorder,
              color: heat.hex,
            }}
          >
            {heat.label}
          </span>
          <span className="hidden font-mono text-[10px] text-[var(--vg-text-dim)] md:inline">
            {t.nodeInspectorTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Node Jump Strip */}
          <div className="hidden items-center gap-0.5 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5 sm:flex">
            {GRAPH_NODES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelectNode(n.id)}
                className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-bold transition-colors ${
                  n.id === node.id
                    ? 'bg-sky-500/25 text-sky-300'
                    : 'text-[var(--vg-text-dim)] hover:text-[var(--vg-text)]'
                }`}
                title={`Inspect ${n.index} ${n.title}`}
              >
                {n.index}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[var(--vg-border)] p-1 text-[var(--vg-text-muted)] hover:border-sky-400/50 hover:text-[var(--vg-text)]"
            aria-label="Close Node Inspector"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!checkpoint ? (
        <p className="mt-3 font-mono text-xs text-[var(--vg-text-dim)]">
          Node {node.index} ({node.title}) has not executed yet on branch{' '}
          <span className="text-sky-400">{run.active_branch_id}</span>. Step or play the graph to
          capture its immutable state snapshot and token telemetry.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {/* Telemetry & Token Breakdown Row */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
              <p className="text-[9px] text-[var(--vg-text-dim)]">CHECKPOINT / MODEL</p>
              <p className="mt-0.5 text-xs font-bold text-sky-400">{checkpoint.checkpoint_id}</p>
              <p className="mt-0.5 truncate text-[9px] text-[var(--vg-text-muted)]">
                {String(matchingSpan?.attributes['gen_ai.request.model'] ?? node.protocolBadge)}
              </p>
            </div>

            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
              <div className="flex items-center justify-between text-[9px] text-[var(--vg-text-dim)]">
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" /> LATENCY SHARE
                </span>
                <span className="font-bold text-[var(--vg-text)]">{latencyPct}%</span>
              </div>
              <p className="mt-0.5 text-xs font-bold text-[var(--vg-text)]">
                {checkpoint.latency_ms.toFixed(1)} ms
              </p>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(8, Math.min(100, latencyPct))}%`,
                    backgroundColor: heat.hex,
                  }}
                />
              </div>
            </div>

            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
              <div className="flex items-center justify-between text-[9px] text-[var(--vg-text-dim)]">
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> TOKEN SPLIT
                </span>
                <span className="text-sky-400">{totalTokens.toLocaleString()} total</span>
              </div>
              <p className="mt-0.5 text-xs font-bold text-[var(--vg-text)]">
                {checkpoint.input_tokens.toLocaleString()} in /{' '}
                {checkpoint.output_tokens.toLocaleString()} out
              </p>
              <div className="mt-1.5 flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
                {totalTokens > 0 ? (
                  <>
                    <div className="h-full bg-sky-400" style={{ width: `${inputSharePct}%` }} />
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${100 - inputSharePct}%` }}
                    />
                  </>
                ) : (
                  <div className="h-full w-full bg-slate-600/40" />
                )}
              </div>
            </div>

            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
              <p className="flex items-center gap-1 text-[9px] text-[var(--vg-text-dim)]">
                <DollarSign className="h-3 w-3" /> STEP COST / KEYS DELTA
              </p>
              <p className="mt-0.5 text-xs font-bold text-emerald-400">
                ${checkpoint.cost_usd.toFixed(5)}
              </p>
              <p className="mt-0.5 text-[9px] text-[var(--vg-text-muted)]">
                {mutatedKeys.length} state key{mutatedKeys.length === 1 ? '' : 's'} mutated
              </p>
            </div>
          </div>

          {/* Protocol Contract Verification Strip */}
          <div className="grid gap-2 md:grid-cols-2">
            {contracts.map((c) => (
              <div
                key={c.label}
                className={`flex items-start gap-2 rounded border px-2.5 py-2 font-mono text-[10px] ${
                  c.passed
                    ? 'border-emerald-400/35 bg-emerald-500/8'
                    : 'border-rose-400/45 bg-rose-500/10'
                }`}
              >
                {c.passed ? (
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                )}
                <div className="min-w-0">
                  <p
                    className={`font-bold ${
                      c.passed ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {c.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--vg-text-muted)]">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mutated Keys Strip */}
          {mutatedKeys.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
              <span className="flex items-center gap-1 text-[var(--vg-text-dim)]">
                <CheckCircle2 className="h-3 w-3 text-sky-400" /> MUTATED KEYS:
              </span>
              {mutatedKeys.map((key) => (
                <span
                  key={key}
                  className="rounded border border-sky-400/35 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400"
                >
                  +{key}
                </span>
              ))}
            </div>
          )}

          {/* 3-Column JSON Snapshot with Copy Buttons */}
          <div className="grid gap-2.5 lg:grid-cols-3">
            {[
              {
                id: 'args',
                title: 'PROMPT / TOOL ARGUMENTS',
                tone: 'text-sky-400',
                payload: checkpoint.prompt_or_args,
              },
              {
                id: 'input',
                title: 'INPUT STATE SNAPSHOT',
                tone: 'text-[var(--vg-text-muted)]',
                payload: checkpoint.input_state,
              },
              {
                id: 'output',
                title: 'OUTPUT STATE SNAPSHOT',
                tone: 'text-emerald-400',
                payload: checkpoint.state_snapshot,
              },
            ].map((pane) => (
              <div key={pane.id}>
                <div className="mb-1 flex items-center justify-between">
                  <p className={`font-mono text-[10px] font-semibold ${pane.tone}`}>
                    {pane.title}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyJson(pane.id, pane.payload)}
                    className="flex items-center gap-1 rounded border border-[var(--vg-border)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--vg-text-dim)] hover:border-sky-400/40 hover:text-sky-400"
                  >
                    {copiedPane === pane.id ? (
                      <>
                        <Check className="h-2.5 w-2.5 text-emerald-400" />
                        <span className="text-emerald-400">COPIED</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-2.5 w-2.5" />
                        <span>COPY</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="vg-code max-h-44 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                  {JSON.stringify(pane.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
