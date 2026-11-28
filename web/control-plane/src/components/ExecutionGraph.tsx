import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  GitFork,
  Maximize2,
  Minus,
  Move,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  X,
  Zap,
} from 'lucide-react';
import type { ControlPlaneRun, NodeId } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import type { RedTeamSimulationResult } from '../engine/redTeamClassifier';
import {
  DEBUGGER_NODE_H,
  DEBUGGER_NODE_W,
  DEBUGGER_VIEWBOX,
  FAULT_CATALOG,
  advanceDebuggerTick,
  applyCheckpointStateJson,
  completeForkRaceInstant,
  computeDynamicEdgeGeometry,
  createInitialDebuggerState,
  injectFaultOnEdge,
  launchDualForkRace,
  moveDebuggerNode,
  pauseAtNodeBreakpoint,
  resetDebuggerNodePositions,
  resumeFromBreakpoint,
  sampleBezierPoint,
  setArmedFaultKind,
  stepOverBreakpoint,
  toggleForkRaceRunning,
  toggleNodeBreakpoint,
  updateCheckpointState,
  type DebuggerEdge,
  type DebuggerNode,
  type DebuggerNodeId,
  type FaultKind,
  type GraphDebuggerState,
  type ProtocolKind,
} from '../engines/interactiveGraphDebuggerEngine';

const BreakpointInspectorBar = lazy(() => import('./BreakpointInspectorBar'));
const DualForkRacePanel = lazy(() => import('./DualForkRacePanel'));

interface ExecutionGraphProps {
  t: Translations;
  theme: 'light' | 'dark';
  run: ControlPlaneRun;
  selectedNodeId: NodeId | null;
  onSelectNode: (nodeId: NodeId) => void;
  redTeamOverlay?: RedTeamSimulationResult | null;
  onClearRedTeamOverlay?: () => void;
}

const FAULT_BUTTONS: Array<{
  kind: FaultKind;
  label: string;
  shortLabel: string;
  tone: 'crimson' | 'amber';
}> = [
  {
    kind: 'PROMPT_INJECTION',
    label: 'Prompt Injection',
    shortLabel: 'Injection',
    tone: 'crimson',
  },
  {
    kind: 'TOOL_TIMEOUT_429',
    label: '429 Timeout',
    shortLabel: '429 Spike',
    tone: 'amber',
  },
  {
    kind: 'CONTEXT_HALLUCINATION',
    label: 'Hallucination',
    shortLabel: 'Hallucinate',
    tone: 'amber',
  },
];

function getStudioPalette(theme: 'light' | 'dark') {
  if (theme === 'light') {
    return {
      indigo: '#4F46E5',
      emerald: '#059669',
      amber: '#D97706',
      crimson: '#E11D48',
      slate: '#64748B',
      wireIdle: 'rgba(100, 116, 139, 0.36)',
      cardStroke: 'rgba(15, 23, 42, 0.13)',
      portFill: '#FFFFFF',
      packetCore: '#FFFFFF',
      pillBg: '#FFFFFF',
      badgeBg: {
        active: 'rgba(79, 70, 229, 0.09)',
        deflected: 'rgba(5, 150, 105, 0.12)',
        paused: 'rgba(225, 29, 72, 0.12)',
        degraded: 'rgba(225, 29, 72, 0.12)',
        rerouted: 'rgba(217, 119, 6, 0.13)',
        idle: 'rgba(100, 116, 139, 0.10)',
      },
    };
  }
  return {
    indigo: '#818CF8',
    emerald: '#34D399',
    amber: '#FBBF24',
    crimson: '#FB7185',
    slate: '#94A3B8',
    wireIdle: 'rgba(148, 163, 184, 0.28)',
    cardStroke: 'rgba(148, 163, 184, 0.22)',
    portFill: '#121826',
    packetCore: '#FFFFFF',
    pillBg: '#101520',
    badgeBg: {
      active: 'rgba(129, 140, 248, 0.16)',
      deflected: 'rgba(52, 211, 153, 0.18)',
      paused: 'rgba(251, 113, 133, 0.18)',
      degraded: 'rgba(251, 113, 133, 0.18)',
      rerouted: 'rgba(251, 191, 36, 0.18)',
      idle: 'rgba(148, 163, 184, 0.14)',
    },
  };
}

function edgeToneColor(
  tone: DebuggerEdge['tone'],
  palette: ReturnType<typeof getStudioPalette>
): string {
  switch (tone) {
    case 'emerald':
      return palette.emerald;
    case 'amber':
      return palette.amber;
    case 'crimson':
      return palette.crimson;
    default:
      return palette.indigo;
  }
}

function protocolPillStyle(protocol: ProtocolKind): string {
  switch (protocol) {
    case 'OWASP':
      return 'border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300';
    case 'MCP 2.0':
      return 'border-indigo-500/40 bg-indigo-500/12 text-indigo-700 dark:text-indigo-300';
    case 'A2A 0.2':
      return 'border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-300';
    default:
      return 'border-sky-500/40 bg-sky-500/12 text-sky-700 dark:text-sky-300';
  }
}

