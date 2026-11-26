import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { TopBar } from './components/TopBar';
import { ScenarioDock } from './components/ScenarioDock';
import { ExecutionGraph } from './components/ExecutionGraph';
import { HitlBanner } from './components/HitlBanner';
import { VerdictOutputPanel } from './components/VerdictOutputPanel';
import { TimeTravelPanel } from './components/TimeTravelPanel';
import { WireInspector } from './components/WireInspector';
import { NodeInspectorModal } from './components/NodeInspectorModal';
import { CommandPalette } from './components/CommandPalette';

const SPEED_DELAY_MS: Record<SpeedMode, number> = {
  '0.5x': 1250,
  '1x': 720,
  '2x': 360,
  instant: 40,
};

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

  // Boot directly into Scenario A paused cleanly at HITL Gate or stepped live so visitors immediately see rich telemetry!
  const [run, setRun] = useState<ControlPlaneRun>(() =>
    runUntilPauseOrComplete(createInitialRun('outage_rollback'))
  );
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [selectedCheckpointId, setSelectedCheckpointId] = useState<string | null>(null);
  const [wireTab, setWireTab] = useState<WireTab>('mcp');
  const [cmdOpen, setCmdOpen] = useState<boolean>(false);
  const [presetTriggerCount, setPresetTriggerCount] = useState<number>(0);

  const t = TRANSLATIONS[locale];
  const activeBranch = run.branches[run.active_branch_id];

  // Auto-probe local Python cluster once on mount
  const reprobeCluster = useCallback(() => {
    probePythonCluster(DEFAULT_PYTHON_CLUSTER_URL).then((health) => {
      setClusterOnline(health.online);
      if (health.online) {
        setRuntimeMode('python');
      }
    });
  }, []);

  useEffect(() => {
    reprobeCluster();
  }, [reprobeCluster]);

  // Global CMD+K / Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

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

  // Optional BYOK synthesis hook when a run completes and user supplied an ephemeral key
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
      const fresh = createInitialRun(scenarioId);

      // Select most illuminating protocol tab per scenario
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

  const handleStep = () => {
    setIsPlaying(false);
    setRun((prev) => stepRun(prev));
  };

  const handleRunInstant = () => {
    setIsPlaying(false);
    setRun((prev) => runUntilPauseOrComplete(prev));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setSelectedNodeId(null);
    setSelectedCheckpointId(null);
    setByokVerdictOverride(null);
    setRun(createInitialRun(run.scenario_id));
  };

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

  const handleSelectBranch = (branchId: string) => {
    setRun((prev) => {
      if (!prev.branches[branchId]) return prev;
      return { ...prev, active_branch_id: branchId };
    });
  };

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
        branch={activeBranch}
        activeBranchId={run.active_branch_id}
      />

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
            onTogglePlay={() => setIsPlaying((p) => !p)}
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
          {/* Interactive Cyclic Multi-Agent Execution Graph */}
          <ExecutionGraph
            t={t}
            run={run}
            selectedNodeId={selectedNodeId}
            onSelectNode={(id) => setSelectedNodeId((cur) => (cur === id ? null : id))}
          />

          {/* Clicked Node State & Telemetry Inspector */}
          {selectedNodeMeta && (
            <NodeInspectorModal
              t={t}
              node={selectedNodeMeta}
              checkpoint={selectedNodeCheckpoint}
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

          {/* Bottom Split Workbench: Time-Travel DAG + 3-Protocol Wire & OTel Waterfall */}
          <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-12">
            <div className="xl:col-span-5">
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
            <div className="xl:col-span-7">
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
            VERDICT GRAPH // ENGINEERED BY TRUONG VAN TINH (GITHUB.COM/TVT987)
          </span>
          <span>
            PROTOCOLS: MCP JSON-RPC 2.0 · A2A v0.2.2 · AG-UI SSE (RFC 6902) · OPENTELEMETRY GENAI
          </span>
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
        onRunInstant={handleRunInstant}
        onReset={handleReset}
      />
    </div>
  );
}

export default App;
