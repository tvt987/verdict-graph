import React, { useState } from 'react';
import {
  AlertTriangle,
  FastForward,
  GitFork,
  KeyRound,
  Pause,
  Play,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import type {
  ControlPlaneRun,
  Locale,
  RuntimeMode,
  ScenarioId,
} from '../types/protocol';
import type { Translations } from '../i18n/translations';
import { SCENARIOS } from '../engine/scenarios';
import type { ByokConfig } from '../engine/remoteBridge';

interface ScenarioDockProps {
  t: Translations;
  locale: Locale;
  run: ControlPlaneRun;
  isPlaying: boolean;
  onSelectScenario: (id: ScenarioId, autoPlay?: boolean) => void;
  onTogglePlay: () => void;
  onStep: () => void;
  onRunInstant: () => void;
  onReset: () => void;
  runtimeMode: RuntimeMode;
  onChangeRuntimeMode: (mode: RuntimeMode) => void;
  clusterOnline: boolean;
  onReprobeCluster: () => void;
  byokConfig: ByokConfig;
  onChangeByokConfig: (cfg: ByokConfig) => void;
}

const SCENARIO_ICON: Record<ScenarioId, React.ReactNode> = {
  outage_rollback: <AlertTriangle className="h-4 w-4 text-amber-400" />,
  prompt_injection: <ShieldAlert className="h-4 w-4 text-rose-400" />,
  a2a_financial_audit: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
  hallucination_fork: <GitFork className="h-4 w-4 text-sky-400" />,
};

export const ScenarioDock: React.FC<ScenarioDockProps> = ({
  t,
  locale,
  run,
  isPlaying,
  onSelectScenario,
  onTogglePlay,
  onStep,
  onRunInstant,
  onReset,
  runtimeMode,
  onChangeRuntimeMode,
  clusterOnline,
  onReprobeCluster,
  byokConfig,
  onChangeByokConfig,
}) => {
  const [showByokFields, setShowByokFields] = useState(false);
  const activeBranch = run.branches[run.active_branch_id];
  const completedSteps = activeBranch.checkpoints.length;

  return (
    <aside className="flex flex-col gap-3">
      {/* Enterprise Scenarios Selector */}
      <section className="vg-panel rounded-lg p-3">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text-muted)]">
            {t.scenariosHeading}
          </h2>
          <span className="font-mono text-[10px] text-[var(--vg-text-dim)]">4 PLAYBOOKS</span>
        </div>

        <div className="flex flex-col gap-2">
          {SCENARIOS.map((sc) => {
            const active = run.scenario_id === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                data-testid={`scenario-btn-${sc.id}`}
                onClick={() => onSelectScenario(sc.id, true)}
                className={`group rounded-md border p-2.5 text-left transition-all ${
                  active
                    ? 'border-sky-400/60 bg-sky-500/10 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.2)]'
                    : 'border-[var(--vg-border)] bg-[var(--vg-surface)] hover:border-sky-400/35 hover:bg-[var(--vg-surface-hover)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {SCENARIO_ICON[sc.id]}
                    <span className="font-mono text-[10px] font-bold tracking-wider text-[var(--vg-text-dim)]">
                      {sc.code}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sc.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-1.5 py-0.5 font-mono text-[9px] font-medium text-[var(--vg-text-muted)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="mt-1.5 font-display text-xs font-semibold text-[var(--vg-text)]">
                  {locale === 'vi' ? sc.titleVi : sc.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--vg-text-muted)]">
                  {locale === 'vi' ? sc.subtitleVi : sc.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Execution Transport Controls */}
      <section className="vg-panel rounded-lg p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text-muted)]">
            {t.controlsHeading}
          </h2>
          <span className="font-mono text-[10px] font-semibold text-sky-400" data-testid="run-status-pill">
            {run.status.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={run.status === 'paused_hitl' || (run.pending_steps.length === 0 && !isPlaying)}
            data-testid="btn-play-pause"
            className="flex items-center justify-between gap-1 rounded border border-sky-400/45 bg-sky-500/15 px-2 py-1.5 font-mono text-[11px] font-semibold text-sky-400 transition-colors hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex items-center gap-1.5">
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isPlaying ? t.pause : t.play}</span>
            </span>
            <kbd className="rounded border border-sky-400/35 bg-sky-500/15 px-1 text-[8.5px] font-bold">
              SPC
            </kbd>
          </button>

          <button
            type="button"
            onClick={onStep}
            disabled={run.status === 'paused_hitl' || run.pending_steps.length === 0}
            data-testid="btn-step"
            className="flex items-center justify-between gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1.5 font-mono text-[11px] font-medium text-[var(--vg-text)] transition-colors hover:border-sky-400/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex items-center gap-1.5">
              <SkipForward className="h-3.5 w-3.5" />
              <span>{t.step}</span>
            </span>
            <kbd className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-1 text-[8.5px] text-[var(--vg-text-dim)]">
              N
            </kbd>
          </button>

          <button
            type="button"
            onClick={onRunInstant}
            disabled={run.status === 'paused_hitl' || run.pending_steps.length === 0}
            data-testid="btn-instant"
            className="flex items-center justify-center gap-1.5 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1.5 font-mono text-[11px] font-medium text-[var(--vg-text)] transition-colors hover:border-sky-400/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FastForward className="h-3.5 w-3.5" />
            <span>{t.instant}</span>
          </button>

          <button
            type="button"
            onClick={onReset}
            data-testid="btn-reset"
            className="flex items-center justify-between gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1.5 font-mono text-[11px] font-medium text-[var(--vg-text-muted)] transition-colors hover:border-rose-400/40 hover:text-rose-400"
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              <span>{t.reset}</span>
            </span>
            <kbd className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-1 text-[8.5px] text-[var(--vg-text-dim)]">
              R
            </kbd>
          </button>
        </div>

        <p className="mt-2 font-mono text-[9px] text-[var(--vg-text-dim)]">{t.keyboardHint}</p>

        {/* Step Progress Strip */}
        <div className="mt-3 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-[var(--vg-text-dim)]">CHECKPOINTS</span>
            <span className="text-[var(--vg-text)]">
              {completedSteps} / {Math.max(run.total_planned_steps, completedSteps)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
            <div
              className={`h-full transition-all duration-300 ${
                run.status === 'paused_hitl'
                  ? 'bg-amber-400'
                  : run.status === 'rejected'
                    ? 'bg-rose-400'
                    : 'bg-sky-400'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  Math.round((completedSteps / Math.max(run.total_planned_steps, 1)) * 100)
                )}%`,
              }}
            />
          </div>
        </div>
      </section>

      {/* Runtime & BYOK Switcher */}
      <section className="vg-panel rounded-lg p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text-muted)]">
            {t.runtimeHeading}
          </h2>
          <button
            type="button"
            onClick={onReprobeCluster}
            className="font-mono text-[10px] text-sky-400 hover:underline"
          >
            PROBE
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {(
            [
              { id: 'browser', label: t.browserEngine, icon: <Sparkles className="h-3.5 w-3.5 text-sky-400" /> },
              {
                id: 'python',
                label: `${t.pythonCluster}`,
                icon: <Server className={`h-3.5 w-3.5 ${clusterOnline ? 'text-emerald-400' : 'text-[var(--vg-text-dim)]'}`} />,
              },
              { id: 'byok', label: t.byokMode, icon: <KeyRound className="h-3.5 w-3.5 text-amber-400" /> },
            ] as Array<{ id: RuntimeMode; label: string; icon: React.ReactNode }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onChangeRuntimeMode(item.id);
                if (item.id === 'byok') setShowByokFields(true);
                if (item.id === 'python') onReprobeCluster();
              }}
              className={`flex items-center justify-between rounded border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                runtimeMode === item.id
                  ? 'border-sky-400/50 bg-sky-500/10 text-[var(--vg-text)]'
                  : 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
              }`}
            >
              <span className="flex items-center gap-2">
                {item.icon}
                {item.label}
              </span>
              {item.id === 'python' && (
                <span
                  className={`h-2 w-2 rounded-full ${clusterOnline ? 'bg-emerald-400' : 'bg-slate-500'}`}
                />
              )}
            </button>
          ))}
        </div>

        {runtimeMode === 'byok' && showByokFields && (
          <div className="mt-2.5 flex flex-col gap-2 rounded border border-amber-400/30 bg-amber-500/5 p-2">
            <div className="flex gap-1">
              {(['gemini', 'openai'] as const).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() =>
                    onChangeByokConfig({
                      ...byokConfig,
                      provider,
                      model: provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4.1-mini',
                    })
                  }
                  className={`flex-1 rounded border py-1 font-mono text-[10px] uppercase ${
                    byokConfig.provider === provider
                      ? 'border-amber-400/60 bg-amber-500/20 text-amber-300'
                      : 'border-[var(--vg-border)] text-[var(--vg-text-muted)]'
                  }`}
                >
                  {provider}
                </button>
              ))}
            </div>
            <input
              type="password"
              value={byokConfig.apiKey}
              onChange={(e) => onChangeByokConfig({ ...byokConfig, apiKey: e.target.value })}
              placeholder="Paste ephemeral API key (RAM only)..."
              className="w-full rounded border border-[var(--vg-border)] bg-[var(--vg-code-bg)] px-2 py-1 font-mono text-[10px] text-[var(--vg-text)] outline-none focus:border-amber-400"
            />
            <p className="font-mono text-[9px] text-[var(--vg-text-dim)]">
              Key stays strictly in React memory; falls back cleanly to browser protocol engine if empty.
            </p>
          </div>
        )}
      </section>
    </aside>
  );
};
