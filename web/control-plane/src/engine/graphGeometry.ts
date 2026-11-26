import type { Checkpoint, GraphEdgeDef, NodeId, NodeMeta } from '../types/protocol';

export const NODE_W = 248;
export const NODE_H = 112;

export const GRAPH_VIEWBOX = {
  width: 1120,
  height: 436,
} as const;

export interface Point2D {
  x: number;
  y: number;
}

export interface CubicBezierCurve {
  p0: Point2D;
  p1: Point2D;
  p2: Point2D;
  p3: Point2D;
}

export interface EdgeGeometry {
  d: string;
  curve: CubicBezierCurve;
  labelX: number;
  labelY: number;
}

export interface PacketSample {
  id: string;
  x: number;
  y: number;
  t: number;
  radius: number;
  opacity: number;
  isHead: boolean;
}

export type LatencyHeatTier = 'fast' | 'nominal' | 'warm' | 'blocked' | 'paused' | 'idle';

export interface LatencyHeatBadge {
  tier: LatencyHeatTier;
  label: string;
  shortLabel: string;
  hex: string;
  pillBg: string;
  pillBorder: string;
  textClass: string;
}

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function evaluateCubicBezier(curve: CubicBezierCurve, rawT: number): Point2D {
  const t = clamp01(rawT);
  const u = 1 - t;
  const u2 = u * u;
  const u3 = u2 * u;
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x:
      u3 * curve.p0.x +
      3 * u2 * t * curve.p1.x +
      3 * u * t2 * curve.p2.x +
      t3 * curve.p3.x,
    y:
      u3 * curve.p0.y +
      3 * u2 * t * curve.p1.y +
      3 * u * t2 * curve.p2.y +
      t3 * curve.p3.y,
  };
}

