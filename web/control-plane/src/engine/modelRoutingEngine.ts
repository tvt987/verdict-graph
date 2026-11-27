/**
 * Verdict Graph v5.0 — Multi-Model FinOps Routing & Pareto Frontier Arena Engine
 *
 * Deterministic 6-model Pareto frontier calculator and confidence-gated cascading
 * router policy optimizer (Fast Tier + Frontier Verifier + Human Escalation).
 * Mirrors `backend/verdict_api/routing_engine.py` identically for zero-drift parity.
 */

export type ArenaModelTier = 'frontier' | 'reasoning' | 'flash' | 'open_weight';

export type ArenaModelId =
  | 'claude-4.5-sonnet'
  | 'gpt-5'
  | 'gemini-2.5-pro'
  | 'deepseek-r1'
  | 'gemini-2.5-flash'
  | 'llama-4-70b-self-hosted';

export type CascadeSliceRole = 'fast' | 'frontier' | 'human_escalation';

export interface ArenaModelSpec {
  id: ArenaModelId;
  label: string;
  shortLabel: string;
  provider: string;
  tier: ArenaModelTier;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  ttftMs: number;
  p95LatencyMs: number;
  groundednessPct: number;
  jsonSchemaAdherencePct: number;
  accentHex: string;
  darkAccentHex: string;
}

export const ARENA_CACHE_INPUT_DISCOUNT = 0.88;
export const ARENA_CACHE_TTFT_SPEEDUP = 0.52;
export const ARENA_CACHE_P95_SPEEDUP = 0.34;

export const HUMAN_ESCALATION_QUALITY_PCT = 99.8;
export const HUMAN_ESCALATION_JSON_PCT = 99.9;
export const HUMAN_ESCALATION_COST_PER_1K_USD = 14.0;
export const HUMAN_ESCALATION_TTFT_MS = 180.0;
export const HUMAN_ESCALATION_P95_MS = 950.0;

export const ARENA_MODEL_CATALOG: readonly ArenaModelSpec[] = [
  {
    id: 'claude-4.5-sonnet',
    label: 'Claude 4.5 Sonnet',
    shortLabel: 'Claude 4.5',
    provider: 'Anthropic',
    tier: 'frontier',
    inputUsdPer1M: 3.0,
    outputUsdPer1M: 15.0,
    ttftMs: 390,
    p95LatencyMs: 1240,
    groundednessPct: 97.8,
    jsonSchemaAdherencePct: 99.1,
    accentHex: '#4F46E5',
    darkAccentHex: '#818CF8',
  },
  {
    id: 'gpt-5',
    label: 'GPT-5',
    shortLabel: 'GPT-5',
    provider: 'OpenAI',
    tier: 'frontier',
    inputUsdPer1M: 5.0,
    outputUsdPer1M: 15.0,
    ttftMs: 460,
    p95LatencyMs: 1480,
    groundednessPct: 98.2,
    jsonSchemaAdherencePct: 99.3,
    accentHex: '#7C3AED',
    darkAccentHex: '#A78BFA',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    shortLabel: 'Gemini Pro',
    provider: 'Google Vertex',
    tier: 'frontier',
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10.0,
    ttftMs: 310,
    p95LatencyMs: 980,
    groundednessPct: 96.6,
    jsonSchemaAdherencePct: 98.4,
    accentHex: '#0284C7',
    darkAccentHex: '#38BDF8',
  },
  {
    id: 'deepseek-r1',
    label: 'DeepSeek-R1',
    shortLabel: 'DeepSeek-R1',
    provider: 'DeepSeek API',
    tier: 'reasoning',
    inputUsdPer1M: 0.55,
    outputUsdPer1M: 2.19,
    ttftMs: 580,
    p95LatencyMs: 1890,
    groundednessPct: 95.4,
    jsonSchemaAdherencePct: 95.8,
    accentHex: '#D97706',
    darkAccentHex: '#F59E0B',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    shortLabel: 'Gemini Flash',
    provider: 'Google Vertex',
    tier: 'flash',
    inputUsdPer1M: 0.15,
    outputUsdPer1M: 0.6,
    ttftMs: 125,
    p95LatencyMs: 410,
    groundednessPct: 91.8,
    jsonSchemaAdherencePct: 96.9,
    accentHex: '#059669',
    darkAccentHex: '#10B981',
  },
  {
    id: 'llama-4-70b-self-hosted',
    label: 'Llama 4 70B Self-Hosted',
    shortLabel: 'Llama 4 70B',
    provider: 'Self-Hosted H100 vLLM',
    tier: 'open_weight',
    inputUsdPer1M: 0.12,
    outputUsdPer1M: 0.36,
    ttftMs: 145,
    p95LatencyMs: 480,
    groundednessPct: 89.6,
    jsonSchemaAdherencePct: 94.5,
    accentHex: '#0D9488',
    darkAccentHex: '#2DD4BF',
  },
] as const;

