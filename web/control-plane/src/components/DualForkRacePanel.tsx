import React from 'react';
import {
  CheckCircle2,
  FastForward,
  GitFork,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TrendingDown,
  X,
} from 'lucide-react';
import type {
  BranchRaceTrack,
  BranchStepMetric,
  DualForkRaceState,
} from '../engines/interactiveGraphDebuggerEngine';

interface DualForkRacePanelProps {
  race: DualForkRaceState;
  onToggleRunning: () => void;
  onFinishInstant: () => void;
  onClose: () => void;
}

const STEP_SHORT_LABEL: Record<string, string> = {
  user_prompt: '01 Prompt',
  planner_agent: '02 Planner',
  mcp_tool_router: '03 MCP',
  hybrid_rag: '04 RAG',
  owasp_firewall: '05 OWASP',
  code_sql_sandbox: '06 Sandbox',
  critic_verifier: '07 Critic',
};

function stepChipStyle(step: BranchStepMetric, isFork: boolean): string {
  if (step.status === 'blocked_safe') {
    return 'border-emerald-500/55 bg-emerald-500/14 text-emerald-800 dark:text-emerald-300';
  }
  if (step.status === 'degraded') {
    return 'border-rose-500/50 bg-rose-500/12 text-rose-800 dark:text-rose-300';
  }
  if (step.status === 'running') {
    return isFork
      ? 'border-indigo-500/60 bg-indigo-500/14 text-indigo-800 ring-1 ring-indigo-500/35 dark:text-indigo-200'
      : 'border-amber-500/60 bg-amber-500/14 text-amber-800 ring-1 ring-amber-500/35 dark:text-amber-200';
  }
  if (step.status === 'completed') {
    return isFork
      ? 'border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-800 dark:text-emerald-300'
      : 'border-slate-400/35 bg-[var(--vg-panel)] text-[var(--vg-text)]';
  }
  return 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-text-dim)] opacity-70';
}