export const ExecutionGraph: React.FC<ExecutionGraphProps> = ({
  t,
  theme,
  run,
  redTeamOverlay = null,
  onClearRedTeamOverlay,
}) => {
  const [dbg, setDbg] = useState<GraphDebuggerState>(() => createInitialDebuggerState());
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [wireFilter, setWireFilter] = useState<'ALL' | ProtocolKind>('ALL');
  const [showAllWireRows, setShowAllWireRows] = useState(false);

  // Pointer interaction state: dragging a node OR panning canvas
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragState, setDragState] = useState<
    | { mode: 'pan'; startClientX: number; startClientY: number; origPanX: number; origPanY: number }
    | {
        mode: 'node';
        nodeId: DebuggerNodeId;
        offsetX: number;
        offsetY: number;
        startClientX: number;
        startClientY: number;
        moved: boolean;
      }
    | null
  >(null);

  const palette = useMemo(() => getStudioPalette(theme), [theme]);
  const isLight = theme === 'light';
  const prevScenarioRef = useRef(run.scenario_id);
  const prevRedTeamIdRef = useRef<string | null>(null);

  // 60fps real-time physics & protocol packet stream loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0.008, (now - lastTs) / 1000));
      lastTs = now;
      setDbg((prev) => advanceDebuggerTick(prev, dtSec));
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  // Sync left-rail scenario picks into live interactive canvas impulses
  useEffect(() => {
    if (prevScenarioRef.current === run.scenario_id) return;
    prevScenarioRef.current = run.scenario_id;
    if (run.scenario_id === 'prompt_injection') {
      setDbg((prev) => injectFaultOnEdge(prev, 'e-rag-firewall', 'PROMPT_INJECTION'));
    } else if (run.scenario_id === 'hallucination_fork') {
      setDbg((prev) => injectFaultOnEdge(prev, 'e-firewall-critic', 'CONTEXT_HALLUCINATION'));
    } else if (run.scenario_id === 'outage_rollback') {
      setDbg((prev) => injectFaultOnEdge(prev, 'e-planner-mcp', 'TOOL_TIMEOUT_429'));
    }
  }, [run.scenario_id]);

  // Sync Red-Team Sandbox attack trigger onto primary canvas OWASP Firewall shield
  useEffect(() => {
    if (!redTeamOverlay) {
      prevRedTeamIdRef.current = null;
      return;
    }
    const key = `${redTeamOverlay.id}:${redTeamOverlay.risk_score}`;
    if (prevRedTeamIdRef.current === key) return;
    prevRedTeamIdRef.current = key;
    if (!redTeamOverlay.passed) {
      setDbg((prev) => injectFaultOnEdge(prev, 'e-planner-firewall', 'PROMPT_INJECTION'));
    }
  }, [redTeamOverlay]);

  // Convert screen pointer coordinates into SVG graph-group local coordinates
  const clientToGraphPoint = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const inv = ctm.inverse();
      const svgX = clientX * inv.a + clientY * inv.c + inv.e;
      const svgY = clientX * inv.b + clientY * inv.d + inv.f;
      return {
        x: (svgX - pan.x) / zoom,
        y: (svgY - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom]
  );

  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    if (target.closest('[data-debugger-node="true"]') || target.closest('[data-edge-trigger="true"]')) {
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragState({
      mode: 'pan',
      startClientX: e.clientX,
      startClientY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
    });
  };

  const handleNodePointerDown = (
    e: React.PointerEvent<SVGGElement>,
    node: DebuggerNode
  ) => {
    const target = e.target as Element;
    if (target.closest('[data-bp-button="true"]')) {
      return;
    }
    e.stopPropagation();
    svgRef.current?.setPointerCapture?.(e.pointerId);
    const pt = clientToGraphPoint(e.clientX, e.clientY);
    setDragState({
      mode: 'node',
      nodeId: node.id,
      offsetX: pt.x - node.x,
      offsetY: pt.y - node.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    });
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) return;
    if (dragState.mode === 'pan') {
      const svg = svgRef.current;
      const scale = svg ? DEBUGGER_VIEWBOX.width / Math.max(1, svg.clientWidth) : 1;
      setPan({
        x: dragState.origPanX + (e.clientX - dragState.startClientX) * scale,
        y: dragState.origPanY + (e.clientY - dragState.startClientY) * scale,
      });
      return;
    }
    const dist = Math.hypot(
      e.clientX - dragState.startClientX,
      e.clientY - dragState.startClientY
    );
    if (dist > 3 || dragState.moved) {
      if (!dragState.moved) {
        setDragState({ ...dragState, moved: true });
      }
      const pt = clientToGraphPoint(e.clientX, e.clientY);
      setDbg((prev) =>
        moveDebuggerNode(prev, dragState.nodeId, pt.x - dragState.offsetX, pt.y - dragState.offsetY)
      );
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragState) return;
    if (dragState.mode === 'node' && !dragState.moved) {
      const clickedId = dragState.nodeId;
      setDbg((prev) => ({
        ...prev,
        selectedNodeId: prev.selectedNodeId === clickedId ? null : clickedId,
      }));
    }
    if (svgRef.current?.hasPointerCapture?.(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    setDragState(null);
  };

  const handleEdgeInject = (edgeId: string) => {
    setDbg((prev) => injectFaultOnEdge(prev, edgeId, prev.armedFaultKind));
  };

  const handleToggleBp = (e: React.MouseEvent, node: DebuggerNode) => {
    e.stopPropagation();
    setDbg((prev) => {
      if (node.hasBreakpoint) {
        return toggleNodeBreakpoint(prev, node.id, false);
      }
      return pauseAtNodeBreakpoint(prev, node.id);
    });
  };

  const handleResetLayout = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDbg((prev) => resetDebuggerNodePositions(prev));
  };

  const anyNodeMoved = useMemo(
    () =>
      dbg.nodeOrder.some((id) => {
        const n = dbg.nodes[id];
        return n.x !== n.defaultX || n.y !== n.defaultY;
      }),
    [dbg.nodeOrder, dbg.nodes]
  );

  const edgeGeometries = useMemo(
    () =>
      dbg.edges.map((edge) => ({
        edge,
        geometry: computeDynamicEdgeGeometry(edge, dbg.nodes),
      })),
    [dbg.edges, dbg.nodes]
  );

  const geomByEdgeId = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeDynamicEdgeGeometry>> = {};
    for (const item of edgeGeometries) {
      map[item.edge.id] = item.geometry;
    }
    return map;
  }, [edgeGeometries]);

  const pausedNode = dbg.pausedNodeId ? dbg.nodes[dbg.pausedNodeId] : null;
  const armedSpec = FAULT_CATALOG[dbg.armedFaultKind];
  const hasDockedDrawer = Boolean(
    (dbg.executionMode === 'PAUSED_AT_BREAKPOINT' && pausedNode) ||
      (dbg.forkRace && dbg.forkRace.active)
  );
  const filteredWireLog = useMemo(() => {
    const base =
      wireFilter === 'ALL'
        ? dbg.wireLog
        : dbg.wireLog.filter((item) => item.protocol === wireFilter);
    return base.slice(0, showAllWireRows ? 8 : hasDockedDrawer ? 2 : 3);
  }, [dbg.wireLog, hasDockedDrawer, showAllWireRows, wireFilter]);

  const activeDraggingNode =
    dragState?.mode === 'node' && dragState.moved ? dbg.nodes[dragState.nodeId] : null;

  return (
    <div className="flex flex-col gap-4">
      <section
        data-testid="interactive-debugger-stage"
        className="vg-panel relative overflow-hidden rounded-xl"
      >
        {/* Row 1: Studio Title + Live Status + Zoom/Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--vg-border)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    dbg.executionMode === 'PAUSED_AT_BREAKPOINT'
                      ? palette.crimson
                      : dbg.nodes.owasp_firewall.shieldPulseTicks > 0
                        ? palette.emerald
                        : palette.indigo,
                  boxShadow: `0 0 10px ${
                    dbg.executionMode === 'PAUSED_AT_BREAKPOINT'
                      ? palette.crimson
                      : palette.indigo
                  }`,
                }}
              />
              <h2 className="font-display text-sm font-bold tracking-tight text-[var(--vg-text)]">
                {t.graphTitle}
              </h2>
              <span
                data-testid="debugger-mode-pill"
                className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${
                  dbg.executionMode === 'PAUSED_AT_BREAKPOINT'
                    ? 'border-rose-500/45 bg-rose-500/12 text-rose-700 dark:text-rose-300'
                    : dbg.executionMode === 'PAUSED_MANUAL'
                      ? 'border-amber-500/45 bg-amber-500/12 text-amber-700 dark:text-amber-300'
                      : 'border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] text-[var(--vg-accent)]'
                }`}
              >
                {dbg.executionMode === 'PAUSED_AT_BREAKPOINT'
                  ? 'PAUSED AT BREAKPOINT'
                  : dbg.executionMode === 'PAUSED_MANUAL'
                    ? 'STREAM PAUSED'
                    : `${dbg.packets.length} LIVE PACKETS · 60FPS`}
              </span>
              {dbg.metrics.blockedAttacks > 0 && (
                <span
                  data-testid="debugger-blocked-counter"
                  className="rounded-full border border-emerald-500/45 bg-emerald-500/12 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                >
                  OWASP BLOCKED: {dbg.metrics.blockedAttacks}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[var(--vg-text-muted)]">
              Drag any agent node to rewire live · Click any wire pill to inject mid-flight fault · Toggle BP to pause &amp; mutate state
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Red-Team Legacy Overlay Badge if active */}
            {redTeamOverlay && !redTeamOverlay.passed && (
              <div
                data-testid="graph-redteam-pill"
                className="flex items-center gap-1.5 rounded-full border border-rose-500/50 bg-rose-500/12 px-2.5 py-1 font-mono text-[10px] font-semibold text-rose-700 dark:text-rose-300"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>QUARANTINED ({redTeamOverlay.risk_score.toFixed(2)})</span>
                {onClearRedTeamOverlay && (
                  <button
                    type="button"
                    onClick={onClearRedTeamOverlay}
                    aria-label="Clear Red-Team Graph Overlay"
                    className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            {/* Stream Play/Pause */}
            <button
              type="button"
              data-testid="debugger-stream-toggle"
              onClick={() =>
                setDbg((prev) =>
                  prev.executionMode === 'PAUSED_AT_BREAKPOINT'
                    ? resumeFromBreakpoint(prev)
                    : {
                        ...prev,
                        executionMode:
                          prev.executionMode === 'RUNNING' ? 'PAUSED_MANUAL' : 'RUNNING',
                      }
                )
              }
              className="flex items-center gap-1 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono text-[10.5px] font-semibold text-[var(--vg-text)] transition-colors hover:border-[var(--vg-accent-border)]"
            >
              {dbg.executionMode === 'RUNNING' ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
                  <span className="hidden sm:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="hidden sm:inline">Resume</span>
                </>
              )}
            </button>

            {/* Pan/Zoom & Fit Controls */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.12).toFixed(2))))}
                className="rounded-md p-1.5 text-[var(--vg-text-muted)] transition-colors hover:bg-[var(--vg-panel)] hover:text-[var(--vg-text)]"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="px-1.5 font-mono text-[10.5px] font-medium text-[var(--vg-text-muted)]">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.45, Number((z + 0.12).toFixed(2))))}
                className="rounded-md p-1.5 text-[var(--vg-text-muted)] transition-colors hover:bg-[var(--vg-panel)] hover:text-[var(--vg-text)]"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetLayout}
                data-testid="debugger-reset-layout-btn"
                className={`rounded-md p-1.5 transition-colors hover:bg-[var(--vg-panel)] ${
                  anyNodeMoved || zoom !== 1 || pan.x !== 0 || pan.y !== 0
                    ? 'text-[var(--vg-accent)]'
                    : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                }`}
                title="Reset Node Layout & Fit View"
                aria-label="Reset Layout"
              >
                {anyNodeMoved || zoom !== 1 || pan.x !== 0 || pan.y !== 0 ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Tactical Wire-Fault Arming Bar + Shield Toggle + Dual Fork Launcher */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] px-4 py-2.5 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider text-[var(--vg-text-dim)]">
              <Zap className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span>WIRE INJECTOR:</span>
            </span>

            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-panel)] p-0.5">
              {FAULT_BUTTONS.map((fb) => {
                const armed = dbg.armedFaultKind === fb.kind;
                return (
                  <button
                    key={fb.kind}
                    type="button"
                    data-testid={`arm-fault-${fb.kind}`}
                    onClick={() => setDbg((prev) => setArmedFaultKind(prev, fb.kind))}
                    className={`rounded-md px-2.5 py-1 font-mono text-[10.5px] font-bold transition-all ${
                      armed
                        ? fb.tone === 'crimson'
                          ? 'bg-rose-600 text-white shadow-xs dark:bg-rose-500'
                          : 'bg-amber-600 text-white shadow-xs dark:bg-amber-500'
                        : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                    }`}
                  >
                    <span className="sm:hidden">{fb.shortLabel}</span>
                    <span className="hidden sm:inline">{fb.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* OWASP Firewall Strict / Bypass Toggle */}
            <button
              type="button"
              data-testid="debugger-shield-toggle"
              onClick={() =>
                setDbg((prev) =>
                  updateCheckpointState(prev, {
                    firewallStrict: !prev.checkpointState.firewallStrict,
                  })
                )
              }
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10.5px] font-bold transition-colors ${
                dbg.checkpointState.firewallStrict
                  ? 'border-emerald-500/45 bg-emerald-500/12 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
                  : 'border-rose-500/50 bg-rose-500/12 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300'
              }`}
            >
              {dbg.checkpointState.firewallStrict ? (
                <ShieldCheck className="h-3.5 w-3.5" />
              ) : (
                <ShieldOff className="h-3.5 w-3.5" />
              )}
              <span>
                OWASP Shield: {dbg.checkpointState.firewallStrict ? 'STRICT' : 'BYPASS'}
              </span>
            </button>

            {/* Launch Dual-Branch Time-Travel Fork Race */}
            <button
              type="button"
              data-testid="debugger-launch-fork-btn"
              onClick={() => setDbg((prev) => launchDualForkRace(prev))}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-600 px-3 py-1 font-mono text-[10.5px] font-bold text-white shadow-xs transition-all hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              <GitFork className="h-3.5 w-3.5" />
              <span>Fork &amp; Race</span>
            </button>
          </div>
        </div>

        {/* Interactive 60fps Drag-and-Wire SVG Studio Canvas */}
        <div className="relative h-[228px] w-full select-none bg-[var(--vg-bg)] sm:h-[395px] lg:h-[430px]">
          <svg
            ref={svgRef}
            data-testid="execution-graph-svg"
            viewBox={`-10 -8 ${DEBUGGER_VIEWBOX.width + 20} ${DEBUGGER_VIEWBOX.height + 16}`}
            className={`h-full w-full touch-none ${
              dragState ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleSvgPointerMove}
            onPointerUp={handleSvgPointerUp}
            onPointerCancel={handleSvgPointerUp}
          >
            <defs>
              <pattern id="vg-v6-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <path
                  d="M 28 0 L 0 0 0 28"
                  fill="none"
                  stroke="var(--vg-grid-line)"
                  strokeWidth="1"
                />
                <circle cx="0" cy="0" r="1.15" fill="var(--vg-grid-dot)" />
              </pattern>

              <filter id="vg-v6-card-shadow" x="-14%" y="-14%" width="128%" height="136%">
                <feDropShadow
                  dx="0"
                  dy={isLight ? 4 : 6}
                  stdDeviation={isLight ? 5 : 7}
                  floodColor={isLight ? '#0F172A' : '#000000'}
                  floodOpacity={isLight ? 0.08 : 0.42}
                />
              </filter>

              <filter id="vg-v6-packet-glow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="3.4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {(
                [
                  ['indigo', palette.indigo],
                  ['emerald', palette.emerald],
                  ['amber', palette.amber],
                  ['crimson', palette.crimson],
                ] as const
              ).map(([name, fill]) => (
                <marker
                  key={name}
                  id={`v6-arrow-${name}`}
                  viewBox="0 0 10 10"
                  refX="8.5"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={fill} />
                </marker>
              ))}
            </defs>

            <rect
              x={-160}
              y={-160}
              width={DEBUGGER_VIEWBOX.width + 320}
              height={DEBUGGER_VIEWBOX.height + 320}
              fill="url(#vg-v6-grid)"
            />

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* 1. Dynamic Cubic Bezier Wires + Clickable Mid-Flight Inject Pills */}
              {edgeGeometries.map(({ edge, geometry }) => {
                const isHovered = hoveredEdgeId === edge.id;
                const hasAttackOnWire = dbg.packets.some(
                  (p) => p.edgeId === edge.id && p.kind === 'attack'
                );
                const hasWarnOnWire = dbg.packets.some(
                  (p) =>
                    p.edgeId === edge.id &&
                    (p.kind === 'timeout' || p.kind === 'hallucination' || p.kind === 'critic_cycle')
                );
                const hasActivePacket = dbg.packets.some((p) => p.edgeId === edge.id);

                const hoverColor =
                  armedSpec.tone === 'crimson' ? palette.crimson : palette.amber;

                const strokeColor = hasAttackOnWire
                  ? palette.crimson
                  : hasWarnOnWire
                    ? palette.amber
                    : isHovered
                      ? hoverColor
                      : hasActivePacket
                        ? edgeToneColor(edge.tone, palette)
                        : palette.wireIdle;

                const markerName = hasAttackOnWire
                  ? 'crimson'
                  : hasWarnOnWire
                    ? 'amber'
                    : isHovered
                      ? armedSpec.tone
                      : edge.tone;

                const pillText = isHovered ? 'INJECT' : edge.label;
                const pillW = Math.max(76, Math.round(pillText.length * 5.6 + 26));

                return (
                  <g
                    key={edge.id}
                    data-edge-id={edge.id}
                    data-edge-trigger="true"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredEdgeId(edge.id)}
                    onMouseLeave={() => setHoveredEdgeId((cur) => (cur === edge.id ? null : cur))}
                    onClick={() => handleEdgeInject(edge.id)}
                  >
                    {/* Wide Forgiving 18px Hit Target along Entire Curve */}
                    <path d={geometry.d} fill="none" stroke="transparent" strokeWidth={18} />

                    {/* Outer Halo when Hovered or Carrying Attack */}
                    {(isHovered || hasAttackOnWire || hasWarnOnWire) && (
                      <path
                        d={geometry.d}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={6.5}
                        opacity={isLight ? 0.17 : 0.24}
                      />
                    )}

                    {/* Main Bezier Wire */}
                    <path
                      d={geometry.d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={
                        hasAttackOnWire || isHovered ? 2.6 : hasActivePacket ? 2.1 : 1.45
                      }
                      strokeDasharray={edge.cyclic ? '6 4' : undefined}
                      className={
                        hasAttackOnWire || hasWarnOnWire
                          ? 'edge-flow-active'
                          : edge.cyclic && hasActivePacket
                            ? 'edge-flow-cyclic'
                            : undefined
                      }
                      markerEnd={`url(#v6-arrow-${markerName})`}
                      opacity={hasActivePacket || isHovered || edge.cyclic ? 0.96 : 0.72}
                    />

                    {/* Precision Terminal Sockets */}
                    <circle
                      cx={geometry.startPort.x}
                      cy={geometry.startPort.y}
                      r={3.8}
                      fill={palette.portFill}
                      stroke={strokeColor}
                      strokeWidth={1.6}
                    />
                    <circle
                      cx={geometry.endPort.x}
                      cy={geometry.endPort.y}
                      r={3.8}
                      fill={palette.portFill}
                      stroke={strokeColor}
                      strokeWidth={1.6}
                    />

                    {/* Interactive Edge Midpoint INJECT Pill */}
                    <g
                      data-testid={`edge-inject-${edge.id}`}
                      transform={`translate(${geometry.labelX}, ${geometry.labelY})`}
                    >
                      <rect
                        x={-pillW / 2}
                        y={-10}
                        width={pillW}
                        height={20}
                        rx={10}
                        fill={
                          isHovered
                            ? hoverColor
                            : hasAttackOnWire
                              ? palette.crimson
                              : palette.pillBg
                        }
                        stroke={
                          isHovered || hasAttackOnWire || hasWarnOnWire
                            ? strokeColor
                            : 'var(--vg-border)'
                        }
                        strokeWidth={isHovered || hasAttackOnWire ? 1.4 : 1}
                        opacity={0.97}
                      />
                      {/* Crisp Inline SVG Lightning Bolt (Zero Emojis) */}
                      <path
                        d="M 1.2 -4.6 L -2.8 0.4 L 0.1 0.4 L -1.2 4.6 L 2.8 -0.4 L -0.1 -0.4 Z"
                        transform={`translate(${-pillW / 2 + 11}, 0)`}
                        fill={
                          isHovered || hasAttackOnWire
                            ? '#FFFFFF'
                            : hasWarnOnWire
                              ? palette.amber
                              : strokeColor
                        }
                      />
                      <text
                        x={5}
                        y={3.1}
                        textAnchor="middle"
                        fontSize="8.4"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight={700}
                        fill={
                          isHovered || hasAttackOnWire
                            ? '#FFFFFF'
                            : hasWarnOnWire
                              ? palette.amber
                              : isLight
                                ? '#334155'
                                : '#CBD5E1'
                        }
                      >
                        {pillText}
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* 2. Live Glowing 60fps Protocol & Attack Packets */}
              {dbg.packets.map((pkt) => {
                const geom = geomByEdgeId[pkt.edgeId];
                if (!geom) return null;

                const head = sampleBezierPoint(geom.curve, pkt.progress);
                const pktColor =
                  pkt.kind === 'attack'
                    ? palette.crimson
                    : pkt.kind === 'timeout' || pkt.kind === 'hallucination' || pkt.kind === 'critic_cycle'
                      ? palette.amber
                      : pkt.kind === 'deflection'
                        ? palette.emerald
                        : palette.indigo;

                const isFaultPkt =
                  pkt.kind === 'attack' ||
                  pkt.kind === 'timeout' ||
                  pkt.kind === 'hallucination' ||
                  pkt.kind === 'critic_cycle';

                const trailCount = isFaultPkt ? 5 : 3;
                const trailPts = Array.from({ length: trailCount }, (_, i) => {
                  const tPos = Math.max(0, pkt.progress - (i + 1) * 0.036);
                  return {
                    pt: sampleBezierPoint(geom.curve, tPos),
                    r: (isFaultPkt ? 4.4 : 3.4) * (1 - (i + 1) / (trailCount + 1.4)),
                    opacity: 0.72 * (1 - (i + 1) / (trailCount + 1)),
                  };
                });

                const badgeText =
                  pkt.kind === 'attack'
                    ? 'INJ-EXFIL-001'
                    : pkt.kind === 'timeout'
                      ? 'HTTP 429'
                      : pkt.kind === 'hallucination'
                        ? 'UNGROUNDED'
                        : pkt.kind === 'critic_cycle'
                          ? 'RE-GROUND'
                          : pkt.kind === 'deflection'
                            ? 'SANITIZED'
                            : null;

                return (
                  <g
                    key={pkt.id}
                    data-testid={`packet-${pkt.kind}`}
                    className="pointer-events-none"
                  >
                    {trailPts.map((tp, idx) => (
                      <circle
                        key={`${pkt.id}-t${idx}`}
                        cx={tp.pt.x}
                        cy={tp.pt.y}
                        r={tp.r}
                        fill={pktColor}
                        opacity={tp.opacity}
                      />
                    ))}

                    {isFaultPkt && (
                      <circle
                        cx={head.x}
                        cy={head.y}
                        r={12}
                        fill={pktColor}
                        opacity={0.28}
                        className="attack-beacon-pulse"
                      />
                    )}

                    <circle
                      cx={head.x}
                      cy={head.y}
                      r={isFaultPkt ? 8.2 : 6.4}
                      fill={pktColor}
                      opacity={0.26}
                      filter="url(#vg-v6-packet-glow)"
                    />
                    <circle
                      cx={head.x}
                      cy={head.y}
                      r={isFaultPkt ? 5.2 : 4.0}
                      fill={palette.packetCore}
                      stroke={pktColor}
                      strokeWidth={2.4}
                    />

                    {badgeText && (
                      <g transform={`translate(${head.x}, ${head.y - 21})`}>
                        <rect
                          x={-41}
                          y={-8.5}
                          width={82}
                          height={15.5}
                          rx={4}
                          fill={pktColor}
                        />
                        <text
                          y={2.4}
                          textAnchor="middle"
                          fontSize="7.6"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={700}
                          fill="#FFFFFF"
                        >
                          {badgeText}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 3. 7 Draggable Multi-Agent Node Cards with ● BP Breakpoints & OWASP Shield Pulse */}
              {dbg.nodeOrder.map((nodeId) => {
                const node = dbg.nodes[nodeId];
                const isDraggingThis =
                  dragState?.mode === 'node' && dragState.nodeId === node.id && dragState.moved;
                const isSelected = dbg.selectedNodeId === node.id;
                const isPausedHere = dbg.pausedNodeId === node.id;
                const isFirewallShielding =
                  node.id === 'owasp_firewall' && node.shieldPulseTicks > 0;
                const isDegraded = node.status === 'degraded';
                const isRerouted = node.status === 'rerouted';

                const accentHex = isPausedHere
                  ? palette.crimson
                  : isFirewallShielding
                    ? palette.emerald
                    : isDegraded
                      ? palette.crimson
                      : isRerouted
                        ? palette.amber
                        : node.id === 'owasp_firewall'
                          ? dbg.checkpointState.firewallStrict
                            ? palette.emerald
                            : palette.crimson
                          : node.id === 'critic_verifier'
                            ? palette.emerald
                            : palette.indigo;

                const statusLabel = isPausedHere
                  ? 'PAUSED'
                  : isFirewallShielding
                    ? 'BLOCKED'
                    : isDegraded
                      ? 'BREACH'
                      : isRerouted
                        ? 'REROUTED'
                        : 'LIVE';

                return (
                  <g
                    key={node.id}
                    data-debugger-node="true"
                    data-testid={`debugger-node-${node.id}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    onPointerDown={(e) => handleNodePointerDown(e, node)}
                    className={isDraggingThis ? 'cursor-grabbing' : 'cursor-grab'}
                  >
                    {/* Expanding OWASP LLM10 Firewall Deflection Shockwave */}
                    {isFirewallShielding && (
                      <>
                        <rect
                          x={-8}
                          y={-8}
                          width={DEBUGGER_NODE_W + 16}
                          height={DEBUGGER_NODE_H + 16}
                          rx={15}
                          fill="none"
                          stroke={palette.emerald}
                          strokeWidth={2.6}
                          className="shield-shockwave-ring"
                        />
                        <rect
                          x={-15}
                          y={-15}
                          width={DEBUGGER_NODE_W + 30}
                          height={DEBUGGER_NODE_H + 30}
                          rx={19}
                          fill="none"
                          stroke={palette.crimson}
                          strokeWidth={1.6}
                          strokeDasharray="5 4"
                          className="node-halo-outer"
                        />
                        {/* Floating Deflection Confirmation Tag */}
                        <g transform={`translate(${DEBUGGER_NODE_W / 2}, -16)`}>
                          <rect
                            x={-88}
                            y={-10}
                            width={176}
                            height={19}
                            rx={9.5}
                            fill={palette.emerald}
                          />
                          <text
                            y={2.5}
                            textAnchor="middle"
                            fontSize="8.4"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight={700}
                            fill="#FFFFFF"
                          >
                            BLOCKED · OWASP LLM01 · 0B
                          </text>
                        </g>
                      </>
                    )}

                    {/* Pulsing Breakpoint / Degraded Halo */}
                    {(isPausedHere || isDegraded || isRerouted) && !isFirewallShielding && (
                      <>
                        <rect
                          x={-5}
                          y={-5}
                          width={DEBUGGER_NODE_W + 10}
                          height={DEBUGGER_NODE_H + 10}
                          rx={13}
                          fill="none"
                          stroke={accentHex}
                          strokeWidth={2}
                          className="node-halo-pulse"
                        />
                        <rect
                          x={-10}
                          y={-10}
                          width={DEBUGGER_NODE_W + 20}
                          height={DEBUGGER_NODE_H + 20}
                          rx={16}
                          fill="none"
                          stroke={accentHex}
                          strokeWidth={1}
                          strokeDasharray="4 4"
                          className="node-halo-outer"
                        />
                      </>
                    )}

                    {/* Main Elevated LangGraph Node Surface */}
                    <rect
                      width={DEBUGGER_NODE_W}
                      height={DEBUGGER_NODE_H}
                      rx={10}
                      fill="var(--vg-node-bg)"
                      stroke={
                        isDraggingThis || isSelected || isPausedHere || isFirewallShielding
                          ? accentHex
                          : palette.cardStroke
                      }
                      strokeWidth={
                        isDraggingThis || isPausedHere || isFirewallShielding
                          ? 2.2
                          : isSelected
                            ? 1.9
                            : 1.2
                      }
                      filter="url(#vg-v6-card-shadow)"
                    />

                    {/* Top Colored Status Strip */}
                    <rect
                      x={1}
                      y={1}
                      width={DEBUGGER_NODE_W - 2}
                      height={3.6}
                      rx={2}
                      fill={accentHex}
                    />

                    {/* Row 1: Index + Protocol Chip + Clickable Red Breakpoint Button */}
                    <text
                      x={12}
                      y={22}
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill={accentHex}
                    >
                      {node.index}
                    </text>

                    <rect
                      x={30}
                      y={10.5}
                      width={66}
                      height={16}
                      rx={4}
                      fill="var(--vg-surface)"
                      stroke="var(--vg-border)"
                      strokeWidth={0.9}
                    />
                    <text
                      x={63}
                      y={21.5}
                      textAnchor="middle"
                      fontSize="8.1"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill="var(--vg-text-muted)"
                    >
                      {node.protocol}
                    </text>

                    {/* Red Debugger Breakpoint Toggle Pill (● BP) */}
                    <g
                      data-bp-button="true"
                      data-testid={`node-bp-${node.id}`}
                      transform={`translate(${DEBUGGER_NODE_W - 50}, 10.5)`}
                      onClick={(e) => handleToggleBp(e, node)}
                      className="cursor-pointer"
                    >
                      <rect
                        width={39}
                        height={16}
                        rx={8}
                        fill={
                          node.hasBreakpoint
                            ? palette.crimson
                            : isLight
                              ? '#F8FAFC'
                              : '#182032'
                        }
                        stroke={
                          node.hasBreakpoint ? palette.crimson : 'rgba(225, 29, 72, 0.36)'
                        }
                        strokeWidth={1}
                      />
                      <circle
                        cx={10}
                        cy={8}
                        r={3.1}
                        fill={node.hasBreakpoint ? '#FFFFFF' : 'none'}
                        stroke={node.hasBreakpoint ? '#FFFFFF' : palette.crimson}
                        strokeWidth={1.3}
                      />
                      <text
                        x={25.5}
                        y={11}
                        textAnchor="middle"
                        fontSize="8.2"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight={700}
                        fill={node.hasBreakpoint ? '#FFFFFF' : palette.crimson}
                      >
                        BP
                      </text>
                    </g>

                    {/* Row 2 & 3: Title & Subtitle */}
                    <text
                      x={12}
                      y={44}
                      fontSize="12.2"
                      fontFamily="Space Grotesk, Inter, sans-serif"
                      fontWeight={700}
                      fill="var(--vg-text)"
                    >
                      {node.title}
                    </text>
                    <text
                      x={12}
                      y={58}
                      fontSize="9"
                      fontFamily="Inter, sans-serif"
                      fill="var(--vg-text-muted)"
                    >
                      {node.subtitle}
                    </text>

                    {/* Row 4: Live Model & Status Telemetry Ribbon */}
                    <rect
                      x={12}
                      y={66}
                      width={DEBUGGER_NODE_W - 24}
                      height={16.5}
                      rx={4}
                      fill={palette.badgeBg[node.status]}
                    />
                    <text
                      x={18}
                      y={77.2}
                      fontSize="8.2"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={600}
                      fill="var(--vg-text)"
                    >
                      {node.modelLabel}
                    </text>
                    <text
                      x={DEBUGGER_NODE_W - 18}
                      y={77.2}
                      textAnchor="end"
                      fontSize="8"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill={accentHex}
                    >
                      {statusLabel}
                    </text>

                    {/* Row 5: Precision Bottom Telemetry Footer */}
                    <line
                      x1={12}
                      y1={88.5}
                      x2={DEBUGGER_NODE_W - 12}
                      y2={88.5}
                      stroke="var(--vg-border)"
                      strokeWidth={0.85}
                    />
                    <text
                      x={12}
                      y={101}
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill={accentHex}
                    >
                      {node.latencyMs}ms
                    </text>
                    <text
                      x={DEBUGGER_NODE_W / 2}
                      y={101}
                      textAnchor="middle"
                      fontSize="8.8"
                      fontFamily="JetBrains Mono, monospace"
                      fill="var(--vg-text-muted)"
                    >
                      {node.tokens.toLocaleString()} tok
                    </text>
                    <text
                      x={DEBUGGER_NODE_W - 12}
                      y={101}
                      textAnchor="end"
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill={palette.indigo}
                    >
                      ${node.costUsd.toFixed(4)}
                    </text>

                    {/* Live Drag Coordinate Ghost Pill */}
                    {isDraggingThis && (
                      <g transform={`translate(${DEBUGGER_NODE_W / 2}, ${DEBUGGER_NODE_H + 14})`}>
                        <rect x={-44} y={-9} width={88} height={17} rx={4} fill={palette.indigo} />
                        <text
                          y={3}
                          textAnchor="middle"
                          fontSize="8.2"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={700}
                          fill="#FFFFFF"
                        >
                          x:{node.x} y:{node.y}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Subtle Studio Drag Hint Pill (Top-Left Overlay) */}
          <div className="pointer-events-none absolute top-2.5 left-3 hidden items-center gap-1.5 rounded-full border border-[var(--vg-border)] bg-[var(--vg-panel)]/90 px-2.5 py-1 font-mono text-[9.5px] font-semibold text-[var(--vg-text-muted)] shadow-xs backdrop-blur-xs sm:flex">
            <Move className="h-3 w-3 text-[var(--vg-accent)]" />
            <span>
              {activeDraggingNode
                ? `Dragging ${activeDraggingNode.title} (${activeDraggingNode.x}, ${activeDraggingNode.y})`
                : `Armed: ${armedSpec.shortLabel} · Click any wire to fire`}
            </span>
          </div>

          {/* Live Groundedness & Shield HUD Pill (Top-Right Overlay) */}
          <div className="pointer-events-none absolute top-2.5 right-3 hidden items-center gap-2.5 rounded-full border border-[var(--vg-border)] bg-[var(--vg-panel)]/90 px-3 py-1 font-mono text-[10px] font-bold shadow-xs backdrop-blur-xs md:flex">
            <span className="text-[var(--vg-text-dim)]">LIVE GRD</span>
            <span
              data-testid="debugger-live-groundedness"
              className={
                dbg.metrics.groundedness >= 0.9
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }
            >
              {dbg.metrics.groundedness.toFixed(2)}
            </span>
            <span className="text-[var(--vg-border)]">|</span>
            <span className="text-[var(--vg-text-dim)]">EXFIL</span>
            <span
              className={
                dbg.metrics.exfiltratedBytes === 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }
            >
              {dbg.metrics.exfiltratedBytes}B
            </span>
          </div>
        </div>

        {/* Live Intercept / Deflection Toast Strip (when a fault hits) */}
        {dbg.lastInterceptBanner && (
          <div
            data-testid="debugger-intercept-banner"
            className={`flex flex-wrap items-center justify-between gap-2.5 border-t px-4 py-2.5 sm:px-5 ${
              dbg.lastInterceptBanner.blocked
                ? dbg.lastInterceptBanner.kind === 'PROMPT_INJECTION'
                  ? 'border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-900 dark:text-emerald-200'
                  : 'border-amber-500/35 bg-amber-500/[0.08] text-amber-900 dark:text-amber-200'
                : 'border-rose-500/45 bg-rose-500/[0.09] text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="flex min-w-0 items-start gap-2">
              {dbg.lastInterceptBanner.blocked &&
              dbg.lastInterceptBanner.kind === 'PROMPT_INJECTION' ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-amber-400" />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] font-bold">
                  <span>{dbg.lastInterceptBanner.title}</span>
                  <span className="rounded bg-[var(--vg-panel)] px-1.5 py-0.5 text-[9.5px] text-[var(--vg-text)]">
                    {dbg.lastInterceptBanner.ruleId}
                  </span>
                </div>
                <p className="mt-0.5 text-xs opacity-90">{dbg.lastInterceptBanner.detail}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDbg((prev) => launchDualForkRace(prev))}
                className="flex items-center gap-1 rounded-md border border-current/25 bg-[var(--vg-panel)] px-2.5 py-1 font-mono text-[10px] font-bold text-[var(--vg-text)] transition-colors hover:border-[var(--vg-accent-border)]"
              >
                <GitFork className="h-3 w-3 text-[var(--vg-accent)]" />
                <span>Fork &amp; Compare</span>
              </button>
              <button
                type="button"
                aria-label="Dismiss intercept alert"
                onClick={() => setDbg((prev) => ({ ...prev, lastInterceptBanner: null }))}
                className="rounded-md p-1 opacity-75 hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Docked Live AG-UI / MCP 2.0 / OWASP Wire Stream Ticker */}
        <div
          data-testid="live-wire-ticker"
          className="border-t border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] px-4 py-2.5 sm:px-5"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
              <span className="font-mono text-[10px] font-bold tracking-wider text-[var(--vg-text-muted)]">
                LIVE AG-UI / MCP 2.0 / OWASP WIRE STREAM
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'AG-UI SSE', 'MCP 2.0', 'OWASP', 'A2A 0.2'] as const).map((proto) => (
                <button
                  key={proto}
                  type="button"
                  onClick={() => setWireFilter(proto)}
                  className={`rounded-md px-2 py-0.5 font-mono text-[9.5px] font-bold transition-colors ${
                    wireFilter === proto
                      ? 'bg-[var(--vg-accent)] text-white'
                      : 'bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {proto}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowAllWireRows((v) => !v)}
                className="flex items-center gap-0.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-0.5 font-mono text-[9.5px] font-semibold text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]"
              >
                <span>{showAllWireRows ? 'Compact' : 'Expand'}</span>
                {showAllWireRows ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {filteredWireLog.map((entry) => {
              const expanded = expandedLogId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-panel)] transition-colors hover:border-[var(--vg-accent-border)]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(expanded ? null : entry.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 text-left font-mono text-[10.5px]"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span
                        className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold ${protocolPillStyle(
                          entry.protocol
                        )}`}
                      >
                        {entry.protocol}
                      </span>
                      <span className="truncate font-semibold text-[var(--vg-text)]">
                        {entry.headline}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2.5 text-[9.5px] text-[var(--vg-text-muted)]">
                      <span className="hidden sm:inline">
                        risk {entry.payload.riskScore.toFixed(2)}
                      </span>
                      <span className="hidden sm:inline">{entry.payload.tokens} tok</span>
                      <span className="font-bold text-[var(--vg-accent)]">
                        ${entry.payload.costUsd.toFixed(4)}
                      </span>
                    </div>
                  </button>

                  {expanded && (
                    <pre className="vg-code m-2 mt-0 overflow-x-auto rounded-md p-2.5 text-[10.5px] leading-relaxed text-[var(--vg-text)]">
                      {JSON.stringify(
                        {
                          protocol: entry.payload.protocol,
                          ...(entry.payload.jsonrpc ? { jsonrpc: entry.payload.jsonrpc } : {}),
                          ...(entry.payload.method ? { method: entry.payload.method } : {}),
                          event: entry.payload.event,
                          edgeId: entry.edgeId,
                          nodeId: entry.nodeId,
                          ...(entry.payload.ruleId ? { ruleId: entry.payload.ruleId } : {}),
                          riskScore: entry.payload.riskScore,
                          tokens: entry.payload.tokens,
                          costUsd: entry.payload.costUsd,
                          summary: entry.payload.summary,
                        },
                        null,
                        2
                      )}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Docked Side-by-Side Dual-Branch Time-Travel Fork Race Panel (Lazy-loaded, primary when active) */}
      {dbg.forkRace && dbg.forkRace.active && (
        <Suspense
          fallback={
            <div className="vg-panel rounded-xl px-5 py-4 font-mono text-xs text-[var(--vg-text-dim)]">
              LOADING DUAL-BRANCH TIME-TRAVEL FORK RACE...
            </div>
          }
        >
          <DualForkRacePanel
            race={dbg.forkRace}
            onToggleRunning={() => setDbg((prev) => toggleForkRaceRunning(prev))}
            onFinishInstant={() => setDbg((prev) => completeForkRaceInstant(prev))}
            onClose={() => setDbg((prev) => ({ ...prev, forkRace: null }))}
          />
        </Suspense>
      )}

      {/* Docked Live Breakpoint State Inspector (Lazy-loaded when Paused at ● BP) */}
      {dbg.executionMode === 'PAUSED_AT_BREAKPOINT' && pausedNode && (
        <Suspense
          fallback={
            <div className="vg-panel rounded-xl px-5 py-4 font-mono text-xs text-[var(--vg-text-dim)]">
              LOADING BREAKPOINT STATE INSPECTOR...
            </div>
          }
        >
          <BreakpointInspectorBar
            pausedNode={pausedNode}
            checkpointState={dbg.checkpointState}
            onUpdateState={(patch) => setDbg((prev) => updateCheckpointState(prev, patch))}
            onApplyJson={(rawJson) => {
              let result: { ok: boolean; error?: string } = { ok: false, error: 'Not applied' };
              setDbg((prev) => {
                const applied = applyCheckpointStateJson(prev, rawJson);
                result = applied.ok ? { ok: true } : { ok: false, error: applied.error };
                return applied.ok ? applied.state : prev;
              });
              return result;
            }}
            onStepOver={() => setDbg((prev) => stepOverBreakpoint(prev))}
            onResume={() => setDbg((prev) => resumeFromBreakpoint(prev))}
            onLaunchForkRace={() => setDbg((prev) => launchDualForkRace(prev, pausedNode.id))}
          />
        </Suspense>
      )}
    </div>
  );
};