export interface RoutingWorkloadPreset {
  id: string;
  label: string;
  labelVi: string;
  description: string;
  monthlyRequestVolume: number;
  qualityFloorPct: number;
  p95LatencyBudgetMs: number;
  promptCacheHitRatePct: number;
  baselineModelId: ArenaModelId;
}

export const ROUTING_WORKLOAD_PRESETS: readonly RoutingWorkloadPreset[] = [
  {
    id: 'enterprise_rag',
    label: 'Enterprise RAG Copilot',
    labelVi: 'Trợ Lý RAG Doanh Nghiệp',
    description: '2.5M req/mo · 94.5% quality floor · 900ms P95 · 40% cache',
    monthlyRequestVolume: 2_500_000,
    qualityFloorPct: 94.5,
    p95LatencyBudgetMs: 900,
    promptCacheHitRatePct: 40,
    baselineModelId: 'claude-4.5-sonnet',
  },
  {
    id: 'financial_audit',
    label: 'Strict Financial Audit',
    labelVi: 'Kiểm Toán Tài Chính Nghiêm Ngặt',
    description: '1.5M req/mo · 97.2% quality floor · 1250ms P95 · 55% cache',
    monthlyRequestVolume: 1_500_000,
    qualityFloorPct: 97.2,
    p95LatencyBudgetMs: 1250,
    promptCacheHitRatePct: 55,
    baselineModelId: 'claude-4.5-sonnet',
  },
  {
    id: 'realtime_voice',
    label: 'Sub-550ms Real-Time Agent',
    labelVi: 'Tác Tử Thời Gian Thực <550ms',
    description: '5M req/mo · 92.5% quality floor · 550ms P95 · 60% cache',
    monthlyRequestVolume: 5_000_000,
    qualityFloorPct: 92.5,
    p95LatencyBudgetMs: 550,
    promptCacheHitRatePct: 60,
    baselineModelId: 'claude-4.5-sonnet',
  },
  {
    id: 'hyperscale_support',
    label: 'Hyperscale 20M Fleet',
    labelVi: 'Hạ Tầng 20 Triệu Request/Tháng',
    description: '20M req/mo · 93.0% quality floor · 800ms P95 · 75% cache',
    monthlyRequestVolume: 20_000_000,
    qualityFloorPct: 93.0,
    p95LatencyBudgetMs: 800,
    promptCacheHitRatePct: 75,
    baselineModelId: 'gpt-5',
  },
] as const;

export interface RoutingOptimizationInput {
  monthlyRequestVolume: number;
  qualityFloorPct: number;
  p95LatencyBudgetMs: number;
  promptCacheHitRatePct: number;
  avgInputTokens?: number;
  avgOutputTokens?: number;
  baselineModelId?: ArenaModelId;
}

export interface EvaluatedArenaModel {
  id: ArenaModelId;
  label: string;
  shortLabel: string;
  provider: string;
  tier: ArenaModelTier;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  ttftMs: number;
  effectiveTtftMs: number;
  p95LatencyMs: number;
  effectiveP95Ms: number;
  groundednessPct: number;
  jsonSchemaAdherencePct: number;
  uncachedCostPer1kUsd: number;
  effectiveCostPer1kUsd: number;
  monthlySpendUsd: number;
  meetsQualityFloor: boolean;
  meetsLatencyBudget: boolean;
  meetsSla: boolean;
  isParetoOptimal: boolean;
  accentHex: string;
  darkAccentHex: string;
}

export interface CascadeRoutingSlice {
  id: string;
  label: string;
  role: CascadeSliceRole;
  sharePct: number;
  monthlyRequests: number;
  costPer1kUsd: number;
  monthlySpendUsd: number;
  effectiveTtftMs: number;
  groundednessPct: number;
  accentHex: string;
  darkAccentHex: string;
}

