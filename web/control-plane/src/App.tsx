import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, ChevronRight } from 'lucide-react';
import type {
  ControlPlaneRun,
  HitlAction,
  Locale,
  NodeId,
  RuntimeMode,
  ScenarioId,
  SpeedMode,
  WireTab,
} from './types/protocol';
import { TRANSLATIONS } from './i18n/translations';
import { GRAPH_NODES } from './engine/scenarios';
import {
  applyHitlDecision,
  createInitialRun,
  forkAndReplayFromCheckpoint,
  getLatestNodeCheckpoint,
  runUntilPauseOrComplete,
  stepRun,
} from './engine/protocolEngine';
import {
  type ByokConfig,
  DEFAULT_PYTHON_CLUSTER_URL,
  probePythonCluster,
  syncRunToPythonCluster,
  synthesizeWithByok,
} from './engine/remoteBridge';
import type { RedTeamSimulationResult } from './engine/redTeamClassifier';
import {
  type MultiModelRoutingPolicy,
  computeFinOpsSimulation,
  computeMultiModelFinOpsMatrix,
  extractBranchFinOpsMetrics,
} from './engine/finopsSimulator';
import {
  buildSignedAuditBundle,
  triggerAuditBundleDownload,
} from './engine/auditExport';
import { TopBar } from './components/TopBar';
import { ScenarioDock } from './components/ScenarioDock';
import { ExecutionGraph } from './components/ExecutionGraph';
import { HitlBanner } from './components/HitlBanner';
import { VerdictOutputPanel } from './components/VerdictOutputPanel';
import { WorkflowDagBuilder } from './components/WorkflowDagBuilder';
import { TimeTravelPanel } from './components/TimeTravelPanel';
import { WireInspector } from './components/WireInspector';
import { NodeInspectorModal } from './components/NodeInspectorModal';
import { CommandPalette } from './components/CommandPalette';
import { RedTeamSandbox } from './components/RedTeamSandbox';
import { FinOpsSimulatorPanel } from './components/FinOpsSimulatorPanel';
import { EnterpriseLicenseModal } from './components/EnterpriseLicenseModal';

const SPEED_DELAY_MS: Record<SpeedMode, number> = {
  '0.5x': 1250,
  '1x': 720,
  '2x': 360,
  instant: 40,
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable
  );
}

const MODULE_LINKS: Array<{ id: string; code: string; labelEn: string; labelVi: string }> = [
  { id: 'execution-graph-deck', code: '01', labelEn: 'Execution Graph', labelVi: 'Đồ Thị Thực Thi' },
  { id: 'workflow-dag-builder', code: '02', labelEn: 'DAG Builder', labelVi: 'Thiết Kế DAG' },
  { id: 'red-team-deck', code: '03', labelEn: 'OWASP Top-10', labelVi: 'Red-Team OWASP' },
  { id: 'finops-deck', code: '04', labelEn: 'FinOps Pareto', labelVi: 'FinOps Pareto' },
  { id: 'time-travel-deck', code: '05', labelEn: 'Time-Travel Diff', labelVi: 'So Sánh Fork' },
  { id: 'wire-inspector-deck', code: '06', labelEn: 'Protocol Wire', labelVi: 'Gói Tin OTel' },
];

