import React, { useMemo, useState } from 'react';
import {
  Activity,
  Check,
  Database,
  Download,
  GitFork,
  Layers,
  Scale,
  Sparkles,
  TrendingDown,
  Zap,
} from 'lucide-react';
import type { Translations } from '../i18n/translations';
import {
  type FinOpsSimulationResult,
  type MultiModelFinOpsResult,
  type MultiModelRoutingPolicy,
  type ParetoChartPoint,
  formatRunScaleLabel,
  formatUsdCompact,
} from '../engine/finopsSimulator';

interface FinOpsSimulatorPanelProps {
  t: Translations;
  monthlyCalls: number;
  onChangeMonthlyCalls: (calls: number) => void;
  cacheHitRatePct: number;
  onChangeCacheHitRatePct: (pct: number) => void;
  routerPolicy: MultiModelRoutingPolicy;
  onChangeRouterPolicy: (policy: MultiModelRoutingPolicy) => void;
  matrix: MultiModelFinOpsResult;
  branchSimulation: FinOpsSimulationResult;
  onLaunchScenarioDFork: () => void;
  onExportAuditBundle: () => void;
  auditExportedRecently: boolean;
}

const VOLUME_STOPS = [100_000, 500_000, 2_000_000, 5_000_000, 10_000_000, 20_000_000];
const LOG_MIN = Math.log10(100_000);
const LOG_MAX = Math.log10(20_000_000);

