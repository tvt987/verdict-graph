import type { BranchSummary, ControlPlaneRun } from '../types/protocol';

export type RoutingPolicy = 'frontier_only' | 'tiered_cascade';

export const TIERED_CASCADE_SAVINGS_FACTOR = 0.522; // -52.2% unit cost via tiered cascade router

export interface FinOpsBranchMetrics {
  branchId: string;
  costPerRunUsd: number;
  tokensPerRun: number;
  latencyMs: number;
  groundedness: number;
}

export interface FinOpsSimulationInput {
  routingPolicy: RoutingPolicy;
  monthlyRuns: number; // 10_000 -> 5_000_000
  mainBranch: FinOpsBranchMetrics;
  forkBranch: FinOpsBranchMetrics;
  sourceMode: 'live_fork' | 'benchmark_baseline';
}

export interface FinOpsStageCostBar {
  stage: string;
  mainModel: string;
  routedModel: string;
  mainCostPer1kUsd: number;
  forkRoutedCostPer1kUsd: number;
  reductionPct: number;
}

export interface FinOpsSimulationResult {
  routingPolicy: RoutingPolicy;
  monthlyRuns: number;
  sourceMode: 'live_fork' | 'benchmark_baseline';
  mainBranchId: string;
  forkBranchId: string;
  mainCostPerRunUsd: number;
  forkRawCostPerRunUsd: number;
  effectiveForkCostPerRunUsd: number;
  mainMonthlyUsd: number;
  forkEffectiveMonthlyUsd: number;
  monthlySavingsUsd: number;
  annualSavingsUsd: number;
  totalSavingsPct: number;
  routingCascadeDeltaPct: number;
  mainGroundedness: number;
  forkGroundedness: number;
  groundednessLift: number;
  mainTokensPerRun: number;
  forkTokensPerRun: number;
  tokensSavedPerRun: number;
  monthlyTokensSaved: number;
  stageBreakdown: FinOpsStageCostBar[];
}

// Canonical Scenario D Main (top_k=24 unranked) vs Fork-1 (top_k=8 + cross-encoder rerank)
export const DEFAULT_MAIN_BENCHMARK: FinOpsBranchMetrics = {
  branchId: 'main',
  costPerRunUsd: 0.04496,
  tokensPerRun: 6160,
  latencyMs: 632.0,
  groundedness: 0.61,
};

export const DEFAULT_FORK_BENCHMARK: FinOpsBranchMetrics = {
  branchId: 'fork-1',
  costPerRunUsd: 0.02418,
  tokensPerRun: 3060,
  latencyMs: 421.0,
  groundedness: 0.99,
};

export function extractBranchFinOpsMetrics(run: ControlPlaneRun): {
  mainBranch: FinOpsBranchMetrics;
  forkBranch: FinOpsBranchMetrics;
  sourceMode: 'live_fork' | 'benchmark_baseline';
} {
  const forkKeys = Object.keys(run.branches).filter((k) => k.startsWith('fork-'));
  const main: BranchSummary | undefined = run.branches.main;

  if (forkKeys.length > 0 && main && main.total_cost_usd > 0) {
    const latestFork = run.branches[forkKeys[forkKeys.length - 1]];
    if (latestFork && latestFork.total_cost_usd > 0) {
      return {
        sourceMode: 'live_fork',
        mainBranch: {
          branchId: main.branch_id,
          costPerRunUsd: main.total_cost_usd,
          tokensPerRun: main.total_input_tokens + main.total_output_tokens,
          latencyMs: main.total_latency_ms,
          groundedness: main.groundedness > 0 ? main.groundedness : 0.61,
        },
        forkBranch: {
          branchId: latestFork.branch_id,
          costPerRunUsd: latestFork.total_cost_usd,
          tokensPerRun: latestFork.total_input_tokens + latestFork.total_output_tokens,
          latencyMs: latestFork.total_latency_ms,
          groundedness: latestFork.groundedness > 0 ? latestFork.groundedness : 0.99,
        },
      };
    }
  }

  return {
    sourceMode: 'benchmark_baseline',
    mainBranch: DEFAULT_MAIN_BENCHMARK,
    forkBranch: DEFAULT_FORK_BENCHMARK,
  };
}

