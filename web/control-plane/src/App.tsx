import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  DollarSign,
  Download,
  Gauge,
  GitFork,
  ShieldCheck,
} from 'lucide-react';
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
import { TopBar, type WorkspaceTab } from './components/TopBar';
import { ScenarioDock } from './components/ScenarioDock';
import { ExecutionGraph } from './components/ExecutionGraph';
import { HitlBanner } from './components/HitlBanner';
import { VerdictOutputPanel } from './components/VerdictOutputPanel';
import { NodeInspectorModal } from './components/NodeInspectorModal';

// Code-split heavy interactive workspaces & modals via React.lazy so entry bundle stays lean (<95 kB)
const ModelRoutingArena = lazy(() => import('./components/ModelRoutingArena'));
const PromptFirewallLab = lazy(() => import('./components/PromptFirewallLab'));
const DagWaterfallReplay = lazy(() => import('./components/DagWaterfallReplay'));
const WorkflowDagBuilder = lazy(() => import('./components/WorkflowDagBuilder'));
const RedTeamSandbox = lazy(() => import('./components/RedTeamSandbox'));
const FinOpsSimulatorPanel = lazy(() => import('./components/FinOpsSimulatorPanel'));
const TimeTravelPanel = lazy(() => import('./components/TimeTravelPanel'));
const WireInspector = lazy(() => import('./components/WireInspector'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const EnterpriseLicenseModal = lazy(() => import('./components/EnterpriseLicenseModal'));

const SPEED_OPTIONS: SpeedMode[] = ['0.5x', '1x', '2x', 'instant'];

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

const PanelFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="vg-panel flex min-h-[180px] items-center justify-center rounded-xl px-5 py-8 font-mono text-xs text-[var(--vg-text-dim)]">
    <span>LOADING WORKSPACE // {label}...</span>
  </div>
);

export function App() {
  const [locale, setLocale] = useState<Locale>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceTab>('orchestrator');
  const [speed, setSpeed] = useState<SpeedMode>('1x');
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('browser');
  const [clusterOnline, setClusterOnline] = useState<boolean>(false);
  const [byokConfig, setByokConfig] = useState<ByokConfig>({
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-2.5-flash',
  });
  const [byokVerdictOverride, setByokVerdictOverride] = useState<string | null>(null);

  // Boot directly into Scenario A paused cleanly at HITL Gate so visitors immediately inspect live photonic telemetry
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
  const [showLegacyFinOps, setShowLegacyFinOps] = useState<boolean>(false);

  // Enterprise states: Red-Team Overlay, Branch FinOps Matrix, Audit Export confirmation
  const [redTeamResult, setRedTeamResult] = useState<RedTeamSimulationResult | null>(null);
  const [monthlyCalls, setMonthlyCalls] = useState<number>(2_000_000);
  const [cacheHitRatePct, setCacheHitRatePct] = useState<number>(45);
  const [routerPolicy, setRouterPolicy] = useState<MultiModelRoutingPolicy>('balanced_hybrid');
  const [auditExportedRecently, setAuditExportedRecently] = useState<boolean>(false);

  const t = TRANSLATIONS[locale];
  const activeBranch = run.branches[run.active_branch_id];
  const totalTokens = activeBranch.total_input_tokens + activeBranch.total_output_tokens;
  const groundednessDisplay =
    activeBranch.groundedness > 0 ? activeBranch.groundedness.toFixed(2) : '--';

  // Ensure initial DOM theme class matches state
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
  }, [theme]);

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
      {/* Decluttered Single-Row Studio Header with 4 Segmented Workspace Tabs */}
      <TopBar
        t={t}
        locale={locale}
        onToggleLocale={() => setLocale((l) => (l === 'en' ? 'vi' : 'en'))}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        onOpenCommandPalette={() => setCmdOpen(true)}
        onExportAuditBundle={handleExportAuditBundle}
        auditExportedRecently={auditExportedRecently}
      />

      {/* Breathable Studio Workspace Container */}
      <main className="mx-auto w-full max-w-[1520px] flex-1 px-4 py-5 sm:px-6 sm:py-6">
        {/* WORKSPACE 1: ORCHESTRATOR DAG */}
        {activeWorkspace === 'orchestrator' && (
          <div className="flex flex-col gap-6" data-testid="workspace-orchestrator">
            {/* Airy Run Telemetry & Speed Control Strip */}
            <section className="vg-panel flex flex-wrap items-center justify-between gap-4 rounded-xl px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-[var(--vg-accent)]">
                    BRANCH: {run.active_branch_id.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <DollarSign className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                  <span className="text-[var(--vg-text-dim)]">{t.finopsCost}</span>
                  <span
                    className="font-bold text-[var(--vg-text)]"
                    data-testid="ticker-cost"
                  >
                    ${activeBranch.total_cost_usd.toFixed(4)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Cpu className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                  <span className="text-[var(--vg-text-dim)]">{t.finopsTokens}</span>
                  <span
                    className="font-bold text-[var(--vg-text)]"
                    data-testid="ticker-tokens"
                  >
                    {totalTokens.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <Activity className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                  <span className="text-[var(--vg-text-dim)]">{t.finopsLatency}</span>
                  <span className="font-bold text-[var(--vg-text)]">
                    {activeBranch.total_latency_ms.toFixed(0)}ms
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-[var(--vg-text-dim)]">{t.finopsGroundedness}</span>
                  <span
                    className="font-bold text-emerald-700 dark:text-emerald-400"
                    data-testid="ticker-groundedness"
                  >
                    {groundednessDisplay}
                  </span>
                </div>
              </div>

              {/* Speed Selector */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5">
                  <Gauge className="mx-1.5 h-3.5 w-3.5 text-[var(--vg-text-dim)]" />
                  {SPEED_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setSpeed(opt)}
                      className={`rounded-md px-2 py-1 font-mono text-[10.5px] font-semibold transition-colors ${
                        speed === opt
                          ? 'bg-[var(--vg-panel)] text-[var(--vg-accent)] shadow-xs'
                          : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                      }`}
                    >
                      {opt === 'instant' ? 'MAX' : opt}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Primary Hero 12-Col Cockpit */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Rail: Enterprise Playbooks & Transport */}
              <div className="lg:col-span-3">
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

              {/* Right Hero Canvas & Contextual Gates */}
              <div className="flex flex-col gap-5 lg:col-span-9">
                <div id="execution-graph-deck">
                  <ExecutionGraph
                    t={t}
                    theme={theme}
                    run={run}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={(id) => setSelectedNodeId((cur) => (cur === id ? null : id))}
                    redTeamOverlay={redTeamResult}
                    onClearRedTeamOverlay={() => setRedTeamResult(null)}
                  />
                </div>

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

                {run.status === 'paused_hitl' && run.hitl_context && (
                  <HitlBanner t={t} context={run.hitl_context} onDecide={handleHitlDecide} />
                )}

                <VerdictOutputPanel
                  t={t}
                  branch={activeBranch}
                  scenarioId={run.scenario_id}
                  hasForks={Object.keys(run.branches).length > 1}
                  onQuickLoadForkPreset={() => {
                    setPresetTriggerCount((c) => c + 1);
                    setActiveWorkspace('audit');
                  }}
                  byokVerdictOverride={byokVerdictOverride}
                />
              </div>
            </div>

            {/* Secondary Orchestrator Engineering Deck: Waterfall Replay + Custom DAG Builder */}
            <div className="flex flex-col gap-6">
              <Suspense fallback={<PanelFallback label="DAG P95 & USD WATERFALL REPLAY" />}>
                <DagWaterfallReplay t={t} run={run} />
              </Suspense>

              <Suspense fallback={<PanelFallback label="CUSTOM 7-ROLE DAG BUILDER" />}>
                <WorkflowDagBuilder t={t} locale={locale} />
              </Suspense>
            </div>
          </div>
        )}

        {/* WORKSPACE 2: OWASP FIREWALL & BUDGET CIRCUIT BREAKER */}
        {activeWorkspace === 'firewall' && (
          <div className="flex flex-col gap-6" data-testid="workspace-firewall">
            <Suspense fallback={<PanelFallback label="OWASP PROMPT FIREWALL & CIRCUIT BREAKER" />}>
              <PromptFirewallLab t={t} locale={locale} />
            </Suspense>

            <Suspense fallback={<PanelFallback label="OWASP LLM TOP-10 RED-TEAM SUITE" />}>
              <RedTeamSandbox
                t={t}
                locale={locale}
                activeResult={redTeamResult}
                onSimulateAttack={(res) => setRedTeamResult(res)}
                onClearOverlay={() => setRedTeamResult(null)}
              />
            </Suspense>
          </div>
        )}

        {/* WORKSPACE 3: NEW FLAGSHIP MULTI-MODEL FINOPS ROUTING & PARETO FRONTIER ARENA */}
        {activeWorkspace === 'routing' && (
          <div className="flex flex-col gap-6" data-testid="workspace-routing">
            <Suspense fallback={<PanelFallback label="MULTI-MODEL PARETO ROUTING ARENA" />}>
              <ModelRoutingArena t={t} locale={locale} theme={theme} />
            </Suspense>

            {/* Collapsible Branch A/B Time-Travel FinOps Comparator */}
            <div className="vg-panel overflow-hidden rounded-xl">
              <button
                type="button"
                onClick={() => setShowLegacyFinOps((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-[var(--vg-surface-hover)]"
              >
                <div>
                  <p className="font-display text-sm font-bold text-[var(--vg-text)]">
                    Time-Travel Branch A/B FinOps Matrix &amp; Legacy 4-Model Router
                  </p>
                  <p className="text-xs text-[var(--vg-text-muted)]">
                    Compare live Scenario D Time-Travel Fork groundedness lift and tiered cascade economics.
                  </p>
                </div>
                {showLegacyFinOps ? (
                  <ChevronUp className="h-4 w-4 text-[var(--vg-text-muted)]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[var(--vg-text-muted)]" />
                )}
              </button>

              {showLegacyFinOps && (
                <div className="border-t border-[var(--vg-border)] p-4">
                  <Suspense fallback={<PanelFallback label="BRANCH FINOPS SIMULATOR" />}>
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
                      onLaunchScenarioDFork={() => {
                        handleLaunchScenarioDFork();
                        setActiveWorkspace('audit');
                      }}
                      onExportAuditBundle={handleExportAuditBundle}
                      auditExportedRecently={auditExportedRecently}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        )}

        {/* WORKSPACE 4: AUDIT, TIME-TRAVEL FORK DIFF & OTLP PROTOCOL WIRE */}
        {activeWorkspace === 'audit' && (
          <div className="flex flex-col gap-6" data-testid="workspace-audit">
            {/* Audit Action Header */}
            <section className="vg-panel flex flex-wrap items-center justify-between gap-4 rounded-xl px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold tracking-tight text-[var(--vg-text)]">
                  Audit Trail, Time-Travel Fork Diff &amp; 3-Protocol Wire Telemetry
                </h2>
                <p className="mt-0.5 text-xs text-[var(--vg-text-muted)]">
                  Inspect immutable checkpoints, replay alternate models from CP-02, audit MCP/A2A/AG-UI frames, and export signed OTLP bundles.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleLaunchScenarioDFork}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--vg-accent)] transition-colors hover:opacity-90"
                >
                  <GitFork className="h-3.5 w-3.5" />
                  <span>{t.finopsLaunchForkBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAuditBundle}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-3 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
                >
                  {auditExportedRecently ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>{t.exportAuditSaved}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      <span>Export Signed OTLP Bundle</span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Spacious 12-Col Split: Time-Travel Diff + Wire Inspector */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-6">
                <Suspense fallback={<PanelFallback label="TIME-TRAVEL DIFF PANEL" />}>
                  <TimeTravelPanel
                    t={t}
                    run={run}
                    selectedCheckpointId={selectedCheckpointId}
                    onSelectCheckpoint={setSelectedCheckpointId}
                    onSelectBranch={handleSelectBranch}
                    onForkAndReplay={handleForkAndReplay}
                    presetTriggerCount={presetTriggerCount}
                  />
                </Suspense>
              </div>
              <div id="wire-inspector-deck" className="xl:col-span-6">
                <Suspense fallback={<PanelFallback label="3-PROTOCOL WIRE INSPECTOR" />}>
                  <WireInspector
                    t={t}
                    run={run}
                    activeTab={wireTab}
                    onChangeTab={setWireTab}
                  />
                </Suspense>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Clean Minimal Studio Footer */}
      <footer className="border-t border-[var(--vg-border)] bg-[var(--vg-panel)] px-4 py-3 font-mono text-[11px] text-[var(--vg-text-dim)] sm:px-6">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-2">
          <span>
            VERDICT GRAPH v5.0 // MULTI-AGENT CONTROL PLANE BY TRUONG VAN TINH (GITHUB.COM/TVT987)
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="hidden md:inline">
              PYTHON 3.12 FASTAPI · PARETO ROUTER · OWASP LLM01-10 · MCP · A2A · AG-UI · OTLP
            </span>
            <button
              type="button"
              onClick={() => setLicenseOpen(true)}
              data-testid="footer-license-btn"
              className="flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            >
              <Award className="h-3.5 w-3.5" />
              <span>Enterprise License</span>
            </button>
          </div>
        </div>
      </footer>

      {/* CMD+K Quick Command Palette */}
      {cmdOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            open={cmdOpen}
            t={t}
            onClose={() => setCmdOpen(false)}
            onSelectWorkspace={setActiveWorkspace}
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
          />
        </Suspense>
      )}

      {/* Enterprise License Quote & Live MBBank VietQR Modal */}
      {licenseOpen && (
        <Suspense fallback={null}>
          <EnterpriseLicenseModal
            open={licenseOpen}
            t={t}
            locale={locale}
            onClose={() => setLicenseOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
