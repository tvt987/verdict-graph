import React, { useEffect, useMemo, useState } from 'react';
import { Command, CornerDownLeft, Search, X } from 'lucide-react';
import type { ScenarioId, WireTab } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import type { WorkspaceTab } from './TopBar';

export interface CommandItem {
  id: string;
  group: string;
  label: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  t: Translations;
  onClose: () => void;
  onSelectWorkspace: (tab: WorkspaceTab) => void;
  onSelectScenario: (id: ScenarioId) => void;
  onSelectWireTab: (tab: WireTab) => void;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onTogglePlay: () => void;
  onStep: () => void;
  onRunInstant: () => void;
  onReset: () => void;
  onExportAuditBundle: () => void;
  onOpenLicenseModal: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  t,
  onClose,
  onSelectWorkspace,
  onSelectScenario,
  onSelectWireTab,
  onToggleTheme,
  onToggleLocale,
  onTogglePlay,
  onStep,
  onRunInstant,
  onReset,
  onExportAuditBundle,
  onOpenLicenseModal,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'ws-orch', group: 'WORKSPACE', label: 'Open Orchestrator DAG & Photonic Execution Graph', run: () => onSelectWorkspace('orchestrator') },
      { id: 'ws-fw', group: 'WORKSPACE', label: 'Open OWASP LLM01-LLM10 Prompt Firewall & Token Circuit Breaker', run: () => onSelectWorkspace('firewall') },
      { id: 'ws-arena', group: 'WORKSPACE', label: 'Open Multi-Model FinOps Routing & Pareto Frontier Arena (6 Models)', run: () => onSelectWorkspace('routing') },
      { id: 'ws-audit', group: 'WORKSPACE', label: 'Open Audit & OTLP (Time-Travel Diff & 3-Protocol Wire Inspector)', run: () => onSelectWorkspace('audit') },
      { id: 'scn-a', group: 'SCENARIOS', label: 'Launch Scenario A — Production Outage & HITL Rollback', run: () => { onSelectWorkspace('orchestrator'); onSelectScenario('outage_rollback'); } },
      { id: 'scn-b', group: 'SCENARIOS', label: 'Launch Scenario B — Indirect Prompt Injection Defense', run: () => { onSelectWorkspace('orchestrator'); onSelectScenario('prompt_injection'); } },
      { id: 'scn-c', group: 'SCENARIOS', label: 'Launch Scenario C — Cross-Org A2A Financial Audit', run: () => { onSelectWorkspace('orchestrator'); onSelectScenario('a2a_financial_audit'); } },
      { id: 'scn-d', group: 'SCENARIOS', label: 'Launch Scenario D — Hallucination Recovery via Time-Travel Fork', run: () => { onSelectWorkspace('orchestrator'); onSelectScenario('hallucination_fork'); } },
      { id: 'tab-mcp', group: 'WIRE INSPECTOR', label: 'Inspect MCP Wire Frames (JSON-RPC 2.0)', run: () => { onSelectWorkspace('audit'); onSelectWireTab('mcp'); } },
      { id: 'tab-a2a', group: 'WIRE INSPECTOR', label: 'Inspect A2A AgentCard & Signed Tasks', run: () => { onSelectWorkspace('audit'); onSelectWireTab('a2a'); } },
      { id: 'tab-agui', group: 'WIRE INSPECTOR', label: 'Inspect AG-UI Stream (SSE & RFC 6902 Patch)', run: () => { onSelectWorkspace('audit'); onSelectWireTab('agui'); } },
      { id: 'tab-otel', group: 'WIRE INSPECTOR', label: 'Inspect OpenTelemetry GenAI Span Waterfall', run: () => { onSelectWorkspace('audit'); onSelectWireTab('otel'); } },
      { id: 'act-play', group: 'TRANSPORT', label: 'Play / Pause Auto-Execution', shortcut: 'SPACE', run: onTogglePlay },
      { id: 'act-step', group: 'TRANSPORT', label: 'Step Single Execution Node', shortcut: 'N', run: onStep },
      { id: 'act-instant', group: 'TRANSPORT', label: 'Run Current Scenario Instant to Pause / Completion', run: onRunInstant },
      { id: 'act-reset', group: 'TRANSPORT', label: 'Reset Active Execution Graph & Checkpointer', shortcut: 'R', run: onReset },
      { id: 'v5-export', group: 'AUDIT', label: 'Export Signed JSON Trace + OpenTelemetry OTLP Audit Bundle', run: onExportAuditBundle },
      { id: 'v5-license', group: 'ENTERPRISE', label: 'Open Enterprise Commercial License Quote & VietQR', run: onOpenLicenseModal },
      { id: 'ui-theme', group: 'INTERFACE', label: 'Toggle Daylight Studio / Obsidian Graphite Theme', run: onToggleTheme },
      { id: 'ui-locale', group: 'INTERFACE', label: 'Switch Interface Language (EN / VI)', run: onToggleLocale },
    ],
    [
      onExportAuditBundle,
      onOpenLicenseModal,
      onReset,
      onRunInstant,
      onSelectScenario,
      onSelectWireTab,
      onSelectWorkspace,
      onStep,
      onToggleLocale,
      onTogglePlay,
      onToggleTheme,
    ]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q)
    );
  }, [commands, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/55 px-4 pt-20 backdrop-blur-xs"
      onClick={onClose}
      data-testid="command-palette-overlay"
    >
      <div
        className="vg-panel w-full max-w-xl overflow-hidden rounded-xl border-[var(--vg-accent-border)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--vg-border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--vg-accent)]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.cmdPlaceholder}
            className="w-full bg-transparent text-xs text-[var(--vg-text)] outline-none placeholder:text-[var(--vg-text-dim)]"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[var(--vg-text-muted)] hover:bg-[var(--vg-surface)] hover:text-[var(--vg-text)]"
            aria-label="Close Command Palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-5 text-center font-mono text-xs text-[var(--vg-text-dim)]">
              No matching control plane commands.
            </p>
          ) : (
            filtered.map((cmd) => (
              <button
                key={cmd.id}
                type="button"
                onClick={() => {
                  cmd.run();
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--vg-accent-soft)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-0.5 font-mono text-[9.5px] font-bold text-[var(--vg-accent)]">
                    {cmd.group}
                  </span>
                  <span className="text-xs font-medium text-[var(--vg-text)]">{cmd.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {cmd.shortcut && (
                    <kbd className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-1.5 py-0.5 font-mono text-[9.5px] text-[var(--vg-text-dim)]">
                      {cmd.shortcut}
                    </kbd>
                  )}
                  <CornerDownLeft className="h-3.5 w-3.5 text-[var(--vg-text-dim)]" />
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--vg-border)] bg-[var(--vg-surface)] px-4 py-2 font-mono text-[10px] text-[var(--vg-text-dim)]">
          <span className="flex items-center gap-1.5">
            <Command className="h-3 w-3" /> VERDICT GRAPH v5.0 QUICK DISPATCH
          </span>
          <span>ESC TO CLOSE</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
