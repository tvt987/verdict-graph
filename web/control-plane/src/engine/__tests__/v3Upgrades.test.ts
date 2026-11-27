import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_MODEL_SPECS,
  WORKFLOW_PRESETS,
  WORKFLOW_ROLE_CATALOG,
  addWorkflowNode,
  createDefaultWorkflow,
  deriveWorkflowEdges,
  removeWorkflowNode,
  reorderWorkflowNode,
  simulateWorkflowTrace,
  updateWorkflowNode,
  validateWorkflowDag,
} from '../../engines/workflowBuilder';
import {
  ALTERNATE_FORK_MODELS,
  computeStructuredStateDiff,
  createInitialRun,
  forkAndReplayFromCheckpoint,
  runUntilPauseOrComplete,
} from '../protocolEngine';
import {
  FINOPS_MODEL_CATALOG,
  ROUTING_POLICY_WEIGHTS,
  computeMultiModelFinOpsMatrix,
} from '../finopsSimulator';
import {
  OWASP_LLM_TOP10_PROBES,
  buildOwaspComplianceJson,
  buildOwaspComplianceMarkdown,
  runOwaspProbe,
  runOwaspTop10Suite,
  triggerOwaspReportDownload,
} from '../redTeamClassifier';
import {
  BASE_LICENSE_VND,
  ENTERPRISE_ADDONS,
  MBBANK_ACCOUNT,
  MBBANK_BIN,
  MBBANK_HOLDER,
  buildEnterpriseQuoteMarkdown,
  buildVietQrUrl,
  computeEnterpriseQuote,
  formatVnd,
  sanitizeTransferReference,
  triggerEnterpriseQuoteDownload,
} from '../enterpriseQuote';
import { TRANSLATIONS } from '../../i18n/translations';