export function computeFinOpsSimulation(input: FinOpsSimulationInput): FinOpsSimulationResult {
  const clampedRuns = Math.max(10_000, Math.min(5_000_000, Math.round(input.monthlyRuns)));
  const mainCostPerRun = Math.max(0.0001, input.mainBranch.costPerRunUsd);
  const forkRawCostPerRun = Math.max(0.0001, input.forkBranch.costPerRunUsd);

  // Under Frontier Only, Fork runs on frontier models (saving from pruned top_k context tokens only).
  // Under Tiered Cascade Router (-52.2%), cheap specialist/mini models handle triage, reranking & policy checks.
  const cascadeMultiplier =
    input.routingPolicy === 'tiered_cascade' ? 1 - TIERED_CASCADE_SAVINGS_FACTOR : 1;

  const effectiveForkCostPerRun = Number((forkRawCostPerRun * cascadeMultiplier).toFixed(6));

  // Baseline monthly cost on Frontier Main branch
  const mainMonthlyUsd = Number((mainCostPerRun * clampedRuns).toFixed(2));
  const forkEffectiveMonthlyUsd = Number((effectiveForkCostPerRun * clampedRuns).toFixed(2));
  const monthlySavingsUsd = Number(Math.max(0, mainMonthlyUsd - forkEffectiveMonthlyUsd).toFixed(2));
  const annualSavingsUsd = Number((monthlySavingsUsd * 12).toFixed(2));

  const totalSavingsPct =
    mainMonthlyUsd > 0
      ? Number((((mainMonthlyUsd - forkEffectiveMonthlyUsd) / mainMonthlyUsd) * 100).toFixed(1))
      : 0;

  const routingCascadeDeltaPct =
    input.routingPolicy === 'tiered_cascade'
      ? Number((TIERED_CASCADE_SAVINGS_FACTOR * 100).toFixed(1))
      : 0;

  const groundednessLift = Number(
    (input.forkBranch.groundedness - input.mainBranch.groundedness).toFixed(2)
  );

  const tokensSavedPerRun = Math.max(
    0,
    input.mainBranch.tokensPerRun - input.forkBranch.tokensPerRun
  );
  const monthlyTokensSaved = tokensSavedPerRun * clampedRuns;

  // Stage-level cost breakdown ($ per 1,000 runs)
  const mainPer1k = mainCostPerRun * 1000;
  const forkPer1k = effectiveForkCostPerRun * 1000;

  const isCascade = input.routingPolicy === 'tiered_cascade';
  const stageWeights: Array<{
    stage: string;
    mainModel: string;
    routedModel: string;
    mainShare: number;
    forkShare: number;
  }> = [
    {
      stage: '01 Planner Triage',
      mainModel: 'gpt-4.1',
      routedModel: isCascade ? 'gpt-4.1-mini' : 'gpt-4.1',
      mainShare: 0.16,
      forkShare: isCascade ? 0.08 : 0.17,
    },
    {
      stage: '02 MCP Rerank & Context',
      mainModel: 'unranked top_k=24',
      routedModel: isCascade ? 'rerank top_k=8' : 'rerank top_k=8',
      mainShare: 0.22,
      forkShare: isCascade ? 0.11 : 0.16,
    },
    {
      stage: '04 Policy Classifier',
      mainModel: 'gpt-4.1-guard',
      routedModel: isCascade ? 'policy-classifier-v3' : 'gpt-4.1-guard',
      mainShare: 0.12,
      forkShare: isCascade ? 0.05 : 0.11,
    },
    {
      stage: '06 Grounded Synthesis',
      mainModel: 'claude-sonnet-4',
      routedModel: isCascade ? 'claude-sonnet-4 (pruned)' : 'claude-sonnet-4',
      mainShare: 0.5,
      forkShare: isCascade ? 0.76 : 0.56,
    },
  ];

  const stageBreakdown: FinOpsStageCostBar[] = stageWeights.map((s) => {
    const mCost = Number((mainPer1k * s.mainShare).toFixed(3));
    const fCost = Number((forkPer1k * s.forkShare).toFixed(3));
    const red = mCost > 0 ? Number((((mCost - fCost) / mCost) * 100).toFixed(1)) : 0;
    return {
      stage: s.stage,
      mainModel: s.mainModel,
      routedModel: s.routedModel,
      mainCostPer1kUsd: mCost,
      forkRoutedCostPer1kUsd: fCost,
      reductionPct: red,
    };
  });

  return {
    routingPolicy: input.routingPolicy,
    monthlyRuns: clampedRuns,
    sourceMode: input.sourceMode,
    mainBranchId: input.mainBranch.branchId,
    forkBranchId: input.forkBranch.branchId,
    mainCostPerRunUsd: mainCostPerRun,
    forkRawCostPerRunUsd: forkRawCostPerRun,
    effectiveForkCostPerRunUsd: effectiveForkCostPerRun,
    mainMonthlyUsd,
    forkEffectiveMonthlyUsd,
    monthlySavingsUsd,
    annualSavingsUsd,
    totalSavingsPct,
    routingCascadeDeltaPct,
    mainGroundedness: input.mainBranch.groundedness,
    forkGroundedness: input.forkBranch.groundedness,
    groundednessLift,
    mainTokensPerRun: input.mainBranch.tokensPerRun,
    forkTokensPerRun: input.forkBranch.tokensPerRun,
    tokensSavedPerRun,
    monthlyTokensSaved,
    stageBreakdown,
  };
}