const RaceLaneCard: React.FC<{ track: BranchRaceTrack; isFork: boolean }> = ({
  track,
  isFork,
}) => {
  const pct = Math.round(track.progress * 100);
  return (
    <div
      data-testid={`fork-race-lane-${track.branchId}`}
      className={`rounded-xl border p-3.5 transition-all ${
        isFork
          ? 'border-emerald-500/40 bg-emerald-500/[0.045]'
          : 'border-rose-500/25 bg-rose-500/[0.03]'
      }`}
    >
      {/* Lane Header & Live Cumulative Telemetry */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider ${
              isFork
                ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                : 'bg-slate-800 text-white dark:bg-slate-700'
            }`}
          >
            {track.label}
          </span>
          <span className="font-mono text-[10.5px] text-[var(--vg-text-muted)]">
            {track.policyLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
          <span className="font-bold text-[var(--vg-text)]">
            ${track.cumulativeCostUsd.toFixed(4)}
          </span>
          <span className="text-[var(--vg-text-muted)]">
            {track.cumulativeTokens.toLocaleString()} tok
          </span>
          <span className="text-[var(--vg-text-muted)]">{track.cumulativeLatencyMs}ms</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              track.groundedness >= 0.92
                ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-500/45 bg-rose-500/12 text-rose-700 dark:text-rose-300'
            }`}
          >
            GRD {track.groundedness.toFixed(2)}
          </span>
          <span
            className={`flex items-center gap-1 text-[10px] font-bold ${
              track.exfiltratedBytes === 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {track.exfiltratedBytes === 0 ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>0B LEAKED</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>{track.exfiltratedBytes.toLocaleString()}B LEAKED</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Animated Parallel Race Ribbon */}
      <div className="mt-3 flex items-center gap-2.5">
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--vg-surface)]">
          <div
            className={`h-full rounded-full transition-all duration-150 ${
              isFork
                ? 'bg-gradient-to-r from-indigo-500 via-emerald-500 to-emerald-400'
                : 'bg-gradient-to-r from-slate-500 via-amber-500 to-rose-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-11 text-right font-mono text-[10.5px] font-bold text-[var(--vg-text)]">
          {pct}%
        </span>
      </div>

      {/* 7 Synchronized Pipeline Stage Pills */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
        {track.steps.map((step) => (
          <div
            key={step.nodeId}
            className={`flex flex-col justify-between rounded-lg border px-2 py-1.5 transition-all ${stepChipStyle(
              step,
              isFork
            )}`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="truncate font-mono text-[9.5px] font-bold">
                {STEP_SHORT_LABEL[step.nodeId] ?? step.nodeTitle}
              </span>
              {step.status === 'blocked_safe' && (
                <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              {step.status === 'completed' && (
                <CheckCircle2 className="h-3 w-3 shrink-0 opacity-75" />
              )}
            </div>
            <div className="mt-1 flex items-center justify-between font-mono text-[9px] opacity-85">
              <span className="truncate">{step.modelUsed.replace('claude-3.7-', 'c3.7-')}</span>
              <span className="shrink-0 font-semibold">{step.latencyMs}ms</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DualForkRacePanel: React.FC<DualForkRacePanelProps> = ({
  race,
  onToggleRunning,
  onFinishInstant,
  onClose,
}) => {
  const bothFinished = race.mainBranch.finished && race.forkBranch.finished;

  return (
    <section
      data-testid="dual-fork-race-panel"
      className="vg-panel overflow-hidden rounded-xl border-[var(--vg-accent-border)] ring-1 ring-indigo-500/15"
    >
      {/* Header + Race Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--vg-border)] bg-[var(--vg-accent-soft)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--vg-accent-border)] bg-[var(--vg-panel)] text-[var(--vg-accent)]">
            <GitFork className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-sm font-bold tracking-tight text-[var(--vg-text)]">
                DUAL-BRANCH TIME-TRAVEL FORK RACE
              </h3>
              <span className="rounded-full border border-[var(--vg-accent-border)] bg-[var(--vg-panel)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--vg-accent)]">
                {bothFinished ? 'RACE COMPLETE' : race.running ? 'RACING LIVE' : 'PAUSED'}
              </span>
            </div>
            <p className="font-mono text-[10.5px] text-[var(--vg-text-muted)]">
              Forked from {race.forkedFromNodeId} · Parallel side-by-side timeline execution
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleRunning}
            data-testid="fork-race-toggle-btn"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-panel)] px-3 py-1.5 font-mono text-[11px] font-bold text-[var(--vg-text)] transition-colors hover:border-[var(--vg-accent-border)] hover:text-[var(--vg-accent)]"
          >
            {bothFinished ? (
              <>
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Re-Race</span>
              </>
            ) : race.running ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                <span>Resume</span>
              </>
            )}
          </button>

          {!bothFinished && (
            <button
              type="button"
              onClick={onFinishInstant}
              data-testid="fork-race-finish-btn"
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/45 bg-emerald-500/12 px-3 py-1.5 font-mono text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              <FastForward className="h-3.5 w-3.5" />
              <span>Finish Race</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Dual Fork Race Panel"
            className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-panel)] p-1.5 text-[var(--vg-text-muted)] transition-colors hover:text-[var(--vg-text)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Real-Time Delta KPI Banner */}
      <div className="grid grid-cols-2 gap-2.5 border-b border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] px-4 py-3 sm:px-5 lg:grid-cols-4">
        <div
          data-testid="race-delta-cost"
          className="rounded-lg border border-emerald-500/35 bg-[var(--vg-panel)] px-3 py-2"
        >
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold text-[var(--vg-text-dim)]">
            <TrendingDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>COST DELTA</span>
          </div>
          <p className="mt-0.5 font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
            -{race.costSavingsPct.toFixed(1)}%
          </p>
          <p className="font-mono text-[10px] text-[var(--vg-text-muted)]">
            ${race.mainBranch.cumulativeCostUsd.toFixed(4)} vs $
            {race.forkBranch.cumulativeCostUsd.toFixed(4)}
          </p>
        </div>

        <div
          data-testid="race-delta-groundedness"
          className="rounded-lg border border-emerald-500/35 bg-[var(--vg-panel)] px-3 py-2"
        >
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold text-[var(--vg-text-dim)]">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>GROUNDEDNESS LIFT</span>
          </div>
          <p className="mt-0.5 font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
            {race.groundednessDelta >= 0 ? '+' : ''}
            {race.groundednessDelta.toFixed(2)}
          </p>
          <p className="font-mono text-[10px] text-[var(--vg-text-muted)]">
            0.61 Main -&gt; {race.forkBranch.groundedness.toFixed(2)} Fork
          </p>
        </div>

        <div
          data-testid="race-delta-latency"
          className="rounded-lg border border-indigo-500/35 bg-[var(--vg-panel)] px-3 py-2"
        >
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold text-[var(--vg-text-dim)]">
            <Timer className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>LATENCY DELTA</span>
          </div>
          <p className="mt-0.5 font-mono text-base font-bold text-indigo-700 dark:text-indigo-400">
            {race.latencyDeltaMs}ms ({race.latencySavingsPct > 0 ? `-${race.latencySavingsPct}%` : '0%'})
          </p>
          <p className="font-mono text-[10px] text-[var(--vg-text-muted)]">
            {race.mainBranch.cumulativeLatencyMs}ms vs {race.forkBranch.cumulativeLatencyMs}ms
          </p>
        </div>

        <div
          data-testid="race-delta-owasp"
          className={`rounded-lg border bg-[var(--vg-panel)] px-3 py-2 ${
            race.owaspBlockedPct === 100
              ? 'border-emerald-500/35'
              : 'border-rose-500/45'
          }`}
        >
          <div className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold text-[var(--vg-text-dim)]">
            {race.owaspBlockedPct === 100 ? (
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            )}
            <span>OWASP BLOCKED</span>
          </div>
          <p
            className={`mt-0.5 font-mono text-base font-bold ${
              race.owaspBlockedPct === 100
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {race.owaspBlockedPct}%
          </p>
          <p className="font-mono text-[10px] text-[var(--vg-text-muted)]">
            {race.owaspBlockedPct === 100
              ? 'INJ-EXFIL-001 Neutralized · 0B'
              : 'Shield Bypassed · Data At Risk'}
          </p>
        </div>
      </div>

      {/* Synchronized Parallel Timeline Swimlanes */}
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <RaceLaneCard track={race.mainBranch} isFork={false} />
        <RaceLaneCard track={race.forkBranch} isFork={true} />
      </div>
    </section>
  );
};

export default DualForkRacePanel;
