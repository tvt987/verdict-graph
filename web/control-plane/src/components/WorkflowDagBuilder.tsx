import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  GitBranch,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  Sliders,
  Trash2,
} from 'lucide-react';
import type { Locale } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import {
  WORKFLOW_MODEL_SPECS,
  WORKFLOW_PRESETS,
  WORKFLOW_ROLE_CATALOG,
  WORKFLOW_ROLE_MAP,
  type WorkflowModelId,
  type WorkflowNodeConfig,
  type WorkflowNodeRole,
  type WorkflowPresetId,
  type WorkflowTraceResult,
  addWorkflowNode,
  createDefaultWorkflow,
  deriveWorkflowEdges,
  removeWorkflowNode,
  reorderWorkflowNode,
  simulateWorkflowTrace,
  updateWorkflowNode,
  validateWorkflowDag,
} from '../engines/workflowBuilder';

interface WorkflowDagBuilderProps {
  t: Translations;
  locale: Locale;
}

interface NodePosition {
  x: number;
  y: number;
  row: number;
}

const CARD_W = 196;
const CARD_H = 88;
const GAP_X = 48;
const GAP_Y = 70;
const PAD_X = 28;
const PAD_Y = 30;
const MAX_COLS = 4;

function computeNodePositions(nodes: WorkflowNodeConfig[]): {
  positions: Record<string, NodePosition>;
  viewWidth: number;
  viewHeight: number;
} {
  const cols = Math.min(MAX_COLS, Math.max(1, nodes.length));
  const rows = Math.max(1, Math.ceil(nodes.length / MAX_COLS));
  const positions: Record<string, NodePosition> = {};

  nodes.forEach((node, idx) => {
    const row = Math.floor(idx / MAX_COLS);
    const colInRow = idx % MAX_COLS;
    // Serpentine layout on odd rows so edges flow naturally without long cross-canvas jumps
    const effectiveCol = row % 2 === 1 ? cols - 1 - colInRow : colInRow;
    positions[node.id] = {
      x: PAD_X + effectiveCol * (CARD_W + GAP_X),
      y: PAD_Y + row * (CARD_H + GAP_Y),
      row,
    };
  });

  const viewWidth = PAD_X * 2 + cols * CARD_W + Math.max(0, cols - 1) * GAP_X;
  const viewHeight = PAD_Y * 2 + rows * CARD_H + Math.max(0, rows - 1) * GAP_Y + 34;

  return { positions, viewWidth, viewHeight };
}

function buildEdgePath(
  fromPos: NodePosition,
  toPos: NodePosition,
  kind: 'forward' | 'feedback',
  viewHeight: number
): { d: string; labelX: number; labelY: number } {
  if (kind === 'feedback') {
    const sx = fromPos.x + CARD_W / 2;
    const sy = fromPos.y + CARD_H;
    const ex = toPos.x + CARD_W / 2;
    const ey = toPos.y + CARD_H;
    const arcY = Math.min(viewHeight - 10, Math.max(sy, ey) + 46);
    const d = `M ${sx} ${sy} C ${sx} ${arcY}, ${ex} ${arcY}, ${ex} ${ey}`;
    return { d, labelX: (sx + ex) / 2, labelY: arcY - 6 };
  }

  // Same row forward left-to-right or right-to-left
  if (fromPos.row === toPos.row) {
    const goingRight = toPos.x >= fromPos.x;
    const sx = goingRight ? fromPos.x + CARD_W : fromPos.x;
    const sy = fromPos.y + CARD_H / 2;
    const ex = goingRight ? toPos.x : toPos.x + CARD_W;
    const ey = toPos.y + CARD_H / 2;
    const dx = (ex - sx) * 0.45;
    return {
      d: `M ${sx} ${sy} C ${sx + dx} ${sy}, ${ex - dx} ${ey}, ${ex} ${ey}`,
      labelX: (sx + ex) / 2,
      labelY: sy - 10,
    };
  }

  // Row transition down
  const sx = fromPos.x + CARD_W / 2;
  const sy = fromPos.y + CARD_H;
  const ex = toPos.x + CARD_W / 2;
  const ey = toPos.y;
  const midY = (sy + ey) / 2;
  return {
    d: `M ${sx} ${sy} C ${sx} ${midY}, ${ex} ${midY}, ${ex} ${ey}`,
    labelX: (sx + ex) / 2 + 28,
    labelY: midY,
  };
}

