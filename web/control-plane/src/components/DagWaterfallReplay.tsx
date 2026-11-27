import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  DollarSign,
  GitBranch,
  Layers,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Timer,
} from 'lucide-react';
import type { ControlPlaneRun } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import {
  type WaterfallSourceMode,
  buildDagWaterfallReplay,
  computeReplayFrame,
} from '../engine/promptFirewallEngine';

interface DagWaterfallReplayProps {
  t: Translations;
  run: ControlPlaneRun;
}

const TONE_BAR_CLASSES: Record<'cyan' | 'emerald' | 'amber' | 'purple', string> = {
  cyan: 'bg-sky-400/80 border-sky-300/70',
  emerald: 'bg-emerald-400/80 border-emerald-300/70',
  amber: 'bg-amber-400/80 border-amber-300/70',
  purple: 'bg-purple-400/80 border-purple-300/70',
};

const TONE_TEXT_CLASSES: Record<'cyan' | 'emerald' | 'amber' | 'purple', string> = {
  cyan: 'text-sky-400',
  emerald: 'text-emerald-400',
  amber: 'text-amber-400',
  purple: 'text-purple-400',
};

export const DagWaterfallReplay: React.FC<DagWaterfallReplayProps> = ({ t, run }) => {
  const [sourceMode, setSourceMode] = useState<WaterfallSourceMode>('multi_branch_benchmark');
  const replay = useMemo(() => buildDagWaterfallReplay(sourceMode, run), [run, sourceMode]);

  const [stepIndex, setStepIndex] = useState<number>(() => replay.steps.length);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Sync step count when source changes
  useEffect(() => {
    setIsPlaying(false);
    setStepIndex(replay.steps.length);
  }, [replay.steps.length, sourceMode, run.run_id]);

  // Step-by-step animated replay loop
  useEffect(() => {
    if (!isPlaying) return;
    if (stepIndex >= replay.steps.length) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setStepIndex((prev) => {
        const next = prev + 1;
        if (next >= replay.steps.length) {
          setIsPlaying(false);
        }
        return next;
      });
    }, 520);
    return () => window.clearTimeout(timer);
  }, [isPlaying, replay.steps.length, stepIndex]);

  const frame = useMemo(() => computeReplayFrame(replay, stepIndex), [replay, stepIndex]);

  const handleTogglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (stepIndex >= replay.steps.length) {
      setStepIndex(1);
    }
    setIsPlaying(true);
  };

  const handleStep = () => {
    setIsPlaying(false);
    setStepIndex((prev) => (prev >= replay.steps.length ? 1 : prev + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setStepIndex(0);
  };

  return (
    <section
      id="waterfall-replay-deck"
      data-testid="dag-waterfall-replay"
      className="vg-panel flex flex-col rounded-lg"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Timer className="h-4 w-4 shrink-0 text-sky-400" />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.waterfallReplayTitle}
            </h2>
            <span className="rounded border border-emerald-400/45 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
              P95 + USD REPLAY
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
            {t.waterfallReplaySubtitle}
          </p>
        </div>

        {/* Source Toggle & Transport Controls */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5 font-mono text-[9.5px]">
            <button
              type="button"
              data-testid="waterfall-source-benchmark"
              onClick={() => setSourceMode('multi_branch_benchmark')}
              className={`rounded px-2 py-0.5 font-semibold ${
                sourceMode === 'multi_branch_benchmark'
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
              }`}
            >
              3-Branch DAG
            </button>
            <button
              type="button"
              data-testid="waterfall-source-active"
              onClick={() => setSourceMode('active_run')}
              className={`rounded px-2 py-0.5 font-semibold ${
                sourceMode === 'active_run'
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
              }`}
            >
              Active Run
            </button>
          </div>

          <button
            type="button"
            data-testid="waterfall-play-btn"
            onClick={handleTogglePlay}
            className="flex items-center gap-1 rounded border border-emerald-400/55 bg-emerald-500/15 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/25"
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span>{isPlaying ? t.pause : 'Replay'}</span>
          </button>

          <button
            type="button"
            data-testid="waterfall-step-btn"
            onClick={handleStep}
            className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--vg-text)] hover:border-sky-400/50"
          >
            <SkipForward className="h-3 w-3" />
            <span>{t.step}</span>
          </button>

          <button
            type="button"
            data-testid="waterfall-reset-btn"
            onClick={handleReset}
            className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{t.reset}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-3.5">
        {/* Live Replay Cumulative KPI Strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-2 font-mono">
            <p className="flex items-center gap-1 text-[8.5px] text-[var(--vg-text-dim)]">
              <Activity className="h-3 w-3 text-sky-400" /> CUMULATIVE P95 LATENCY
            </p>
            <p className="mt-0.5 text-sm font-bold text-sky-400" data-testid="waterfall-cum-p95">
              {frame.cumulativeP95Ms.toFixed(1)}ms
            </p>
          </div>
          <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-2 font-mono">
            <p className="flex items-center gap-1 text-[8.5px] text-[var(--vg-text-dim)]">
              <DollarSign className="h-3 w-3 text-emerald-400" /> CUMULATIVE USD SPEND
            </p>
            <p className="mt-0.5 text-sm font-bold text-emerald-400" data-testid="waterfall-cum-usd">
              ${frame.cumulativeCostUsd.toFixed(4)}
            </p>
          </div>
          <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-2 font-mono">
            <p className="flex items-center gap-1 text-[8.5px] text-[var(--vg-text-dim)]">
              <Layers className="h-3 w-3 text-amber-400" /> REPLAY CURSOR
            </p>
            <p className="mt-0.5 text-sm font-bold text-[var(--vg-text)]" data-testid="waterfall-step-counter">
              {frame.stepIndex} / {frame.totalSteps} ({frame.progressPct}%)
            </p>
          </div>
          <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-2 font-mono">
            <p className="flex items-center gap-1 text-[8.5px] text-[var(--vg-text-dim)]">
              <GitBranch className="h-3 w-3 text-purple-400" /> ACTIVE NODE
            </p>
            <p className="mt-0.5 truncate text-xs font-bold text-[var(--vg-text)]">
              {frame.activeStep ? frame.activeStep.label : 'READY (STEP 0)'}
            </p>
          </div>
        </div>

        {/* Interactive Scrubber */}
        <div className="flex items-center gap-3 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-1.5 font-mono text-[9.5px]">
          <span className="shrink-0 text-[var(--vg-text-dim)]">TIMELINE SCRUBBER</span>
          <input
            type="range"
            data-testid="waterfall-scrubber"
            min={0}
            max={replay.steps.length}
            step={1}
            value={stepIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setStepIndex(Number(e.target.value));
            }}
            className="vg-slider flex-1"
            aria-label="DAG Waterfall Replay Step Scrubber"
          />
          <span className="shrink-0 font-bold text-sky-400">
            0ms .. {replay.totalTimelineMs.toFixed(0)}ms
          </span>
        </div>

        {/* Waterfall Gantt Rows */}
        <div className="space-y-1.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-bg)] p-2.5">
          {replay.steps.map((step) => {
            const revealed = step.stepIndex <= frame.stepIndex;
            const isActive = frame.activeStep?.stepIndex === step.stepIndex;
            const leftPct = (step.startMs / replay.totalTimelineMs) * 100;
            const widthPct = Math.max(4, (step.durationMs / replay.totalTimelineMs) * 100);

            return (
              <button
                key={step.nodeId}
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setStepIndex(step.stepIndex);
                }}
                className={`grid w-full grid-cols-1 items-center gap-2 rounded border px-2 py-1.5 text-left font-mono text-[9.5px] transition-all md:grid-cols-12 ${
                  isActive
                    ? 'border-sky-400/70 bg-sky-500/15'
                    : revealed
                      ? 'border-[var(--vg-border)] bg-[var(--vg-panel)] hover:border-sky-400/40'
                      : 'border-[var(--vg-border)]/50 bg-[var(--vg-panel)]/40 opacity-45'
                }`}
              >
                {/* Node + Branch Label */}
                <div className="min-w-0 md:col-span-4">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${TONE_TEXT_CLASSES[step.branchTone]}`}>
                      #{step.stepIndex}
                    </span>
                    <span className="truncate font-semibold text-[var(--vg-text)]">
                      {step.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[8.5px] text-[var(--vg-text-dim)]">
                    <span className={TONE_TEXT_CLASSES[step.branchTone]}>{step.branchId}</span>
                    <span>·</span>
                    <span className="truncate">{step.model}</span>
                  </div>
                </div>

                {/* Gantt Timeline Track */}
                <div className="relative h-5 w-full overflow-hidden rounded bg-[var(--vg-surface)] md:col-span-5">
                  <div
                    className={`absolute top-0.5 bottom-0.5 rounded border transition-all duration-300 ${
                      TONE_BAR_CLASSES[step.branchTone]
                    } ${isActive ? 'ring-2 ring-sky-300/80' : ''}`}
                    style={{
                      left: `${Math.min(94, leftPct)}%`,
                      width: revealed ? `${Math.min(100 - leftPct, widthPct)}%` : '0%',
                    }}
                  />
                  <span className="relative z-10 flex h-full items-center justify-end pr-2 text-[8.5px] font-bold text-[var(--vg-text)]">
                    {step.durationMs.toFixed(0)}ms (P95 {step.p95LatencyMs.toFixed(0)}ms)
                  </span>
                </div>

                {/* Cumulative Branch Metrics */}
                <div className="flex items-center justify-between gap-2 text-[9px] md:col-span-3 md:justify-end">
                  <span className="text-[var(--vg-text-muted)]">
                    Node <strong className="text-emerald-400">${step.nodeCostUsd.toFixed(4)}</strong>
                  </span>
                  <span className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-1.5 py-0.5 text-sky-300">
                    Σ ${step.cumulativeCostUsd.toFixed(4)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Per-Branch Cumulative P95 & USD Rollup Cards */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {replay.branchRollups.map((rollup) => {
            const live = frame.perBranchLive.find((b) => b.branchId === rollup.branchId);
            return (
              <div
                key={rollup.branchId}
                className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[10px] font-bold ${TONE_TEXT_CLASSES[rollup.branchTone]}`}>
                    {rollup.branchLabel}
                  </span>
                  <span className="text-[9px] text-[var(--vg-text-dim)]">
                    {live?.completedCount ?? 0}/{rollup.nodeCount} NODES
                  </span>
                </div>
                <div className="mt-1.5 flex items-baseline justify-between">
                  <span className="text-xs font-bold text-[var(--vg-text)]">
                    P95 {(live?.liveP95Ms ?? 0).toFixed(0)}ms
                  </span>
                  <span className="text-xs font-bold text-emerald-400">
                    ${(live?.liveCostUsd ?? 0).toFixed(4)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[8.5px] text-[var(--vg-text-dim)]">
                  Bottleneck: {rollup.bottleneckNode}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default DagWaterfallReplay;