describe('v3.0 Custom Multi-Agent Workflow DAG Builder (src/engines/workflowBuilder.ts)', () => {
  it('exposes all 7 enterprise agent roles in catalog', () => {
    const roles = WORKFLOW_ROLE_CATALOG.map((r) => r.role);
    expect(roles).toEqual([
      'planner',
      'rag_retriever',
      'sql_sandbox',
      'policy_guardrail',
      'critic_verifier',
      'hitl_gate',
      'final_synthesizer',
    ]);
  });

  it('creates valid presets including full 7-node Zero-Trust governance DAG', () => {
    expect(WORKFLOW_PRESETS).toHaveLength(3);
    const zt = createDefaultWorkflow('zero_trust_audit');
    expect(zt).toHaveLength(7);
    expect(validateWorkflowDag(zt)).toHaveLength(0);

    const lowLat = createDefaultWorkflow('low_latency_vllm');
    expect(lowLat).toHaveLength(4);
    expect(lowLat[0].model).toBe('vllm-qwen-72b');
  });

  it('adds nodes with unique IDs both at end and after a selected node', () => {
    const initial = createDefaultWorkflow('low_latency_vllm');
    const afterFirst = addWorkflowNode(initial, 'sql_sandbox', initial[0].id);
    expect(afterFirst).toHaveLength(initial.length + 1);
    expect(afterFirst[1].role).toBe('sql_sandbox');

    const appended = addWorkflowNode(afterFirst, 'hitl_gate');
    expect(appended).toHaveLength(initial.length + 2);
    expect(appended[appended.length - 1].role).toBe('hitl_gate');

    const uniqueIds = new Set(appended.map((n) => n.id));
    expect(uniqueIds.size).toBe(appended.length);
  });

  it('removes a target node and protects against emptying the last node', () => {
    const nodes = createDefaultWorkflow('low_latency_vllm');
    const removed = removeWorkflowNode(nodes, nodes[1].id);
    expect(removed).toHaveLength(3);
    expect(removed.some((n) => n.id === nodes[1].id)).toBe(false);

    const single = [nodes[0]];
    expect(removeWorkflowNode(single, single[0].id)).toHaveLength(1);
  });

  it('reorders nodes left and right safely within DAG bounds', () => {
    const nodes = createDefaultWorkflow('low_latency_vllm');
    const secondId = nodes[1].id;
    const movedLeft = reorderWorkflowNode(nodes, secondId, 'left');
    expect(movedLeft[0].id).toBe(secondId);

    // Moving index 0 left is a safe no-op
    const edgeLeft = reorderWorkflowNode(movedLeft, secondId, 'left');
    expect(edgeLeft[0].id).toBe(secondId);

    const movedRight = reorderWorkflowNode(movedLeft, secondId, 'right');
    expect(movedRight[1].id).toBe(secondId);
  });

  it('updates node parameters and clamps maxTokens, temperature, and retryBudget', () => {
    const nodes = createDefaultWorkflow('enterprise_rag_sql');
    const targetId = nodes[0].id;
    const updated = updateWorkflowNode(nodes, targetId, {
      model: 'claude-3.7-sonnet',
      maxTokens: 999_999,
      temperature: 2.4,
      retryBudget: 99,
      promptDirective: 'Custom deterministic policy check.',
    });
    const node = updated.find((n) => n.id === targetId)!;
    expect(node.model).toBe('claude-3.7-sonnet');
    expect(node.maxTokens).toBe(32768);
    expect(node.temperature).toBe(1);
    expect(node.retryBudget).toBe(5);
    expect(node.promptDirective).toBe('Custom deterministic policy check.');

    const lowerClamped = updateWorkflowNode(updated, targetId, {
      maxTokens: 10,
      temperature: -0.5,
      retryBudget: -2,
    });
    const low = lowerClamped.find((n) => n.id === targetId)!;
    expect(low.maxTokens).toBe(256);
    expect(low.temperature).toBe(0);
    expect(low.retryBudget).toBe(0);
  });

  it('derives sequential forward edges plus cyclic critic/guardrail feedback arc', () => {
    const nodes = createDefaultWorkflow('enterprise_rag_sql');
    const edges = deriveWorkflowEdges(nodes);
    const forward = edges.filter((e) => e.kind === 'forward');
    const feedback = edges.filter((e) => e.kind === 'feedback');
    expect(forward).toHaveLength(nodes.length - 1);
    expect(feedback).toHaveLength(1);
    expect(feedback[0].label).toBe('CRITIC REPLAN LOOP');
  });

  it('validates DAG security invariants (missing guardrail, late guardrail, missing synth, empty)', () => {
    expect(validateWorkflowDag([]).some((i) => i.code === 'DAG-EMPTY')).toBe(true);

    const noGuard = createDefaultWorkflow('low_latency_vllm').filter(
      (n) => n.role !== 'policy_guardrail'
    );
    expect(validateWorkflowDag(noGuard).some((i) => i.code === 'SEC-NO-GUARD')).toBe(true);

    const lateGuard = createDefaultWorkflow('low_latency_vllm');
    // Move policy_guardrail (idx 2) after final_synthesizer (idx 3)
    const swapped = reorderWorkflowNode(lateGuard, lateGuard[2].id, 'right');
    expect(validateWorkflowDag(swapped).some((i) => i.code === 'SEC-LATE-GUARD')).toBe(true);

    const noSynth = lateGuard.filter((n) => n.role !== 'final_synthesizer');
    expect(validateWorkflowDag(noSynth).some((i) => i.code === 'OUT-NO-SYNTH')).toBe(true);
  });

  it('executes deterministic workflow traces with identical telemetry for identical inputs', () => {
    const nodes = createDefaultWorkflow('zero_trust_audit');
    const traceA = simulateWorkflowTrace(nodes, 'Audit voucher SLA');
    const traceB = simulateWorkflowTrace(nodes, 'Audit voucher SLA');

    expect(traceA.traceId).toBe(traceB.traceId);
    expect(traceA.steps).toHaveLength(7);
    expect(traceA.totalLatencyMs).toBe(traceB.totalLatencyMs);
    expect(traceA.totalCostUsd).toBe(traceB.totalCostUsd);
    expect(traceA.guardrailProtected).toBe(true);
    expect(traceA.hitlGated).toBe(true);
    expect(traceA.avgGroundedness).toBeGreaterThanOrEqual(0.9);
  });

  it('reflects model pricing and retry budget overhead dynamically during trace simulation', () => {
    const base = createDefaultWorkflow('low_latency_vllm');
    const expensive = updateWorkflowNode(base, base[0].id, {
      model: 'claude-3.7-sonnet',
      temperature: 0.85,
      retryBudget: 3,
    });
    const cheap = updateWorkflowNode(base, base[0].id, {
      model: 'vllm-qwen-72b',
      temperature: 0.1,
      retryBudget: 0,
    });

    const expTrace = simulateWorkflowTrace(expensive);
    const cheapTrace = simulateWorkflowTrace(cheap);

    expect(expTrace.totalRetries).toBeGreaterThan(0);
    expect(cheapTrace.totalRetries).toBe(0);
    expect(expTrace.totalCostUsd).toBeGreaterThan(cheapTrace.totalCostUsd);
    expect(WORKFLOW_MODEL_SPECS['vllm-qwen-72b'].inputUsdPer1M).toBeLessThan(
      WORKFLOW_MODEL_SPECS['claude-3.7-sonnet'].inputUsdPer1M
    );
  });
});