const MODEL_IDS = Object.keys(WORKFLOW_MODEL_SPECS) as WorkflowModelId[];

export const WorkflowDagBuilder: React.FC<WorkflowDagBuilderProps> = ({ t, locale }) => {
  const [activePreset, setActivePreset] = useState<WorkflowPresetId>('enterprise_rag_sql');
  const [nodes, setNodes] = useState<WorkflowNodeConfig[]>(() =>
    createDefaultWorkflow('enterprise_rag_sql')
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>(() => {
    const initial = createDefaultWorkflow('enterprise_rag_sql');
    return initial[0]?.id ?? '';
  });
  const [tracePrompt, setTracePrompt] = useState<string>(
    'Audit Q4 voucher double-spending risk across 712 retail stores and validate rollback SLO.'
  );
  const [traceResult, setTraceResult] = useState<WorkflowTraceResult>(() =>
    simulateWorkflowTrace(createDefaultWorkflow('enterprise_rag_sql'))
  );
  const [revealedSteps, setRevealedSteps] = useState<number>(() =>
    createDefaultWorkflow('enterprise_rag_sql').length
  );
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? nodes[0] ?? null,
    [nodes, selectedNodeId]
  );

  const edges = useMemo(() => deriveWorkflowEdges(nodes), [nodes]);
  const validationIssues = useMemo(() => validateWorkflowDag(nodes), [nodes]);
  const layout = useMemo(() => computeNodePositions(nodes), [nodes]);

  // Animate step-by-step deterministic trace across custom DAG
  useEffect(() => {
    if (!isAnimating) return;
    if (revealedSteps >= traceResult.steps.length) {
      setIsAnimating(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setRevealedSteps((prev) => {
        const next = prev + 1;
        if (next >= traceResult.steps.length) {
          setIsAnimating(false);
        }
        return next;
      });
    }, 420);
    return () => window.clearTimeout(timer);
  }, [isAnimating, revealedSteps, traceResult.steps.length]);

  const applyWorkflowMutation = (nextNodes: WorkflowNodeConfig[], nextSelected?: string) => {
    setIsAnimating(false);
    setNodes(nextNodes);
    if (nextSelected) {
      setSelectedNodeId(nextSelected);
    } else if (!nextNodes.some((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(nextNodes[0]?.id ?? '');
    }
    const freshTrace = simulateWorkflowTrace(nextNodes, tracePrompt);
    setTraceResult(freshTrace);
    setRevealedSteps(freshTrace.steps.length);
  };

  const handleLoadPreset = (presetId: WorkflowPresetId) => {
    setActivePreset(presetId);
    const nextNodes = createDefaultWorkflow(presetId);
    applyWorkflowMutation(nextNodes, nextNodes[0]?.id ?? '');
  };

  const handleAddNode = (role: WorkflowNodeRole) => {
    const nextNodes = addWorkflowNode(nodes, role, selectedNode?.id);
    const added = nextNodes.find((n) => !nodes.some((old) => old.id === n.id));
    applyWorkflowMutation(nextNodes, added?.id);
  };

  const handleRemoveNode = (nodeId: string) => {
    const nextNodes = removeWorkflowNode(nodes, nodeId);
    applyWorkflowMutation(nextNodes);
  };

  const handleReorder = (nodeId: string, dir: 'left' | 'right') => {
    const nextNodes = reorderWorkflowNode(nodes, nodeId, dir);
    applyWorkflowMutation(nextNodes, nodeId);
  };

  const handleUpdateSelected = (
    patch: Partial<
      Pick<
        WorkflowNodeConfig,
        'title' | 'model' | 'maxTokens' | 'temperature' | 'retryBudget' | 'promptDirective'
      >
    >
  ) => {
    if (!selectedNode) return;
    const nextNodes = updateWorkflowNode(nodes, selectedNode.id, patch);
    applyWorkflowMutation(nextNodes, selectedNode.id);
  };

  const handleRunLiveTrace = () => {
    const fresh = simulateWorkflowTrace(nodes, tracePrompt);
    setTraceResult(fresh);
    setRevealedSteps(1);
    setIsAnimating(true);
  };

  const handleStepTrace = () => {
    setIsAnimating(false);
    if (revealedSteps >= traceResult.steps.length) {
      const fresh = simulateWorkflowTrace(nodes, tracePrompt);
      setTraceResult(fresh);
      setRevealedSteps(1);
      return;
    }
    setRevealedSteps((prev) => Math.min(traceResult.steps.length, prev + 1));
  };

  const handleResetTrace = () => {
    setIsAnimating(false);
    setRevealedSteps(0);
  };

  const visibleSteps = traceResult.steps.slice(0, revealedSteps);
  const activeStep = visibleSteps.length > 0 ? visibleSteps[visibleSteps.length - 1] : null;
  const completedNodeIds = new Set(visibleSteps.map((s) => s.nodeId));
  const completedEdgeIds = new Set(
    visibleSteps.map((s) => s.edgeId).filter((id): id is string => Boolean(id))
  );

  const selectedIndex = selectedNode ? nodes.findIndex((n) => n.id === selectedNode.id) : -1;
  const selectedStepTelemetry = selectedNode
    ? visibleSteps.find((s) => s.nodeId === selectedNode.id) ?? null
    : null;

  return (
    <section
      id="workflow-dag-builder"
      data-testid="workflow-dag-builder"
      className="vg-panel flex flex-col rounded-lg"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <GitBranch className="h-4 w-4 shrink-0 text-sky-400" />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.dagBuilderTitle}
            </h2>
            <span className="rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-400">
              {nodes.length} NODES · v3.0
            </span>
            {validationIssues.length === 0 ? (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> ZERO-TRUST VALID
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded border border-amber-400/45 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-400">
                <AlertTriangle className="h-3 w-3" /> {validationIssues.length} ADVISORY
              </span>
            )}
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
            {t.dagBuilderSubtitle}
          </p>
        </div>

        {/* Presets & Execution Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5">
            {WORKFLOW_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`dag-preset-${preset.id}`}
                onClick={() => handleLoadPreset(preset.id)}
                className={`rounded px-2 py-0.5 font-mono text-[9.5px] font-semibold transition-colors ${
                  activePreset === preset.id
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                }`}
                title={preset.description}
              >
                {locale === 'vi' ? preset.labelVi.split(' ')[0] : preset.label.split(' ')[0]}
              </button>
            ))}
          </div>

          <button
            type="button"
            data-testid="dag-run-trace-btn"
            onClick={handleRunLiveTrace}
            className="flex items-center gap-1.5 rounded border border-emerald-400/60 bg-emerald-500/20 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30"
          >
            <Play className="h-3 w-3" />
            <span>{t.dagRunTraceBtn}</span>
          </button>

          <button
            type="button"
            data-testid="dag-step-btn"
            onClick={handleStepTrace}
            className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[10px] font-medium text-[var(--vg-text)] transition-colors hover:border-sky-400/50"
          >
            <SkipForward className="h-3 w-3" />
            <span>{t.dagStepBtn}</span>
          </button>

          <button
            type="button"
            data-testid="dag-reset-btn"
            onClick={handleResetTrace}
            className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--vg-text-muted)] transition-colors hover:text-[var(--vg-text)]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{t.dagResetBtn}</span>
          </button>
        </div>
      </div>

      {/* Add Node Role Palette Bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--vg-border)] bg-[var(--vg-surface)]/70 px-3.5 py-2">
        <span className="font-mono text-[9.5px] font-semibold tracking-wider text-[var(--vg-text-dim)]">
          {t.dagAddNodeLabel}
        </span>
        {WORKFLOW_ROLE_CATALOG.map((meta) => (
          <button
            key={meta.role}
            type="button"
            data-testid={`dag-add-${meta.role}`}
            onClick={() => handleAddNode(meta.role)}
            className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1 font-mono text-[9.5px] font-semibold text-[var(--vg-text)] transition-all hover:border-sky-400/60 hover:bg-sky-500/10"
            title={meta.description}
          >
            <Plus className="h-3 w-3" style={{ color: meta.accentHex }} />
            <span>{locale === 'vi' ? meta.labelVi : meta.label}</span>
          </button>
        ))}
      </div>

      {/* Main Split: Custom SVG DAG Canvas (left 8 cols) + Node Inspector (right 4 cols) */}
      <div className="grid grid-cols-1 gap-3 p-3.5 xl:grid-cols-12">
        {/* Left: SVG DAG Canvas + Trace Summary */}
        <div className="flex flex-col gap-3 xl:col-span-8">
          {/* Trace Input Prompt */}
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5">
            <span className="font-mono text-[9.5px] font-semibold text-sky-400">DAG PROMPT</span>
            <input
              type="text"
              data-testid="dag-prompt-input"
              value={tracePrompt}
              onChange={(e) => setTracePrompt(e.target.value)}
              className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-[var(--vg-text)] outline-none"
              aria-label="Custom Workflow DAG Prompt"
            />
          </div>

          {/* Interactive SVG DAG Canvas */}
          <div className="relative overflow-x-auto rounded-md border border-[var(--vg-border)] bg-[var(--vg-bg)] p-2">
            <svg
              data-testid="workflow-dag-svg"
              viewBox={`0 0 ${layout.viewWidth} ${layout.viewHeight}`}
              className="mx-auto block h-auto min-h-[220px] w-full max-w-full"
            >
              <defs>
                <pattern id="vg-dag-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="0.9" fill="var(--vg-grid-dot)" />
                </pattern>
                <marker
                  id="dag-arrow-cyan"
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
                  id="dag-arrow-emerald"
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
                  id="dag-arrow-purple"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#A855F7" />
                </marker>
                <marker
                  id="dag-arrow-muted"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="rgba(148,163,184,0.4)" />
                </marker>
              </defs>

              <rect width={layout.viewWidth} height={layout.viewHeight} fill="url(#vg-dag-grid)" />

              {/* Render Edges */}
              {edges.map((edge) => {
                const fromPos = layout.positions[edge.fromId];
                const toPos = layout.positions[edge.toId];
                if (!fromPos || !toPos) return null;
                const { d, labelX, labelY } = buildEdgePath(
                  fromPos,
                  toPos,
                  edge.kind,
                  layout.viewHeight
                );
                const isActiveEdge = activeStep?.edgeId === edge.id;
                const isCompletedEdge = completedEdgeIds.has(edge.id);
                const isFeedback = edge.kind === 'feedback';

                const strokeColor = isFeedback
                  ? '#A855F7'
                  : isActiveEdge
                    ? '#38BDF8'
                    : isCompletedEdge
                      ? '#10B981'
                      : 'rgba(148,163,184,0.28)';

                const marker = isFeedback
                  ? 'url(#dag-arrow-purple)'
                  : isActiveEdge
                    ? 'url(#dag-arrow-cyan)'
                    : isCompletedEdge
                      ? 'url(#dag-arrow-emerald)'
                      : 'url(#dag-arrow-muted)';

                return (
                  <g key={edge.id} data-workflow-edge={edge.id}>
                    {isActiveEdge && (
                      <path
                        d={d}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth={6}
                        opacity={0.22}
                      />
                    )}
                    <path
                      d={d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={isActiveEdge ? 2.6 : isCompletedEdge ? 2 : 1.3}
                      strokeDasharray={isFeedback ? '5 4' : undefined}
                      className={
                        isActiveEdge
                          ? 'edge-flow-active'
                          : isFeedback
                            ? 'edge-flow-cyclic'
                            : undefined
                      }
                      markerEnd={marker}
                      opacity={isFeedback ? 0.65 : 1}
                    />
                    {isFeedback && (
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        fill="#A855F7"
                        fontSize="8"
                        fontFamily="JetBrains Mono, monospace"
                        fontWeight={700}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Render Custom Agent Nodes */}
              {nodes.map((node, idx) => {
                const pos = layout.positions[node.id];
                if (!pos) return null;
                const meta = WORKFLOW_ROLE_MAP[node.role];
                const spec = WORKFLOW_MODEL_SPECS[node.model];
                const isSelected = selectedNode?.id === node.id;
                const isActive = activeStep?.nodeId === node.id;
                const isDone = completedNodeIds.has(node.id);
                const step = visibleSteps.find((s) => s.nodeId === node.id);

                return (
                  <g
                    key={node.id}
                    data-testid={`dag-node-${node.id}`}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer"
                  >
                    {isActive && (
                      <rect
                        x={-4}
                        y={-4}
                        width={CARD_W + 8}
                        height={CARD_H + 8}
                        rx={10}
                        fill="none"
                        stroke={meta.accentHex}
                        strokeWidth={1.8}
                        className="node-halo-pulse"
                      />
                    )}
                    <rect
                      width={CARD_W}
                      height={CARD_H}
                      rx={8}
                      fill="var(--vg-node-bg)"
                      stroke={
                        isSelected
                          ? '#38BDF8'
                          : isActive
                            ? meta.accentHex
                            : isDone
                              ? 'rgba(16,185,129,0.48)'
                              : 'var(--vg-border)'
                      }
                      strokeWidth={isSelected || isActive ? 2 : 1.1}
                    />
                    <rect
                      x={1}
                      y={1}
                      width={CARD_W - 2}
                      height={3}
                      rx={2}
                      fill={meta.accentHex}
                      opacity={isDone || isActive ? 1 : 0.35}
                    />
                    <text
                      x={10}
                      y={20}
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill={meta.accentHex}
                    >
                      {String(idx + 1).padStart(2, '0')} · {meta.protocolBadge}
                    </text>
                    <text
                      x={CARD_W - 10}
                      y={20}
                      textAnchor="end"
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={600}
                      fill={isDone ? '#10B981' : 'var(--vg-text-dim)'}
                    >
                      {step ? `${step.latencyMs.toFixed(0)}ms` : `T=${node.temperature.toFixed(1)}`}
                    </text>
                    <text
                      x={10}
                      y={42}
                      fontSize="12"
                      fontFamily="Space Grotesk, Inter, sans-serif"
                      fontWeight={700}
                      fill="var(--vg-text)"
                    >
                      {node.title.slice(0, 22)}
                    </text>
                    <text
                      x={10}
                      y={58}
                      fontSize="9"
                      fontFamily="JetBrains Mono, monospace"
                      fill="var(--vg-text-muted)"
                    >
                      {spec.label}
                    </text>
                    <line
                      x1={8}
                      y1={66}
                      x2={CARD_W - 8}
                      y2={66}
                      stroke="var(--vg-border)"
                      strokeWidth={0.7}
                    />
                    <text
                      x={10}
                      y={80}
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                      fill="var(--vg-text-dim)"
                    >
                      MAX {node.maxTokens} · R:{node.retryBudget}
                    </text>
                    <text
                      x={CARD_W - 10}
                      y={80}
                      textAnchor="end"
                      fontSize="8.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight={700}
                      fill={step ? '#38BDF8' : 'var(--vg-text-dim)'}
                    >
                      {step ? `$${step.costUsd.toFixed(4)}` : 'READY'}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Aggregate Deterministic Trace Telemetry Strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">TRACE LATENCY</p>
              <p className="text-xs font-bold text-sky-400" data-testid="dag-total-latency">
                {visibleSteps.reduce((s, r) => s + r.latencyMs, 0).toFixed(0)}ms
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">TOTAL TOKENS</p>
              <p className="text-xs font-bold text-[var(--vg-text)]" data-testid="dag-total-tokens">
                {visibleSteps
                  .reduce((s, r) => s + r.inputTokens + r.outputTokens, 0)
                  .toLocaleString()}
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">EST. RUN COST</p>
              <p className="text-xs font-bold text-emerald-400" data-testid="dag-total-cost">
                ${visibleSteps.reduce((s, r) => s + r.costUsd, 0).toFixed(5)}
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">GROUNDEDNESS</p>
              <p className="text-xs font-bold text-emerald-400">
                {visibleSteps.length > 0
                  ? visibleSteps[visibleSteps.length - 1].groundedness.toFixed(2)
                  : '--'}
              </p>
            </div>
            <div className="col-span-2 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono sm:col-span-1">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">TRACE STEPS</p>
              <p className="text-xs font-bold text-[var(--vg-text)]">
                {visibleSteps.length} / {traceResult.steps.length}
              </p>
            </div>
          </div>

          {/* Validation Advisories if any */}
          {validationIssues.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 font-mono text-[10px] text-amber-300">
              {validationIssues.map((iss) => (
                <div key={iss.code} className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                  <span>
                    [{iss.code}] {iss.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Live Step Trace Log */}
          {visibleSteps.length > 0 && (
            <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5">
              <p className="mb-1.5 font-mono text-[9.5px] font-semibold tracking-wider text-[var(--vg-text-muted)]">
                DETERMINISTIC EXECUTION TRACE ({traceResult.traceId.toUpperCase()})
              </p>
              <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                {visibleSteps.map((step) => (
                  <div
                    key={step.nodeId}
                    onClick={() => setSelectedNodeId(step.nodeId)}
                    className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
                      selectedNode?.id === step.nodeId
                        ? 'border-sky-400/50 bg-sky-500/10'
                        : 'border-[var(--vg-border)] bg-[var(--vg-panel)] hover:border-sky-400/30'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                      <span className="font-bold text-sky-400">#{step.stepIndex}</span>
                      <span className="font-semibold text-[var(--vg-text)]">{step.title}</span>
                      <span className="hidden truncate text-[var(--vg-text-muted)] md:inline">
                        — {step.outputSummary}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-[9.5px]">
                      <span className="text-[var(--vg-text-dim)]">{step.model}</span>
                      <span className="text-sky-400">{step.latencyMs.toFixed(0)}ms</span>
                      <span className="text-emerald-400">${step.costUsd.toFixed(4)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Selected Node Inspector */}
        <div
          data-testid="dag-node-inspector"
          className="flex flex-col gap-3 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3 xl:col-span-4"
        >
          <div className="flex items-center justify-between border-b border-[var(--vg-border)] pb-2">
            <div className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-sky-400" />
              <h3 className="font-mono text-[10px] font-bold tracking-wider text-[var(--vg-text)]">
                {t.dagInspectorHeading}
              </h3>
            </div>
            {selectedNode && (
              <span className="rounded border border-sky-400/40 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-400">
                {selectedNode.id.toUpperCase()}
              </span>
            )}
          </div>

          {selectedNode ? (
            <>
              {/* Node Title + Order Controls */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-[var(--vg-text)]">
                    {selectedNode.title}
                  </p>
                  <p className="font-mono text-[9.5px] text-[var(--vg-text-dim)]">
                    {WORKFLOW_ROLE_MAP[selectedNode.role].description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    data-testid="dag-move-left-btn"
                    disabled={selectedIndex <= 0}
                    onClick={() => handleReorder(selectedNode.id, 'left')}
                    className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] p-1 text-[var(--vg-text)] transition-colors hover:border-sky-400/60 disabled:opacity-35"
                    title="Move Node Earlier"
                    aria-label="Move Node Earlier"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid="dag-move-right-btn"
                    disabled={selectedIndex === -1 || selectedIndex >= nodes.length - 1}
                    onClick={() => handleReorder(selectedNode.id, 'right')}
                    className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] p-1 text-[var(--vg-text)] transition-colors hover:border-sky-400/60 disabled:opacity-35"
                    title="Move Node Later"
                    aria-label="Move Node Later"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid="dag-remove-node-btn"
                    disabled={nodes.length <= 1}
                    onClick={() => handleRemoveNode(selectedNode.id)}
                    className="rounded border border-rose-400/40 bg-rose-500/10 p-1 text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-35"
                    title="Remove Node from DAG"
                    aria-label="Remove Node from DAG"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Model Assignment */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="dag-model-select"
                  className="flex items-center gap-1 font-mono text-[9.5px] font-semibold text-[var(--vg-text-muted)]"
                >
                  <Cpu className="h-3 w-3 text-sky-400" />
                  MODEL ASSIGNMENT
                </label>
                <select
                  id="dag-model-select"
                  data-testid="dag-node-model-select"
                  value={selectedNode.model}
                  onChange={(e) =>
                    handleUpdateSelected({ model: e.target.value as WorkflowModelId })
                  }
                  className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--vg-text)] outline-none focus:border-sky-400"
                >
                  {MODEL_IDS.map((mid) => {
                    const spec = WORKFLOW_MODEL_SPECS[mid];
                    return (
                      <option key={mid} value={mid}>
                        {spec.label} ({spec.provider} · ${spec.inputUsdPer1M}/${spec.outputUsdPer1M})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Max Tokens Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-mono text-[9.5px]">
                  <span className="font-semibold text-[var(--vg-text-muted)]">MAX TOKENS</span>
                  <span className="font-bold text-sky-400" data-testid="dag-node-max-tokens-val">
                    {selectedNode.maxTokens.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="dag-node-max-tokens-slider"
                  min={256}
                  max={16384}
                  step={256}
                  value={selectedNode.maxTokens}
                  onChange={(e) => handleUpdateSelected({ maxTokens: Number(e.target.value) })}
                  className="vg-slider w-full"
                  aria-label="Node Max Tokens"
                />
              </div>

              {/* Temperature Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-mono text-[9.5px]">
                  <span className="font-semibold text-[var(--vg-text-muted)]">TEMPERATURE</span>
                  <span
                    className={`font-bold ${
                      selectedNode.temperature >= 0.65 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                    data-testid="dag-node-temp-val"
                  >
                    {selectedNode.temperature.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  data-testid="dag-node-temp-slider"
                  min={0}
                  max={1}
                  step={0.05}
                  value={selectedNode.temperature}
                  onChange={(e) => handleUpdateSelected({ temperature: Number(e.target.value) })}
                  className="vg-slider w-full"
                  aria-label="Node Temperature"
                />
              </div>

              {/* Retry Budget Pills */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-mono text-[9.5px]">
                  <span className="font-semibold text-[var(--vg-text-muted)]">RETRY BUDGET</span>
                  <span className="font-bold text-[var(--vg-text)]">
                    {selectedNode.retryBudget} RETRIES
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1">
                  {[0, 1, 2, 3, 4, 5].map((budget) => (
                    <button
                      key={budget}
                      type="button"
                      data-testid={`dag-retry-${budget}`}
                      onClick={() => handleUpdateSelected({ retryBudget: budget })}
                      className={`rounded border py-1 font-mono text-[10px] font-bold transition-colors ${
                        selectedNode.retryBudget === budget
                          ? 'border-sky-400/60 bg-sky-500/20 text-sky-400'
                          : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                      }`}
                    >
                      {budget}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt Directive */}
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="dag-prompt-directive"
                  className="font-mono text-[9.5px] font-semibold text-[var(--vg-text-muted)]"
                >
                  NODE SYSTEM DIRECTIVE
                </label>
                <textarea
                  id="dag-prompt-directive"
                  value={selectedNode.promptDirective}
                  onChange={(e) => handleUpdateSelected({ promptDirective: e.target.value })}
                  rows={2}
                  spellCheck={false}
                  className="vg-code w-full resize-none rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)] outline-none focus:border-sky-400"
                />
              </div>

              {/* Selected Node Live Trace Output */}
              {selectedStepTelemetry && (
                <div className="rounded border border-emerald-400/35 bg-emerald-500/10 p-2 font-mono text-[9.5px]">
                  <div className="flex items-center justify-between text-emerald-400">
                    <span className="font-bold">LIVE NODE SPAN</span>
                    <span>
                      TTFT {selectedStepTelemetry.ttftMs}ms · {selectedStepTelemetry.latencyMs}ms
                    </span>
                  </div>
                  <p className="mt-1 text-[var(--vg-text)]">
                    {selectedStepTelemetry.outputSummary}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="font-mono text-[10px] text-[var(--vg-text-dim)]">
              Click any agent node on the canvas to configure parameters.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default WorkflowDagBuilder;
