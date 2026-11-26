import React, { useEffect, useMemo, useState } from 'react';
import { Command, CornerDownLeft, Search, X } from 'lucide-react';
import type { ScenarioId, WireTab } from '../types/protocol';
import type { Translations } from '../i18n/translations';

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
  onSelectScenario: (id: ScenarioId) => void;
  onSelectWireTab: (tab: WireTab) => void;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onRunInstant: () => void;
  onReset: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  t,
  onClose,
  onSelectScenario,
  onSelectWireTab,
  onToggleTheme,
  onToggleLocale,
  onRunInstant,
  onReset,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const commands: CommandItem[] = useMemo(
    () => [
      { id: 'scn-a', group: 'SCENARIOS', label: 'Launch Scenario A — Production Outage & HITL Rollback', run: () => onSelectScenario('outage_rollback') },
      { id: 'scn-b', group: 'SCENARIOS', label: 'Launch Scenario B — Indirect Prompt Injection Defense', run: () => onSelectScenario('prompt_injection') },
      { id: 'scn-c', group: 'SCENARIOS', label: 'Launch Scenario C — Cross-Org A2A Financial Audit', run: () => onSelectScenario('a2a_financial_audit') },
      { id: 'scn-d', group: 'SCENARIOS', label: 'Launch Scenario D — Hallucination Recovery via Time-Travel Fork', run: () => onSelectScenario('hallucination_fork') },
      { id: 'tab-mcp', group: 'WIRE INSPECTOR', label: 'Open MCP Wire Tab (JSON-RPC 2.0)', run: () => onSelectWireTab('mcp') },
      { id: 'tab-a2a', group: 'WIRE INSPECTOR', label: 'Open A2A Wire Tab (AgentCard & Signed Tasks)', run: () => onSelectWireTab('a2a') },
      { id: 'tab-agui', group: 'WIRE INSPECTOR', label: 'Open AG-UI Stream Tab (SSE & RFC 6902 Patch)', run: () => onSelectWireTab('agui') },
      { id: 'tab-otel', group: 'WIRE INSPECTOR', label: 'Open OpenTelemetry GenAI Trace Waterfall', run: () => onSelectWireTab('otel') },
      { id: 'act-instant', group: 'EXECUTION', label: 'Run Current Scenario Instant to Pause / Completion', run: onRunInstant },
      { id: 'act-reset', group: 'EXECUTION', label: 'Reset Active Execution Graph & Checkpointer', run: onReset },
      { id: 'ui-theme', group: 'INTERFACE', label: 'Toggle Aerospace Obsidian / Light Technical Blueprint', run: onToggleTheme },
      { id: 'ui-locale', group: 'INTERFACE', label: 'Switch Interface Language (EN / VI)', run: onToggleLocale },
    ],
    [onReset, onRunInstant, onSelectScenario, onSelectWireTab, onToggleLocale, onToggleTheme]
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 px-4 pt-20 backdrop-blur-sm"
      onClick={onClose}
      data-testid="command-palette-overlay"
    >
      <div
        className="vg-panel w-full max-w-xl overflow-hidden rounded-lg border-sky-400/40 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--vg-border)] px-3.5 py-2.5">
          <Search className="h-4 w-4 text-sky-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.cmdPlaceholder}
            className="w-full bg-transparent font-mono text-xs text-[var(--vg-text)] outline-none placeholder:text-[var(--vg-text-dim)]"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-4 text-center font-mono text-xs text-[var(--vg-text-dim)]">
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
                className="flex w-full items-center justify-between rounded px-2.5 py-2 text-left transition-colors hover:bg-sky-500/15"
              >
                <div className="flex items-center gap-2.5">
                  <span className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-sky-400">
                    {cmd.group}
                  </span>
                  <span className="text-xs text-[var(--vg-text)]">{cmd.label}</span>
                </div>
                <CornerDownLeft className="h-3 w-3 text-[var(--vg-text-dim)]" />
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--vg-border)] bg-[var(--vg-surface)] px-3.5 py-1.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
          <span className="flex items-center gap-1">
            <Command className="h-3 w-3" /> VERDICT GRAPH QUICK DISPATCH
          </span>
          <span>ESC TO CLOSE</span>
        </div>
      </div>
    </div>
  );
};