describe('v3.0 Time-Travel Forking with Alternate Model/Prompt & Structured State Diff', () => {
  it('supports all alternate enterprise models for checkpoint replay', () => {
    const ids = ALTERNATE_FORK_MODELS.map((m) => m.id);
    expect(ids).toContain('claude-3.7-sonnet');
    expect(ids).toContain('gemini-2.5-pro');
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('vllm-qwen-72b');
  });

  it('replays CP-02 on Local vLLM Qwen-72B with huge cost and latency savings vs Claude 3.7', () => {
    const mainRun = runUntilPauseOrComplete(createInitialRun('hallucination_fork'));

    const { diff: vllmDiff } = forkAndReplayFromCheckpoint(mainRun, 'CP-02', {
      top_k: 8,
      rerank: true,
      strict_grounding: true,
      model: 'vllm-qwen-72b',
      prompt_override: 'Concise operator brief on local vLLM.',
    });

    const { diff: claudeDiff } = forkAndReplayFromCheckpoint(mainRun, 'CP-02', {
      top_k: 8,
      rerank: true,
      strict_grounding: true,
      model: 'claude-3.7-sonnet',
      prompt_override: 'Strict compliance audit report.',
    });

    expect(vllmDiff.compare_model).toBe('vllm-qwen-72b');
    expect(claudeDiff.compare_model).toBe('claude-3.7-sonnet');
    expect(vllmDiff.cost_delta_usd).toBeLessThan(claudeDiff.cost_delta_usd);
    expect(vllmDiff.latency_delta_ms).toBeLessThan(claudeDiff.latency_delta_ms);
    expect(vllmDiff.tokens_delta).toBeLessThan(claudeDiff.tokens_delta);
  });

  it('attaches structured JSON state diff and structured Branch A vs B output objects', () => {
    const mainRun = runUntilPauseOrComplete(createInitialRun('hallucination_fork'));
    const { diff } = forkAndReplayFromCheckpoint(mainRun, 'CP-02', {
      top_k: 8,
      rerank: true,
      strict_grounding: true,
      model: 'gemini-2.5-pro',
      prompt_override: 'Strict citation verification directive.',
    });

    expect(diff.prompt_override).toBe('Strict citation verification directive.');
    expect(diff.base_structured_output?.branch_id).toBe('main');
    expect(diff.compare_structured_output?.model).toBe('gemini-2.5-pro');
    expect(diff.structured_state_diff?.some((e) => e.path === '/top_k' && e.kind === 'changed')).toBe(
      true
    );
    expect(diff.structured_state_diff?.some((e) => e.path === '/rerank' && e.after === true)).toBe(
      true
    );
  });

  it('computes accurate JSON state diff across added, removed, changed, and unchanged keys', () => {
    const entries = computeStructuredStateDiff(
      { a: 1, b: 'old', c: true },
      { a: 1, b: 'new', d: [1, 2] }
    );
    expect(entries.find((e) => e.path === '/a')?.kind).toBe('unchanged');
    expect(entries.find((e) => e.path === '/b')?.kind).toBe('changed');
    expect(entries.find((e) => e.path === '/c')?.kind).toBe('removed');
    expect(entries.find((e) => e.path === '/d')?.kind).toBe('added');
  });

  it('supports sequential multi-branch forks while preserving immutable root checkpoints', () => {
    const mainRun = runUntilPauseOrComplete(createInitialRun('hallucination_fork'));
    const { run: afterFork1 } = forkAndReplayFromCheckpoint(mainRun, 'CP-02', {
      top_k: 8,
      rerank: true,
      strict_grounding: true,
      model: 'gemini-2.5-pro',
    });
    const { run: afterFork2 } = forkAndReplayFromCheckpoint(afterFork1, 'CP-02', {
      top_k: 6,
      rerank: true,
      strict_grounding: true,
      model: 'vllm-qwen-72b',
    });

    expect(Object.keys(afterFork2.branches)).toEqual(['main', 'fork-1', 'fork-2']);
    expect(afterFork2.branch_diffs).toHaveLength(2);
    expect(afterFork2.branches.main.checkpoints[1].state_snapshot.top_k).toBe(24);
  });

  it('throws clear error if requested fork checkpoint does not exist', () => {
    const mainRun = runUntilPauseOrComplete(createInitialRun('outage_rollback'));
    expect(() => forkAndReplayFromCheckpoint(mainRun, 'CP-999', {})).toThrow(
      "Checkpoint 'CP-999' not found"
    );
  });
});