export function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [speed, setSpeed] = useState<SpeedMode>('1x');
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('browser');
  const [clusterOnline, setClusterOnline] = useState<boolean>(false);
  const [byokConfig, setByokConfig] = useState<ByokConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
  });
  const [byokVerdictOverride, setByokVerdictOverride] = useState<string | null>(null);

  // Boot directly into Scenario A paused cleanly at HITL Gate so visitors immediately see rich photonic telemetry
  const [run, setRun] = useState<ControlPlaneRun>(() =>
    runUntilPauseOrComplete(createInitialRun('outage_rollback'))
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [wireTab, setWireTab] = useState<WireTab>('mcp');
  const [cmdOpen, setCmdOpen] = useState<boolean>(false);
  const [licenseOpen, setLicenseOpen] = useState<boolean>(false);
  const [presetTriggerCount, setPresetTriggerCount] = useState<number>(0);

  // v3.0 Enterprise states: Red-Team Overlay, Multi-Model FinOps Matrix, Audit Export confirmation
  const [redTeamResult, setRedTeamResult] = useState<RedTeamSimulationResult | null>(null);
  const [monthlyCalls, setMonthlyCalls] = useState<number>(2_000_000);
  const [cacheHitRatePct, setCacheHitRatePct] = useState<number>(45);
  const [routerPolicy, setRouterPolicy] = useState<MultiModelRoutingPolicy>('balanced_hybrid');
  const [auditExportedRecently, setAuditExportedRecently] = useState<boolean>(false);

  const t = TRANSLATIONS[locale];
  const activeBranch = run.branches[run.active_branch_id];

  const reprobeCluster = useCallback(() => {
    probePythonCluster(DEFAULT_PYTHON_CLUSTER_URL).then((health) => {
      setClusterOnline(health.online);
      if (health.online) {
        setRuntimeMode('python');
      }
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (prev) return false;
      if (run.status === 'paused_hitl' || run.pending_steps.length === 0) return false;
      return true;
    });
  }, [run.pending_steps.length, run.status]);

  const handleStep = useCallback(() => {
    setIsPlaying(false);
    setRun((prev) => stepRun(prev));
  }, []);

  const handleRunInstant = useCallback(() => {
    setIsPlaying(false);
    setRun((prev) => runUntilPauseOrComplete(prev));
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    setSelectedNodeId(null);
    setSelectedCheckpointId(null);
    setByokVerdictOverride(null);
    setRedTeamResult(null);
    setRun((prev) => createInitialRun(prev.scenario_id));
  }, []);

  // Global keyboard shortcuts: Cmd/Ctrl+K, Escape, Space (Play/Pause), N (Step), R (Reset)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setCmdOpen(false);
        setLicenseOpen(false);
        return;
      }
      if (
        cmdOpen ||
        licenseOpen ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        isEditableTarget(e.target)
      ) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleStep();
      } else if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReset();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cmdOpen, licenseOpen, handleReset, handleStep, handleTogglePlay]);

  // Auto-play timer loop
  useEffect(() => {
    if (!isPlaying) return;
    if (run.status === 'paused_hitl' || run.pending_steps.length === 0) {
      setIsPlaying(false);
      return;
    }

    const delay = SPEED_DELAY_MS[speed];
    const timer = window.setTimeout(() => {
      setRun((prev) => {
        const stepped = speed === 'instant' ? runUntilPauseOrComplete(prev) : stepRun(prev);
        if (stepped.status === 'paused_hitl' || stepped.pending_steps.length === 0) {
          setIsPlaying(false);
        }
        return stepped;
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [isPlaying, run.pending_steps.length, run.status, speed]);

  // Optional BYOK synthesis hook
  useEffect(() => {
    if (runtimeMode !== 'byok' || !byokConfig.apiKey.trim()) {
      setByokVerdictOverride(null);
      return;
    }
    if (run.status !== 'completed') return;
    const summaryPrompt = `Scenario: ${run.scenario_id}. Summarize verified verdict cleanly in 2 sentences based on state: ${JSON.stringify(
      activeBranch.checkpoints[activeBranch.checkpoints.length - 1]?.state_snapshot ?? {}
    )}`;
    synthesizeWithByok(byokConfig, summaryPrompt).then((res) => {
      if (res.ok && res.text) {
        setByokVerdictOverride(`[BYOK ${byokConfig.provider.toUpperCase()}] ${res.text}`);
      }
    });
  }, [activeBranch.checkpoints, byokConfig, run.run_id, run.scenario_id, run.status, runtimeMode]);

  const applyThemeClass = (nextTheme: 'dark' | 'light') => {
    const root = document.documentElement;
    if (nextTheme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    setTheme(nextTheme);
  };

  const handleToggleTheme = (ev?: React.MouseEvent<HTMLButtonElement>) => {
    const nextTheme: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    const doc = document as Document & {
      startViewTransition?: (cb: () => void) => void;
    };
    if (doc.startViewTransition && ev) {
      doc.startViewTransition(() => applyThemeClass(nextTheme));
    } else {
      applyThemeClass(nextTheme);
    }
  };

  const handleSelectScenario = useCallback(
    (scenarioId: ScenarioId, autoPlay = true) => {
      setByokVerdictOverride(null);
      setSelectedNodeId(null);
      setSelectedCheckpointId(null);
      setRedTeamResult(null);
      const fresh = createInitialRun(scenarioId);

      if (scenarioId === 'a2a_financial_audit') setWireTab('a2a');
      else if (scenarioId === 'prompt_injection') setWireTab('agui');
      else if (scenarioId === 'hallucination_fork') setWireTab('otel');
      else setWireTab('mcp');

      if (runtimeMode === 'python' && clusterOnline) {
        void syncRunToPythonCluster(DEFAULT_PYTHON_CLUSTER_URL, scenarioId);
      }

      if (autoPlay && speed === 'instant') {
        setRun(runUntilPauseOrComplete(fresh));
        setIsPlaying(false);
      } else if (autoPlay) {
        setRun(stepRun(fresh));
        setIsPlaying(true);
      } else {
        setRun(fresh);
        setIsPlaying(false);
      }
    },
    [clusterOnline, runtimeMode, speed]
  );

  const handleHitlDecide = (action: HitlAction, canaryPercent: number) => {
    setIsPlaying(false);
    setRun((prev) => applyHitlDecision(prev, action, canaryPercent));
  };

  const handleForkAndReplay = (checkpointId: string, overrides: Record<string, unknown>) => {
    setIsPlaying(false);
    setRun((prev) => {
      const { run: forkedRun } = forkAndReplayFromCheckpoint(prev, checkpointId, overrides);
      return forkedRun;
    });
  };

  const handleLaunchScenarioDFork = useCallback(() => {
    setIsPlaying(false);
    setRedTeamResult(null);
    setSelectedNodeId(null);
    const completedMain = runUntilPauseOrComplete(createInitialRun('hallucination_fork'));
    const { run: forkedRun } = forkAndReplayFromCheckpoint(completedMain, 'CP-02', {
      top_k: 8,
      rerank: true,
      strict_grounding: true,
      model: 'gemini-2.5-pro',
      prompt_override: 'Strict grounding mode: cite verified SPEC-2026 & BENCH-2026 chunks.',
    });
    setWireTab('otel');
    setRun(forkedRun);
  }, []);

  const handleSelectBranch = (branchId: string) => {
    setRun((prev) => {
      if (!prev.branches[branchId]) return prev;
      return { ...prev, active_branch_id: branchId };
    });
  };

  const finopsSimulation = useMemo(() => {
    const extracted = extractBranchFinOpsMetrics(run);
    return computeFinOpsSimulation({
      routingPolicy: routerPolicy === 'quality_first' ? 'frontier_only' : 'tiered_cascade',
      monthlyRuns: Math.min(5_000_000, monthlyCalls),
      mainBranch: extracted.mainBranch,
      forkBranch: extracted.forkBranch,
      sourceMode: extracted.sourceMode,
    });
  }, [monthlyCalls, routerPolicy, run]);

  const multiModelMatrix = useMemo(
    () =>
      computeMultiModelFinOpsMatrix({
        monthlyCalls,
        cacheHitRatePct,
        policy: routerPolicy,
      }),
    [cacheHitRatePct, monthlyCalls, routerPolicy]
  );

  const handleExportAuditBundle = useCallback(() => {
    const bundle = buildSignedAuditBundle(run, {
      redTeamResult,
      finopsResult: finopsSimulation,
    });
    triggerAuditBundleDownload(bundle);
    setAuditExportedRecently(true);
    window.setTimeout(() => setAuditExportedRecently(false), 2000);
  }, [finopsSimulation, redTeamResult, run]);

  const handleJumpToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const selectedNodeMeta = useMemo(
    () => (selectedNodeId ? GRAPH_NODES.find((n) => n.id === selectedNodeId) ?? null : null),
    [selectedNodeId]
  );

  const selectedNodeCheckpoint = useMemo(
    () => (selectedNodeId ? getLatestNodeCheckpoint(run, selectedNodeId) : null),
    [run, selectedNodeId]
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--vg-bg)] text-[var(--vg-text)]">
      <TopBar
        t={t}
        locale={locale}
        onToggleLocale={() => setLocale((l) => (l === 'en' ? 'vi' : 'en'))}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        speed={speed}
        onChangeSpeed={setSpeed}
        runtimeMode={runtimeMode}
        clusterOnline={clusterOnline}
        onOpenCommandPalette={() => setCmdOpen(true)}
        onExportAuditBundle={handleExportAuditBundle}
        auditExportedRecently={auditExportedRecently}
        onOpenLicenseModal={() => setLicenseOpen(true)}
        branch={activeBranch}
        activeBranchId={run.active_branch_id}
      />

      {/* v3.0 Enterprise Quick-Jump Module Ribbon */}
      <nav
        aria-label="Control Plane Modules"
        className="border-b border-[var(--vg-border)] bg-[var(--vg-surface)]/80 px-3.5 py-1.5"
      >
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {MODULE_LINKS.map((mod) => (
              <button
                key={mod.id}
                type="button"
                onClick={() => handleJumpToSection(mod.id)}
                className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-0.5 font-mono text-[9.5px] font-medium text-[var(--vg-text-muted)] transition-colors hover:border-sky-400/50 hover:text-sky-400"
              >
                <span className="font-bold text-sky-400">{mod.code}</span>
                <span>{locale === 'vi' ? mod.labelVi : mod.labelEn}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setLicenseOpen(true)}
            className="hidden items-center gap-1 font-mono text-[9.5px] font-semibold text-emerald-400 transition-colors hover:underline lg:flex"
          >
            <Award className="h-3 w-3" />
            <span>TVT STUDIO FLAGSHIP #3 · 19.900.000 VND COMMERCIAL LICENSE</span>
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </nav>

      {/* Main Responsive Mission Control Grid */}
      <main className="mx-auto grid w-full max-w-[1720px] flex-1 grid-cols-1 gap-3.5 p-3.5 lg:grid-cols-12">
        {/* Left Rail: Scenarios, Transport, Runtime */}
        <div className="lg:col-span-3 xl:col-span-3">
          <ScenarioDock
            t={t}
            locale={locale}
            run={run}
            isPlaying={isPlaying}
            onSelectScenario={handleSelectScenario}
            onTogglePlay={handleTogglePlay}
            onStep={handleStep}
            onRunInstant={handleRunInstant}
            onReset={handleReset}
            runtimeMode={runtimeMode}
            onChangeRuntimeMode={setRuntimeMode}
            clusterOnline={clusterOnline}
            onReprobeCluster={reprobeCluster}
            byokConfig={byokConfig}
            onChangeByokConfig={setByokConfig}
          />
        </div>

        {/* Right Primary Cockpit */}
        <div className="flex flex-col gap-3.5 lg:col-span-9 xl:col-span-9">
          {/* 01: Interactive Photonic Cyclic Multi-Agent Execution Graph */}
          <div id="execution-graph-deck">
            <ExecutionGraph
              t={t}
              run={run}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId((cur) => (cur === id ? null : id))}
              redTeamOverlay={redTeamResult}
              onClearRedTeamOverlay={() => setRedTeamResult(null)}
            />
          </div>

          {/* Clicked Node State, Token & Protocol Contract Inspector */}
          {selectedNodeMeta && (
            <NodeInspectorModal
              t={t}
              run={run}
              node={selectedNodeMeta}
              checkpoint={selectedNodeCheckpoint}
              onSelectNode={(id) => setSelectedNodeId(id)}
              onClose={() => setSelectedNodeId(null)}
            />
          )}

          {/* Contextual HITL Approval Interrupt Gate */}
          {run.status === 'paused_hitl' && run.hitl_context && (
            <HitlBanner t={t} context={run.hitl_context} onDecide={handleHitlDecide} />
          )}

          {/* Grounded Synthesizer Verdict & AG-UI Generative Widget */}
          <VerdictOutputPanel
            t={t}
            branch={activeBranch}
            scenarioId={run.scenario_id}
            hasForks={Object.keys(run.branches).length > 1}
            onQuickLoadForkPreset={() => setPresetTriggerCount((c) => c + 1)}
            byokVerdictOverride={byokVerdictOverride}
          />

          {/* 02: v3.0 Custom Multi-Agent Workflow DAG Builder & Node Inspector */}
          <WorkflowDagBuilder t={t} locale={locale} />

          {/* 03 & 04: v3.0 Security OWASP Top-10 Suite + Multi-Model FinOps Pareto Router Matrix */}
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <RedTeamSandbox
                t={t}
                locale={locale}
                activeResult={redTeamResult}
                onSimulateAttack={(res) => setRedTeamResult(res)}
                onClearOverlay={() => setRedTeamResult(null)}
              />
            </div>
            <div className="xl:col-span-6">
              <FinOpsSimulatorPanel
                t={t}
                monthlyCalls={monthlyCalls}
                onChangeMonthlyCalls={setMonthlyCalls}
                cacheHitRatePct={cacheHitRatePct}
                onChangeCacheHitRatePct={setCacheHitRatePct}
                routerPolicy={routerPolicy}
                onChangeRouterPolicy={setRouterPolicy}
                matrix={multiModelMatrix}
                branchSimulation={finopsSimulation}
                onLaunchScenarioDFork={handleLaunchScenarioDFork}
                onExportAuditBundle={handleExportAuditBundle}
                auditExportedRecently={auditExportedRecently}
              />
            </div>
          </div>

          {/* 05 & 06: Time-Travel Checkpoint Forking & State Diff + 3-Protocol Wire & OTel Waterfall */}
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <TimeTravelPanel
                t={t}
                run={run}
                selectedCheckpointId={selectedCheckpointId}
                onSelectCheckpoint={setSelectedCheckpointId}
                onSelectBranch={handleSelectBranch}
                onForkAndReplay={handleForkAndReplay}
                presetTriggerCount={presetTriggerCount}
              />
            </div>
            <div id="wire-inspector-deck" className="xl:col-span-6">
              <WireInspector
                t={t}
                run={run}
                activeTab={wireTab}
                onChangeTab={setWireTab}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Footer Strip */}
      <footer className="border-t border-[var(--vg-border)] bg-[var(--vg-panel)] px-4 py-2 font-mono text-[10px] text-[var(--vg-text-dim)]">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-2">
          <span>
            VERDICT GRAPH v3.0 ENTERPRISE SUPER VIP PRO // ENGINEERED BY TRUONG VAN TINH (GITHUB.COM/TVT987)
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <span>
              PROTOCOLS: MCP JSON-RPC 2.0 · A2A v0.2.2 · AG-UI SSE (RFC 6902) · OPENTELEMETRY OTLP
            </span>
            <button
              type="button"
              onClick={() => setLicenseOpen(true)}
              className="font-semibold text-emerald-400 hover:underline"
            >
              Enterprise License (19.9M VND)
            </button>
          </div>
        </div>
      </footer>

      {/* CMD+K Quick Command Palette */}
      <CommandPalette
        open={cmdOpen}
        t={t}
        onClose={() => setCmdOpen(false)}
        onSelectScenario={(id) => handleSelectScenario(id, true)}
        onSelectWireTab={setWireTab}
        onToggleTheme={() => handleToggleTheme()}
        onToggleLocale={() => setLocale((l) => (l === 'en' ? 'vi' : 'en'))}
        onTogglePlay={handleTogglePlay}
        onStep={handleStep}
        onRunInstant={handleRunInstant}
        onReset={handleReset}
        onExportAuditBundle={handleExportAuditBundle}
        onOpenLicenseModal={() => setLicenseOpen(true)}
        onJumpToSection={handleJumpToSection}
      />

      {/* Enterprise License Quote & Live MBBank VietQR Modal */}
      <EnterpriseLicenseModal
        open={licenseOpen}
        t={t}
        locale={locale}
        onClose={() => setLicenseOpen(false)}
      />
    </div>
  );
}

export default App;
