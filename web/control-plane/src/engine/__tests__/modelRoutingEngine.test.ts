import { describe, expect, it } from 'vitest';
import {
  ARENA_CACHE_INPUT_DISCOUNT,
  ARENA_MODEL_CATALOG,
  HUMAN_ESCALATION_COST_PER_1K_USD,
  ROUTING_WORKLOAD_PRESETS,
  formatArenaUsd,
  formatArenaVolume,
  optimizeMultiModelRouting,
} from '../modelRoutingEngine';

describe('v5.0 Multi-Model FinOps Routing & Pareto Frontier Arena Engine', () => {
  it('registers all 6 required frontier and open-weight LLM profiles with realistic telemetry', () => {
    expect(ARENA_MODEL_CATALOG).toHaveLength(6);
    expect(ARENA_MODEL_CATALOG.map((m) => m.label)).toEqual([
      'Claude 4.5 Sonnet',
      'GPT-5',
      'Gemini 2.5 Pro',
      'DeepSeek-R1',
      'Gemini 2.5 Flash',
      'Llama 4 70B Self-Hosted',
    ]);
    for (const model of ARENA_MODEL_CATALOG) {
      expect(model.inputUsdPer1M).toBeGreaterThan(0);
      expect(model.outputUsdPer1M).toBeGreaterThan(0);
      expect(model.ttftMs).toBeGreaterThan(0);
      expect(model.p95LatencyMs).toBeGreaterThan(model.ttftMs);
      expect(model.groundednessPct).toBeGreaterThanOrEqual(85);
      expect(model.groundednessPct).toBeLessThanOrEqual(99.5);
      expect(model.jsonSchemaAdherencePct).toBeGreaterThanOrEqual(90);
      expect(model.jsonSchemaAdherencePct).toBeLessThanOrEqual(100);
    }
  });

  it('computes a profitable Pareto-optimal cascading router policy for default enterprise RAG workload', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_500_000,
      qualityFloorPct: 94.5,
      p95LatencyBudgetMs: 900,
      promptCacheHitRatePct: 40,
      baselineModelId: 'claude-4.5-sonnet',
    });

    expect(res.slaSatisfied).toBe(true);
    expect(res.slaWarnings).toHaveLength(0);
    expect(res.blendedGroundednessPct).toBeGreaterThanOrEqual(94.5);
    expect(res.blendedP95LatencyMs).toBeLessThanOrEqual(900);
    expect(res.monthlySavingsUsd).toBeGreaterThan(10_000);
    expect(res.savingsPct).toBeGreaterThan(50);
    expect(res.annualSavingsUsd).toBeCloseTo(res.monthlySavingsUsd * 12, 0);
    expect(res.policySummary).toContain('%');
  });

  it('partitions cascade traffic shares strictly to 100% and exact integer monthly requests', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 3_456_789,
      qualityFloorPct: 95.0,
      p95LatencyBudgetMs: 1100,
      promptCacheHitRatePct: 35,
    });

    const totalShare = res.cascadeSlices.reduce((acc, s) => acc + s.sharePct, 0);
    const totalReqs = res.cascadeSlices.reduce((acc, s) => acc + s.monthlyRequests, 0);
    expect(totalShare).toBe(100);
    expect(totalReqs).toBe(3_456_789);
    expect(res.cascadeSlices.some((s) => s.role === 'human_escalation')).toBe(true);
  });

  it('extracts a strictly non-dominated 2D Cost-vs-Quality Pareto frontier ordered ascending by cost', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_000_000,
      qualityFloorPct: 94.0,
      p95LatencyBudgetMs: 1200,
      promptCacheHitRatePct: 30,
    });

    expect(res.paretoFrontierIds.length).toBeGreaterThanOrEqual(3);
    const frontierModels = res.paretoFrontierIds.map(
      (id) => res.models.find((m) => m.id === id)!
    );

    // Costs along Pareto frontier must be monotonically non-decreasing, groundedness strictly increasing
    for (let i = 1; i < frontierModels.length; i += 1) {
      expect(frontierModels[i].effectiveCostPer1kUsd).toBeGreaterThanOrEqual(
        frontierModels[i - 1].effectiveCostPer1kUsd
      );
      expect(frontierModels[i].groundednessPct).toBeGreaterThan(
        frontierModels[i - 1].groundednessPct
      );
    }

    // No frontier model may be dominated by any other model in catalog
    for (const fm of frontierModels) {
      const isDominated = res.models.some(
        (other) =>
          other.id !== fm.id &&
          other.effectiveCostPer1kUsd <= fm.effectiveCostPer1kUsd &&
          other.groundednessPct >= fm.groundednessPct &&
          (other.effectiveCostPer1kUsd < fm.effectiveCostPer1kUsd ||
            other.groundednessPct > fm.groundednessPct)
      );
      expect(isDominated).toBe(false);
    }
  });

  it('places cheapest open-weight model (Llama 4 70B) and highest-quality frontier (GPT-5) on Pareto frontier', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 1_000_000,
      qualityFloorPct: 92.0,
      p95LatencyBudgetMs: 1500,
      promptCacheHitRatePct: 20,
    });

    expect(res.paretoFrontierIds[0]).toBe('llama-4-70b-self-hosted');
    expect(res.paretoFrontierIds[res.paretoFrontierIds.length - 1]).toBe('gpt-5');
  });

  it('monotonically increases groundedness and cost as Quality Floor rises from 88% to 97.5%', () => {
    const low = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_000_000,
      qualityFloorPct: 88.0,
      p95LatencyBudgetMs: 1500,
      promptCacheHitRatePct: 30,
    });
    const mid = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_000_000,
      qualityFloorPct: 94.5,
      p95LatencyBudgetMs: 1500,
      promptCacheHitRatePct: 30,
    });
    const high = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_000_000,
      qualityFloorPct: 97.5,
      p95LatencyBudgetMs: 1500,
      promptCacheHitRatePct: 30,
    });

    expect(low.slaSatisfied).toBe(true);
    expect(mid.slaSatisfied).toBe(true);
    expect(high.slaSatisfied).toBe(true);
    expect(mid.blendedGroundednessPct).toBeGreaterThanOrEqual(low.blendedGroundednessPct);
    expect(high.blendedGroundednessPct).toBeGreaterThanOrEqual(mid.blendedGroundednessPct);
    expect(high.blendedMonthlySpendUsd).toBeGreaterThan(low.blendedMonthlySpendUsd);
  });

  it('enforces strict P95 latency budget (500ms) and flags slower models as SLA-violating', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_000_000,
      qualityFloorPct: 92.0,
      p95LatencyBudgetMs: 500,
      promptCacheHitRatePct: 25,
    });

    expect(res.slaSatisfied).toBe(true);
    expect(res.blendedP95LatencyMs).toBeLessThanOrEqual(500);
    const deepseek = res.models.find((m) => m.id === 'deepseek-r1')!;
    const gpt5 = res.models.find((m) => m.id === 'gpt-5')!;
    expect(deepseek.meetsLatencyBudget).toBe(false);
    expect(gpt5.meetsLatencyBudget).toBe(false);
  });

  it('applies 88% input-token discount and latency speedup when Prompt Caching Hit Rate increases', () => {
    const noCache = optimizeMultiModelRouting({
      monthlyRequestVolume: 5_000_000,
      qualityFloorPct: 95.0,
      p95LatencyBudgetMs: 2500,
      promptCacheHitRatePct: 0,
    });
    const maxCache = optimizeMultiModelRouting({
      monthlyRequestVolume: 5_000_000,
      qualityFloorPct: 95.0,
      p95LatencyBudgetMs: 2500,
      promptCacheHitRatePct: 85,
    });

    expect(noCache.promptCacheMonthlySavingsUsd).toBe(0);
    expect(maxCache.promptCacheMonthlySavingsUsd).toBeGreaterThan(0);
    expect(maxCache.blendedMonthlySpendUsd).toBeLessThan(noCache.blendedMonthlySpendUsd);
    expect(maxCache.blendedTtftMs).toBeLessThan(noCache.blendedTtftMs);

    // Verify exact prompt cache discount formula on Claude 4.5 Sonnet
    const claude0 = noCache.models.find((m) => m.id === 'claude-4.5-sonnet')!;
    const claude85 = maxCache.models.find((m) => m.id === 'claude-4.5-sonnet')!;
    const expectedInputPart = 1800 * 3.0 * (1 - ARENA_CACHE_INPUT_DISCOUNT * 0.85);
    const expectedOutputPart = 450 * 15.0;
    expect(claude85.effectiveCostPer1kUsd).toBeCloseTo(
      (expectedInputPart + expectedOutputPart) / 1000,
      3
    );
    expect(claude85.effectiveTtftMs).toBeLessThan(claude0.effectiveTtftMs);
  });

  it('scales monthly spend and savings linearly across the full 100K to 20M req/mo spectrum', () => {
    const lowVol = optimizeMultiModelRouting({
      monthlyRequestVolume: 100_000,
      qualityFloorPct: 94.0,
      p95LatencyBudgetMs: 1000,
      promptCacheHitRatePct: 40,
    });
    const highVol = optimizeMultiModelRouting({
      monthlyRequestVolume: 20_000_000,
      qualityFloorPct: 94.0,
      p95LatencyBudgetMs: 1000,
      promptCacheHitRatePct: 40,
    });

    expect(lowVol.policySummary).toBe(highVol.policySummary);
    expect(highVol.blendedMonthlySpendUsd / lowVol.blendedMonthlySpendUsd).toBeCloseTo(200, 1);
    expect(highVol.monthlySavingsUsd / lowVol.monthlySavingsUsd).toBeCloseTo(200, 1);
  });

  it('clamps out-of-range slider inputs safely within production bounds', () => {
    const belowMin = optimizeMultiModelRouting({
      monthlyRequestVolume: 500,
      qualityFloorPct: 40,
      p95LatencyBudgetMs: 50,
      promptCacheHitRatePct: -30,
    });
    const aboveMax = optimizeMultiModelRouting({
      monthlyRequestVolume: 999_000_000,
      qualityFloorPct: 120,
      p95LatencyBudgetMs: 99_999,
      promptCacheHitRatePct: 100,
    });

    expect(belowMin.inputs.monthlyRequestVolume).toBe(100_000);
    expect(belowMin.inputs.qualityFloorPct).toBe(85.0);
    expect(belowMin.inputs.p95LatencyBudgetMs).toBe(400);
    expect(belowMin.inputs.promptCacheHitRatePct).toBe(0);

    expect(aboveMax.inputs.monthlyRequestVolume).toBe(20_000_000);
    expect(aboveMax.inputs.qualityFloorPct).toBe(99.0);
    expect(aboveMax.inputs.p95LatencyBudgetMs).toBe(3000);
    expect(aboveMax.inputs.promptCacheHitRatePct).toBe(85);
  });

  it('handles NaN and non-finite inputs cleanly by falling back to safe lower bounds', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: Number.NaN,
      qualityFloorPct: Number.POSITIVE_INFINITY,
      p95LatencyBudgetMs: Number.NaN,
      promptCacheHitRatePct: Number.NaN,
    });
    expect(res.inputs.monthlyRequestVolume).toBe(100_000);
    expect(res.inputs.p95LatencyBudgetMs).toBe(400);
    expect(res.inputs.promptCacheHitRatePct).toBe(0);
    expect(Number.isFinite(res.blendedMonthlySpendUsd)).toBe(true);
  });

  it('gracefully surfaces SLA warnings when extreme quality (99%) collides with 400ms latency budget', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 1_000_000,
      qualityFloorPct: 99.0,
      p95LatencyBudgetMs: 400,
      promptCacheHitRatePct: 0,
    });

    expect(res.slaSatisfied).toBe(false);
    expect(res.slaWarnings.length).toBeGreaterThanOrEqual(1);
    expect(res.cascadeSlices.reduce((s, x) => s + x.sharePct, 0)).toBe(100);
  });

  it('recomputes baseline comparison accurately when baseline switches from Claude 4.5 Sonnet to GPT-5', () => {
    const claudeBase = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_500_000,
      qualityFloorPct: 94.5,
      p95LatencyBudgetMs: 900,
      promptCacheHitRatePct: 40,
      baselineModelId: 'claude-4.5-sonnet',
    });
    const gpt5Base = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_500_000,
      qualityFloorPct: 94.5,
      p95LatencyBudgetMs: 900,
      promptCacheHitRatePct: 40,
      baselineModelId: 'gpt-5',
    });

    expect(gpt5Base.baselineModelId).toBe('gpt-5');
    expect(gpt5Base.baselineModelLabel).toBe('GPT-5');
    expect(gpt5Base.singleFrontierMonthlyUsd).toBeGreaterThan(
      claudeBase.singleFrontierMonthlyUsd
    );
    expect(gpt5Base.monthlySavingsUsd).toBeGreaterThan(claudeBase.monthlySavingsUsd);
  });

  it('falls back to Claude 4.5 Sonnet if an unknown baseline model ID is supplied', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 1_000_000,
      qualityFloorPct: 94.0,
      p95LatencyBudgetMs: 1100,
      promptCacheHitRatePct: 25,
      baselineModelId: 'unknown-llm' as never,
    });
    expect(res.baselineModelId).toBe('claude-4.5-sonnet');
  });

  it('achieves high JSON schema adherence (>94%) across all 4 enterprise workload presets', () => {
    expect(ROUTING_WORKLOAD_PRESETS).toHaveLength(4);
    for (const preset of ROUTING_WORKLOAD_PRESETS) {
      const res = optimizeMultiModelRouting({
        monthlyRequestVolume: preset.monthlyRequestVolume,
        qualityFloorPct: preset.qualityFloorPct,
        p95LatencyBudgetMs: preset.p95LatencyBudgetMs,
        promptCacheHitRatePct: preset.promptCacheHitRatePct,
        baselineModelId: preset.baselineModelId,
      });
      expect(res.slaSatisfied).toBe(true);
      expect(res.blendedGroundednessPct).toBeGreaterThanOrEqual(preset.qualityFloorPct);
      expect(res.blendedP95LatencyMs).toBeLessThanOrEqual(preset.p95LatencyBudgetMs);
      expect(res.blendedJsonAdherencePct).toBeGreaterThanOrEqual(94.5);
      expect(res.monthlySavingsUsd).toBeGreaterThan(0);
    }
  });

  it('keeps human escalation reserve bounded and priced at exact amortized SME unit rate', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_000_000,
      qualityFloorPct: 95.0,
      p95LatencyBudgetMs: 1000,
      promptCacheHitRatePct: 40,
    });

    const human = res.cascadeSlices.find((s) => s.role === 'human_escalation')!;
    expect(human).toBeDefined();
    expect(human.sharePct).toBeGreaterThanOrEqual(2);
    expect(human.sharePct).toBeLessThanOrEqual(15);
    expect(human.costPer1kUsd).toBe(HUMAN_ESCALATION_COST_PER_1K_USD);
    expect(human.monthlySpendUsd).toBeCloseTo(
      (human.monthlyRequests / 1000) * HUMAN_ESCALATION_COST_PER_1K_USD,
      1
    );
  });

  it('unlocks lower-cost open-weight Llama 4 70B tier when quality floor is relaxed to 88%', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 4_000_000,
      qualityFloorPct: 88.0,
      p95LatencyBudgetMs: 900,
      promptCacheHitRatePct: 40,
    });

    expect(res.slaSatisfied).toBe(true);
    expect(res.cascadeSlices.some((s) => s.id === 'llama-4-70b-self-hosted')).toBe(true);
    expect(res.savingsPct).toBeGreaterThan(90);
  });

  it('escalates frontier tier share cleanly when quality floor rises from 92% to 97.6%', () => {
    const low = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_000_000,
      qualityFloorPct: 92.0,
      p95LatencyBudgetMs: 1400,
      promptCacheHitRatePct: 45,
    });
    const high = optimizeMultiModelRouting({
      monthlyRequestVolume: 2_000_000,
      qualityFloorPct: 97.6,
      p95LatencyBudgetMs: 1400,
      promptCacheHitRatePct: 45,
    });

    expect(low.slaSatisfied).toBe(true);
    expect(high.slaSatisfied).toBe(true);
    const lowFrontierPct = low.cascadeSlices.find((s) => s.role === 'frontier')?.sharePct ?? 0;
    const highFrontierPct = high.cascadeSlices.find((s) => s.role === 'frontier')?.sharePct ?? 0;
    expect(highFrontierPct).toBeGreaterThan(lowFrontierPct);
    expect(highFrontierPct).toBeGreaterThanOrEqual(30);
    expect(high.blendedGroundednessPct).toBeGreaterThanOrEqual(97.6);
  });

  it('scales token costs accurately for long-context RAG payloads (4000 in / 1000 out)', () => {
    const shortCtx = optimizeMultiModelRouting({
      monthlyRequestVolume: 1_000_000,
      qualityFloorPct: 94.0,
      p95LatencyBudgetMs: 1100,
      promptCacheHitRatePct: 30,
      avgInputTokens: 1000,
      avgOutputTokens: 250,
    });
    const longCtx = optimizeMultiModelRouting({
      monthlyRequestVolume: 1_000_000,
      qualityFloorPct: 94.0,
      p95LatencyBudgetMs: 1100,
      promptCacheHitRatePct: 30,
      avgInputTokens: 4000,
      avgOutputTokens: 1000,
    });

    const claudeShort = shortCtx.models.find((m) => m.id === 'claude-4.5-sonnet')!;
    const claudeLong = longCtx.models.find((m) => m.id === 'claude-4.5-sonnet')!;
    expect(claudeLong.effectiveCostPer1kUsd / claudeShort.effectiveCostPer1kUsd).toBeCloseTo(4.0, 2);
  });

  it('is strictly deterministic across repeated invocations with identical inputs', () => {
    const input = {
      monthlyRequestVolume: 3_500_000,
      qualityFloorPct: 95.3,
      p95LatencyBudgetMs: 920,
      promptCacheHitRatePct: 52,
    };
    const a = optimizeMultiModelRouting(input);
    const b = optimizeMultiModelRouting(input);
    expect(a).toEqual(b);
  });

  it('guarantees blended monthly spend equals sum of individual cascade slice spends (within rounding)', () => {
    const res = optimizeMultiModelRouting({
      monthlyRequestVolume: 6_000_000,
      qualityFloorPct: 95.5,
      p95LatencyBudgetMs: 1050,
      promptCacheHitRatePct: 45,
    });

    const sumSlices = res.cascadeSlices.reduce((sum, s) => sum + s.monthlySpendUsd, 0);
    expect(res.blendedMonthlySpendUsd).toBeCloseTo(sumSlices, 0);
  });

  it('formats compact volumes and USD amounts cleanly across K, M, and negative savings labels', () => {
    expect(formatArenaVolume(100_000)).toBe('100K');
    expect(formatArenaVolume(750_000)).toBe('750K');
    expect(formatArenaVolume(1_000_000)).toBe('1M');
    expect(formatArenaVolume(2_500_000)).toBe('2.5M');
    expect(formatArenaVolume(20_000_000)).toBe('20M');

    expect(formatArenaUsd(84.5)).toBe('$84.50');
    expect(formatArenaUsd(14_820)).toBe('$14,820');
    expect(formatArenaUsd(-14_820)).toBe('-$14,820');
    expect(formatArenaUsd(1_420_000)).toBe('$1.42M');
  });

  it('verifies zero UI emojis exist in Arena model catalog or workload presets', () => {
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const model of ARENA_MODEL_CATALOG) {
      expect(emojiPattern.test(model.label)).toBe(false);
      expect(emojiPattern.test(model.provider)).toBe(false);
    }
    for (const preset of ROUTING_WORKLOAD_PRESETS) {
      expect(emojiPattern.test(preset.label)).toBe(false);
      expect(emojiPattern.test(preset.labelVi)).toBe(false);
      expect(emojiPattern.test(preset.description)).toBe(false);
    }
  });
});