export function formatRunScaleLabel(runs: number): string {
  if (runs >= 1_000_000) {
    const m = runs / 1_000_000;
    return `${Number.isInteger(m) ? m.toFixed(0) : m.toFixed(2).replace(/0$/, '')}M`;
  }
  return `${Math.round(runs / 1_000)}K`;
}

export function formatUsdCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (amount >= 10_000) {
    return `$${Math.round(amount).toLocaleString('en-US')}`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ============================================================================
// v3.0 Multi-Model FinOps Cost/Latency Router Matrix & Pareto Frontier Engine
// ============================================================================

export type MultiModelId =
  | 'gemini-2.5-pro'
  | 'claude-3.7-sonnet'
  | 'gpt-4o'
  | 'vllm-qwen-72b';

export type MultiModelRoutingPolicy =
  | 'quality_first'
  | 'balanced_hybrid'
  | 'cost_optimized';

export interface FinOpsModelSpec {
  id: MultiModelId;
  label: string;
  shortLabel: string;
  provider: string;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  ttftMs: number;
  qualityIndex: number; // 0..100 benchmark composite
  contextWindow: string;
  accentHex: string;
}

export const FINOPS_MODEL_CATALOG: FinOpsModelSpec[] = [
  {
    id: 'claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    shortLabel: 'Claude 3.7',
    provider: 'Anthropic',
    inputUsdPer1M: 3.0,
    outputUsdPer1M: 15.0,
    ttftMs: 410,
    qualityIndex: 97.4,
    contextWindow: '200K',
    accentHex: '#F59E0B',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    shortLabel: 'Gemini 2.5 Pro',
    provider: 'Google Vertex',
    inputUsdPer1M: 1.25,
    outputUsdPer1M: 10.0,
    ttftMs: 325,
    qualityIndex: 96.1,
    contextWindow: '2M',
    accentHex: '#38BDF8',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    shortLabel: 'GPT-4o',
    provider: 'OpenAI',
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 10.0,
    ttftMs: 310,
    qualityIndex: 94.2,
    contextWindow: '128K',
    accentHex: '#A855F7',
  },
  {
    id: 'vllm-qwen-72b',
    label: 'Local vLLM Qwen-72B',
    shortLabel: 'vLLM Qwen-72B',
    provider: 'Self-Hosted H100',
    inputUsdPer1M: 0.18,
    outputUsdPer1M: 0.42,
    ttftMs: 142,
    qualityIndex: 88.9,
    contextWindow: '128K',
    accentHex: '#10B981',
  },
];

export const ROUTING_POLICY_WEIGHTS: Record<
  MultiModelRoutingPolicy,
  Record<MultiModelId, number>
> = {
  quality_first: {
    'claude-3.7-sonnet': 0.54,
    'gemini-2.5-pro': 0.30,
    'gpt-4o': 0.11,
    'vllm-qwen-72b': 0.05,
  },
  balanced_hybrid: {
    'claude-3.7-sonnet': 0.18,
    'gemini-2.5-pro': 0.36,
    'gpt-4o': 0.12,
    'vllm-qwen-72b': 0.34,
  },
  cost_optimized: {
    'claude-3.7-sonnet': 0.05,
    'gemini-2.5-pro': 0.18,
    'gpt-4o': 0.09,
    'vllm-qwen-72b': 0.68,
  },
};

export interface MultiModelFinOpsInput {
  monthlyCalls: number; // 100_000 -> 20_000_000
  cacheHitRatePct: number; // 0 -> 85
  policy: MultiModelRoutingPolicy;
  avgInputTokens?: number;
  avgOutputTokens?: number;
}

export interface ModelAllocationRow {
  model: FinOpsModelSpec;
  sharePct: number;
  monthlyCalls: number;
  costPer1kCallsUsd: number;
  monthlySpendUsd: number;
  effectiveTtftMs: number;
}

export interface ParetoChartPoint {
  id: string;
  label: string;
  kind: 'model' | 'policy' | 'active';
  costPer1kCallsUsd: number;
  qualityIndex: number;
  ttftMs: number;
  accentHex: string;
  onFrontier: boolean;
}

export interface MultiModelFinOpsResult {
  monthlyCalls: number;
  cacheHitRatePct: number;
  policy: MultiModelRoutingPolicy;
  monthlyCloudSpendUsd: number;
  singleFrontierMonthlyUsd: number;
  monthlySavingsUsd: number;
  annualSavingsUsd: number;
  savingsPct: number;
  blendedTtftMs: number;
  singleFrontierTtftMs: number;
  latencyReductionMs: number;
  blendedQualityIndex: number;
  costPer1kCallsUsd: number;
  allocations: ModelAllocationRow[];
  paretoPoints: ParetoChartPoint[];
}

const DEFAULT_AVG_INPUT_TOKENS = 1850;
const DEFAULT_AVG_OUTPUT_TOKENS = 420;
const CACHED_TOKEN_COST_FACTOR = 0.08; // 92% discount on semantic / KV cache hits
const CACHED_TTFT_MS = 38;

function modelCostPer1kCalls(
  spec: FinOpsModelSpec,
  avgIn: number,
  avgOut: number,
  cacheFrac: number
): number {
  const uncachedPerCall =
    (avgIn / 1_000_000) * spec.inputUsdPer1M + (avgOut / 1_000_000) * spec.outputUsdPer1M;
  const effectivePerCall =
    uncachedPerCall * (1 - cacheFrac) + uncachedPerCall * CACHED_TOKEN_COST_FACTOR * cacheFrac;
  return Number((effectivePerCall * 1000).toFixed(4));
}

function modelEffectiveTtft(spec: FinOpsModelSpec, cacheFrac: number): number {
  return Number((spec.ttftMs * (1 - cacheFrac) + CACHED_TTFT_MS * cacheFrac).toFixed(1));
}

export function computeMultiModelFinOpsMatrix(
  input: MultiModelFinOpsInput
): MultiModelFinOpsResult {
  const monthlyCalls = Math.max(100_000, Math.min(20_000_000, Math.round(input.monthlyCalls)));
  const cacheHitRatePct = Math.max(0, Math.min(85, Math.round(input.cacheHitRatePct)));
  const cacheFrac = cacheHitRatePct / 100;
  const avgIn = input.avgInputTokens ?? DEFAULT_AVG_INPUT_TOKENS;
  const avgOut = input.avgOutputTokens ?? DEFAULT_AVG_OUTPUT_TOKENS;

  const weights = ROUTING_POLICY_WEIGHTS[input.policy];

  // Single-frontier baseline: 100% pinned to Claude 3.7 Sonnet with 0% semantic caching
  const frontierSpec = FINOPS_MODEL_CATALOG[0]; // claude-3.7-sonnet
  const frontierPer1kUncached = modelCostPer1kCalls(frontierSpec, avgIn, avgOut, 0);
  const singleFrontierMonthlyUsd = Number(
    ((frontierPer1kUncached / 1000) * monthlyCalls).toFixed(2)
  );

  const allocations: ModelAllocationRow[] = FINOPS_MODEL_CATALOG.map((model) => {
    const w = weights[model.id];
    const calls = Math.round(monthlyCalls * w);
    const per1k = modelCostPer1kCalls(model, avgIn, avgOut, cacheFrac);
    const spend = Number(((per1k / 1000) * calls).toFixed(2));
    const effTtft = modelEffectiveTtft(model, cacheFrac);
    return {
      model,
      sharePct: Math.round(w * 100),
      monthlyCalls: calls,
      costPer1kCallsUsd: per1k,
      monthlySpendUsd: spend,
      effectiveTtftMs: effTtft,
    };
  });

  const monthlyCloudSpendUsd = Number(
    allocations.reduce((sum, row) => sum + row.monthlySpendUsd, 0).toFixed(2)
  );
  const monthlySavingsUsd = Number(
    Math.max(0, singleFrontierMonthlyUsd - monthlyCloudSpendUsd).toFixed(2)
  );
  const annualSavingsUsd = Number((monthlySavingsUsd * 12).toFixed(2));
  const savingsPct =
    singleFrontierMonthlyUsd > 0
      ? Number(((monthlySavingsUsd / singleFrontierMonthlyUsd) * 100).toFixed(1))
      : 0;

  const blendedTtftMs = Number(
    allocations
      .reduce((acc, row) => acc + (row.sharePct / 100) * row.effectiveTtftMs, 0)
      .toFixed(1)
  );
  const latencyReductionMs = Number((frontierSpec.ttftMs - blendedTtftMs).toFixed(1));
  const blendedQualityIndex = Number(
    allocations
      .reduce((acc, row) => acc + (row.sharePct / 100) * row.model.qualityIndex, 0)
      .toFixed(1)
  );
  const costPer1kCallsUsd = Number(((monthlyCloudSpendUsd / monthlyCalls) * 1000).toFixed(4));

  // Build Pareto Cost-vs-Quality Points (4 models + active routed policy)
  const rawPoints: Array<Omit<ParetoChartPoint, 'onFrontier'>> = [
    ...FINOPS_MODEL_CATALOG.map((m) => ({
      id: m.id,
      label: m.shortLabel,
      kind: 'model' as const,
      costPer1kCallsUsd: modelCostPer1kCalls(m, avgIn, avgOut, cacheFrac),
      qualityIndex: m.qualityIndex,
      ttftMs: modelEffectiveTtft(m, cacheFrac),
      accentHex: m.accentHex,
    })),
    {
      id: `active-${input.policy}`,
      label:
        input.policy === 'quality_first'
          ? 'Active: Quality First'
          : input.policy === 'balanced_hybrid'
            ? 'Active: Balanced Hybrid'
            : 'Active: Cost Optimized',
      kind: 'active' as const,
      costPer1kCallsUsd,
      qualityIndex: blendedQualityIndex,
      ttftMs: blendedTtftMs,
      accentHex: '#22D3EE',
    },
  ];

  // Identify Pareto-optimal points (no other point has strictly lower cost AND >= quality)
  const paretoPoints: ParetoChartPoint[] = rawPoints.map((pt) => {
    const dominated = rawPoints.some(
      (other) =>
        other.id !== pt.id &&
        other.costPer1kCallsUsd <= pt.costPer1kCallsUsd &&
        other.qualityIndex >= pt.qualityIndex &&
        (other.costPer1kCallsUsd < pt.costPer1kCallsUsd || other.qualityIndex > pt.qualityIndex)
    );
    return {
      ...pt,
      onFrontier: !dominated,
    };
  });

  return {
    monthlyCalls,
    cacheHitRatePct,
    policy: input.policy,
    monthlyCloudSpendUsd,
    singleFrontierMonthlyUsd,
    monthlySavingsUsd,
    annualSavingsUsd,
    savingsPct,
    blendedTtftMs,
    singleFrontierTtftMs: frontierSpec.ttftMs,
    latencyReductionMs,
    blendedQualityIndex,
    costPer1kCallsUsd,
    allocations,
    paretoPoints,
  };
}
