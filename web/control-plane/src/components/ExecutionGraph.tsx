import React, { useMemo, useState } from 'react';
import {
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from 'lucide-react';
import type { ControlPlaneRun, GraphEdgeDef, NodeId, NodeMeta } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import { GRAPH_EDGES, GRAPH_NODES } from '../engine/scenarios';
import { getLatestNodeCheckpoint } from '../engine/protocolEngine';

interface ExecutionGraphProps {
  t: Translations;
  run: ControlPlaneRun;
  selectedNodeId: NodeId | null;
  onSelectNode: (nodeId: NodeId) => void;
}

const NODE_W = 246;
const NODE_H = 104;

function getEdgePath(edge: GraphEdgeDef, nodeMap: Record<NodeId, NodeMeta>): { d: string; labelX: number; labelY: number } {
  const src = nodeMap[edge.from];
  const dst = nodeMap[edge.to];

  // Special bespoke arcs for cyclic and cross-tier edges so zero labels collide!
  if (edge.id === 'e-guard-plan') {
    // Cyclic arc looping up along the left margin from 04 -> 01
    const sx = src.x + 26;
    const sy = src.y;
    const tx = dst.x + 26;
    const ty = dst.y + NODE_H;
    return {
      d: `M ${sx} ${sy} C ${sx - 56} ${sy - 40}, ${tx - 56} ${ty + 40}, ${tx} ${ty}`,
      labelX: sx - 52,
      labelY: (sy + ty) / 2,
    };
  }

  if (edge.id === 'e-hitl-a2a') {
    // Cyclic arc from 05 top-right -> 03 bottom-left
    const sx = src.x + NODE_W - 24;
    const sy = src.y;
    const tx = dst.x + 42;
    const ty = dst.y + NODE_H;
    return {
      d: `M ${sx} ${sy} C ${sx + 24} ${sy - 48}, ${tx - 36} ${ty + 42}, ${tx} ${ty}`,
      labelX: (sx + tx) / 2 + 28,
      labelY: (sy + ty) / 2 - 4,
    };
  }

  if (edge.id === 'e-synth-mcp') {
    // Time-travel fork arc looping cleanly across the top from 06 -> 02
    const sx = src.x + NODE_W - 18;
    const sy = src.y;
    const tx = dst.x + NODE_W / 2;
    const ty = dst.y;
    return {
      d: `M ${sx} ${sy} C ${sx + 48} ${sy - 190}, ${tx + 40} ${ty - 64}, ${tx} ${ty}`,
      labelX: (sx + tx) / 2 + 12,
      labelY: 19,
    };
  }

  if (edge.id === 'e-a2a-guard') {
    // Clean sweeping diagonal from 03 bottom -> 04 top-right
    const sx = src.x + 18;
    const sy = src.y + NODE_H;
    const tx = dst.x + NODE_W - 22;
    const ty = dst.y;
    const midY = (sy + ty) / 2;
    return {
      d: `M ${sx} ${sy} C ${sx - 40} ${midY + 8}, ${tx + 60} ${midY - 8}, ${tx} ${ty}`,
      labelX: (sx + tx) / 2 + 44,
      labelY: midY - 6,
    };
  }

  if (edge.id === 'e-mcp-guard') {
    // Clean curve from 02 bottom-left -> 04 top-center
    const sx = src.x + 42;
    const sy = src.y + NODE_H;
    const tx = dst.x + NODE_W * 0.56;
    const ty = dst.y;
    const midY = (sy + ty) / 2;
    return {
      d: `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`,
      labelX: (sx + tx) / 2 - 14,
      labelY: midY + 4,
    };
  }

  if (edge.id === 'e-plan-synth') {
    // Clean bypass curve when Planner re-routes sanitized context straight to Synthesizer
    const sx = src.x + NODE_W - 24;
    const sy = src.y + NODE_H;
    const tx = dst.x + 32;
    const ty = dst.y;
    const midY = (sy + ty) / 2;
    return {
      d: `M ${sx} ${sy} C ${sx + 90} ${midY + 14}, ${tx - 90} ${midY - 14}, ${tx} ${ty}`,
      labelX: (sx + tx) / 2 + 24,
      labelY: midY + 16,
    };
  }

  if (edge.id === 'e-guard-synth') {
    // Lower bypass arc beneath HITL gate from 04 bottom -> 06 bottom
    const sx = src.x + NODE_W / 2;
    const sy = src.y + NODE_H;
    const tx = dst.x + NODE_W / 2;
    const ty = dst.y + NODE_H;
    return {
      d: `M ${sx} ${sy} C ${sx + 70} ${sy + 44}, ${tx - 70} ${ty + 44}, ${tx} ${ty}`,
      labelX: (sx + tx) / 2,
      labelY: sy + 39,
    };
  }

  // Standard horizontal neighbor edge (same tier)
  const sx = src.x + NODE_W;
  const sy = src.y + NODE_H / 2;
  const tx = dst.x;
  const ty = dst.y + NODE_H / 2;
  const dx = (tx - sx) * 0.5;
  return {
    d: `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`,
    labelX: (sx + tx) / 2,
    labelY: sy - 16,
  };
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
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  const nodeMap = useMemo(() => {
    return GRAPH_NODES.reduce(
      (acc, n) => {
        acc[n.id] = n;
        return acc;
      },
      {} as Record<NodeId, NodeMeta>
    );
  }, []);

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

  return (
    <section className="vg-panel relative overflow-hidden rounded-lg">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.graphTitle}
            </h2>
          </div>
          <p className="font-mono text-[10px] text-[var(--vg-text-dim)]">{t.graphHint}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden items-center gap-3 font-mono text-[9px] text-[var(--vg-text-muted)] md:flex">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-sky-400" /> FORWARD
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-rose-500" /> VIOLATION LOOP
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-amber-400" /> HITL / CANARY
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

      {/* Interactive SVG Canvas */}
      <div className="relative h-[376px] w-full select-none bg-[var(--vg-bg)] sm:h-[404px]">
        <svg
          data-testid="execution-graph-svg"
          viewBox="0 0 1090 416"
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
            <filter id="vg-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
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

          <rect width="1090" height="416" fill="url(#vg-tech-grid)" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Render Edges */}
            {GRAPH_EDGES.map((edge) => {
              const { d, labelX, labelY } = getEdgePath(edge, nodeMap);
              const isActive = run.active_edge_id === edge.id;
              const isVisited = run.visited_edges.includes(edge.id);
              const color = toneHex(edge.tone);
              const markerId =
                isActive || isVisited
                  ? `url(#arrow-${edge.tone ?? 'cyan'})`
                  : 'url(#arrow-muted)';

              return (
                <g key={edge.id}>
                  <path
                    id={`path-${edge.id}`}
                    d={d}
                    fill="none"
                    stroke={isActive || isVisited ? color : 'rgba(148,163,184,0.2)'}
                    strokeWidth={isActive ? 2.4 : isVisited ? 1.8 : 1.15}
                    strokeDasharray={edge.cyclic ? '5 4' : undefined}
                    className={
                      isActive
                        ? edge.cyclic
                          ? 'edge-flow-cyclic'
                          : 'edge-flow-active'
                        : undefined
                    }
                    markerEnd={markerId}
                    opacity={isActive ? 1 : isVisited ? 0.85 : 0.45}
                  />

                  {/* Optical Signal Packet traveling along active or visited cyclic edge */}
                  {(isActive || (isVisited && edge.cyclic)) && (
                    <circle r={isActive ? 4.2 : 3} fill={color} filter="url(#vg-glow)">
                      <animateMotion
                        dur={edge.cyclic ? '1.6s' : '1.15s'}
                        repeatCount="indefinite"
                        path={d}
                      />
                    </circle>
                  )}

                  {/* Edge Label Tag */}
                  {(isActive || isVisited || edge.cyclic) && (() => {
                    const pillW = Math.max(68, Math.round(edge.label.length * 5.8 + 14));
                    return (
                      <g transform={`translate(${labelX}, ${labelY})`}>
                        <rect
                          x={-pillW / 2}
                          y={-9}
                          width={pillW}
                          height={17}
                          rx={3}
                          fill="var(--vg-panel)"
                          stroke={isActive || isVisited ? color : 'var(--vg-border)'}
                          strokeWidth={0.85}
                          opacity={isActive || isVisited ? 0.96 : 0.72}
                        />
                        <text
                          textAnchor="middle"
                          y={2.5}
                          fill={isActive || isVisited ? color : 'var(--vg-text-dim)'}
                          fontSize="8.5"
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

            {/* Render 6 Specialized Graph Nodes */}
            {GRAPH_NODES.map((node) => {
              const cp = getLatestNodeCheckpoint(run, node.id);
              const isActive = run.active_node_id === node.id;
              const isVisited = run.visited_nodes.includes(node.id);
              const isSelected = selectedNodeId === node.id;
              const isPausedHere =
                run.status === 'paused_hitl' && node.id === 'hitl_approval_gate';
              const isReroutedHere =
                cp?.guardrail_status === 'rerouted' && node.id === 'policy_guardrail';
              const isWeakGrounded =
                cp?.groundedness !== undefined && cp.groundedness < 0.8 && node.id === 'grounded_synthesizer';

              let statusColor = '#64748B';
              let statusLabel = 'IDLE';
              if (isPausedHere) {
                statusColor = '#F59E0B';
                statusLabel = 'PAUSED HITL';
              } else if (isReroutedHere) {
                statusColor = '#F43F5E';
                statusLabel = 'BLOCKED · REROUTED';
              } else if (isWeakGrounded) {
                statusColor = '#F59E0B';
                statusLabel = `WARN · ${cp?.groundedness?.toFixed(2)}`;
              } else if (isActive) {
                statusColor = '#38BDF8';
                statusLabel = 'ACTIVE';
              } else if (isVisited) {
                statusColor = '#10B981';
                statusLabel = 'VERIFIED';
              }

              const borderColor = isSelected
                ? '#38BDF8'
                : isPausedHere
                  ? '#F59E0B'
                  : isReroutedHere
                    ? '#F43F5E'
                    : isActive
                      ? '#38BDF8'
                      : isVisited
                        ? 'rgba(16, 185, 129, 0.45)'
                        : 'var(--vg-border)';

              const totalTok = cp ? cp.input_tokens + cp.output_tokens : 0;

              return (
                <g
                  key={node.id}
                  data-graph-node="true"
                  data-testid={`graph-node-${node.id}`}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => onSelectNode(node.id)}
                  className="cursor-pointer"
                >
                  {/* Active Breathing Halo */}
                  {(isActive || isPausedHere) && (
                    <rect
                      x={-4}
                      y={-4}
                      width={NODE_W + 8}
                      height={NODE_H + 8}
                      rx={10}
                      fill="none"
                      stroke={statusColor}
                      strokeWidth={1.6}
                      className="node-halo-pulse"
                    />
                  )}

                  {/* Main Card Surface */}
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill="var(--vg-node-bg)"
                    stroke={borderColor}
                    strokeWidth={isSelected || isActive || isPausedHere ? 1.8 : 1.1}
                  />

                  {/* Top Accent Strip */}
                  <rect
                    x={1}
                    y={1}
                    width={NODE_W - 2}
                    height={3}
                    rx={2}
                    fill={statusColor}
                    opacity={isVisited || isActive || isPausedHere ? 0.9 : 0.25}
                  />

                  {/* Index + Protocol Badge */}
                  <text
                    x={12}
                    y={23}
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                    fill={statusColor}
                  >
                    {node.index}
                  </text>
                  <rect
                    x={32}
                    y={11}
                    width={54}
                    height={16}
                    rx={3}
                    fill="var(--vg-surface)"
                    stroke="var(--vg-border)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={59}
                    y={22}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={600}
                    fill="var(--vg-text-muted)"
                  >
                    {node.protocolBadge}
                  </text>

                  {/* Status LED + Label */}
                  <circle cx={NODE_W - 14} cy={19} r={3.5} fill={statusColor} />
                  <text
                    x={NODE_W - 23}
                    y={22}
                    textAnchor="end"
                    fontSize="8.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight={700}
                    fill={statusColor}
                  >
                    {statusLabel}
                  </text>

                  {/* Node Title & Subtitle */}
                  <text
                    x={12}
                    y={47}
                    fontSize="12.5"
                    fontFamily="Space Grotesk, Inter, sans-serif"
                    fontWeight={700}
                    fill="var(--vg-text)"
                  >
                    {node.title}
                  </text>
                  <text
                    x={12}
                    y={63}
                    fontSize="9.5"
                    fontFamily="Inter, sans-serif"
                    fill="var(--vg-text-muted)"
                  >
                    {node.subtitle}
                  </text>

                  {/* Bottom Telemetry Bar */}
                  <line
                    x1={10}
                    y1={75}
                    x2={NODE_W - 10}
                    y2={75}
                    stroke="var(--vg-border)"
                    strokeWidth={0.8}
                  />
                  <text
                    x={12}
                    y={92}
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fill="var(--vg-text-muted)"
                  >
                    {cp ? `${cp.latency_ms.toFixed(0)}ms` : '-- ms'}
                  </text>
                  <text
                    x={NODE_W / 2}
                    y={92}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fill="var(--vg-text-muted)"
                  >
                    {cp ? `${totalTok.toLocaleString()} tok` : '-- tok'}
                  </text>
                  <text
                    x={NODE_W - 12}
                    y={92}
                    textAnchor="end"
                    fontSize="9.5"
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
