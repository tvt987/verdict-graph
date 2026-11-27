import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  DollarSign,
  Gauge,
  Layers,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Zap,
} from 'lucide-react';
import type { Locale } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import {
  type ArenaModelId,
  type EvaluatedArenaModel,
  ROUTING_WORKLOAD_PRESETS,
  formatArenaUsd,
  formatArenaVolume,
  optimizeMultiModelRouting,
} from '../engine/modelRoutingEngine';

interface ModelRoutingArenaProps {
  t: Translations;
  locale: Locale;
  theme: 'light' | 'dark';
}

const VOLUME_STOPS = [100_000, 500_000, 2_500_000, 5_000_000, 10_000_000, 20_000_000];
const LOG_MIN = Math.log10(100_000);
const LOG_MAX = Math.log10(20_000_000);

function volumeToSlider(volume: number): number {
  const clamped = Math.max(100_000, Math.min(20_000_000, volume));
  return Math.round(((Math.log10(clamped) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000);
}

function sliderToVolume(sliderVal: number): number {
  const frac = Math.max(0, Math.min(1, sliderVal / 1000));
  const raw = Math.pow(10, LOG_MIN + frac * (LOG_MAX - LOG_MIN));
  if (raw < 1_000_000) return Math.round(raw / 50_000) * 50_000;
  return Math.round(raw / 250_000) * 250_000;
}

const CHART_W = 640;
const CHART_H = 310;
const PAD = { top: 26, right: 32, bottom: 44, left: 56 };

export const ModelRoutingArena: React.FC<ModelRoutingArenaProps> = ({ t, locale, theme }) => {
  const [monthlyRequestVolume, setMonthlyRequestVolume] = useState<number>(2_500_000);
  const [qualityFloorPct, setQualityFloorPct] = useState<number>(94.5);
  const [p95LatencyBudgetMs, setP95LatencyBudgetMs] = useState<number>(900);
  const [promptCacheHitRatePct, setPromptCacheHitRatePct] = useState<number>(40);
  const [baselineModelId, setBaselineModelId] = useState<ArenaModelId>('claude-4.5-sonnet');
  const [activePresetId, setActivePresetId] = useState<string>('enterprise_rag');
  const [focusedId, setFocusedId] = useState<string>('cascade-policy');

  const isDark = theme === 'dark';

  const result = useMemo(
    () =>
      optimizeMultiModelRouting({
        monthlyRequestVolume,
        qualityFloorPct,
        p95LatencyBudgetMs,
        promptCacheHitRatePct,
        baselineModelId,
      }),
    [
      baselineModelId,
      monthlyRequestVolume,
      p95LatencyBudgetMs,
      promptCacheHitRatePct,
      qualityFloorPct,
    ]
  );

  const applyPreset = (presetId: string) => {
    const preset = ROUTING_WORKLOAD_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setActivePresetId(preset.id);
    setMonthlyRequestVolume(preset.monthlyRequestVolume);
    setQualityFloorPct(preset.qualityFloorPct);
    setP95LatencyBudgetMs(preset.p95LatencyBudgetMs);
    setPromptCacheHitRatePct(preset.promptCacheHitRatePct);
    setBaselineModelId(preset.baselineModelId);
    setFocusedId('cascade-policy');
  };

  const chartGeometry = useMemo(() => {
    const plotW = CHART_W - PAD.left - PAD.right;
    const plotH = CHART_H - PAD.top - PAD.bottom;

    const maxCost = Math.max(
      2.0,
      result.blendedCostPer1kUsd,
      ...result.models.map((m) => m.effectiveCostPer1kUsd)
    ) * 1.12;
    const minQ = 88.0;
    const maxQ = 100.0;

    const toX = (cost: number) => PAD.left + 12 + (cost / maxCost) * (plotW - 24);
    const toY = (q: number) =>
      PAD.top + plotH - ((Math.max(minQ, Math.min(maxQ, q)) - minQ) / (maxQ - minQ)) * plotH;

    const plottedModels = result.models.map((m) => ({
      model: m,
      cx: Number(toX(m.effectiveCostPer1kUsd).toFixed(1)),
      cy: Number(toY(m.groundednessPct).toFixed(1)),
      color: isDark ? m.darkAccentHex : m.accentHex,
    }));

    const frontierPoints = result.paretoFrontierIds
      .map((id) => plottedModels.find((p) => p.model.id === id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const frontierPolyline = frontierPoints.map((p) => `${p.cx},${p.cy}`).join(' ');

    // Subtle shaded area under Pareto envelope curve
    const baselineY = PAD.top + plotH;
    const frontierAreaPath =
      frontierPoints.length >= 2
        ? `M ${frontierPoints[0].cx} ${baselineY} ` +
          frontierPoints.map((p) => `L ${p.cx} ${p.cy}`).join(' ') +
          ` L ${frontierPoints[frontierPoints.length - 1].cx} ${baselineY} Z`
        : '';

    const cascadePoint = {
      cx: Number(toX(result.blendedCostPer1kUsd).toFixed(1)),
      cy: Number(toY(result.blendedGroundednessPct).toFixed(1)),
    };

    const qualityFloorY = Number(toY(result.inputs.qualityFloorPct).toFixed(1));
    const costTicks = [0, 0.25, 0.5, 0.75, 1.0].map((frac) => ({
      value: Number((maxCost * frac).toFixed(2)),
      x: Number(toX(maxCost * frac).toFixed(1)),
    }));

    return {
      plotW,
      plotH,
      maxCost,
      toX,
      toY,
      plottedModels,
      frontierPoints,
      frontierPolyline,
      frontierAreaPath,
      cascadePoint,
      qualityFloorY,
      costTicks,
    };
  }, [isDark, result]);

  const focusedModel: EvaluatedArenaModel | null =
    focusedId === 'cascade-policy'
      ? null
      : result.models.find((m) => m.id === focusedId) ?? null;

  const activeSliceIds = useMemo(
    () => new Set(result.cascadeSlices.map((s) => s.id)),
    [result.cascadeSlices]
  );

  const frontierStroke = isDark ? '#34D399' : '#059669';
  const cascadeStroke = isDark ? '#818CF8' : '#4F46E5';

  return (
    <section
      id="model-routing-arena"
      data-testid="model-routing-arena"
      className="flex flex-col gap-6"
    >
      {/* Top Hero Card: Title, Presets & Optimal Cascade Policy */}
      <div className="vg-panel overflow-hidden rounded-xl">
        {/* Studio Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--vg-border)] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] text-[var(--vg-accent)]">
                <TrendingDown className="h-4 w-4" />
              </div>
              <h2 className="font-display text-base font-bold tracking-tight text-[var(--vg-text)] sm:text-lg">
                {t.arenaTitle}
              </h2>
              <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                6 MODELS · PARETO CASCADE
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--vg-text-muted)] sm:text-[13px]">
              {t.arenaSubtitle}
            </p>
          </div>

          {/* Baseline Single-Frontier Comparison Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] font-medium text-[var(--vg-text-dim)]">
              BASELINE:
            </span>
            <div className="flex items-center rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5 font-mono text-[11px]">
              {(['claude-4.5-sonnet', 'gpt-5'] as ArenaModelId[]).map((id) => {
                const active = baselineModelId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid={`arena-baseline-${id}`}
                    onClick={() => setBaselineModelId(id)}
                    className={`rounded-md px-2.5 py-1 font-semibold transition-all ${
                      active
                        ? 'bg-[var(--vg-panel)] text-[var(--vg-accent)] shadow-xs'
                        : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                    }`}
                  >
                    {id === 'claude-4.5-sonnet' ? 'Claude 4.5 Sonnet' : 'GPT-5'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Enterprise Workload Presets */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] px-5 py-3 sm:px-6">
          <span className="font-mono text-[10px] font-semibold tracking-wider text-[var(--vg-text-dim)]">
            WORKLOAD PRESETS:
          </span>
          {ROUTING_WORKLOAD_PRESETS.map((preset) => {
            const active = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`arena-preset-${preset.id}`}
                onClick={() => applyPreset(preset.id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                  active
                    ? 'border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] font-semibold text-[var(--vg-accent)]'
                    : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:border-[var(--vg-accent-border)] hover:text-[var(--vg-text)]'
                }`}
              >
                {locale === 'vi' ? preset.labelVi : preset.label}
              </button>
            );
          })}
        </div>

        {/* Hero KPIs + Cascading Policy Bar */}
        <div className="grid grid-cols-1 gap-5 p-5 sm:p-6 xl:grid-cols-12">
          {/* Left 5 Cols: Active Pareto-Optimal Cascading Policy */}
          <div className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] p-4 sm:p-5 xl:col-span-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-wider text-[var(--vg-accent)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  PARETO-OPTIMAL CASCADING ROUTER POLICY
                </span>
                <span
                  data-testid="arena-sla-badge"
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                    result.slaSatisfied
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'border-amber-500/45 bg-amber-500/15 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {result.slaSatisfied ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> SLA SATISFIED
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" /> SLA BOUNDARY
                    </>
                  )}
                </span>
              </div>

              <p
                data-testid="arena-policy-summary"
                className="mt-2.5 font-display text-base font-bold leading-snug text-[var(--vg-text)] sm:text-lg"
              >
                {result.policySummary}
              </p>

              {/* Stacked Traffic Proportion Bar */}
              <div className="mt-3.5 flex h-3 w-full overflow-hidden rounded-full bg-[var(--vg-panel)] p-0.5 shadow-inner">
                {result.cascadeSlices.map((slice) => (
                  <div
                    key={slice.id}
                    style={{
                      width: `${Math.max(2, slice.sharePct)}%`,
                      backgroundColor: isDark ? slice.darkAccentHex : slice.accentHex,
                    }}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                    title={`${slice.sharePct}% ${slice.label} (${formatArenaVolume(slice.monthlyRequests)} req/mo)`}
                  />
                ))}
              </div>
            </div>

            {/* Individual Slice Pills */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {result.cascadeSlices.map((slice) => (
                <div
                  key={slice.id}
                  data-testid={`arena-slice-${slice.role}`}
                  className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-panel)] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: isDark ? slice.darkAccentHex : slice.accentHex }}
                    />
                    <span className="font-mono text-xs font-bold text-[var(--vg-text)]">
                      {slice.sharePct}%
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-[var(--vg-text)]">
                    {slice.label}
                  </p>
                  <p className="font-mono text-[10.5px] text-[var(--vg-text-muted)]">
                    {formatArenaUsd(slice.monthlySpendUsd)}/mo
                  </p>
                </div>
              ))}
            </div>

            {result.slaWarnings.length > 0 && (
              <div
                data-testid="arena-sla-warnings"
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
              >
                {result.slaWarnings[0]}
              </div>
            )}
          </div>

          {/* Right 7 Cols: 4 Crisp FinOps & Quality KPI Tiles */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:col-span-7">
            <div className="flex flex-col justify-between rounded-xl border border-emerald-500/35 bg-emerald-500/8 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  MONTHLY SAVINGS VS {result.baselineModelLabel.toUpperCase()}
                </span>
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  data-testid="arena-monthly-savings"
                  className="font-display text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300 sm:text-3xl"
                >
                  -{formatArenaUsd(result.monthlySavingsUsd)}/mo
                </span>
                <span
                  data-testid="arena-savings-pct"
                  className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300"
                >
                  -{result.savingsPct}%
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-[var(--vg-text-muted)]">
                Annualized FinOps ROI:{' '}
                <strong className="text-[var(--vg-text)]">
                  {formatArenaUsd(result.annualSavingsUsd)}/yr
                </strong>{' '}
                vs {formatArenaUsd(result.singleFrontierMonthlyUsd)}/mo single-frontier
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-[var(--vg-text-dim)]">
                  BLENDED MONTHLY SPEND
                </span>
                <Layers className="h-4 w-4 text-[var(--vg-accent)]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  data-testid="arena-monthly-spend"
                  className="font-display text-2xl font-bold tracking-tight text-[var(--vg-text)] sm:text-3xl"
                >
                  {formatArenaUsd(result.blendedMonthlySpendUsd)}
                </span>
                <span className="font-mono text-xs text-[var(--vg-text-muted)]">/ mo</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-[var(--vg-text-muted)]">
                Unit Cost:{' '}
                <strong className="text-[var(--vg-text)]">
                  ${result.blendedCostPer1kUsd.toFixed(2)} / 1K req
                </strong>{' '}
                · Cache Saves{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">
                  {formatArenaUsd(result.promptCacheMonthlySavingsUsd)}/mo
                </strong>
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-[var(--vg-text-dim)]">
                  BLENDED GROUNDEDNESS &amp; JSON
                </span>
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  data-testid="arena-blended-quality"
                  className="font-display text-2xl font-bold tracking-tight text-[var(--vg-text)] sm:text-3xl"
                >
                  {result.blendedGroundednessPct.toFixed(2)}%
                </span>
                <span className="font-mono text-xs text-[var(--vg-text-muted)]">
                  floor {result.inputs.qualityFloorPct.toFixed(1)}%
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-[var(--vg-text-muted)]">
                Structured JSON Schema Adherence:{' '}
                <strong className="text-[var(--vg-text)]">
                  {result.blendedJsonAdherencePct.toFixed(1)}%
                </strong>
              </p>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-[var(--vg-text-dim)]">
                  BLENDED P95 LATENCY &amp; TTFT
                </span>
                <Activity className="h-4 w-4 text-[var(--vg-accent)]" />
              </div>
              <div className="mt-2 flex items-baseline gap-2.5">
                <span
                  data-testid="arena-blended-latency"
                  className="font-display text-2xl font-bold tracking-tight text-[var(--vg-text)] sm:text-3xl"
                >
                  {result.blendedP95LatencyMs.toFixed(0)}ms
                </span>
                <span className="font-mono text-xs text-[var(--vg-text-muted)]">
                  budget {result.inputs.p95LatencyBudgetMs}ms
                </span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-[var(--vg-text-muted)]">
                Blended TTFT:{' '}
                <strong className="text-[var(--vg-text)]">
                  {result.blendedTtftMs.toFixed(0)}ms
                </strong>{' '}
                · Prompt Cache Hit:{' '}
                <strong className="text-[var(--vg-accent)]">
                  {result.inputs.promptCacheHitRatePct}%
                </strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: 4 Interactive Sliders (Left 5 Cols) + Interactive SVG Pareto Frontier Chart (Right 7 Cols) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: 4 Interactive FinOps & SLA Sliders */}
        <div className="vg-panel flex flex-col gap-5 rounded-xl p-5 sm:p-6 xl:col-span-5">
          <div>
            <h3 className="font-display text-sm font-bold tracking-tight text-[var(--vg-text)]">
              Interactive Routing Constraints &amp; FinOps Controls
            </h3>
            <p className="mt-0.5 text-xs text-[var(--vg-text-muted)]">
              Adjust fleet traffic, accuracy floor, latency SLA, and prompt cache hit rate to recompute the Pareto cascade live.
            </p>
          </div>

          {/* Slider 1: Monthly Request Volume */}
          <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-4">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="arena-volume-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--vg-text)]"
              >
                <Zap className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                {t.arenaVolumeLabel}
              </label>
              <span
                data-testid="arena-volume-value"
                className="rounded-md border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--vg-accent)]"
              >
                {formatArenaVolume(monthlyRequestVolume)} req/mo
              </span>
            </div>
            <input
              id="arena-volume-input"
              type="range"
              data-testid="arena-volume-slider"
              min={0}
              max={1000}
              step={5}
              value={volumeToSlider(monthlyRequestVolume)}
              onChange={(e) => {
                setActivePresetId('custom');
                setMonthlyRequestVolume(sliderToVolume(Number(e.target.value)));
              }}
              className="vg-slider mt-3 w-full"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {VOLUME_STOPS.map((stop) => (
                <button
                  key={stop}
                  type="button"
                  onClick={() => {
                    setActivePresetId('custom');
                    setMonthlyRequestVolume(stop);
                  }}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                    monthlyRequestVolume === stop
                      ? 'border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] text-[var(--vg-accent)]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {formatArenaVolume(stop)}
                </button>
              ))}
            </div>
          </div>

          {/* Slider 2: Quality Floor (85% - 99%) */}
          <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-4">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="arena-quality-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--vg-text)]"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                {t.arenaQualityFloorLabel}
              </label>
              <span
                data-testid="arena-quality-value"
                className="rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300"
              >
                {qualityFloorPct.toFixed(1)}%
              </span>
            </div>
            <input
              id="arena-quality-input"
              type="range"
              data-testid="arena-quality-slider"
              min={85}
              max={99}
              step={0.5}
              value={qualityFloorPct}
              onChange={(e) => {
                setActivePresetId('custom');
                setQualityFloorPct(Number(e.target.value));
              }}
              className="vg-slider mt-3 w-full"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[88, 92, 94.5, 97, 98.5].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setActivePresetId('custom');
                    setQualityFloorPct(q);
                  }}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                    Math.abs(qualityFloorPct - q) < 0.05
                      ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                      : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {q}%
                </button>
              ))}
            </div>
          </div>

          {/* Slider 3: P95 Latency Budget (400ms - 3000ms) */}
          <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-4">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="arena-latency-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--vg-text)]"
              >
                <Gauge className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                {t.arenaLatencyBudgetLabel}
              </label>
              <span
                data-testid="arena-latency-value"
                className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-bold text-amber-800 dark:text-amber-300"
              >
                {p95LatencyBudgetMs}ms
              </span>
            </div>
            <input
              id="arena-latency-input"
              type="range"
              data-testid="arena-latency-slider"
              min={400}
              max={3000}
              step={50}
              value={p95LatencyBudgetMs}
              onChange={(e) => {
                setActivePresetId('custom');
                setP95LatencyBudgetMs(Number(e.target.value));
              }}
              className="vg-slider mt-3 w-full"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[450, 650, 900, 1400, 2500].map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => {
                    setActivePresetId('custom');
                    setP95LatencyBudgetMs(ms);
                  }}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                    p95LatencyBudgetMs === ms
                      ? 'border-amber-500/45 bg-amber-500/12 text-amber-800 dark:text-amber-300'
                      : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {ms}ms
                </button>
              ))}
            </div>
          </div>

          {/* Slider 4: Prompt Caching Hit Rate (0% - 85%) */}
          <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-4">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="arena-cache-input"
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--vg-text)]"
              >
                <Database className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                {t.arenaCacheHitLabel}
              </label>
              <span
                data-testid="arena-cache-value"
                className="rounded-md border border-sky-500/35 bg-sky-500/10 px-2 py-0.5 font-mono text-xs font-bold text-sky-700 dark:text-sky-300"
              >
                {promptCacheHitRatePct}% hit
              </span>
            </div>
            <input
              id="arena-cache-input"
              type="range"
              data-testid="arena-cache-slider"
              min={0}
              max={85}
              step={1}
              value={promptCacheHitRatePct}
              onChange={(e) => {
                setActivePresetId('custom');
                setPromptCacheHitRatePct(Number(e.target.value));
              }}
              className="vg-slider mt-3 w-full"
            />
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[0, 25, 40, 65, 85].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setActivePresetId('custom');
                    setPromptCacheHitRatePct(pct);
                  }}
                  className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold transition-colors ${
                    promptCacheHitRatePct === pct
                      ? 'border-sky-500/45 bg-sky-500/12 text-sky-700 dark:text-sky-300'
                      : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Interactive SVG Cost-vs-Quality Pareto Frontier Scatter Chart */}
        <div className="vg-panel flex flex-col justify-between gap-4 rounded-xl p-5 sm:p-6 xl:col-span-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-bold tracking-tight text-[var(--vg-text)]">
                Cost-vs-Quality Pareto Frontier Envelope
              </h3>
              <p className="mt-0.5 text-xs text-[var(--vg-text-muted)]">
                Click or hover any LLM node to inspect effective cost per 1K requests, groundedness, TTFT &amp; SLA eligibility.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-[var(--vg-text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                Pareto Envelope
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-indigo-600 dark:bg-indigo-400" />
                Cascade Policy
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--vg-border)] bg-[var(--vg-bg)] p-3">
            <svg
              data-testid="arena-pareto-svg"
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="h-auto w-full select-none"
              role="img"
              aria-label="Cost versus Groundedness Quality Pareto Frontier Scatter Chart"
            >
              <defs>
                <linearGradient id="arena-pareto-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={frontierStroke} stopOpacity={isDark ? 0.22 : 0.14} />
                  <stop offset="100%" stopColor={frontierStroke} stopOpacity={0.01} />
                </linearGradient>
              </defs>

              {/* Feasible Quality Zone Shade above qualityFloorPct */}
              <rect
                x={PAD.left}
                y={PAD.top}
                width={chartGeometry.plotW}
                height={Math.max(0, chartGeometry.qualityFloorY - PAD.top)}
                fill={frontierStroke}
                opacity={isDark ? 0.05 : 0.045}
              />

              {/* Horizontal Quality Grid Lines */}
              {[90, 92, 94, 96, 98, 100].map((q) => {
                const y = chartGeometry.toY(q);
                return (
                  <g key={q}>
                    <line
                      x1={PAD.left}
                      y1={y}
                      x2={CHART_W - PAD.right}
                      y2={y}
                      stroke="var(--vg-border)"
                      strokeDasharray="3 4"
                    />
                    <text
                      x={PAD.left - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      fill="var(--vg-text-dim)"
                    >
                      {q}%
                    </text>
                  </g>
                );
              })}

              {/* Vertical Cost Grid Ticks */}
              {chartGeometry.costTicks.map((tick, idx) => (
                <g key={idx}>
                  <line
                    x1={tick.x}
                    y1={PAD.top}
                    x2={tick.x}
                    y2={CHART_H - PAD.bottom}
                    stroke="var(--vg-border)"
                    strokeDasharray="3 4"
                    opacity={0.7}
                  />
                  <text
                    x={tick.x}
                    y={CHART_H - PAD.bottom + 15}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fill="var(--vg-text-dim)"
                  >
                    ${tick.value.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* Primary Axes */}
              <line
                x1={PAD.left}
                y1={PAD.top}
                x2={PAD.left}
                y2={CHART_H - PAD.bottom}
                stroke="var(--vg-text-dim)"
                strokeWidth={1}
                opacity={0.55}
              />
              <line
                x1={PAD.left}
                y1={CHART_H - PAD.bottom}
                x2={CHART_W - PAD.right}
                y2={CHART_H - PAD.bottom}
                stroke="var(--vg-text-dim)"
                strokeWidth={1}
                opacity={0.55}
              />

              {/* Axis Labels */}
              <text
                x={PAD.left + chartGeometry.plotW / 2}
                y={CHART_H - 8}
                textAnchor="middle"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                fill="var(--vg-text-muted)"
              >
                EFFECTIVE COST PER 1,000 REQUESTS (USD) — LOWER IS BETTER
              </text>
              <text
                x={16}
                y={PAD.top + chartGeometry.plotH / 2}
                textAnchor="middle"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight={600}
                fill="var(--vg-text-muted)"
                transform={`rotate(-90 16 ${PAD.top + chartGeometry.plotH / 2})`}
              >
                GROUNDEDNESS (%)
              </text>

              {/* Active Quality Floor Line */}
              <line
                data-testid="arena-quality-floor-line"
                x1={PAD.left}
                y1={chartGeometry.qualityFloorY}
                x2={CHART_W - PAD.right}
                y2={chartGeometry.qualityFloorY}
                stroke={isDark ? '#FBBF24' : '#D97706'}
                strokeWidth={1.3}
                strokeDasharray="6 4"
              />
              <rect
                x={CHART_W - PAD.right - 108}
                y={chartGeometry.qualityFloorY - 19}
                width={106}
                height={16}
                rx={4}
                fill="var(--vg-panel)"
                stroke={isDark ? '#FBBF24' : '#D97706'}
                strokeWidth={0.9}
              />
              <text
                x={CHART_W - PAD.right - 55}
                y={chartGeometry.qualityFloorY - 8}
                textAnchor="middle"
                fontSize="8.8"
                fontFamily="JetBrains Mono, monospace"
                fontWeight={700}
                fill={isDark ? '#FBBF24' : '#B45309'}
              >
                FLOOR {result.inputs.qualityFloorPct.toFixed(1)}%
              </text>

              {/* Pareto Envelope Ribbon & Curve */}
              {chartGeometry.frontierAreaPath && (
                <path d={chartGeometry.frontierAreaPath} fill="url(#arena-pareto-fill)" />
              )}
              {chartGeometry.frontierPolyline && (
                <polyline
                  data-testid="arena-pareto-curve"
                  points={chartGeometry.frontierPolyline}
                  fill="none"
                  stroke={frontierStroke}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* 6 Model Scatter Points */}
              {chartGeometry.plottedModels.map(({ model, cx, cy, color }) => {
                const isFocused = focusedId === model.id;
                const isUsed = activeSliceIds.has(model.id);

                let labelX = cx;
                let labelY = cy - 11;
                let labelAnchor: 'start' | 'middle' | 'end' =
                  cx < PAD.left + 80
                    ? 'start'
                    : cx > CHART_W - PAD.right - 80
                      ? 'end'
                      : 'middle';

                if (model.id === 'llama-4-70b-self-hosted') {
                  labelX = cx + 10;
                  labelY = cy + 4;
                  labelAnchor = 'start';
                } else if (model.id === 'gemini-2.5-flash') {
                  labelX = cx + 10;
                  labelY = cy + 4;
                  labelAnchor = 'start';
                } else if (model.id === 'deepseek-r1') {
                  labelX = cx + 10;
                  labelY = cy + 16;
                  labelAnchor = 'start';
                } else if (model.id === 'gemini-2.5-pro') {
                  labelX = cx;
                  labelY = cy + 18;
                  labelAnchor = 'middle';
                }

                return (
                  <g
                    key={model.id}
                    data-testid={`arena-point-${model.id}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setFocusedId(model.id)}
                    onClick={() => setFocusedId(model.id)}
                  >
                    {(isFocused || isUsed) && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isFocused ? 13 : 10}
                        fill={color}
                        opacity={isDark ? 0.22 : 0.16}
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isFocused ? 6.5 : 5.5}
                      fill={model.meetsLatencyBudget ? color : 'var(--vg-panel)'}
                      stroke={color}
                      strokeWidth={model.meetsLatencyBudget ? 2 : 2.2}
                      strokeDasharray={model.meetsLatencyBudget ? undefined : '2.5 2'}
                    />
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor={labelAnchor}
                      fontSize="9.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={isFocused || isUsed ? 700 : 600}
                      fill="var(--vg-text)"
                    >
                      {model.shortLabel}
                    </text>
                  </g>
                );
              })}

              {/* Highlighted Pareto-Optimal Cascade Policy Diamond */}
              <g
                data-testid="arena-point-cascade"
                transform={`translate(${chartGeometry.cascadePoint.cx}, ${chartGeometry.cascadePoint.cy})`}
                className="cursor-pointer"
                onMouseEnter={() => setFocusedId('cascade-policy')}
                onClick={() => setFocusedId('cascade-policy')}
              >
                <circle
                  r={15}
                  fill={cascadeStroke}
                  opacity={isDark ? 0.22 : 0.15}
                  className="node-halo-pulse"
                />
                <rect
                  x={-7}
                  y={-7}
                  width={14}
                  height={14}
                  rx={2.5}
                  transform="rotate(45)"
                  fill={cascadeStroke}
                  stroke="var(--vg-panel)"
                  strokeWidth={2}
                />
                <g transform="translate(0, -17)">
                  <rect
                    x={-54}
                    y={-12}
                    width={108}
                    height={16}
                    rx={4}
                    fill={cascadeStroke}
                  />
                  <text
                    x={0}
                    y={-1}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                    fill="#FFFFFF"
                  >
                    PARETO CASCADE
                  </text>
                </g>
              </g>
            </svg>
          </div>

          {/* Focused Node Telemetry Strip */}
          <div
            data-testid="arena-focus-strip"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] px-4 py-3 font-mono text-xs"
          >
            {focusedModel ? (
              <>
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: isDark
                        ? focusedModel.darkAccentHex
                        : focusedModel.accentHex,
                    }}
                  />
                  <span className="font-bold text-[var(--vg-text)]">{focusedModel.label}</span>
                  <span className="text-[var(--vg-text-muted)]">({focusedModel.provider})</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span>
                    <strong className="text-[var(--vg-text)]">
                      ${focusedModel.effectiveCostPer1kUsd.toFixed(2)}
                    </strong>
                    /1K
                  </span>
                  <span>
                    Q=<strong className="text-emerald-700 dark:text-emerald-400">{focusedModel.groundednessPct}%</strong>
                  </span>
                  <span>
                    JSON=<strong className="text-[var(--vg-text)]">{focusedModel.jsonSchemaAdherencePct}%</strong>
                  </span>
                  <span>
                    TTFT <strong className="text-[var(--vg-text)]">{focusedModel.effectiveTtftMs}ms</strong>
                  </span>
                  <span>
                    P95 <strong className="text-[var(--vg-text)]">{focusedModel.effectiveP95Ms}ms</strong>
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-[var(--vg-accent)]" />
                  <span className="font-bold text-[var(--vg-accent)]">
                    Active Pareto Cascade Policy
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span>
                    <strong className="text-[var(--vg-text)]">
                      ${result.blendedCostPer1kUsd.toFixed(2)}
                    </strong>
                    /1K
                  </span>
                  <span>
                    Q=<strong className="text-emerald-700 dark:text-emerald-400">{result.blendedGroundednessPct}%</strong>
                  </span>
                  <span>
                    JSON=<strong className="text-[var(--vg-text)]">{result.blendedJsonAdherencePct}%</strong>
                  </span>
                  <span>
                    P95 <strong className="text-[var(--vg-text)]">{result.blendedP95LatencyMs}ms</strong>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: 6-Model Benchmark & Telemetry Comparison Table */}
      <div className="vg-panel overflow-hidden rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] px-5 py-3.5 sm:px-6">
          <div>
            <h3 className="font-display text-sm font-bold tracking-tight text-[var(--vg-text)]">
              6-Model Frontier &amp; Open-Weight Telemetry Matrix
            </h3>
            <p className="text-xs text-[var(--vg-text-muted)]">
              Real input/output pricing ($/1M tokens), prompt-cached effective latency, groundedness accuracy, and JSON schema adherence.
            </p>
          </div>
          <span className="font-mono text-[10.5px] text-[var(--vg-text-dim)]">
            AVG PAYLOAD: {result.inputs.avgInputTokens} IN / {result.inputs.avgOutputTokens} OUT TOKENS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--vg-text-dim)]">
                <th className="px-5 py-3">Model Profile</th>
                <th className="px-4 py-3 text-right">In / Out ($/1M)</th>
                <th className="px-4 py-3 text-right">Eff. TTFT / P95</th>
                <th className="px-4 py-3 text-right">Groundedness</th>
                <th className="px-4 py-3 text-right">JSON Adherence</th>
                <th className="px-4 py-3 text-right">Monthly Spend</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--vg-border)] text-xs">
              {result.models.map((m) => {
                const inCascade = activeSliceIds.has(m.id);
                return (
                  <tr
                    key={m.id}
                    data-testid={`arena-row-${m.id}`}
                    onClick={() => setFocusedId(m.id)}
                    className={`cursor-pointer transition-colors ${
                      inCascade
                        ? 'bg-[var(--vg-accent-soft)]'
                        : 'hover:bg-[var(--vg-surface-hover)]'
                    }`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: isDark ? m.darkAccentHex : m.accentHex }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[var(--vg-text)]">{m.label}</span>
                            {inCascade && (
                              <span className="rounded bg-[var(--vg-accent)] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
                                ROUTED
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10.5px] text-[var(--vg-text-dim)]">
                            {m.provider}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--vg-text-muted)]">
                      ${m.inputUsdPer1M.toFixed(2)} / ${m.outputUsdPer1M.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span className="font-semibold text-[var(--vg-text)]">
                        {m.effectiveTtftMs}ms
                      </span>{' '}
                      <span
                        className={
                          m.meetsLatencyBudget
                            ? 'text-[var(--vg-text-muted)]'
                            : 'font-semibold text-rose-700 dark:text-rose-400'
                        }
                      >
                        / {m.effectiveP95Ms}ms
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span
                        className={
                          m.meetsQualityFloor
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : 'font-semibold text-[var(--vg-text-muted)]'
                        }
                      >
                        {m.groundednessPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--vg-text)]">
                      {m.jsonSchemaAdherencePct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-[var(--vg-text)]">
                      {formatArenaUsd(m.monthlySpendUsd)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5 font-mono text-[10px]">
                        {m.isParetoOptimal && (
                          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/12 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-300">
                            PARETO
                          </span>
                        )}
                        {m.meetsSla ? (
                          <span className="rounded-full border border-indigo-500/35 bg-indigo-500/10 px-2 py-0.5 font-semibold text-indigo-700 dark:text-indigo-300">
                            SLA OK
                          </span>
                        ) : (
                          <span className="rounded-full border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-0.5 font-medium text-[var(--vg-text-dim)]">
                            {!m.meetsLatencyBudget ? 'LATENCY' : 'TIER-1'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default ModelRoutingArena;
