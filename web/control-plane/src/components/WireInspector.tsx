import React, { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Code2,
  Copy,
  Network,
  Radio,
  Terminal,
} from 'lucide-react';
import type { ControlPlaneRun, OTelGenAISpan, WireTab } from '../types/protocol';
import type { Translations } from '../i18n/translations';

interface WireInspectorProps {
  t: Translations;
  run: ControlPlaneRun;
  activeTab: WireTab;
  onChangeTab: (tab: WireTab) => void;
}

export const WireInspector: React.FC<WireInspectorProps> = ({
  t,
  run,
  activeTab,
  onChangeTab,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(null);
  const [showRawSse, setShowRawSse] = useState<boolean>(false);

  const activeSpans = useMemo(() => {
    const branchSpans = run.otel_spans.filter((s) => s.branch_id === run.active_branch_id);
    return branchSpans.length > 0 ? branchSpans : run.otel_spans;
  }, [run.active_branch_id, run.otel_spans]);

  const totalTraceMs = useMemo(() => {
    if (activeSpans.length === 0) return 100;
    return Math.max(
      100,
      ...activeSpans.map((s) => s.start_ms + s.duration_ms)
    );
  }, [activeSpans]);

  const selectedSpan: OTelGenAISpan | null = useMemo(() => {
    if (selectedSpanId) {
      const found = activeSpans.find((s) => s.span_id === selectedSpanId);
      if (found) return found;
    }
    return activeSpans[activeSpans.length - 1] ?? null;
  }, [activeSpans, selectedSpanId]);

  const handleCopy = (id: string, data: unknown) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2)).catch(() => undefined);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const tabs: Array<{ id: WireTab; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'mcp', label: 'MCP (JSON-RPC 2.0)', count: run.mcp_logs.length, icon: <Terminal className="h-3.5 w-3.5" /> },
    { id: 'a2a', label: 'A2A (AgentCard)', count: run.a2a_logs.length, icon: <Network className="h-3.5 w-3.5" /> },
    { id: 'agui', label: 'AG-UI (SSE)', count: run.ag_ui_events.length, icon: <Radio className="h-3.5 w-3.5" /> },
    { id: 'otel', label: 'OTel GenAI Waterfall', count: activeSpans.length, icon: <Activity className="h-3.5 w-3.5" /> },
  ];

  return (
    <section className="vg-panel flex h-full flex-col rounded-lg" data-testid="wire-inspector">
      {/* Header & Protocol Tab Strip */}
      <div className="border-b border-[var(--vg-border)] px-3.5 pt-2.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-sky-400" />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.wireTitle}
            </h2>
          </div>
          {activeTab === 'agui' && (
            <button
              type="button"
              onClick={() => setShowRawSse((v) => !v)}
              className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-0.5 font-mono text-[10px] text-sky-400 hover:border-sky-400/50"
            >
              {showRawSse ? 'PARSED VIEW' : 'RAW SSE FRAMES'}
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`wire-tab-${tab.id}`}
                onClick={() => onChangeTab(tab.id)}
                className={`flex items-center gap-1.5 border-b-2 px-2.5 py-2 font-mono text-[10px] font-semibold transition-colors ${
                  active
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[9px] ${
                    active
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'bg-[var(--vg-surface)] text-[var(--vg-text-dim)]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content Area */}
      <div className="max-h-[430px] flex-1 overflow-y-auto p-3.5">
        {/* TAB 1: MCP JSON-RPC 2.0 */}
        {activeTab === 'mcp' && (
          <div className="flex flex-col gap-2.5" data-testid="wire-panel-mcp">
            {run.mcp_logs.length === 0 ? (
              <p className="font-mono text-xs text-[var(--vg-text-dim)]">
                No MCP JSON-RPC 2.0 frames captured yet. Step or run a scenario to observe live handshakes.
              </p>
            ) : (
              run.mcp_logs.map((env) => (
                <div
                  key={`${env.id}-${env.branch_id}`}
                  className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-bold text-sky-400">
                        {env.method}
                      </span>
                      <span className="text-[var(--vg-text)]">{env.server}</span>
                      <span className="rounded border border-[var(--vg-border)] px-1 text-[9px] text-[var(--vg-text-dim)]">
                        {env.branch_id}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="text-emerald-400">RTT {env.rtt_ms}ms</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(env.id, { request: env.request, response: env.response })}
                        className="rounded border border-[var(--vg-border)] p-1 text-[var(--vg-text-muted)] hover:text-sky-400"
                        title="Copy JSON-RPC 2.0 Envelope"
                      >
                        {copiedId === env.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="mb-1 font-mono text-[9px] font-semibold text-sky-400">
                        OUTBOUND REQUEST (JSON-RPC 2.0)
                      </p>
                      <pre className="vg-code max-h-40 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                        {JSON.stringify(env.request, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 font-mono text-[9px] font-semibold text-emerald-400">
                        INBOUND RESPONSE
                      </p>
                      <pre className="vg-code max-h-40 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                        {JSON.stringify(env.response, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: A2A Protocol */}
        {activeTab === 'a2a' && (
          <div className="flex flex-col gap-2.5" data-testid="wire-panel-a2a">
            {run.a2a_logs.length === 0 ? (
              <p className="font-mono text-xs text-[var(--vg-text-dim)]">
                This scenario did not require cross-agent A2A delegation. Launch Scenario A or Scenario C to inspect /.well-known/agent.json and signed A2A artifacts.
              </p>
            ) : (
              run.a2a_logs.map((env) => (
                <div
                  key={env.id}
                  className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-400">
                        {env.operation}
                      </span>
                      <span className="text-[var(--vg-text)]">{env.peer_agent}</span>
                      {env.task_id && (
                        <span className="text-[var(--vg-text-dim)]">task:{env.task_id}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-emerald-400/35 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-400">
                        {env.state}
                      </span>
                      <span className="text-[var(--vg-text-muted)]">{env.rtt_ms}ms</span>
                    </div>
                  </div>
                  <pre className="vg-code max-h-48 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                    {JSON.stringify(env.payload, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: AG-UI SSE Stream */}
        {activeTab === 'agui' && (
          <div className="flex flex-col gap-1.5" data-testid="wire-panel-agui">
            {run.ag_ui_events.length === 0 ? (
              <p className="font-mono text-xs text-[var(--vg-text-dim)]">
                Awaiting AG-UI Server-Sent Events stream...
              </p>
            ) : showRawSse ? (
              <pre className="vg-code overflow-auto rounded p-3 text-[10px] leading-relaxed text-[var(--vg-text)]">
                {run.ag_ui_events
                  .map(
                    (ev) =>
                      `id: ${ev.id}\nevent: ${ev.type}\ndata: ${JSON.stringify({
                        run_id: ev.run_id,
                        branch_id: ev.branch_id,
                        node_id: ev.node_id,
                        ...ev.data,
                      })}`
                  )
                  .join('\n\n')}
              </pre>
            ) : (
              run.ag_ui_events.map((ev) => {
                const badgeColor =
                  ev.type === 'INTERRUPT_REQUIRED'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                    : ev.type === 'STATE_DELTA'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                      : ev.type === 'RUN_FINISHED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                        : 'bg-[var(--vg-panel)] text-[var(--vg-text-muted)] border-[var(--vg-border)]';
                return (
                  <div
                    key={ev.id}
                    className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono text-[10px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--vg-text-dim)]">{ev.id}</span>
                        <span className={`rounded border px-1.5 py-0.5 font-bold ${badgeColor}`}>
                          {ev.type}
                        </span>
                        {ev.node_id && (
                          <span className="text-[var(--vg-text-muted)]">{ev.node_id}</span>
                        )}
                      </div>
                      <span className="text-[9px] text-[var(--vg-text-dim)]">
                        {ev.branch_id}
                      </span>
                    </div>
                    <pre className="mt-1 overflow-x-auto text-[10px] text-[var(--vg-text)]">
                      {JSON.stringify(ev.data)}
                    </pre>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 4: OpenTelemetry GenAI Span Waterfall */}
        {activeTab === 'otel' && (
          <div className="flex flex-col gap-3" data-testid="wire-panel-otel">
            {activeSpans.length === 0 ? (
              <p className="font-mono text-xs text-[var(--vg-text-dim)]">
                No OpenTelemetry GenAI spans recorded yet.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between font-mono text-[10px] text-[var(--vg-text-muted)]">
                  <span>TRACE_ID: {activeSpans[0].trace_id}</span>
                  <span>TOTAL TRACE SPAN: {totalTraceMs.toFixed(1)}ms</span>
                </div>

                {/* Gantt Waterfall Bars */}
                <div className="flex flex-col gap-1.5">
                  {activeSpans.map((span) => {
                    const leftPct = (span.start_ms / totalTraceMs) * 100;
                    const widthPct = Math.max(4, (span.duration_ms / totalTraceMs) * 100);
                    const isSelected = selectedSpan?.span_id === span.span_id;
                    const barTone =
                      span.status === 'ERROR'
                        ? 'bg-rose-500'
                        : span.status === 'PAUSED'
                          ? 'bg-amber-400'
                          : span.attributes['gen_ai.operation.name'] === 'execute_tool'
                            ? 'bg-sky-400'
                            : span.attributes['gen_ai.operation.name'] === 'delegate_a2a'
                              ? 'bg-emerald-400'
                              : 'bg-indigo-400';

                    return (
                      <button
                        key={span.span_id}
                        type="button"
                        data-testid={`otel-span-${span.span_id}`}
                        onClick={() => setSelectedSpanId(span.span_id)}
                        className={`grid grid-cols-12 items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors ${
                          isSelected
                            ? 'border-sky-400/60 bg-sky-500/10'
                            : 'border-[var(--vg-border)] bg-[var(--vg-surface)] hover:border-sky-400/30'
                        }`}
                      >
                        <div className="col-span-5 truncate font-mono text-[10px]">
                          <p className="truncate font-semibold text-[var(--vg-text)]">{span.name}</p>
                          <p className="truncate text-[9px] text-[var(--vg-text-dim)]">
                            {span.attributes['gen_ai.request.model']} · $
                            {span.attributes['verdict.finops.cost_usd'].toFixed(4)}
                          </p>
                        </div>
                        <div className="col-span-5">
                          <div className="relative h-3.5 w-full overflow-hidden rounded bg-[var(--vg-panel)]">
                            <div
                              className={`absolute top-0.5 h-2.5 rounded-sm ${barTone}`}
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                        <div className="col-span-2 text-right font-mono text-[10px] text-[var(--vg-text)]">
                          {span.duration_ms.toFixed(0)}ms
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Clickable Span Attribute Inspector */}
                {selectedSpan && (
                  <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                      <span className="font-bold text-sky-400">
                        SPAN ATTRIBUTES // {selectedSpan.name}
                      </span>
                      <span className="text-[var(--vg-text-dim)]">
                        span_id={selectedSpan.span_id} · parent={selectedSpan.parent_span_id ?? 'ROOT'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {Object.entries(selectedSpan.attributes).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between gap-2 rounded bg-[var(--vg-code-bg)] px-2 py-1 font-mono text-[10px]"
                        >
                          <span className="truncate text-[var(--vg-text-muted)]">{k}</span>
                          <span className="truncate font-semibold text-[var(--vg-text)]">
                            {String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default WireInspector;