export function evaluateCubicBezierTangent(
  curve: CubicBezierCurve,
  rawT: number
): { dx: number; dy: number; angleDeg: number } {
  const t = clamp01(rawT);
  const u = 1 - t;
  const dx =
    3 * u * u * (curve.p1.x - curve.p0.x) +
    6 * u * t * (curve.p2.x - curve.p1.x) +
    3 * t * t * (curve.p3.x - curve.p2.x);
  const dy =
    3 * u * u * (curve.p1.y - curve.p0.y) +
    6 * u * t * (curve.p2.y - curve.p1.y) +
    3 * t * t * (curve.p3.y - curve.p2.y);

  return {
    dx,
    dy,
    angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

export function sampleEdgePacketTrain(
  curve: CubicBezierCurve,
  phase: number,
  packetCount = 2,
  trailSteps = 4,
  trailSpacing = 0.032,
  baseRadius = 3.8
): PacketSample[] {
  const samples: PacketSample[] = [];
  const normPhase = ((phase % 1) + 1) % 1;

  for (let p = 0; p < packetCount; p += 1) {
    const headT = (normPhase + p / packetCount) % 1;
    const headPt = evaluateCubicBezier(curve, headT);
    // Smooth edge fade-in and fade-out near node terminals
    const edgeFade = Math.min(1, headT * 8, (1 - headT) * 8);

    samples.push({
      id: `p${p}-head`,
      x: headPt.x,
      y: headPt.y,
      t: headT,
      radius: baseRadius,
      opacity: Number((0.98 * edgeFade).toFixed(3)),
      isHead: true,
    });

    for (let s = 1; s <= trailSteps; s += 1) {
      const tailT = headT - s * trailSpacing;
      if (tailT < 0.01) continue;
      const tailPt = evaluateCubicBezier(curve, tailT);
      const decay = 1 - s / (trailSteps + 1);
      samples.push({
        id: `p${p}-t${s}`,
        x: tailPt.x,
        y: tailPt.y,
        t: tailT,
        radius: Number((baseRadius * (0.42 + 0.45 * decay)).toFixed(2)),
        opacity: Number((0.68 * decay * edgeFade).toFixed(3)),
        isHead: false,
      });
    }
  }

  return samples;
}

function curveToSvgPath(curve: CubicBezierCurve): string {
  const { p0, p1, p2, p3 } = curve;
  return `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`;
}

export function getEdgeGeometry(
  edge: GraphEdgeDef,
  nodeMap: Record<NodeId, NodeMeta>
): EdgeGeometry {
  const src = nodeMap[edge.from];
  const dst = nodeMap[edge.to];

  if (edge.id === 'e-guard-plan') {
    const sx = src.x + 26;
    const sy = src.y;
    const tx = dst.x + 26;
    const ty = dst.y + NODE_H;
    const curve: CubicBezierCurve = {
      p0: { x: sx, y: sy },
      p1: { x: sx - 58, y: sy - 38 },
      p2: { x: tx - 58, y: ty + 38 },
      p3: { x: tx, y: ty },
    };
    return {
      d: curveToSvgPath(curve),
      curve,
      labelX: sx - 52,
      labelY: (sy + ty) / 2,
    };
  }

  if (edge.id === 'e-hitl-a2a') {
    const sx = src.x + NODE_W - 24;
    const sy = src.y;
    const tx = dst.x + 42;
    const ty = dst.y + NODE_H;
    const curve: CubicBezierCurve = {
      p0: { x: sx, y: sy },
      p1: { x: sx + 26, y: sy - 48 },
      p2: { x: tx - 36, y: ty + 42 },
      p3: { x: tx, y: ty },
    };
    return {
      d: curveToSvgPath(curve),
      curve,
      labelX: (sx + tx) / 2 + 28,
      labelY: (sy + ty) / 2 - 4,
    };
  }

  if (edge.id === 'e-synth-mcp') {
    const sx = src.x + NODE_W - 18;
    const sy = src.y;
    const tx = dst.x + NODE_W / 2;
    const ty = dst.y;
    const curve: CubicBezierCurve = {
      p0: { x: sx, y: sy },
      p1: { x: sx + 48, y: sy - 196 },
      p2: { x: tx + 40, y: ty - 66 },
      p3: { x: tx, y: ty },
    };
    return {
      d: curveToSvgPath(curve),
      curve,
      labelX: (sx + tx) / 2 + 12,
      labelY: 19,
    };
  }

  if (edge.id === 'e-a2a-guard') {
    const sx = src.x + 18;
    const sy = src.y + NODE_H;
    const tx = dst.x + NODE_W - 22;
    const ty = dst.y;
    const midY = (sy + ty) / 2;
    const curve: CubicBezierCurve = {
      p0: { x: sx, y: sy },
      p1: { x: sx - 40, y: midY + 8 },
      p2: { x: tx + 60, y: midY - 8 },
      p3: { x: tx, y: ty },
    };
    return {
      d: curveToSvgPath(curve),
      curve,
      labelX: (sx + tx) / 2 + 44,
      labelY: midY - 6,
    };
  }

  if (edge.id === 'e-mcp-guard') {
    const sx = src.x + 42;
    const sy = src.y + NODE_H;
    const tx = dst.x + NODE_W * 0.56;
    const ty = dst.y;
    const midY = (sy + ty) / 2;
    const curve: CubicBezierCurve = {
      p0: { x: sx, y: sy },
      p1: { x: sx, y: midY },
      p2: { x: tx, y: midY },
      p3: { x: tx, y: ty },
    };
    return {
      d: curveToSvgPath(curve),
      curve,
      labelX: (sx + tx) / 2 - 14,
      labelY: midY + 4,
    };
  }

  if (edge.id === 'e-plan-synth') {
    const sx = src.x + NODE_W - 24;
    const sy = src.y + NODE_H;
    const tx = dst.x + 32;
    const ty = dst.y;
    const midY = (sy + ty) / 2;
    const curve: CubicBezierCurve = {
      p0: { x: sx, y: sy },
      p1: { x: sx + 90, y: midY + 14 },
      p2: { x: tx - 90, y: midY - 14 },
      p3: { x: tx, y: ty },
    };
    return {
      d: curveToSvgPath(curve),
      curve,
      labelX: (sx + tx) / 2 + 24,
      labelY: midY + 16,
    };
  }

  if (edge.id === 'e-guard-synth') {
    const sx = src.x + NODE_W / 2;
    const sy = src.y + NODE_H;
    const tx = dst.x + NODE_W / 2;
    const ty = dst.y + NODE_H;
    const curve: CubicBezierCurve = {
      p0: { x: sx, y: sy },
      p1: { x: sx + 70, y: sy + 44 },
      p2: { x: tx - 70, y: ty + 44 },
      p3: { x: tx, y: ty },
    };
    return {
      d: curveToSvgPath(curve),
      curve,
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
  const curve: CubicBezierCurve = {
    p0: { x: sx, y: sy },
    p1: { x: sx + dx, y: sy },
    p2: { x: tx - dx, y: ty },
    p3: { x: tx, y: ty },
  };
  return {
    d: curveToSvgPath(curve),
    curve,
    labelX: (sx + tx) / 2,
    labelY: sy - 16,
  };
}

export function classifyNodeLatencyHeat(
  checkpoint: Checkpoint | null,
  options?: { isPausedHitl?: boolean; isRedTeamBlocked?: boolean }
): LatencyHeatBadge {
  if (
    options?.isRedTeamBlocked ||
    checkpoint?.guardrail_status === 'blocked' ||
    (checkpoint?.node_id === 'policy_guardrail' && checkpoint.guardrail_status === 'rerouted')
  ) {
    return {
      tier: 'blocked',
      label: 'BLOCKED',
      shortLabel: 'BLOCKED',
      hex: '#F43F5E',
      pillBg: 'rgba(244, 63, 94, 0.16)',
      pillBorder: 'rgba(244, 63, 94, 0.55)',
      textClass: 'text-rose-400',
    };
  }

  if (options?.isPausedHitl) {
    return {
      tier: 'paused',
      label: 'HITL PAUSED',
      shortLabel: 'PAUSED',
      hex: '#F59E0B',
      pillBg: 'rgba(245, 158, 11, 0.16)',
      pillBorder: 'rgba(245, 158, 11, 0.55)',
      textClass: 'text-amber-400',
    };
  }

  if (!checkpoint) {
    return {
      tier: 'idle',
      label: 'IDLE',
      shortLabel: '--',
      hex: '#64748B',
      pillBg: 'rgba(100, 116, 139, 0.12)',
      pillBorder: 'rgba(100, 116, 139, 0.28)',
      textClass: 'text-slate-400',
    };
  }

  const ms = checkpoint.latency_ms;
  if (ms < 100) {
    return {
      tier: 'fast',
      label: `${ms.toFixed(0)}ms · FAST`,
      shortLabel: '<100ms',
      hex: '#10B981',
      pillBg: 'rgba(16, 185, 129, 0.16)',
      pillBorder: 'rgba(16, 185, 129, 0.45)',
      textClass: 'text-emerald-400',
    };
  }
  if (ms <= 200) {
    return {
      tier: 'nominal',
      label: `${ms.toFixed(0)}ms · NOMINAL`,
      shortLabel: '100-200ms',
      hex: '#38BDF8',
      pillBg: 'rgba(56, 189, 248, 0.16)',
      pillBorder: 'rgba(56, 189, 248, 0.45)',
      textClass: 'text-sky-400',
    };
  }
  return {
    tier: 'warm',
    label: `${ms.toFixed(0)}ms · HOT`,
    shortLabel: '>200ms',
    hex: '#F59E0B',
    pillBg: 'rgba(245, 158, 11, 0.16)',
    pillBorder: 'rgba(245, 158, 11, 0.48)',
    textClass: 'text-amber-400',
  };
}
