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
