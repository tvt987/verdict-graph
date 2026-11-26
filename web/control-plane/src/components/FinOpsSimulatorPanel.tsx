import React from 'react';
import {
  Check,
  Download,
  GitFork,
  Layers,
  ShieldCheck,
  TrendingDown,
  Zap,
} from 'lucide-react';
import type { Translations } from '../i18n/translations';
import {
  type FinOpsSimulationResult,
  type RoutingPolicy,
  formatRunScaleLabel,
  formatUsdCompact,
} from '../engine/finopsSimulator';

interface FinOpsSimulatorPanelProps {
  t: Translations;
  routingPolicy: RoutingPolicy;
  onChangeRoutingPolicy: (policy: RoutingPolicy) => void;
  monthlyRuns: number;
  onChangeMonthlyRuns: (runs: number) => void;
  simulation: FinOpsSimulationResult;
  onLaunchScenarioDFork: () => void;
  onExportAuditBundle: () => void;
  auditExportedRecently: boolean;
}

const SCALE_STOPS = [10_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000];

// Logarithmic mapping [0..1000] <-> [10_000..5_000_000] for ultra-smooth slider feel
const LOG_MIN = Math.log10(10_000);
const LOG_MAX = Math.log10(5_000_000);

function runsToSliderValue(runs: number): number {
  const clamped = Math.max(10_000, Math.min(5_000_000, runs));
  return Math.round(((Math.log10(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000);
}

function sliderValueToRuns(val: number): number {
  const frac = Math.max(0, Math.min(1, val / 1000));
  const raw = Math.pow(10, LOG_MIN + frac * (LOG_MAX - LOG_MIN));
  if (raw < 100_000) return Math.round(raw / 5_000) * 5_000;
  if (raw < 1_000_000) return Math.round(raw / 25_000) * 25_000;
  return Math.round(raw / 100_000) * 100_000;
}

function formatTokensCompact(tokens: number): string {
  if (tokens >= 1_000_000_000) {
    return `${(tokens / 1_000_000_000).toFixed(2)}B`;
  }
  return `${(tokens / 1_000_000).toFixed(1)}M`;
}

export const FinOpsSimulatorPanel: React.FC<FinOpsSimulatorPanelProps> = ({
  t,
  routingPolicy,
  onChangeRoutingPolicy,
  monthlyRuns,
  onChangeMonthlyRuns,
  simulation,
  onLaunchScenarioDFork,
  onExportAuditBundle,
  auditExportedRecently,
}) => {
  const maxBarMonthly = Math.max(1, simulation.mainMonthlyUsd);
  const forkBarPct = Math.max(
    6,
    Math.min(100, Math.round((simulation.forkEffectiveMonthlyUsd / maxBarMonthly) * 100))
  );

  const mainGroundPct = Math.round(simulation.mainGroundedness * 100);
  const forkGroundPct = Math.round(simulation.forkGroundedness * 100);

  return (
    <section
      id="finops-deck"
      data-testid="finops-simulator-panel"
      className="vg-panel flex h-full flex-col rounded-lg"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TrendingDown className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.finopsSimTitle}
            </h2>
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                simulation.sourceMode === 'live_fork'
                  ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                  : 'border-sky-500/35 bg-sky-500/10 text-sky-700 dark:text-sky-400'
              }`}
            >
              {simulation.sourceMode === 'live_fork' ? 'LIVE FORK' : 'SCN-D BASELINE'}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
            {t.finopsSimSubtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onExportAuditBundle}
          data-testid="finops-export-audit-btn"
          className="flex shrink-0 items-center gap-1.5 rounded border border-sky-500/50 bg-sky-500/15 px-2.5 py-1 font-mono text-[10px] font-semibold text-sky-700 transition-colors hover:bg-sky-500/25 dark:border-sky-400/50 dark:text-sky-300"
        >
          {auditExportedRecently ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              <span className="text-emerald-700 dark:text-emerald-300">{t.exportAuditSaved}</span>
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              <span>{t.exportAuditBtn}</span>
            </>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-3.5">
        {/* Routing Policy Switch */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <button
            type="button"
            data-testid="finops-policy-frontier"
            onClick={() => onChangeRoutingPolicy('frontier_only')}
            className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition-all ${
              routingPolicy === 'frontier_only'
                ? 'border-amber-400/60 bg-amber-500/12 text-[var(--vg-text)]'
                : 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-text-muted)] hover:border-amber-400/35'
            }`}
          >
            <div>
              <p className="font-mono text-[10px] font-bold tracking-wider">
                {t.finopsFrontierLabel}
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-[var(--vg-text-dim)]">
                All stages pinned to flagship models
              </p>
            </div>
            <Layers className="h-4 w-4 shrink-0 text-amber-400" />
          </button>

          <button
            type="button"
            data-testid="finops-policy-cascade"
            onClick={() => onChangeRoutingPolicy('tiered_cascade')}
            className={`flex items-center justify-between rounded-md border px-3 py-2 text-left transition-all ${
              routingPolicy === 'tiered_cascade'
                ? 'border-emerald-400/60 bg-emerald-500/12 text-[var(--vg-text)] shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]'
                : 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-text-muted)] hover:border-emerald-400/35'
            }`}
          >
            <div>
              <p className="font-mono text-[10px] font-bold tracking-wider text-emerald-400">
                {t.finopsCascadeLabel}
              </p>
              <p className="mt-0.5 font-mono text-[9px] text-[var(--vg-text-dim)]">
                Mini triage + classifier + pruned synthesis
              </p>
            </div>
            <Zap className="h-4 w-4 shrink-0 text-emerald-400" />
          </button>
        </div>

        {/* Scale Slider (10K -> 5M runs/month) */}
        <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="text-[var(--vg-text-muted)]">{t.finopsScaleLabel}</span>
            <span
              data-testid="finops-scale-value"
              className="rounded bg-sky-500/15 px-2 py-0.5 font-bold text-sky-400"
            >
              {formatRunScaleLabel(monthlyRuns)} RUNS / MO
            </span>
          </div>

          <input
            type="range"
            data-testid="finops-scale-slider"
            min={0}
            max={1000}
            step={5}
            value={runsToSliderValue(monthlyRuns)}
            onChange={(e) => onChangeMonthlyRuns(sliderValueToRuns(Number(e.target.value)))}
            className="vg-slider mt-2.5 w-full"
            aria-label="Monthly Agent Execution Volume"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
            {SCALE_STOPS.filter((s) => [10_000, 100_000, 500_000, 1_000_000, 5_000_000].includes(s)).map(
              (stop) => (
                <button
                  key={stop}
                  type="button"
                  onClick={() => onChangeMonthlyRuns(stop)}
                  className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold transition-colors ${
                    monthlyRuns === stop
                      ? 'border-sky-400/60 bg-sky-500/20 text-sky-300'
                      : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-dim)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {formatRunScaleLabel(stop)}
                </button>
              )
            )}
          </div>
        </div>

        {/* Hero FinOps & Groundedness KPI Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-2.5 font-mono">
            <p className="text-[8.5px] text-emerald-300/80">MONTHLY SAVINGS</p>
            <p
              data-testid="finops-monthly-savings"
              className="mt-0.5 text-sm font-bold text-emerald-400"
            >
              {formatUsdCompact(simulation.monthlySavingsUsd)}
            </p>
            <p className="mt-0.5 text-[9px] text-[var(--vg-text-dim)]">
              -{simulation.totalSavingsPct}% vs main
            </p>
          </div>

          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
            <p className="text-[8.5px] text-[var(--vg-text-dim)]">ANNUALIZED ROI</p>
            <p className="mt-0.5 text-sm font-bold text-sky-400">
              {formatUsdCompact(simulation.annualSavingsUsd)}
            </p>
            <p className="mt-0.5 text-[9px] text-[var(--vg-text-dim)]">12-mo projection</p>
          </div>

          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
            <p className="flex items-center gap-1 text-[8.5px] text-[var(--vg-text-dim)]">
              <ShieldCheck className="h-3 w-3 shrink-0 text-emerald-400" /> GROUNDEDNESS
            </p>
            <p
              data-testid="finops-groundedness-lift"
              className="mt-0.5 whitespace-nowrap text-[13px] font-bold text-emerald-500 dark:text-emerald-400"
            >
              {simulation.mainGroundedness.toFixed(2)} -&gt; {simulation.forkGroundedness.toFixed(2)}
            </p>
            <p className="mt-0.5 text-[9px] text-emerald-600 dark:text-emerald-400/90">
              +{simulation.groundednessLift.toFixed(2)} lift
            </p>
          </div>

          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
            <p className="text-[8.5px] text-[var(--vg-text-dim)]">TOKENS PRUNED</p>
            <p className="mt-0.5 whitespace-nowrap text-[13px] font-bold text-[var(--vg-text)]">
              {formatTokensCompact(simulation.monthlyTokensSaved)}
            </p>
            <p className="mt-0.5 text-[9px] text-[var(--vg-text-dim)]">
              -{simulation.tokensSavedPerRun.toLocaleString()} tok/run
            </p>
          </div>
        </div>

        {/* Visual A/B Cost & Groundedness Comparison Bars */}
        <div className="grid gap-2.5 sm:grid-cols-2">
          {/* Monthly Cost A/B Bars */}
          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
            <p className="mb-2 text-[9.5px] font-semibold tracking-wider text-[var(--vg-text-muted)]">
              MONTHLY COST A/B ({formatRunScaleLabel(monthlyRuns)} RUNS)
            </p>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--vg-text-muted)]">
                    MAIN ({simulation.mainBranchId.toUpperCase()})
                  </span>
                  <span className="font-bold text-rose-400">
                    {formatUsdCompact(simulation.mainMonthlyUsd)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
                  <div className="h-full w-full rounded-full bg-rose-500/80" />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--vg-text)]">
                    FORK + {routingPolicy === 'tiered_cascade' ? 'CASCADE' : 'FRONTIER'}
                  </span>
                  <span className="font-bold text-emerald-400">
                    {formatUsdCompact(simulation.forkEffectiveMonthlyUsd)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${forkBarPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Groundedness Lift Bars */}
          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
            <p className="mb-2 text-[9.5px] font-semibold tracking-wider text-[var(--vg-text-muted)]">
              GROUNDEDNESS QUALITY A/B
            </p>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--vg-text-muted)]">MAIN (top_k=24 unranked)</span>
                  <span className="font-bold text-amber-400">
                    {simulation.mainGroundedness.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
                  <div
                    className="h-full rounded-full bg-amber-400/85"
                    style={{ width: `${mainGroundPct}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-[var(--vg-text)]">FORK (top_k=8 + rerank)</span>
                  <span className="font-bold text-emerald-400">
                    {simulation.forkGroundedness.toFixed(2)}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${forkGroundPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Per-Stage Routing Breakdown ($/1K runs) */}
        <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
          <div className="mb-1.5 flex items-center justify-between text-[9.5px]">
            <span className="font-semibold text-[var(--vg-text-muted)]">
              PER-STAGE MODEL ROUTING ($ / 1K RUNS)
            </span>
            {simulation.sourceMode === 'benchmark_baseline' && (
              <button
                type="button"
                onClick={onLaunchScenarioDFork}
                className="flex items-center gap-1 text-[9.5px] font-semibold text-sky-400 hover:underline"
              >
                <GitFork className="h-3 w-3" />
                <span>{t.finopsLaunchForkBtn}</span>
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {simulation.stageBreakdown.map((row) => (
              <div
                key={row.stage}
                className="grid grid-cols-12 items-center gap-2 text-[9.5px]"
              >
                <span className="col-span-5 truncate text-[var(--vg-text)]">{row.stage}</span>
                <span className="col-span-4 truncate text-[var(--vg-text-dim)]">
                  {row.routedModel}
                </span>
                <span className="col-span-3 text-right font-bold text-emerald-400">
                  ${row.forkRoutedCostPer1kUsd.toFixed(2)}
                  <span className="ml-1 text-[8.5px] text-[var(--vg-text-dim)]">
                    (-{Math.max(0, row.reductionPct).toFixed(0)}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