function callsToSlider(calls: number): number {
  const clamped = Math.max(100_000, Math.min(20_000_000, calls));
  return Math.round(((Math.log10(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000);
}

function sliderToCalls(val: number): number {
  const frac = Math.max(0, Math.min(1, val / 1000));
  const raw = Math.pow(10, LOG_MIN + frac * (LOG_MAX - LOG_MIN));
  if (raw < 1_000_000) return Math.round(raw / 50_000) * 50_000;
  return Math.round(raw / 250_000) * 250_000;
}

const PARETO_W = 460;
const PARETO_H = 196;
const PAD = { top: 18, right: 24, bottom: 30, left: 42 };

export const FinOpsSimulatorPanel: React.FC<FinOpsSimulatorPanelProps> = ({
  t,
  monthlyCalls,
  onChangeMonthlyCalls,
  cacheHitRatePct,
  onChangeCacheHitRatePct,
  routerPolicy,
  onChangeRouterPolicy,
  matrix,
  branchSimulation,
  onLaunchScenarioDFork,
  onExportAuditBundle,
  auditExportedRecently,
}) => {
  const [focusedPointId, setFocusedPointId] = useState<string | null>(null);

  const paretoGeometry = useMemo(() => {
    const plotW = PARETO_W - PAD.left - PAD.right;
    const plotH = PARETO_H - PAD.top - PAD.bottom;

    const maxCost = Math.max(
      1,
      ...matrix.paretoPoints.map((p) => p.costPer1kCallsUsd)
    ) * 1.12;
    const minQuality = 86;
    const maxQuality = 99;

    const toX = (cost: number) => PAD.left + 16 + (cost / maxCost) * (plotW - 32);
    const toY = (qual: number) =>
      PAD.top + plotH - ((qual - minQuality) / (maxQuality - minQuality)) * plotH;

    const mapped = matrix.paretoPoints.map((pt) => ({
      ...pt,
      cx: Number(toX(pt.costPer1kCallsUsd).toFixed(1)),
      cy: Number(toY(pt.qualityIndex).toFixed(1)),
    }));

    const frontierSorted = mapped
      .filter((p) => p.onFrontier)
      .sort((a, b) => a.costPer1kCallsUsd - b.costPer1kCallsUsd);
    const frontierPolyline = frontierSorted.map((p) => `${p.cx},${p.cy}`).join(' ');

    return { mapped, frontierPolyline, maxCost, plotW, plotH, toX, toY };
  }, [matrix.paretoPoints]);

  const focusedPoint: ParetoChartPoint =
    matrix.paretoPoints.find((p) => p.id === focusedPointId) ??
    matrix.paretoPoints.find((p) => p.kind === 'active') ??
    matrix.paretoPoints[0];

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
              {t.finopsRouterTitle}
            </h2>
            <span className="rounded border border-emerald-500/45 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
              4 MODELS · PARETO
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
            {t.finopsRouterSubtitle}
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
        {/* 3 Routing Policies: Quality First / Balanced Hybrid / Cost Optimized */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {(
            [
              {
                id: 'quality_first',
                label: t.finopsPolicyQuality,
                sub: '54% Claude · 30% Gemini',
                icon: <Sparkles className="h-3.5 w-3.5 text-amber-400" />,
                activeCls: 'border-amber-400/60 bg-amber-500/12 text-[var(--vg-text)]',
              },
              {
                id: 'balanced_hybrid',
                label: t.finopsPolicyBalanced,
                sub: '36% Gemini · 34% vLLM',
                icon: <Scale className="h-3.5 w-3.5 text-sky-400" />,
                activeCls: 'border-sky-400/60 bg-sky-500/12 text-[var(--vg-text)]',
              },
              {
                id: 'cost_optimized',
                label: t.finopsPolicyCost,
                sub: '68% Local vLLM Qwen-72B',
                icon: <Zap className="h-3.5 w-3.5 text-emerald-400" />,
                activeCls: 'border-emerald-400/60 bg-emerald-500/12 text-[var(--vg-text)]',
              },
            ] as Array<{
              id: MultiModelRoutingPolicy;
              label: string;
              sub: string;
              icon: React.ReactNode;
              activeCls: string;
            }>
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`finops-policy-${item.id}`}
              onClick={() => onChangeRouterPolicy(item.id)}
              className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left transition-all ${
                routerPolicy === item.id
                  ? item.activeCls
                  : 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-text-muted)] hover:border-sky-400/40'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-[10px] font-bold tracking-wide">
                  {item.label}
                </p>
                <p className="mt-0.5 truncate font-mono text-[8.5px] text-[var(--vg-text-dim)]">
                  {item.sub}
                </p>
              </div>
              {item.icon}
            </button>
          ))}
        </div>

        {/* Dual Sliders: Monthly Volume (100K -> 20M) + Cache Hit Rate (0% -> 85%) */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5">
            <div className="flex items-center justify-between font-mono text-[9.5px]">
              <span className="text-[var(--vg-text-muted)]">{t.finopsVolumeLabel}</span>
              <span
                data-testid="finops-scale-value"
                className="rounded bg-sky-500/15 px-1.5 py-0.5 font-bold text-sky-400"
              >
                {formatRunScaleLabel(monthlyCalls)} / MO
              </span>
            </div>
            <input
              type="range"
              data-testid="finops-scale-slider"
              min={0}
              max={1000}
              step={5}
              value={callsToSlider(monthlyCalls)}
              onChange={(e) => onChangeMonthlyCalls(sliderToCalls(Number(e.target.value)))}
              className="vg-slider mt-2 w-full"
              aria-label="Monthly Request Volume"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {VOLUME_STOPS.map((stop) => (
                <button
                  key={stop}
                  type="button"
                  onClick={() => onChangeMonthlyCalls(stop)}
                  className={`rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold transition-colors ${
                    monthlyCalls === stop
                      ? 'border-sky-400/60 bg-sky-500/20 text-sky-300'
                      : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-dim)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {formatRunScaleLabel(stop)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5">
            <div className="flex items-center justify-between font-mono text-[9.5px]">
              <span className="flex items-center gap-1 text-[var(--vg-text-muted)]">
                <Database className="h-3 w-3 text-emerald-400" />
                {t.finopsCacheHitLabel}
              </span>
              <span
                data-testid="finops-cache-value"
                className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-bold text-emerald-400"
              >
                {cacheHitRatePct}% HIT
              </span>
            </div>
            <input
              type="range"
              data-testid="finops-cache-slider"
              min={0}
              max={85}
              step={1}
              value={cacheHitRatePct}
              onChange={(e) => onChangeCacheHitRatePct(Number(e.target.value))}
              className="vg-slider mt-2 w-full"
              aria-label="Semantic and KV Cache Hit Rate"
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {[0, 25, 45, 65, 85].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onChangeCacheHitRatePct(pct)}
                  className={`rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold transition-colors ${
                    cacheHitRatePct === pct
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300'
                      : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-dim)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4 Live Hero FinOps KPIs */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-md border border-sky-400/35 bg-sky-500/10 p-2 font-mono">
            <p className="text-[8.5px] text-sky-300/85">MONTHLY SPEND</p>
            <p
              data-testid="finops-monthly-spend"
              className="mt-0.5 text-sm font-bold text-sky-400"
            >
              {formatUsdCompact(matrix.monthlyCloudSpendUsd)}
            </p>
            <p className="mt-0.5 text-[8.5px] text-[var(--vg-text-dim)]">
              vs {formatUsdCompact(matrix.singleFrontierMonthlyUsd)} 1-model
            </p>
          </div>

          <div className="rounded-md border border-emerald-400/40 bg-emerald-500/10 p-2 font-mono">
            <p className="text-[8.5px] text-emerald-300/85">ANNUAL SAVINGS</p>
            <p
              data-testid="finops-annual-savings"
              className="mt-0.5 text-sm font-bold text-emerald-400"
            >
              {formatUsdCompact(matrix.annualSavingsUsd)}
            </p>
            <p className="mt-0.5 text-[8.5px] text-emerald-400/90">
              -{matrix.savingsPct}% vs Frontier
            </p>
          </div>

          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
            <p className="flex items-center gap-1 text-[8.5px] text-[var(--vg-text-dim)]">
              <Activity className="h-3 w-3 text-sky-400" /> BLENDED TTFT
            </p>
            <p
              data-testid="finops-blended-ttft"
              className="mt-0.5 text-sm font-bold text-[var(--vg-text)]"
            >
              {matrix.blendedTtftMs}ms
            </p>
            <p className="mt-0.5 text-[8.5px] text-emerald-400">
              -{matrix.latencyReductionMs}ms vs 410ms
            </p>
          </div>

          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
            <p className="flex items-center gap-1 text-[8.5px] text-[var(--vg-text-dim)]">
              <Layers className="h-3 w-3 text-amber-400" /> QUALITY INDEX
            </p>
            <p
              data-testid="finops-quality-index"
              className="mt-0.5 text-sm font-bold text-amber-400"
            >
              {matrix.blendedQualityIndex.toFixed(1)} / 100
            </p>
            <p className="mt-0.5 text-[8.5px] text-[var(--vg-text-dim)]">
              ${matrix.costPer1kCallsUsd.toFixed(2)} / 1K calls
            </p>
          </div>
        </div>

        {/* Interactive SVG Cost-vs-Quality Pareto Chart */}
        <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[9.5px]">
            <span className="font-semibold tracking-wider text-[var(--vg-text-muted)]">
              COST-VS-QUALITY PARETO FRONTIER ($ / 1K CALLS vs QUALITY)
            </span>
            <span
              data-testid="pareto-focus-pill"
              className="rounded border border-sky-400/35 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold text-sky-400"
            >
              {focusedPoint.label}: ${focusedPoint.costPer1kCallsUsd.toFixed(2)}/1K · Q=
              {focusedPoint.qualityIndex} · {focusedPoint.ttftMs}ms
            </span>
          </div>

          <svg
            data-testid="finops-pareto-svg"
            viewBox={`0 0 ${PARETO_W} ${PARETO_H}`}
            className="h-auto w-full"
          >
            {/* Horizontal grid lines */}
            {[88, 91, 94, 97].map((q) => {
              const y = paretoGeometry.toY(q);
              return (
                <g key={q}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={PARETO_W - PAD.right}
                    y2={y}
                    stroke="var(--vg-border)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={PAD.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono, monospace"
                    fill="var(--vg-text-dim)"
                  >
                    {q}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line
              x1={PAD.left}
              y1={PAD.top}
              x2={PAD.left}
              y2={PARETO_H - PAD.bottom}
              stroke="var(--vg-text-dim)"
              strokeWidth={0.8}
            />
            <line
              x1={PAD.left}
              y1={PARETO_H - PAD.bottom}
              x2={PARETO_W - PAD.right}
              y2={PARETO_H - PAD.bottom}
              stroke="var(--vg-text-dim)"
              strokeWidth={0.8}
            />

            {/* Axis captions */}
            <text
              x={PARETO_W / 2}
              y={PARETO_H - 6}
              textAnchor="middle"
              fontSize="8.5"
              fontFamily="JetBrains Mono, monospace"
              fill="var(--vg-text-dim)"
            >
              COST PER 1,000 CALLS (USD) — LOWER IS BETTER
            </text>
            <text
              x={12}
              y={PARETO_H / 2}
              textAnchor="middle"
              fontSize="8.5"
              fontFamily="JetBrains Mono, monospace"
              fill="var(--vg-text-dim)"
              transform={`rotate(-90 12 ${PARETO_H / 2})`}
            >
              QUALITY
            </text>

            {/* Pareto Frontier Polyline */}
            {paretoGeometry.frontierPolyline && (
              <polyline
                points={paretoGeometry.frontierPolyline}
                fill="none"
                stroke="#10B981"
                strokeWidth={1.8}
                strokeDasharray="5 3"
                opacity={0.8}
              />
            )}

            {/* Scatter Points */}
            {paretoGeometry.mapped.map((pt) => {
              const isActive = pt.kind === 'active';
              const isFocused = focusedPoint.id === pt.id;
              return (
                <g
                  key={pt.id}
                  data-testid={`pareto-point-${pt.id}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setFocusedPointId(pt.id)}
                  onClick={() => setFocusedPointId(pt.id)}
                >
                  {(isActive || isFocused) && (
                    <circle
                      cx={pt.cx}
                      cy={pt.cy}
                      r={isActive ? 11 : 9}
                      fill={pt.accentHex}
                      opacity={0.2}
                    />
                  )}
                  <circle
                    cx={pt.cx}
                    cy={pt.cy}
                    r={isActive ? 6 : 4.8}
                    fill={pt.accentHex}
                    stroke="#0B0E14"
                    strokeWidth={1.5}
                  />
                  <text
                    x={pt.cx}
                    y={pt.cy - 9}
                    textAnchor={
                      pt.cx < PAD.left + 56
                        ? 'start'
                        : pt.cx > PARETO_W - PAD.right - 56
                          ? 'end'
                          : 'middle'
                    }
                    fontSize="8.2"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={isActive ? 700 : 600}
                    fill={isActive ? '#22D3EE' : 'var(--vg-text)'}
                  >
                    {pt.kind === 'active' ? 'ROUTED MIX' : pt.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 4-Model Allocation Matrix */}
        <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5 font-mono">
          <div className="mb-1.5 flex items-center justify-between text-[9.5px]">
            <span className="font-semibold text-[var(--vg-text-muted)]">
              LIVE TRAFFIC ROUTING ALLOCATION (4 MODELS)
            </span>
            {branchSimulation.sourceMode === 'benchmark_baseline' && (
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
            {matrix.allocations.map((row) => (
              <div key={row.model.id} className="space-y-0.5">
                <div className="grid grid-cols-12 items-center gap-1 text-[9.5px]">
                  <span className="col-span-4 truncate font-semibold text-[var(--vg-text)]">
                    {row.model.label}
                  </span>
                  <span className="col-span-2 text-right text-sky-400">{row.sharePct}%</span>
                  <span className="col-span-3 text-right text-[var(--vg-text-dim)]">
                    {row.effectiveTtftMs}ms TTFT
                  </span>
                  <span className="col-span-3 text-right font-bold text-emerald-400">
                    {formatUsdCompact(row.monthlySpendUsd)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(3, row.sharePct)}%`,
                      backgroundColor: row.model.accentHex,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinOpsSimulatorPanel;
