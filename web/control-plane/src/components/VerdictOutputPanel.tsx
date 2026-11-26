import React from 'react';
import {
  CheckCircle2,
  GitFork,
  ShieldAlert,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import type { BranchSummary, ScenarioId } from '../types/protocol';
import type { Translations } from '../i18n/translations';

interface VerdictOutputPanelProps {
  t: Translations;
  branch: BranchSummary;
  scenarioId: ScenarioId;
  hasForks: boolean;
  onQuickLoadForkPreset: () => void;
  byokVerdictOverride?: string | null;
}

const TONE_CLASS: Record<'cyan' | 'emerald' | 'amber' | 'crimson', string> = {
  cyan: 'border-sky-400/35 bg-sky-500/10 text-sky-400',
  emerald: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-400',
  amber: 'border-amber-400/35 bg-amber-500/10 text-amber-400',
  crimson: 'border-rose-400/35 bg-rose-500/10 text-rose-400',
};

export const VerdictOutputPanel: React.FC<VerdictOutputPanelProps> = ({
  t,
  branch,
  scenarioId,
  hasForks,
  onQuickLoadForkPreset,
  byokVerdictOverride,
}) => {
  if (!branch.verdict_summary || branch.status === 'paused_hitl') return null;

  const showForkCallout =
    scenarioId === 'hallucination_fork' &&
    branch.branch_id === 'main' &&
    branch.groundedness < 0.8 &&
    !hasForks;

  return (
    <section className="vg-panel rounded-lg p-4" data-testid="verdict-output-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-400" />
          <h3 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
            {t.verdictHeading}
          </h3>
          <span className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-1.5 py-0.5 font-mono text-[10px] text-sky-400">
            BRANCH: {branch.branch_id.toUpperCase()}
          </span>
        </div>

        <span
          className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
            branch.groundedness >= 0.9
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-400'
              : 'border-amber-400/40 bg-amber-500/15 text-amber-400'
          }`}
        >
          GROUNDEDNESS {branch.groundedness.toFixed(2)}
        </span>
      </div>

      {/* Scenario D Guided Time-Travel Callout */}
      {showForkCallout && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-sky-400/45 bg-sky-500/10 p-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <div>
              <p className="font-mono text-[11px] font-bold text-amber-400">{t.forkCalloutTitle}</p>
              <p className="mt-0.5 text-xs text-[var(--vg-text-muted)]">{t.forkCalloutBody}</p>
            </div>
          </div>
          <button
            type="button"
            data-testid="btn-load-optimal-fork"
            onClick={onQuickLoadForkPreset}
            className="flex shrink-0 items-center gap-1.5 rounded border border-sky-400/60 bg-sky-500/20 px-3 py-1.5 font-mono text-[11px] font-semibold text-sky-300 transition-colors hover:bg-sky-500/30"
          >
            <GitFork className="h-3.5 w-3.5" />
            <span>{t.forkCalloutBtn}</span>
          </button>
        </div>
      )}

      {/* Synthesized Verdict Prose */}
      <p className="mt-3 text-sm leading-relaxed text-[var(--vg-text)]">
        {byokVerdictOverride || branch.verdict_summary}
      </p>

      {/* Citation Evidence Chips */}
      {branch.citations.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {branch.citations.map((cit) => (
            <div
              key={cit.id}
              className="flex items-start gap-2 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5"
            >
              {cit.verified ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : (
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-sky-400">[{cit.id}]</span>
                  <span className="rounded border border-[var(--vg-border)] px-1 font-mono text-[9px] text-[var(--vg-text-dim)]">
                    {cit.protocol}
                  </span>
                </div>
                <p className="truncate font-mono text-[10px] text-[var(--vg-text)]">{cit.source}</p>
                <p className="mt-0.5 text-[11px] text-[var(--vg-text-muted)]">{cit.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AG-UI Generative Widget */}
      {branch.widget && (
        <div className="mt-3.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold tracking-wider text-[var(--vg-text-muted)]">
              AG-UI GENERATIVE WIDGET // {branch.widget.title.toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {branch.widget.metrics.map((m) => (
              <div key={m.label} className={`rounded border p-2 ${TONE_CLASS[m.tone]}`}>
                <p className="font-mono text-[9px] tracking-wider opacity-80">{m.label}</p>
                <p className="mt-0.5 font-mono text-xs font-bold">{m.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] text-[var(--vg-text-muted)]">
            {branch.widget.callout}
          </p>
        </div>
      )}
    </section>
  );
};