describe('v3.0 Multi-Model FinOps Cost/Latency Router Matrix & Pareto Frontier', () => {
  it('models all 4 required flagship & local engines with valid routing weights summing to 100%', () => {
    const modelIds = FINOPS_MODEL_CATALOG.map((m) => m.id);
    expect(modelIds).toEqual([
      'claude-3.7-sonnet',
      'gemini-2.5-pro',
      'gpt-4o',
      'vllm-qwen-72b',
    ]);

    for (const weights of Object.values(ROUTING_POLICY_WEIGHTS)) {
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it('orders monthly spend and TTFT strictly: Quality First > Balanced Hybrid > Cost Optimized', () => {
    const qFirst = computeMultiModelFinOpsMatrix({
      monthlyCalls: 5_000_000,
      cacheHitRatePct: 35,
      policy: 'quality_first',
    });
    const balanced = computeMultiModelFinOpsMatrix({
      monthlyCalls: 5_000_000,
      cacheHitRatePct: 35,
      policy: 'balanced_hybrid',
    });
    const costOpt = computeMultiModelFinOpsMatrix({
      monthlyCalls: 5_000_000,
      cacheHitRatePct: 35,
      policy: 'cost_optimized',
    });

    expect(qFirst.monthlyCloudSpendUsd).toBeGreaterThan(balanced.monthlyCloudSpendUsd);
    expect(balanced.monthlyCloudSpendUsd).toBeGreaterThan(costOpt.monthlyCloudSpendUsd);

    expect(qFirst.blendedTtftMs).toBeGreaterThan(balanced.blendedTtftMs);
    expect(balanced.blendedTtftMs).toBeGreaterThan(costOpt.blendedTtftMs);

    expect(qFirst.blendedQualityIndex).toBeGreaterThan(balanced.blendedQualityIndex);
    expect(balanced.blendedQualityIndex).toBeGreaterThan(costOpt.blendedQualityIndex);
  });

  it('applies semantic + KV cache hit rate (0% -> 85%) to slash both cloud spend and TTFT', () => {
    const noCache = computeMultiModelFinOpsMatrix({
      monthlyCalls: 2_000_000,
      cacheHitRatePct: 0,
      policy: 'balanced_hybrid',
    });
    const highCache = computeMultiModelFinOpsMatrix({
      monthlyCalls: 2_000_000,
      cacheHitRatePct: 85,
      policy: 'balanced_hybrid',
    });

    expect(highCache.monthlyCloudSpendUsd).toBeLessThan(noCache.monthlyCloudSpendUsd * 0.25);
    expect(highCache.blendedTtftMs).toBeLessThan(noCache.blendedTtftMs * 0.45);
    expect(highCache.annualSavingsUsd).toBeGreaterThan(noCache.annualSavingsUsd);
  });

  it('clamps monthly volume to [100K..20M] and cache hit rate to [0..85%] and scales linearly', () => {
    const tooLow = computeMultiModelFinOpsMatrix({
      monthlyCalls: 1000,
      cacheHitRatePct: -20,
      policy: 'balanced_hybrid',
    });
    const tooHigh = computeMultiModelFinOpsMatrix({
      monthlyCalls: 500_000_000,
      cacheHitRatePct: 99,
      policy: 'balanced_hybrid',
    });

    expect(tooLow.monthlyCalls).toBe(100_000);
    expect(tooLow.cacheHitRatePct).toBe(0);
    expect(tooHigh.monthlyCalls).toBe(20_000_000);
    expect(tooHigh.cacheHitRatePct).toBe(85);

    const low = computeMultiModelFinOpsMatrix({
      monthlyCalls: 100_000,
      cacheHitRatePct: 40,
      policy: 'cost_optimized',
    });
    const high = computeMultiModelFinOpsMatrix({
      monthlyCalls: 20_000_000,
      cacheHitRatePct: 40,
      policy: 'cost_optimized',
    });
    expect(high.monthlyCloudSpendUsd / low.monthlyCloudSpendUsd).toBeCloseTo(200, 1);
    expect(high.annualSavingsUsd).toBeCloseTo(high.monthlySavingsUsd * 12, 1);
  });

  it('computes Cost-vs-Quality Pareto frontier points including active routed policy', () => {
    const res = computeMultiModelFinOpsMatrix({
      monthlyCalls: 2_000_000,
      cacheHitRatePct: 45,
      policy: 'balanced_hybrid',
    });

    expect(res.paretoPoints).toHaveLength(5); // 4 models + 1 active mix
    expect(res.paretoPoints.some((p) => p.kind === 'active')).toBe(true);
    expect(res.paretoPoints.filter((p) => p.onFrontier).length).toBeGreaterThanOrEqual(2);
    // vLLM Qwen-72B is always lowest cost -> must sit on Pareto frontier
    expect(res.paretoPoints.find((p) => p.id === 'vllm-qwen-72b')?.onFrontier).toBe(true);
    // Claude 3.7 is highest quality -> must sit on Pareto frontier
    expect(res.paretoPoints.find((p) => p.id === 'claude-3.7-sonnet')?.onFrontier).toBe(true);
  });
});

describe('v3.0 OWASP LLM Top-10 Red-Team Adversarial Suite & Compliance Exports', () => {
  it('defines exactly 10 unique OWASP LLM Top-10 probes (LLM01..LLM10)', () => {
    expect(OWASP_LLM_TOP10_PROBES).toHaveLength(10);
    expect(OWASP_LLM_TOP10_PROBES.map((p) => p.id)).toEqual([
      'LLM01',
      'LLM02',
      'LLM03',
      'LLM04',
      'LLM05',
      'LLM06',
      'LLM07',
      'LLM08',
      'LLM09',
      'LLM10',
    ]);
  });

  it.each(OWASP_LLM_TOP10_PROBES)(
    'blocks adversarial probe $id ($name) with high confidence and measurable guardrail latency',
    (probe) => {
      const result = runOwaspProbe(probe);
      expect(result.status).toBe('BLOCKED');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0.91);
      expect(result.confidenceScore).toBeLessThanOrEqual(0.99);
      expect(result.guardrailLatencyMs).toBeGreaterThan(0);
      expect(result.triggeredRules.length).toBeGreaterThanOrEqual(1);
      expect(result.simulation.blast_radius.leaked_bytes).toBe(0);
    }
  );

  it('executes full 10-probe suite achieving 100% defense rate and Grade A+', () => {
    const report = runOwaspTop10Suite();
    expect(report.totalProbes).toBe(10);
    expect(report.blockedCount).toBe(10);
    expect(report.passedCount).toBe(0);
    expect(report.defenseRatePct).toBe(100);
    expect(report.complianceGrade).toBe('A+');
    expect(report.p95GuardrailLatencyMs).toBeGreaterThanOrEqual(report.avgGuardrailLatencyMs);
  });

  it('exports valid parseable JSON compliance audit report', () => {
    const report = runOwaspTop10Suite();
    const jsonStr = buildOwaspComplianceJson(report);
    const parsed = JSON.parse(jsonStr) as {
      schema_version: string;
      summary: { blocked_count: number; compliance_grade: string };
      probes: Array<{ probe_id: string; status: string }>;
    };

    expect(parsed.schema_version).toBe('verdict-graph.owasp-top10.v3');
    expect(parsed.summary.blocked_count).toBe(10);
    expect(parsed.summary.compliance_grade).toBe('A+');
    expect(parsed.probes).toHaveLength(10);
  });

  it('exports structured Markdown audit compliance table for all 10 probes', () => {
    const report = runOwaspTop10Suite();
    const md = buildOwaspComplianceMarkdown(report);
    expect(md).toContain('OWASP LLM TOP-10 RED-TEAM COMPLIANCE REPORT');
    expect(md).toContain('10/10 BLOCKED (100%)');
    expect(md).toContain('| LLM01 |');
    expect(md).toContain('| LLM10 |');
  });
});

describe('v3.0 Enterprise License Quote & Live MBBank VietQR Engine', () => {
  it('computes base 19.900.000 VND flagship quote with exact MBBank VietQR credentials', () => {
    const quote = computeEnterpriseQuote([]);
    expect(quote.baseLicenseVnd).toBe(BASE_LICENSE_VND);
    expect(quote.totalVnd).toBe(19_900_000);
    expect(quote.formattedTotalVnd).toBe('19.900.000 VND');
    expect(quote.bankBin).toBe(MBBANK_BIN);
    expect(quote.accountNumber).toBe(MBBANK_ACCOUNT);
    expect(quote.accountHolder).toBe(MBBANK_HOLDER);
    expect(quote.vietQrUrl).toContain(
      'https://img.vietqr.io/image/970422-0325456574-compact2.png?amount=19900000'
    );
    expect(quote.vietQrUrl).toContain('accountName=TRUONG%20VAN%20TINH');
  });

  it('recalculates total VND and VietQR URL dynamically when enterprise add-ons are toggled', () => {
    const allIds = ENTERPRISE_ADDONS.map((a) => a.id);
    const quote = computeEnterpriseQuote(allIds, 'Acme Fintech Corp');
    const expectedTotal = 19_900_000 + 4_500_000 + 3_000_000 + 2_500_000;
    expect(quote.totalVnd).toBe(expectedTotal);
    expect(quote.formattedTotalVnd).toBe(formatVnd(expectedTotal));
    expect(quote.vietQrUrl).toContain(`amount=${expectedTotal}`);
    expect(quote.transferReference).toContain('ACMEFINTECHC');
  });

  it('sanitizes transfer references strictly against special/XSS characters', () => {
    expect(sanitizeTransferReference('<script>alert(1)</script> VG3!')).toBe(
      'SCRIPTALERT1SCRIPT VG3'
    );
    expect(sanitizeTransferReference('   !!!@@@   ')).toBe('VERDICTGRAPH V3 ENT');
  });

  it('enforces minimum flagship amount floor in buildVietQrUrl', () => {
    const url = buildVietQrUrl(500, 'TEST REF');
    expect(url).toContain('amount=19900000');
    expect(url).toContain('addInfo=TEST%20REF');
  });

  it('generates formal Markdown commercial quote containing bank settlement details', () => {
    const quote = computeEnterpriseQuote(['onprem_vllm'], 'Saigon FinTech');
    const md = buildEnterpriseQuoteMarkdown(quote);
    expect(md).toContain('VERDICT GRAPH v3.0 ENTERPRISE SUPER VIP PRO');
    expect(md).toContain('24.400.000 VND');
    expect(md).toContain('0325456574');
    expect(md).toContain('TRUONG VAN TINH');
    expect(md).toContain('https://img.vietqr.io/image/970422-0325456574-compact2.png');
  });

  it('returns deterministic report & quote download filenames cleanly in headless Node', () => {
    const suite = runOwaspTop10Suite();
    expect(triggerOwaspReportDownload(suite, 'json')).toMatch(/\.json$/);
    expect(triggerOwaspReportDownload(suite, 'markdown')).toMatch(/\.md$/);

    const quote = computeEnterpriseQuote([]);
    expect(triggerEnterpriseQuoteDownload(quote)).toMatch(/^verdict-graph-v3-quote-.*\.md$/);
  });
});

describe('v3.0 Additional Edge-Case & Bilingual Integrity Guards', () => {
  it('derives POLICY QUARANTINE LOOP feedback edge when Guardrail exists without Critic', () => {
    const lowLat = createDefaultWorkflow('low_latency_vllm');
    const edges = deriveWorkflowEdges(lowLat);
    const fb = edges.filter((e) => e.kind === 'feedback');
    expect(fb).toHaveLength(1);
    expect(fb[0].label).toBe('POLICY QUARANTINE LOOP');
  });

  it('flags SQL-UNPROTECTED when SQL Sandbox runs without Guardrail or HITL Gate', () => {
    const nodes = createDefaultWorkflow('low_latency_vllm').filter(
      (n) => n.role !== 'policy_guardrail'
    );
    const withSql = addWorkflowNode(nodes, 'sql_sandbox', 'unknown-id-fallback');
    expect(withSql[withSql.length - 1].role).toBe('sql_sandbox');
    const issues = validateWorkflowDag(withSql);
    expect(issues.some((i) => i.code === 'SQL-UNPROTECTED')).toBe(true);
  });

  it('simulates a single-node DAG with zero edges and finite telemetry', () => {
    const single = [createDefaultWorkflow('low_latency_vllm')[0]];
    const trace = simulateWorkflowTrace(single, 'Quick triage check');
    expect(trace.edges).toHaveLength(0);
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0].edgeId).toBeNull();
    expect(trace.totalLatencyMs).toBeGreaterThan(0);
  });

  it('scales Multi-Model FinOps spend accurately with custom token budgets and sums traffic shares', () => {
    const base = computeMultiModelFinOpsMatrix({
      monthlyCalls: 1_000_000,
      cacheHitRatePct: 20,
      policy: 'balanced_hybrid',
      avgInputTokens: 1000,
      avgOutputTokens: 200,
    });
    const doubleTokens = computeMultiModelFinOpsMatrix({
      monthlyCalls: 1_000_000,
      cacheHitRatePct: 20,
      policy: 'balanced_hybrid',
      avgInputTokens: 2000,
      avgOutputTokens: 400,
    });

    expect(doubleTokens.monthlyCloudSpendUsd / base.monthlyCloudSpendUsd).toBeCloseTo(2.0, 2);
    const totalCallsAllocated = base.allocations.reduce((s, r) => s + r.monthlyCalls, 0);
    expect(totalCallsAllocated).toBe(1_000_000);
  });

  it('maintains 100% key parity across EN and VI translations with zero empty strings', () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const viKeys = Object.keys(TRANSLATIONS.vi).sort();
    expect(enKeys).toEqual(viKeys);
    for (const key of enKeys) {
      const k = key as keyof typeof TRANSLATIONS.en;
      expect(TRANSLATIONS.en[k].trim().length).toBeGreaterThan(0);
      expect(TRANSLATIONS.vi[k].trim().length).toBeGreaterThan(0);
    }
  });

  it('confirms zero emojis exist in EN and VI translation catalogs', () => {
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const locale of ['en', 'vi'] as const) {
      for (const value of Object.values(TRANSLATIONS[locale])) {
        expect(emojiPattern.test(value)).toBe(false);
      }
    }
  });
});