export interface ParetoRoutingOptimizationResult {
  inputs: {
    monthlyRequestVolume: number;
    qualityFloorPct: number;
    p95LatencyBudgetMs: number;
    promptCacheHitRatePct: number;
    avgInputTokens: number;
    avgOutputTokens: number;
    baselineModelId: ArenaModelId;
  };
  slaSatisfied: boolean;
  slaWarnings: string[];
  policySummary: string;
  paretoFrontierIds: ArenaModelId[];
  cascadeSlices: CascadeRoutingSlice[];
  blendedCostPer1kUsd: number;
  blendedMonthlySpendUsd: number;
  blendedGroundednessPct: number;
  blendedJsonAdherencePct: number;
  blendedTtftMs: number;
  blendedP95LatencyMs: number;
  baselineModelId: ArenaModelId;
  baselineModelLabel: string;
  singleFrontierMonthlyUsd: number;
  singleFrontierUncachedMonthlyUsd: number;
  promptCacheMonthlySavingsUsd: number;
  monthlySavingsUsd: number;
  annualSavingsUsd: number;
  savingsPct: number;
  models: EvaluatedArenaModel[];
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function humanShareCandidates(qualityFloorPct: number): number[] {
  let base = 8;
  if (qualityFloorPct <= 91.0) base = 2;
  else if (qualityFloorPct <= 93.5) base = 3;
  else if (qualityFloorPct <= 96.5) base = 5;
  else if (qualityFloorPct <= 97.8) base = 6;

  if (qualityFloorPct > 97.5) {
    return Array.from(
      new Set([base, Math.min(25, base + 4), Math.min(25, base + 9), Math.min(25, base + 14)])
    ).sort((a, b) => a - b);
  }
  return [base];
}

interface CandidatePolicy {
  fast: EvaluatedArenaModel;
  frontier: EvaluatedArenaModel;
  fastPct: number;
  frontierPct: number;
  humanPct: number;
  blendedQ: number;
  blendedJson: number;
  blendedCost: number;
  blendedUncachedCost: number;
  blendedTtft: number;
  blendedP95: number;
  meetsQ: boolean;
  meetsLat: boolean;
  primaryMetric: number;
  secondaryMetric: number;
  tertiaryMetric: number;
}

function isCandidateBetter(a: CandidatePolicy, b: CandidatePolicy): boolean {
  if (Math.abs(a.primaryMetric - b.primaryMetric) > 1e-9) {
    return a.primaryMetric < b.primaryMetric;
  }
  if (Math.abs(a.secondaryMetric - b.secondaryMetric) > 1e-9) {
    return a.secondaryMetric < b.secondaryMetric;
  }
  if (Math.abs(a.tertiaryMetric - b.tertiaryMetric) > 1e-9) {
    return a.tertiaryMetric < b.tertiaryMetric;
  }
  if (a.fast.id !== b.fast.id) return a.fast.id < b.fast.id;
  return a.frontier.id < b.frontier.id;
}

export function optimizeMultiModelRouting(
  rawInput: RoutingOptimizationInput
): ParetoRoutingOptimizationResult {
  const monthlyRequestVolume = Math.round(
    clamp(rawInput.monthlyRequestVolume, 100_000, 20_000_000)
  );
  const qualityFloorPct = roundTo(clamp(rawInput.qualityFloorPct, 85.0, 99.0), 1);
  const p95LatencyBudgetMs = Math.round(clamp(rawInput.p95LatencyBudgetMs, 400, 3000));
  const promptCacheHitRatePct = Math.round(clamp(rawInput.promptCacheHitRatePct, 0, 85));
  const avgInputTokens = Math.round(clamp(rawInput.avgInputTokens ?? 1800, 50, 128_000));
  const avgOutputTokens = Math.round(clamp(rawInput.avgOutputTokens ?? 450, 10, 32_000));
  const baselineModelId: ArenaModelId = ARENA_MODEL_CATALOG.some(
    (m) => m.id === rawInput.baselineModelId
  )
    ? (rawInput.baselineModelId as ArenaModelId)
    : 'claude-4.5-sonnet';

  const cacheFrac = promptCacheHitRatePct / 100;
  const volK = monthlyRequestVolume / 1000;
  const cachedInFactor = 1 - ARENA_CACHE_INPUT_DISCOUNT * cacheFrac;

  // 1. Evaluate all 6 profiles under prompt caching and SLA thresholds
  const preEvaluated = ARENA_MODEL_CATALOG.map((spec) => {
    const uncachedCostPer1kUsd = roundTo(
      (avgInputTokens * spec.inputUsdPer1M + avgOutputTokens * spec.outputUsdPer1M) / 1000,
      4
    );
    const effectiveCostPer1kUsd = roundTo(
      (avgInputTokens * spec.inputUsdPer1M * cachedInFactor +
        avgOutputTokens * spec.outputUsdPer1M) /
        1000,
      4
    );
    const effectiveTtftMs = roundTo(spec.ttftMs * (1 - ARENA_CACHE_TTFT_SPEEDUP * cacheFrac), 1);
    const effectiveP95Ms = roundTo(
      spec.p95LatencyMs * (1 - ARENA_CACHE_P95_SPEEDUP * cacheFrac),
      1
    );
    const monthlySpendUsd = roundTo(effectiveCostPer1kUsd * volK, 2);
    const meetsQualityFloor = spec.groundednessPct >= qualityFloorPct;
    const meetsLatencyBudget = effectiveP95Ms <= p95LatencyBudgetMs;

    return {
      ...spec,
      uncachedCostPer1kUsd,
      effectiveCostPer1kUsd,
      effectiveTtftMs,
      effectiveP95Ms,
      monthlySpendUsd,
      meetsQualityFloor,
      meetsLatencyBudget,
      meetsSla: meetsQualityFloor && meetsLatencyBudget,
    };
  });

  // 2. Strict 2D Pareto frontier extraction (minimize effectiveCostPer1kUsd, maximize groundednessPct)
  const models: EvaluatedArenaModel[] = preEvaluated.map((row) => {
    const dominated = preEvaluated.some(
      (other) =>
        other.id !== row.id &&
        other.effectiveCostPer1kUsd <= row.effectiveCostPer1kUsd &&
        other.groundednessPct >= row.groundednessPct &&
        (other.effectiveCostPer1kUsd < row.effectiveCostPer1kUsd ||
          other.groundednessPct > row.groundednessPct)
    );
    return {
      ...row,
      isParetoOptimal: !dominated,
    };
  });

  const paretoFrontierIds = models
    .filter((m) => m.isParetoOptimal)
    .sort((a, b) =>
      a.effectiveCostPer1kUsd !== b.effectiveCostPer1kUsd
        ? a.effectiveCostPer1kUsd - b.effectiveCostPer1kUsd
        : b.groundednessPct - a.groundednessPct
    )
    .map((m) => m.id);

  const baseline = models.find((m) => m.id === baselineModelId) ?? models[0];

  // 3. Deterministic Pareto-Optimal Cascading Policy Solver
  const humanOptions = humanShareCandidates(qualityFloorPct);
  let bestFeasible: CandidatePolicy | null = null;
  let bestFallback: CandidatePolicy | null = null;

  const fastPool = models.filter(
    (m) => m.tier === 'flash' || m.tier === 'open_weight' || m.tier === 'reasoning'
  );
  const frontierPool = models.filter(
    (m) => m.tier === 'frontier' || m.tier === 'reasoning'
  );

  for (const fast of fastPool) {
    for (const frontier of frontierPool) {
      if (frontier.groundednessPct < fast.groundednessPct) continue;

      for (const humanPct of humanOptions) {
        const remaining = 100 - humanPct;
        for (let fastPct = 0; fastPct <= remaining; fastPct += 1) {
          const frontierPct = remaining - fastPct;
          if (fast.id === frontier.id && fastPct > 0) continue;

          const isTwoTier = fastPct > 0 && frontierPct > 0;
          let effFastQ = fast.groundednessPct;
          let routerCostOverhead = 0;
          let routerTtftOverhead = 0;
          let routerP95Overhead = 0;

          if (isTwoTier) {
            const gain = Math.min(1.8, 0.6 + (frontierPct / 100) * 3.2);
            effFastQ = Math.min(frontier.groundednessPct - 0.1, fast.groundednessPct + gain);
            routerCostOverhead = 0.12 * fast.effectiveCostPer1kUsd;
            routerTtftOverhead = 0.2 * fast.effectiveTtftMs;
            routerP95Overhead = 0.22 * fast.effectiveP95Ms;
          }

          const blendedQ =
            (fastPct * effFastQ +
              frontierPct * frontier.groundednessPct +
              humanPct * HUMAN_ESCALATION_QUALITY_PCT) /
            100;

          const blendedJson =
            (fastPct * fast.jsonSchemaAdherencePct +
              frontierPct * frontier.jsonSchemaAdherencePct +
              humanPct * HUMAN_ESCALATION_JSON_PCT) /
            100;

          const blendedCost =
            (fastPct * fast.effectiveCostPer1kUsd +
              frontierPct * (frontier.effectiveCostPer1kUsd + routerCostOverhead) +
              humanPct * HUMAN_ESCALATION_COST_PER_1K_USD) /
            100;

          const blendedUncachedCost =
            (fastPct * fast.uncachedCostPer1kUsd +
              frontierPct *
                (frontier.uncachedCostPer1kUsd +
                  (isTwoTier ? 0.12 * fast.uncachedCostPer1kUsd : 0)) +
              humanPct * HUMAN_ESCALATION_COST_PER_1K_USD) /
            100;

          const blendedTtft =
            (fastPct * fast.effectiveTtftMs +
              frontierPct * (frontier.effectiveTtftMs + routerTtftOverhead) +
              humanPct * HUMAN_ESCALATION_TTFT_MS) /
            100;

          const blendedP95 =
            (fastPct * fast.effectiveP95Ms +
              frontierPct * (frontier.effectiveP95Ms + routerP95Overhead) +
              humanPct * HUMAN_ESCALATION_P95_MS) /
            100;

          const meetsQ = blendedQ + 1e-9 >= qualityFloorPct;
          const meetsLat = blendedP95 <= p95LatencyBudgetMs + 1e-9;

          if (meetsQ && meetsLat) {
            const cand: CandidatePolicy = {
              fast,
              frontier,
              fastPct,
              frontierPct,
              humanPct,
              blendedQ,
              blendedJson,
              blendedCost,
              blendedUncachedCost,
              blendedTtft,
              blendedP95,
              meetsQ,
              meetsLat,
              primaryMetric: blendedCost,
              secondaryMetric: -blendedQ,
              tertiaryMetric: blendedP95,
            };
            if (!bestFeasible || isCandidateBetter(cand, bestFeasible)) {
              bestFeasible = cand;
            }
          } else {
            const qDeficit = Math.max(0, qualityFloorPct - blendedQ);
            const latExcess = Math.max(0, blendedP95 - p95LatencyBudgetMs);
            const penalty = qDeficit * 10 + (latExcess / 100) * 4 + blendedCost * 0.05;
            const cand: CandidatePolicy = {
              fast,
              frontier,
              fastPct,
              frontierPct,
              humanPct,
              blendedQ,
              blendedJson,
              blendedCost,
              blendedUncachedCost,
              blendedTtft,
              blendedP95,
              meetsQ,
              meetsLat,
              primaryMetric: penalty,
              secondaryMetric: blendedCost,
              tertiaryMetric: -blendedQ,
            };
            if (!bestFallback || isCandidateBetter(cand, bestFallback)) {
              bestFallback = cand;
            }
          }
        }
      }
    }
  }

  const chosen = bestFeasible ?? bestFallback!;
  const slaSatisfied = bestFeasible !== null;
  const slaWarnings: string[] = [];
  if (!chosen.meetsQ) {
    slaWarnings.push(
      `Max achievable groundedness ${chosen.blendedQ.toFixed(2)}% is below ${qualityFloorPct.toFixed(1)}% floor under current P95 latency budget.`
    );
  }
  if (!chosen.meetsLat) {
    slaWarnings.push(
      `Minimum achievable P95 latency ${chosen.blendedP95.toFixed(1)}ms exceeds ${p95LatencyBudgetMs}ms budget.`
    );
  }

  // Exact integer request partitioning summing strictly to monthlyRequestVolume
  let fastReqs =
    chosen.fastPct > 0 ? Math.round(monthlyRequestVolume * (chosen.fastPct / 100)) : 0;
  const humanReqs =
    chosen.humanPct > 0 ? Math.round(monthlyRequestVolume * (chosen.humanPct / 100)) : 0;
  const frontierReqs =
    chosen.frontierPct > 0 ? monthlyRequestVolume - fastReqs - humanReqs : 0;
  if (chosen.frontierPct === 0) {
    fastReqs = monthlyRequestVolume - humanReqs;
  }

  const cascadeSlices: CascadeRoutingSlice[] = [];
  if (chosen.fastPct > 0) {
    cascadeSlices.push({
      id: chosen.fast.id,
      label: chosen.fast.label,
      role: 'fast',
      sharePct: chosen.fastPct,
      monthlyRequests: fastReqs,
      costPer1kUsd: chosen.fast.effectiveCostPer1kUsd,
      monthlySpendUsd: roundTo((fastReqs / 1000) * chosen.fast.effectiveCostPer1kUsd, 2),
      effectiveTtftMs: chosen.fast.effectiveTtftMs,
      groundednessPct: chosen.fast.groundednessPct,
      accentHex: chosen.fast.accentHex,
      darkAccentHex: chosen.fast.darkAccentHex,
    });
  }

  if (chosen.frontierPct > 0) {
    const isTwoTier = chosen.fastPct > 0;
    const effFrontierCost1k = roundTo(
      chosen.frontier.effectiveCostPer1kUsd +
        (isTwoTier ? 0.12 * chosen.fast.effectiveCostPer1kUsd : 0),
      4
    );
    cascadeSlices.push({
      id: chosen.frontier.id,
      label: chosen.frontier.label,
      role: 'frontier',
      sharePct: chosen.frontierPct,
      monthlyRequests: frontierReqs,
      costPer1kUsd: effFrontierCost1k,
      monthlySpendUsd: roundTo((frontierReqs / 1000) * effFrontierCost1k, 2),
      effectiveTtftMs: chosen.frontier.effectiveTtftMs,
      groundednessPct: chosen.frontier.groundednessPct,
      accentHex: chosen.frontier.accentHex,
      darkAccentHex: chosen.frontier.darkAccentHex,
    });
  }

  if (chosen.humanPct > 0) {
    cascadeSlices.push({
      id: 'human-escalation',
      label: 'Human Escalation',
      role: 'human_escalation',
      sharePct: chosen.humanPct,
      monthlyRequests: humanReqs,
      costPer1kUsd: HUMAN_ESCALATION_COST_PER_1K_USD,
      monthlySpendUsd: roundTo((humanReqs / 1000) * HUMAN_ESCALATION_COST_PER_1K_USD, 2),
      effectiveTtftMs: HUMAN_ESCALATION_TTFT_MS,
      groundednessPct: HUMAN_ESCALATION_QUALITY_PCT,
      accentHex: '#E11D48',
      darkAccentHex: '#FB7185',
    });
  }

  const policySummary = cascadeSlices.map((s) => `${s.sharePct}% ${s.label}`).join(' + ');

  const blendedCostPer1kUsd = roundTo(chosen.blendedCost, 4);
  const blendedUncached1k = roundTo(chosen.blendedUncachedCost, 4);
  const blendedMonthlySpendUsd = roundTo(blendedCostPer1kUsd * volK, 2);
  const blendedUncachedMonthlySpend = roundTo(blendedUncached1k * volK, 2);
  const promptCacheMonthlySavingsUsd = roundTo(
    Math.max(0, blendedUncachedMonthlySpend - blendedMonthlySpendUsd),
    2
  );

  const singleFrontierMonthlyUsd = baseline.monthlySpendUsd;
  const singleFrontierUncachedMonthlyUsd = roundTo(baseline.uncachedCostPer1kUsd * volK, 2);
  const monthlySavingsUsd = roundTo(
    Math.max(0, singleFrontierMonthlyUsd - blendedMonthlySpendUsd),
    2
  );
  const annualSavingsUsd = roundTo(monthlySavingsUsd * 12, 2);
  const savingsPct =
    singleFrontierMonthlyUsd > 0
      ? roundTo((monthlySavingsUsd / singleFrontierMonthlyUsd) * 100, 1)
      : 0;

  return {
    inputs: {
      monthlyRequestVolume,
      qualityFloorPct,
      p95LatencyBudgetMs,
      promptCacheHitRatePct,
      avgInputTokens,
      avgOutputTokens,
      baselineModelId,
    },
    slaSatisfied,
    slaWarnings,
    policySummary,
    paretoFrontierIds,
    cascadeSlices,
    blendedCostPer1kUsd,
    blendedMonthlySpendUsd,
    blendedGroundednessPct: roundTo(chosen.blendedQ, 2),
    blendedJsonAdherencePct: roundTo(chosen.blendedJson, 2),
    blendedTtftMs: roundTo(chosen.blendedTtft, 1),
    blendedP95LatencyMs: roundTo(chosen.blendedP95, 1),
    baselineModelId: baseline.id,
    baselineModelLabel: baseline.label,
    singleFrontierMonthlyUsd,
    singleFrontierUncachedMonthlyUsd,
    promptCacheMonthlySavingsUsd,
    monthlySavingsUsd,
    annualSavingsUsd,
    savingsPct,
    models,
  };
}

export function formatArenaVolume(reqs: number): string {
  if (reqs >= 1_000_000) {
    const m = reqs / 1_000_000;
    return Number.isInteger(m) ? `${m}M` : `${m.toFixed(1)}M`;
  }
  return `${Math.round(reqs / 1000)}K`;
}

export function formatArenaUsd(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1000) {
    return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}
