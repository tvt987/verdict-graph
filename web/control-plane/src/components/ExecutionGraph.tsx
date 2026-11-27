import React, { useEffect, useMemo, useState } from 'react';
import {
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { ControlPlaneRun, GraphEdgeDef, NodeId, NodeMeta } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import type { RedTeamSimulationResult } from '../engine/redTeamClassifier';
import { GRAPH_EDGES, GRAPH_NODES } from '../engine/scenarios';
import { getLatestNodeCheckpoint } from '../engine/protocolEngine';
import {
  GRAPH_VIEWBOX,
  NODE_H,
  NODE_W,
  classifyNodeLatencyHeat,
  getEdgeGeometry,
  sampleEdgePacketTrain,
} from '../engine/graphGeometry';

interface ExecutionGraphProps {
  t: Translations;
  theme: 'light' | 'dark';
  run: ControlPlaneRun;
  selectedNodeId: NodeId | null;
  onSelectNode: (nodeId: NodeId) => void;
  redTeamOverlay?: RedTeamSimulationResult | null;
  onClearRedTeamOverlay?: () => void;
}

function getThemePalette(theme: 'light' | 'dark') {
  if (theme === 'light') {
    return {
      primary: '#4F46E5',
      emerald: '#059669',
      amber: '#D97706',
      crimson: '#E11D48',
      idle: '#64748B',
      inactiveEdge: 'rgba(100, 116, 139, 0.30)',
      packetCore: '#FFFFFF',
      nodeStrokeIdle: 'rgba(15, 23, 42, 0.14)',
      heatBg: {
        fast: 'rgba(5, 150, 105, 0.10)',
        nominal: 'rgba(79, 70, 229, 0.10)',
        warm: 'rgba(217, 119, 6, 0.12)',
        blocked: 'rgba(225, 29, 72, 0.12)',
        paused: 'rgba(217, 119, 6, 0.12)',
        idle: 'rgba(100, 116, 139, 0.10)',
      },
      heatBorder: {
        fast: 'rgba(5, 150, 105, 0.38)',
        nominal: 'rgba(79, 70, 229, 0.38)',
        warm: 'rgba(217, 119, 6, 0.42)',
        blocked: 'rgba(225, 29, 72, 0.45)',
        paused: 'rgba(217, 119, 6, 0.45)',
        idle: 'rgba(100, 116, 139, 0.28)',
      },
    };
  }
  return {
    primary: '#38BDF8',
    emerald: '#34D399',
    amber: '#FBBF24',
    crimson: '#FB7185',
    idle: '#64748B',
    inactiveEdge: 'rgba(148, 163, 184, 0.22)',
    packetCore: '#FFFFFF',
    nodeStrokeIdle: 'rgba(148, 163, 184, 0.20)',
    heatBg: {
      fast: 'rgba(16, 185, 129, 0.16)',
      nominal: 'rgba(56, 189, 248, 0.16)',
      warm: 'rgba(245, 158, 11, 0.16)',
      blocked: 'rgba(244, 63, 94, 0.18)',
      paused: 'rgba(245, 158, 11, 0.18)',
      idle: 'rgba(100, 116, 139, 0.14)',
    },
    heatBorder: {
      fast: 'rgba(52, 211, 153, 0.45)',
      nominal: 'rgba(56, 189, 248, 0.45)',
      warm: 'rgba(251, 191, 36, 0.48)',
      blocked: 'rgba(251, 113, 133, 0.55)',
      paused: 'rgba(251, 191, 36, 0.55)',
      idle: 'rgba(100, 116, 139, 0.32)',
    },
  };
}

function toneHex(tone: GraphEdgeDef['tone'] | undefined, palette: ReturnType<typeof getThemePalette>): string {
  switch (tone) {
    case 'crimson':
      return palette.crimson;
    case 'amber':
      return palette.amber;
    case 'emerald':
      return palette.emerald;
    default:
      return palette.primary;
  }
}

export const ExecutionGraph: React.FC<ExecutionGraphProps> = ({
  t,
  theme,
  run,
  selectedNodeId,
  onSelectNode,
  redTeamOverlay = null,
  onClearRedTeamOverlay,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });
  const [animPhase, setAnimPhase] = useState(0.28);

  const palette = useMemo(() => getThemePalette(theme), [theme]);
  const isLight = theme === 'light';

  // Smooth 60fps photonic packet animation loop
  useEffect(() => {
    let rafId = 0;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dtSec = Math.min(0.08, (now - lastTs) / 1000);
      lastTs = now;
      setAnimPhase((prev) => (prev + dtSec * 0.42) % 1);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const nodeMap = useMemo(() => {
    return GRAPH_NODES.reduce(
      (acc, n) => {
        acc[n.id] = n;
        return acc;
      },
      {} as Record<NodeId, NodeMeta>
    );
  }, []);

  const edgeGeometries = useMemo(() => {
    return GRAPH_EDGES.map((edge) => ({
      edge,
      geometry: getEdgeGeometry(edge, nodeMap),
    }));
  }, [nodeMap]);

  const activeBranch = run.branches[run.active_branch_id];
  const branchTotalLatency = Math.max(1, activeBranch?.total_latency_ms ?? 1);
  const redTeamBlocked = Boolean(redTeamOverlay && !redTeamOverlay.passed);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as HTMLElement).closest('[data-graph-node="true"]')) return;
    setDragging(true);
    setDragOrigin({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragOrigin.x, y: e.clientY - dragOrigin.y });
  };

  const handleMouseUp = () => setDragging(false);

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const activePacketEdges = edgeGeometries.filter(({ edge }) => {
    const isRedTeamReroute =
      redTeamBlocked && (edge.id === 'e-guard-plan' || edge.id === 'e-plan-synth');
    return (
      isRedTeamReroute ||
      run.active_edge_id === edge.id ||
      run.visited_edges.includes(edge.id)
    );
  }).length;

  return (
    <section className="vg-panel relative overflow-hidden rounded-xl">
      {/* Breathable Studio Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--vg-border)] px-5 py-3.5">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: redTeamBlocked ? palette.crimson : palette.primary,
                boxShadow: `0 0 10px ${redTeamBlocked ? palette.crimson : palette.primary}`,
              }}
            />
            <h2 className="font-display text-sm font-bold tracking-tight text-[var(--vg-text)]">
              {t.graphTitle}
            </h2>
            <span className="hidden rounded-full border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--vg-accent)] sm:inline-flex">
              {activePacketEdges} LIVE CHANNELS · PHOTONIC TELEMETRY
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--vg-text-muted)]">{t.graphHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Red-Team Active Alert Pill */}
          {redTeamOverlay && (
            <div
              data-testid="graph-redteam-pill"
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-semibold ${
                redTeamBlocked
                  ? 'border-rose-500/50 bg-rose-500/12 text-rose-700 dark:text-rose-300'
                  : 'border-emerald-500/50 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>
                {redTeamBlocked
                  ? `QUARANTINED (${redTeamOverlay.risk_score.toFixed(2)}) · 04 -> 01`
                  : `RED-TEAM CLEAN (${redTeamOverlay.risk_score.toFixed(2)})`}
              </span>
              {onClearRedTeamOverlay && (
                <button
                  type="button"
                  onClick={onClearRedTeamOverlay}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label="Clear Red-Team Graph Overlay"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Crisp Heat Legend */}
          <div className="hidden items-center gap-3 font-mono text-[10px] text-[var(--vg-text-muted)] xl:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.emerald }} />
              &lt;100ms
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.primary }} />
              100-200ms
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.amber }} />
              &gt;200ms
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.crimson }} />
              BLOCKED
            </span>
          </div>

          {/* Pan/Zoom Controls */}
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
              onClick={handleResetView}
              className="rounded-md p-1.5 text-[var(--vg-text-muted)] transition-colors hover:bg-[var(--vg-panel)] hover:text-[var(--vg-text)]"
              title="Fit View"
              aria-label="Reset View"
            >
              {zoom !== 1 || pan.x !== 0 || pan.y !== 0 ? (
                <RotateCcw className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Generous Interactive Photonic SVG Canvas */}
      <div className="relative h-[400px] w-full select-none bg-[var(--vg-bg)] sm:h-[470px] lg:h-[510px]">
        <svg
          data-testid="execution-graph-svg"
          viewBox={`-18 -14 ${GRAPH_VIEWBOX.width + 36} ${GRAPH_VIEWBOX.height + 28}`}
          className={`h-full w-full ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <pattern id="vg-tech-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path
                d="M 28 0 L 0 0 0 28"
                fill="none"
                stroke="var(--vg-grid-line)"
                strokeWidth="1"
              />
              <circle cx="0" cy="0" r="1.15" fill="var(--vg-grid-dot)" />
            </pattern>
            <filter id="vg-node-shadow" x="-12%" y="-12%" width="124%" height="132%">
              <feDropShadow
                dx="0"
                dy={isLight ? 4 : 6}
                stdDeviation={isLight ? 5 : 6}
                floodColor={isLight ? '#0F172A' : '#000000'}
                floodOpacity={isLight ? 0.07 : 0.35}
              />
            </filter>
            <filter id="vg-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.0" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="vg-packet-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="3.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker
              id="arrow-cyan"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.primary} />
            </marker>
            <marker
              id="arrow-crimson"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.crimson} />
            </marker>
            <marker
              id="arrow-amber"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.amber} />
            </marker>
            <marker
              id="arrow-emerald"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.emerald} />
            </marker>
            <marker
              id="arrow-muted"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill={palette.inactiveEdge} />
            </marker>
          </defs>

          <rect
            x={-18}
            y={-14}
            width={GRAPH_VIEWBOX.width + 36}
            height={GRAPH_VIEWBOX.height + 28}
            fill="url(#vg-tech-grid)"
          />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Curved Bezier Edges + Live Photonic Packets */}
            {edgeGeometries.map(({ edge, geometry }, edgeIdx) => {
              const { d, curve, labelX, labelY } = geometry;
              const isRedTeamReroute = redTeamBlocked && edge.id === 'e-guard-plan';
              const isRedTeamSafePath = redTeamBlocked && edge.id === 'e-plan-synth';
              const isActive =
                run.active_edge_id === edge.id || isRedTeamReroute || isRedTeamSafePath;
              const isVisited = run.visited_edges.includes(edge.id);
              const color = isRedTeamReroute ? palette.crimson : toneHex(edge.tone, palette);
              const markerId = isRedTeamReroute
                ? 'url(#arrow-crimson)'
                : isActive || isVisited
                  ? `url(#arrow-${edge.tone ?? 'cyan'})`
                  : 'url(#arrow-muted)';

              const hasPackets = isActive || isVisited;
              const edgePhase =
                (animPhase * (isRedTeamReroute ? 1.55 : isActive ? 1.25 : 0.85) +
                  edgeIdx * 0.17) %
                1;
              const packets = hasPackets
                ? sampleEdgePacketTrain(
                    curve,
                    edgePhase,
                    isActive || edge.cyclic ? 2 : 1,
                    isActive ? 5 : 3,
                    isActive ? 0.03 : 0.025,
                    isActive ? 4.4 : 3.3
                  )
                : [];

              return (
                <g key={edge.id} data-edge-id={edge.id}>
                  {isActive && (
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={6}
                      opacity={isLight ? 0.14 : 0.18}
                      filter="url(#vg-glow)"
                    />
                  )}

                  <path
                    id={`path-${edge.id}`}
                    d={d}
                    fill="none"
                    stroke={isActive || isVisited ? color : palette.inactiveEdge}
                    strokeWidth={isActive ? 2.5 : isVisited ? 1.9 : 1.25}
                    strokeDasharray={edge.cyclic ? '5 4' : undefined}
                    className={
                      isActive
                        ? edge.cyclic
                          ? 'edge-flow-cyclic'
                          : 'edge-flow-active'
                        : undefined
                    }
                    markerEnd={markerId}
                    opacity={isActive ? 1 : isVisited ? 0.88 : 0.55}
                  />

                  {/* Glowing Photonic Protocol Packets */}
                  {packets.map((pkt) => (
                    <g key={pkt.id} data-photonic-packet={pkt.isHead ? edge.id : undefined}>
                      {pkt.isHead && (
                        <circle
                          cx={pkt.x}
                          cy={pkt.y}
                          r={pkt.radius * 2.0}
                          fill={color}
                          opacity={pkt.opacity * (isLight ? 0.22 : 0.30)}
                          filter="url(#vg-packet-glow)"
                        />
                      )}
                      <circle
                        cx={pkt.x}
                        cy={pkt.y}
                        r={pkt.radius}
                        fill={pkt.isHead ? palette.packetCore : color}
                        stroke={pkt.isHead ? color : 'none'}
                        strokeWidth={pkt.isHead ? 2.0 : 0}
                        opacity={pkt.opacity}
                      />
                    </g>
                  ))}

                  {/* Crisp High-Contrast Edge Label Pill */}
                  {(isActive || isVisited || edge.cyclic) &&
                    (() => {
                      const pillW = Math.max(76, Math.round(edge.label.length * 6.0 + 18));
                      return (
                        <g transform={`translate(${labelX}, ${labelY})`}>
                          <rect
                            x={-pillW / 2}
                            y={-10}
                            width={pillW}
                            height={20}
                            rx={5}
                            fill="var(--vg-panel)"
                            stroke={isActive || isVisited ? color : 'var(--vg-border)'}
                            strokeWidth={isActive ? 1.25 : 0.9}
                            opacity={0.97}
                          />
                          <text
                            textAnchor="middle"
                            y={3}
                            fill={isActive || isVisited ? color : 'var(--vg-text-dim)'}
                            fontSize="8.6"
                            fontFamily="JetBrains Mono, monospace"
                            fontWeight={isActive || isVisited ? 700 : 600}
                          >
                            {edge.label}
                          </text>
                        </g>
                      );
                    })()}
                </g>
              );
            })}

            {/* 6 Specialized Multi-Agent Graph Nodes */}
            {GRAPH_NODES.map((node) => {
              const cp = getLatestNodeCheckpoint(run, node.id);
              const isRedTeamGuardNode = redTeamBlocked && node.id === 'policy_guardrail';
              const isRedTeamPlannerNode = redTeamBlocked && node.id === 'supervisor_planner';
              const isActive = run.active_node_id === node.id || isRedTeamPlannerNode;
              const isVisited = run.visited_nodes.includes(node.id);
              const isSelected = selectedNodeId === node.id;
              const isPausedHere =
                run.status === 'paused_hitl' && node.id === 'hitl_approval_gate';

              const heat = classifyNodeLatencyHeat(cp, {
                isPausedHitl: isPausedHere,
                isRedTeamBlocked: isRedTeamGuardNode,
              });

              const heatColor =
                heat.tier === 'fast'
                  ? palette.emerald
                  : heat.tier === 'nominal'
                    ? palette.primary
                    : heat.tier === 'warm' || heat.tier === 'paused'
                      ? palette.amber
                      : heat.tier === 'blocked'
                        ? palette.crimson
                        : palette.idle;

              const isWeakGrounded =
                cp?.groundedness !== undefined &&
                cp.groundedness < 0.8 &&
                node.id === 'grounded_synthesizer';

              const accentHex = isRedTeamGuardNode
                ? palette.crimson
                : isPausedHere
                  ? palette.amber
                  : isWeakGrounded
                    ? palette.amber
                    : isActive
                      ? palette.primary
                      : heat.tier === 'blocked'
                        ? palette.crimson
                        : isVisited
                          ? heatColor
                          : palette.idle;

              const borderColor = isSelected
                ? palette.primary
                : isRedTeamGuardNode || heat.tier === 'blocked'
                  ? palette.crimson
                  : isPausedHere
                    ? palette.amber
                    : isActive
                      ? palette.primary
                      : isVisited
                        ? palette.heatBorder[heat.tier]
                        : palette.nodeStrokeIdle;

              const totalTok = cp ? cp.input_tokens + cp.output_tokens : 0;
              const latencySharePct = isRedTeamGuardNode
                ? 100
                : isPausedHere
                  ? 82
                  : cp
                    ? Math.max(12, Math.min(100, Math.round((cp.latency_ms / branchTotalLatency) * 100)))
                    : 0;

              const heatBadgeText = isRedTeamGuardNode
                ? `BLOCKED · ${redTeamOverlay?.risk_score.toFixed(2)}`
                : isWeakGrounded
                  ? `WARN · ${cp?.groundedness?.toFixed(2)}`
                  : heat.shortLabel;

              const heatPillW = Math.max(58, Math.round(heatBadgeText.length * 5.8 + 18));

              return (
                <g
                  key={node.id}
                  data-graph-node="true"
                  data-testid={`graph-node-${node.id}`}
                  data-heat-tier={heat.tier}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => onSelectNode(node.id)}
                  className="cursor-pointer"
                >
                  {(isActive || isPausedHere || isRedTeamGuardNode || heat.tier === 'blocked') && (
                    <>
                      <rect
                        x={-5}
                        y={-5}
                        width={NODE_W + 10}
                        height={NODE_H + 10}
                        rx={13}
                        fill="none"
                        stroke={accentHex}
                        strokeWidth={1.8}
                        className="node-halo-pulse"
                      />
                      <rect
                        x={-10}
                        y={-10}
                        width={NODE_W + 20}
                        height={NODE_H + 20}
                        rx={16}
                        fill="none"
                        stroke={accentHex}
                        strokeWidth={0.95}
                        strokeDasharray="4 4"
                        className="node-halo-outer"
                      />
                    </>
                  )}

                  {/* Elevated Studio Card Surface */}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={10}
                    fill="var(--vg-node-bg)"
                    stroke={borderColor}
                    strokeWidth={
                      isSelected || isActive || isPausedHere || isRedTeamGuardNode ? 2.0 : 1.25
                    }
                    filter="url(#vg-node-shadow)"
                  />

                  {/* Top Accent Indicator Bar */}
                  <rect
                    x={1}
                    y={1}
                    width={NODE_W - 2}
                    height={3.5}
                    rx={2}
                    fill={accentHex}
                    opacity={isVisited || isActive || isPausedHere || isRedTeamGuardNode ? 0.95 : 0.25}
                  />

                  {/* Index + Protocol Chip */}
                  <text
                    x={13}
                    y={24}
                    fontSize="10.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                    fill={accentHex}
                  >
                    {node.index}
                  </text>
                  <rect
                    x={31}
                    y={12}
                    width={56}
                    height={16.5}
                    rx={4}
                    fill="var(--vg-surface)"
                    stroke="var(--vg-border)"
                    strokeWidth={0.9}
                  />
                  <text
                    x={59}
                    y={23}
                    textAnchor="middle"
                    fontSize="8.4"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                    fill="var(--vg-text-muted)"
                  >
                    {node.protocolBadge}
                  </text>

                  {/* Per-Node Heat Status Pill */}
                  <g transform={`translate(${NODE_W - heatPillW - 11}, 12)`}>
                    <rect
                      width={heatPillW}
                      height={16.5}
                      rx={4}
                      fill={isWeakGrounded ? palette.heatBg.warm : palette.heatBg[heat.tier]}
                      stroke={
                        isWeakGrounded ? palette.heatBorder.warm : palette.heatBorder[heat.tier]
                      }
                      strokeWidth={0.9}
                    />
                    <circle
                      cx={8}
                      cy={8.25}
                      r={2.7}
                      fill={isWeakGrounded ? palette.amber : heatColor}
                    />
                    <text
                      x={15}
                      y={11.2}
                      fontSize="8.2"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill={isWeakGrounded ? palette.amber : heatColor}
                    >
                      {heatBadgeText}
                    </text>
                  </g>

                  {/* Node Title & Subtitle */}
                  <text
                    x={13}
                    y={47}
                    fontSize="13"
                    fontFamily="Space Grotesk, Inter, sans-serif"
                    fontWeight={700}
                    fill="var(--vg-text)"
                  >
                    {node.title}
                  </text>
                  <text
                    x={13}
                    y={62}
                    fontSize="9.6"
                    fontFamily="Inter, sans-serif"
                    fill="var(--vg-text-muted)"
                  >
                    {node.subtitle}
                  </text>

                  {/* Micro-Progress Bar */}
                  <rect
                    x={13}
                    y={72}
                    width={NODE_W - 26}
                    height={4.5}
                    rx={2.25}
                    fill="var(--vg-surface)"
                  />
                  {latencySharePct > 0 && (
                    <rect
                      x={13}
                      y={72}
                      width={((NODE_W - 26) * latencySharePct) / 100}
                      height={4.5}
                      rx={2.25}
                      fill={accentHex}
                      opacity={0.95}
                    />
                  )}

                  {/* Bottom Telemetry Footer */}
                  <line
                    x1={11}
                    y1={85}
                    x2={NODE_W - 11}
                    y2={85}
                    stroke="var(--vg-border)"
                    strokeWidth={0.85}
                  />
                  <text
                    x={13}
                    y={102}
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                    fill={cp || isRedTeamGuardNode ? accentHex : 'var(--vg-text-muted)'}
                  >
                    {isRedTeamGuardNode
                      ? `${redTeamOverlay?.evaluation_ms.toFixed(0)}ms`
                      : cp
                        ? `${cp.latency_ms.toFixed(0)}ms`
                        : '-- ms'}
                  </text>
                  <text
                    x={NODE_W / 2}
                    y={102}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fill="var(--vg-text-muted)"
                  >
                    {cp ? `${totalTok.toLocaleString()} tok` : '-- tok'}
                  </text>
                  <text
                    x={NODE_W - 13}
                    y={102}
                    textAnchor="end"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                    fill={cp && cp.cost_usd > 0 ? palette.primary : 'var(--vg-text-dim)'}
                  >
                    {cp ? `$${cp.cost_usd.toFixed(4)}` : '$0.0000'}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </section>
  );
};
