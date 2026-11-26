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
  run: ControlPlaneRun;
  selectedNodeId: NodeId | null;
  onSelectNode: (nodeId: NodeId) => void;
  redTeamOverlay?: RedTeamSimulationResult | null;
  onClearRedTeamOverlay?: () => void;
}

function toneHex(tone?: GraphEdgeDef['tone']): string {
  switch (tone) {
    case 'crimson':
      return '#F43F5E';
    case 'amber':
      return '#F59E0B';
    case 'emerald':
      return '#10B981';
    default:
      return '#38BDF8';
  }
}

export const ExecutionGraph: React.FC<ExecutionGraphProps> = ({
  t,
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

  // Count how many edges currently carry live photonic packets
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
    <section className="vg-panel relative overflow-hidden rounded-lg">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                redTeamBlocked
                  ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                  : 'bg-sky-400 shadow-[0_0_8px_#38bdf8]'
              }`}
            />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.graphTitle}
            </h2>
            <span className="hidden rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-sky-400 sm:inline-flex">
              {activePacketEdges} ACTIVE CHANNELS · PHOTONIC TELEMETRY
            </span>
          </div>
          <p className="font-mono text-[10px] text-[var(--vg-text-dim)]">{t.graphHint}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Red-Team Active Alert Pill */}
          {redTeamOverlay && (
            <div
              data-testid="graph-redteam-pill"
              className={`flex items-center gap-1.5 rounded border px-2 py-0.5 font-mono text-[10px] font-semibold ${
                redTeamBlocked
                  ? 'border-rose-400/60 bg-rose-500/15 text-rose-300'
                  : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-300'
              }`}
            >
              <ShieldAlert className="h-3 w-3" />
              <span>
                {redTeamBlocked
                  ? `QUARANTINED (${redTeamOverlay.risk_score.toFixed(2)}) · 04 -> 01`
                  : `RED-TEAM CLEAN (${redTeamOverlay.risk_score.toFixed(2)})`}
              </span>
              {onClearRedTeamOverlay && (
                <button
                  type="button"
                  onClick={onClearRedTeamOverlay}
                  className="ml-0.5 rounded p-0.5 hover:bg-black/20"
                  aria-label="Clear Red-Team Graph Overlay"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Heat & Edge Legend */}
          <div className="hidden items-center gap-2.5 font-mono text-[9px] text-[var(--vg-text-muted)] xl:flex">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-2.5 rounded-full bg-emerald-400" /> &lt;100ms
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-2.5 rounded-full bg-sky-400" /> 100-200ms
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-2.5 rounded-full bg-amber-400" /> &gt;200ms
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-2.5 rounded-full bg-rose-500" /> BLOCKED
            </span>
          </div>

          {/* Pan/Zoom Controls */}
          <div className="flex items-center gap-0.5 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.12).toFixed(2))))}
              className="rounded p-1 text-[var(--vg-text-muted)] hover:bg-[var(--vg-panel)] hover:text-[var(--vg-text)]"
              title="Zoom Out"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="px-1 font-mono text-[10px] text-[var(--vg-text-muted)]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.45, Number((z + 0.12).toFixed(2))))}
              className="rounded p-1 text-[var(--vg-text-muted)] hover:bg-[var(--vg-panel)] hover:text-[var(--vg-text)]"
              title="Zoom In"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="rounded p-1 text-[var(--vg-text-muted)] hover:bg-[var(--vg-panel)] hover:text-[var(--vg-text)]"
              title="Fit View"
            >
              {zoom !== 1 || pan.x !== 0 || pan.y !== 0 ? (
                <RotateCcw className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Photonic SVG Canvas */}
      <div className="relative h-[386px] w-full select-none bg-[var(--vg-bg)] sm:h-[418px]">
        <svg
          data-testid="execution-graph-svg"
          viewBox={`0 0 ${GRAPH_VIEWBOX.width} ${GRAPH_VIEWBOX.height}`}
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
              <circle cx="0" cy="0" r="1" fill="var(--vg-grid-dot)" />
            </pattern>
            <filter id="vg-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="vg-packet-glow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="4.2" result="blur" />
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
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38BDF8" />
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
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#F43F5E" />
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
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#F59E0B" />
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
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10B981" />
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
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="rgba(148,163,184,0.35)" />
            </marker>
          </defs>

          <rect width={GRAPH_VIEWBOX.width} height={GRAPH_VIEWBOX.height} fill="url(#vg-tech-grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Render Curved Bezier Edges + Live Photonic Packets */}
            {edgeGeometries.map(({ edge, geometry }, edgeIdx) => {
              const { d, curve, labelX, labelY } = geometry;
              const isRedTeamReroute = redTeamBlocked && edge.id === 'e-guard-plan';
              const isRedTeamSafePath = redTeamBlocked && edge.id === 'e-plan-synth';
              const isActive =
                run.active_edge_id === edge.id || isRedTeamReroute || isRedTeamSafePath;
              const isVisited = run.visited_edges.includes(edge.id);
              const color = isRedTeamReroute ? '#F43F5E' : toneHex(edge.tone);
              const markerId =
                isRedTeamReroute
                  ? 'url(#arrow-crimson)'
                  : isActive || isVisited
                    ? `url(#arrow-${edge.tone ?? 'cyan'})`
                    : 'url(#arrow-muted)';

              const hasPackets = isActive || isVisited;
              const edgePhase = (animPhase * (isRedTeamReroute ? 1.55 : isActive ? 1.25 : 0.85) + edgeIdx * 0.17) % 1;
              const packets = hasPackets
                ? sampleEdgePacketTrain(
                    curve,
                    edgePhase,
                    isActive || edge.cyclic ? 2 : 1,
                    isActive ? 5 : 3,
                    isActive ? 0.03 : 0.025,
                    isActive ? 4.3 : 3.1
                  )
                : [];

              return (
                <g key={edge.id} data-edge-id={edge.id}>
                  {/* Subtle under-glow conduit on active or red-team edges */}
                  {isActive && (
                    <path
                      d={d}
                      fill="none"
                      stroke={color}
                      strokeWidth={5.5}
                      opacity={0.16}
                      filter="url(#vg-glow)"
                    />
                  )}

                  {/* Primary Bezier Wire */}
                  <path
                    id={`path-${edge.id}`}
                    d={d}
                    fill="none"
                    stroke={isActive || isVisited ? color : 'rgba(148,163,184,0.2)'}
                    strokeWidth={isActive ? 2.4 : isVisited ? 1.75 : 1.15}
                    strokeDasharray={edge.cyclic ? '5 4' : undefined}
                    className={
                      isActive
                        ? edge.cyclic
                          ? 'edge-flow-cyclic'
                          : 'edge-flow-active'
                        : undefined
                    }
                    markerEnd={markerId}
                    opacity={isActive ? 1 : isVisited ? 0.84 : 0.4}
                  />

                  {/* Glowing Photonic Protocol Packets traveling smoothly along Bezier curve */}
                  {packets.map((pkt) => (
                    <g key={pkt.id} data-photonic-packet={pkt.isHead ? edge.id : undefined}>
                      {pkt.isHead && (
                        <circle
                          cx={pkt.x}
                          cy={pkt.y}
                          r={pkt.radius * 2.1}
                          fill={color}
                          opacity={pkt.opacity * 0.28}
                          filter="url(#vg-packet-glow)"
                        />
                      )}
                      <circle
                        cx={pkt.x}
                        cy={pkt.y}
                        r={pkt.radius}
                        fill={pkt.isHead ? '#FFFFFF' : color}
                        stroke={pkt.isHead ? color : 'none'}
                        strokeWidth={pkt.isHead ? 1.6 : 0}
                        opacity={pkt.opacity}
                        filter={pkt.isHead ? 'url(#vg-packet-glow)' : undefined}
                      />
                    </g>
                  ))}

                  {/* Edge Label Tag */}
                  {(isActive || isVisited || edge.cyclic) && (() => {
                    const pillW = Math.max(72, Math.round(edge.label.length * 5.7 + 16));
                    return (
                      <g transform={`translate(${labelX}, ${labelY})`}>
                        <rect
                          x={-pillW / 2}
                          y={-9.5}
                          width={pillW}
                          height={18}
                          rx={3.5}
                          fill="var(--vg-panel)"
                          stroke={isActive || isVisited ? color : 'var(--vg-border)'}
                          strokeWidth={isActive ? 1.15 : 0.85}
                          opacity={isActive || isVisited ? 0.96 : 0.72}
                        />
                        <text
                          textAnchor="middle"
                          y={2.5}
                          fill={isActive || isVisited ? color : 'var(--vg-text-dim)'}
                          fontSize="8.3"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight={isActive ? 700 : 500}
                        >
                          {edge.label}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* Render 6 Specialized Graph Nodes with Heat Badges & Micro-Progress Bars */}
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

              const isWeakGrounded =
                cp?.groundedness !== undefined &&
                cp.groundedness < 0.8 &&
                node.id === 'grounded_synthesizer';

              const accentHex = isRedTeamGuardNode
                ? '#F43F5E'
                : isPausedHere
                  ? '#F59E0B'
                  : isWeakGrounded
                    ? '#F59E0B'
                    : isActive
                      ? '#38BDF8'
                      : heat.tier === 'blocked'
                        ? '#F43F5E'
                        : isVisited
                          ? heat.hex
                          : '#64748B';

              const borderColor = isSelected
                ? '#38BDF8'
                : isRedTeamGuardNode || heat.tier === 'blocked'
                  ? '#F43F5E'
                  : isPausedHere
                    ? '#F59E0B'
                    : isActive
                      ? '#38BDF8'
                      : isVisited
                        ? heat.pillBorder
                        : 'var(--vg-border)';

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

              const heatPillW = Math.max(54, Math.round(heatBadgeText.length * 5.6 + 18));

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
                  {/* Multi-Ring Breathing Halo for Active / Paused / Red-Team Quarantined Nodes */}
                  {(isActive || isPausedHere || isRedTeamGuardNode || heat.tier === 'blocked') && (
                    <>
                      <rect
                        x={-5}
                        y={-5}
                        width={NODE_W + 10}
                        height={NODE_H + 10}
                        rx={11}
                        fill="none"
                        stroke={accentHex}
                        strokeWidth={1.7}
                        className="node-halo-pulse"
                      />
                      <rect
                        x={-10}
                        y={-10}
                        width={NODE_W + 20}
                        height={NODE_H + 20}
                        rx={14}
                        fill="none"
                        stroke={accentHex}
                        strokeWidth={0.9}
                        strokeDasharray="4 4"
                        className="node-halo-outer"
                      />
                    </>
                  )}

                  {/* Main Card Surface */}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill="var(--vg-node-bg)"
                    stroke={borderColor}
                    strokeWidth={isSelected || isActive || isPausedHere || isRedTeamGuardNode ? 1.9 : 1.15}
                  />

                  {/* Top Accent Strip */}
                  <rect
                    x={1}
                    y={1}
                    width={NODE_W - 2}
                    height={3}
                    rx={2}
                    fill={accentHex}
                    opacity={isVisited || isActive || isPausedHere || isRedTeamGuardNode ? 0.95 : 0.25}
                  />

                  {/* Index + Protocol Badge */}
                  <text
                    x={12}
                    y={23}
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                    fill={accentHex}
                  >
                    {node.index}
                  </text>
                  <rect
                    x={30}
                    y={11}
                    width={54}
                    height={16}
                    rx={3}
                    fill="var(--vg-surface)"
                    stroke="var(--vg-border)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={57}
                    y={22}
                    textAnchor="middle"
                    fontSize="8.3"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={600}
                    fill="var(--vg-text-muted)"
                  >
                    {node.protocolBadge}
                  </text>

                  {/* Per-Node Latency Heat Badge Pill */}
                  <g transform={`translate(${NODE_W - heatPillW - 10}, 11)`}>
                    <rect
                      width={heatPillW}
                      height={16}
                      rx={3.5}
                      fill={isWeakGrounded ? 'rgba(245, 158, 11, 0.16)' : heat.pillBg}
                      stroke={isWeakGrounded ? 'rgba(245, 158, 11, 0.5)' : heat.pillBorder}
                      strokeWidth={0.85}
                    />
                    <circle
                      cx={7.5}
                      cy={8}
                      r={2.6}
                      fill={isWeakGrounded ? '#F59E0B' : heat.hex}
                    />
                    <text
                      x={14}
                      y={11}
                      fontSize="8"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill={isWeakGrounded ? '#F59E0B' : heat.hex}
                    >
                      {heatBadgeText}
                    </text>
                  </g>

                  {/* Node Title & Subtitle */}
                  <text
                    x={12}
                    y={46}
                    fontSize="12.5"
                    fontFamily="Space Grotesk, Inter, sans-serif"
                    fontWeight={700}
                    fill="var(--vg-text)"
                  >
                    {node.title}
                  </text>
                  <text
                    x={12}
                    y={61}
                    fontSize="9.3"
                    fontFamily="Inter, sans-serif"
                    fill="var(--vg-text-muted)"
                  >
                    {node.subtitle}
                  </text>

                  {/* Micro-Progress Bar (Latency Share / Quarantine Fill) */}
                  <rect
                    x={12}
                    y={71}
                    width={NODE_W - 24}
                    height={4.5}
                    rx={2.25}
                    fill="var(--vg-surface)"
                    stroke="var(--vg-border)"
                    strokeWidth={0.5}
                  />
                  {latencySharePct > 0 && (
                    <rect
                      x={12}
                      y={71}
                      width={((NODE_W - 24) * latencySharePct) / 100}
                      height={4.5}
                      rx={2.25}
                      fill={accentHex}
                      opacity={0.92}
                    />
                  )}

                  {/* Bottom Telemetry Footer */}
                  <line
                    x1={10}
                    y1={84}
                    x2={NODE_W - 10}
                    y2={84}
                    stroke="var(--vg-border)"
                    strokeWidth={0.75}
                  />
                  <text
                    x={12}
                    y={101}
                    fontSize="9.3"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={600}
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
                    y={101}
                    textAnchor="middle"
                    fontSize="9.3"
                    fontFamily="JetBrains Mono, monospace"
                    fill="var(--vg-text-muted)"
                  >
                    {cp ? `${totalTok.toLocaleString()} tok` : '-- tok'}
                  </text>
                  <text
                    x={NODE_W - 12}
                    y={101}
                    textAnchor="end"
                    fontSize="9.3"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={600}
                    fill={cp && cp.cost_usd > 0 ? '#38BDF8' : 'var(--vg-text-dim)'}
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
