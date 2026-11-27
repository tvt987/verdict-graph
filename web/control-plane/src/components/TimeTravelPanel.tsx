import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Cpu,
  GitBranch,
  GitCompare,
  GitFork,
  History,
  Sparkles,
  Wand2,
} from 'lucide-react';
import type { Checkpoint, ControlPlaneRun } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import { ALTERNATE_FORK_MODELS } from '../engine/protocolEngine';

interface TimeTravelPanelProps {
  t: Translations;
  run: ControlPlaneRun;
  selectedCheckpointId: string | null;
  onSelectCheckpoint: (cpId: string) => void;
  onSelectBranch: (branchId: string) => void;
  onForkAndReplay: (checkpointId: string, overrides: Record<string, unknown>) => void;
  presetTriggerCount: number;
}

const PROMPT_PRESETS = [
  {
    id: 'strict_grounding',
    label: 'Strict Citation + Rerank',
    model: 'gemini-2.5-pro',
    prompt: 'Strict grounding mode: cite only verified SPEC-2026 & BENCH-2026 chunks, concise JSON.',
    topK: 8,
    rerank: true,
  },
  {
    id: 'vllm_cost_slash',
    label: 'vLLM Cost Slash (-90%)',
    model: 'vllm-qwen-72b',
    prompt: 'Concise operator brief on local vLLM Qwen-72B: prioritize sub-100ms TTFT and verified KPIs.',
    topK: 6,
    rerank: true,
  },
  {
    id: 'claude_audit',
    label: 'Claude 3.7 Deep Audit',
    model: 'claude-3.7-sonnet',
    prompt: 'Strict enterprise compliance audit: enumerate every SLA invariant and cite evidence.',
    topK: 8,
    rerank: true,
  },
];

export const TimeTravelPanel: React.FC<TimeTravelPanelProps> = ({
  t,
  run,
  selectedCheckpointId,
  onSelectCheckpoint,
  onSelectBranch,
  onForkAndReplay,
  presetTriggerCount,
}) => {
  const [subTab, setSubTab] = useState<'dag' | 'diff'>('dag');
  const [editorText, setEditorText] = useState<string>('{}');
  const [altModel, setAltModel] = useState<string>('gemini-2.5-pro');
  const [altPrompt, setAltPrompt] = useState<string>(PROMPT_PRESETS[0].prompt);
  const [selectedDiffIdx, setSelectedDiffIdx] = useState<number>(0);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const skipNextResetRef = React.useRef<boolean>(false);

  const allCheckpoints = useMemo(() => {
    const map = new Map<string, Checkpoint>();
    for (const b of Object.values(run.branches)) {
      for (const cp of b.checkpoints) {
        map.set(cp.checkpoint_id, cp);
      }
    }
    return map;
  }, [run.branches]);

  const effectiveCp = useMemo(() => {
    if (selectedCheckpointId && allCheckpoints.has(selectedCheckpointId)) {
      return allCheckpoints.get(selectedCheckpointId) ?? null;
    }
    const activeBranch = run.branches[run.active_branch_id];
    if (activeBranch && activeBranch.checkpoints.length > 0) {
      return activeBranch.checkpoints[activeBranch.checkpoints.length - 1];
    }
    return null;
  }, [allCheckpoints, run.active_branch_id, run.branches, selectedCheckpointId]);

  useEffect(() => {
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false;
      return;
    }
    if (effectiveCp) {
      setEditorText(JSON.stringify(effectiveCp.state_snapshot, null, 2));
      setJsonError(null);
    }
  }, [effectiveCp?.checkpoint_id, run.run_id]);

  // When user clicks "Load CP-02 Optimal Fork Preset" from Scenario D callout
  useEffect(() => {
    if (presetTriggerCount === 0) return;
    const cp2 = allCheckpoints.get('CP-02');
    if (cp2) {
      if (effectiveCp?.checkpoint_id !== 'CP-02') {
        skipNextResetRef.current = true;
      }
      onSelectCheckpoint('CP-02');
      const optimal = {
        ...cp2.state_snapshot,
        top_k: 8,
        rerank: true,
        strict_grounding: true,
      };
      setAltModel('gemini-2.5-pro');
      setAltPrompt(PROMPT_PRESETS[0].prompt);
      setEditorText(JSON.stringify(optimal, null, 2));
      setJsonError(null);
      setSubTab('dag');
    }
  }, [presetTriggerCount]);

  // Automatically surface Diff tab when a new fork diff arrives
  useEffect(() => {
    if (run.branch_diffs.length > 0) {
      setSelectedDiffIdx(run.branch_diffs.length - 1);
      setSubTab('diff');
    } else {
      setSelectedDiffIdx(0);
      setSubTab('dag');
    }
  }, [run.branch_diffs.length, run.run_id]);

  const handleApplyPromptPreset = (preset: (typeof PROMPT_PRESETS)[number]) => {
    setAltModel(preset.model);
    setAltPrompt(preset.prompt);
    try {
      const parsed = JSON.parse(editorText) as Record<string, unknown>;
      const updated = {
        ...parsed,
        top_k: preset.topK,
        rerank: preset.rerank,
        strict_grounding: true,
      };
      setEditorText(JSON.stringify(updated, null, 2));
      setJsonError(null);
    } catch {
      setEditorText(
        JSON.stringify(
          { top_k: preset.topK, rerank: preset.rerank, strict_grounding: true },
          null,
          2
        )
      );
      setJsonError(null);
    }
  };

  const handleApplyOptimalPreset = () => {
    handleApplyPromptPreset(PROMPT_PRESETS[0]);
  };

  const handleForkClick = () => {
    if (!effectiveCp) return;
    try {
      const parsed = JSON.parse(editorText) as Record<string, unknown>;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setJsonError('State snapshot must be a JSON object.');
        return;
      }
      setJsonError(null);
      const overrides: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (JSON.stringify(effectiveCp.state_snapshot[k]) !== JSON.stringify(v)) {
          overrides[k] = v;
        }
      }
      if (!('top_k' in overrides)) overrides.top_k = parsed.top_k ?? 8;
      if (!('rerank' in overrides)) overrides.rerank = parsed.rerank ?? true;
      if (!('strict_grounding' in overrides)) {
        overrides.strict_grounding = parsed.strict_grounding ?? true;
      }
      overrides.model = altModel;
      if (altPrompt.trim()) {
        overrides.prompt_override = altPrompt.trim();
      }
      onForkAndReplay(effectiveCp.checkpoint_id, overrides);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax');
    }
  };

  const branchesList = Object.values(run.branches);
  const activeDiff =
    run.branch_diffs[Math.min(selectedDiffIdx, Math.max(0, run.branch_diffs.length - 1))] ?? null;

  return (
    <section
      id="time-travel-deck"
      className="vg-panel flex h-full flex-col rounded-lg"
      data-testid="time-travel-panel"
    >
      {/* Header + SubTabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-sky-400" />
          <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
            {t.timeTravelTitle}
          </h2>
        </div>

        <div className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5">
          <button
            type="button"
            data-testid="tab-timetravel-dag"
            onClick={() => setSubTab('dag')}
            className={`flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-medium transition-colors ${
              subTab === 'dag'
                ? 'bg-sky-500/20 text-sky-400'
                : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
            }`}
          >
            <GitBranch className="h-3 w-3" />
            <span>DAG &amp; FORK</span>
          </button>
          <button
            type="button"
            data-testid="tab-timetravel-diff"
            onClick={() => setSubTab('diff')}
            className={`flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-medium transition-colors ${
              subTab === 'diff'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
            }`}
          >
            <GitCompare className="h-3 w-3" />
            <span>{t.branchDiffTitle}</span>
            {run.branch_diffs.length > 0 && (
              <span className="rounded bg-emerald-500/30 px-1 text-[9px] text-emerald-300">
                {run.branch_diffs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      {subTab === 'dag' ? (
        <div className="flex flex-1 flex-col gap-3 p-3.5">
          {/* Branch Selector & DAG Timeline */}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {branchesList.map((b) => (
                <button
                  key={b.branch_id}
                  type="button"
                  onClick={() => onSelectBranch(b.branch_id)}
                  className={`flex items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] font-semibold transition-colors ${
                    run.active_branch_id === b.branch_id
                      ? 'border-sky-400/60 bg-sky-500/15 text-sky-400'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  <GitBranch className="h-3 w-3" />
                  <span>{b.branch_id}</span>
                  {b.forked_from_checkpoint_id && (
                    <span className="text-[9px] text-[var(--vg-text-dim)]">
                      from {b.forked_from_checkpoint_id}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Immutable Checkpoint DAG Nodes */}
            <div className="flex flex-col gap-2">
              {branchesList.map((branch) => (
                <div
                  key={branch.branch_id}
                  className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5"
                >
                  <div className="mb-2 flex items-center justify-between font-mono text-[10px]">
                    <span className="font-semibold text-[var(--vg-text)]">
                      {branch.branch_id.toUpperCase()}
                      {branch.forked_from_checkpoint_id
                        ? `  <-- FORKED AT ${branch.forked_from_checkpoint_id}`
                        : '  (IMMUTABLE ROOT LINEAGE)'}
                    </span>
                    <span className="text-[var(--vg-text-dim)]">
                      {branch.checkpoints.length} CPs · ${branch.total_cost_usd.toFixed(4)}
                    </span>
                  </div>

                  {branch.checkpoints.length === 0 ? (
                    <p className="font-mono text-[10px] text-[var(--vg-text-dim)]">
                      Awaiting first execution step...
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {branch.checkpoints.map((cp, idx) => {
                        const selected = effectiveCp?.checkpoint_id === cp.checkpoint_id;
                        const toneBorder =
                          cp.guardrail_status === 'rerouted'
                            ? 'border-rose-400/60'
                            : cp.groundedness !== undefined && cp.groundedness < 0.8
                              ? 'border-amber-400/60'
                              : selected
                                ? 'border-sky-400'
                                : 'border-[var(--vg-border)]';

                        return (
                          <React.Fragment key={cp.checkpoint_id}>
                            {idx > 0 && (
                              <ArrowRight className="h-3 w-3 shrink-0 text-[var(--vg-text-dim)]" />
                            )}
                            <button
                              type="button"
                              data-testid={`checkpoint-chip-${cp.checkpoint_id}`}
                              onClick={() => {
                                onSelectBranch(branch.branch_id);
                                onSelectCheckpoint(cp.checkpoint_id);
                              }}
                              className={`rounded border px-2 py-1 text-left transition-all ${toneBorder} ${
                                selected
                                  ? 'bg-sky-500/20 text-sky-300 shadow-[0_0_0_1px_rgba(56,189,248,0.3)]'
                                  : 'bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:border-sky-400/40 hover:text-[var(--vg-text)]'
                              }`}
                            >
                              <div className="font-mono text-[10px] font-bold">
                                {cp.checkpoint_id}
                              </div>
                              <div className="max-w-[110px] truncate font-mono text-[9px] opacity-80">
                                {cp.node_id.replace(/_/g, ' ')}
                              </div>
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* v3.0 Alternate Model + Prompt Override + JSON State Inspector */}
          <div className="flex flex-1 flex-col gap-2.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3">
            {/* Quick Replay Presets */}
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[var(--vg-text)]">
                  FORK OVERRIDES
                </span>
                {effectiveCp && (
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-400">
                    {effectiveCp.checkpoint_id}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                {PROMPT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`fork-preset-${preset.id}`}
                    onClick={() => handleApplyPromptPreset(preset)}
                    className="rounded border border-sky-400/35 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-sky-400 transition-colors hover:bg-sky-500/20"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alternate Model Selector */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
              <div className="flex flex-col gap-1 sm:col-span-5">
                <label
                  htmlFor="fork-alt-model"
                  className="flex items-center gap-1 font-mono text-[9px] font-semibold text-[var(--vg-text-muted)]"
                >
                  <Cpu className="h-3 w-3 text-sky-400" />
                  {t.forkAltModelLabel}
                </label>
                <select
                  id="fork-alt-model"
                  data-testid="fork-alt-model-select"
                  value={altModel}
                  onChange={(e) => setAltModel(e.target.value)}
                  className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5 font-mono text-[10.5px] text-[var(--vg-text)] outline-none focus:border-sky-400"
                >
                  {ALTERNATE_FORK_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} (${m.inputRatePer1M}/${m.outputRatePer1M})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1 sm:col-span-7">
                <label
                  htmlFor="fork-alt-prompt"
                  className="font-mono text-[9px] font-semibold text-[var(--vg-text-muted)]"
                >
                  {t.forkAltPromptLabel}
                </label>
                <input
                  id="fork-alt-prompt"
                  data-testid="fork-alt-prompt-input"
                  type="text"
                  value={altPrompt}
                  onChange={(e) => setAltPrompt(e.target.value)}
                  className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5 font-mono text-[10.5px] text-[var(--vg-text)] outline-none focus:border-sky-400"
                  placeholder="Enter alternate prompt directive for Branch B..."
                />
              </div>
            </div>

            {/* State JSON Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[9.5px] font-semibold tracking-wider text-[var(--vg-text-muted)]">
                {t.stateInspectorTitle}
              </span>
              <button
                type="button"
                data-testid="btn-apply-optimal-preset"
                onClick={handleApplyOptimalPreset}
                className="flex items-center gap-1 rounded border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 font-mono text-[9.5px] font-medium text-sky-400 transition-colors hover:bg-sky-500/20"
              >
                <Wand2 className="h-3 w-3" />
                <span>{t.applyOptimalPreset}</span>
              </button>
            </div>

            <textarea
              data-testid="checkpoint-state-editor"
              value={editorText}
              onChange={(e) => {
                setEditorText(e.target.value);
                setJsonError(null);
              }}
              rows={5}
              spellCheck={false}
              className="vg-code w-full flex-1 resize-none rounded p-2 text-[10.5px] leading-relaxed text-[var(--vg-text)] outline-none focus:border-sky-400"
            />

            {jsonError && (
              <p className="font-mono text-[10px] text-rose-400">JSON ERROR: {jsonError}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[9.5px] text-[var(--vg-text-dim)]">
                Immutable source checkpoint · Replay runs on isolated Branch B
              </span>
              <button
                type="button"
                data-testid="btn-fork-replay"
                disabled={!effectiveCp}
                onClick={handleForkClick}
                className="flex items-center gap-1.5 rounded border border-emerald-400/60 bg-emerald-500/20 px-3 py-1.5 font-mono text-[10.5px] font-bold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GitFork className="h-3.5 w-3.5" />
                <span>{t.forkAltReplayBtn}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Live Side-by-Side State & Structured Output Diff Inspector */
        <div className="flex flex-1 flex-col gap-3 p-3.5" data-testid="branch-diff-viewer">
          {!activeDiff ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-[var(--vg-border)] p-6 text-center">
              <GitCompare className="h-6 w-6 text-[var(--vg-text-dim)]" />
              <p className="mt-2 font-display text-xs font-semibold text-[var(--vg-text)]">
                No Forked Branches Yet
              </p>
              <p className="mt-1 max-w-xs text-[11px] text-[var(--vg-text-muted)]">
                Select any checkpoint in DAG &amp; FORK, pick an alternate model or prompt directive, and click Fork &amp; Replay to inspect live side-by-side state &amp; output diffs.
              </p>
            </div>
          ) : (
            <>
              {/* Branch Diff Selector & Model Comparison Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 font-mono text-[10.5px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-emerald-300">
                    {activeDiff.base_branch_id.toUpperCase()} vs{' '}
                    {activeDiff.compare_branch_id.toUpperCase()}
                  </span>
                  <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9.5px] text-sky-300">
                    {activeDiff.base_model ?? 'claude-sonnet-4'} -&gt;{' '}
                    {activeDiff.compare_model ?? 'claude-sonnet-4'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9.5px] text-[var(--vg-text-muted)]">
                    ORIGIN: {activeDiff.fork_checkpoint_id}
                  </span>
                  {run.branch_diffs.length > 1 && (
                    <div className="flex gap-1">
                      {run.branch_diffs.map((d, idx) => (
                        <button
                          key={d.compare_branch_id}
                          type="button"
                          onClick={() => setSelectedDiffIdx(idx)}
                          className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                            idx === selectedDiffIdx
                              ? 'bg-emerald-500/30 text-emerald-200'
                              : 'bg-[var(--vg-panel)] text-[var(--vg-text-dim)]'
                          }`}
                        >
                          {d.compare_branch_id}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Delta Metrics Strip: Tokens, Latency, Cost ($), Groundedness */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
                  <p className="text-[8.5px] text-[var(--vg-text-dim)]">COST SAVINGS ($)</p>
                  <p
                    className={`mt-0.5 text-xs font-bold ${
                      activeDiff.cost_delta_usd <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                    data-testid="diff-cost-pct"
                  >
                    {activeDiff.cost_delta_usd <= 0 ? '-' : '+'}$
                    {Math.abs(activeDiff.cost_delta_usd).toFixed(4)} ({activeDiff.cost_delta_pct}%)
                  </p>
                </div>
                <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
                  <p className="text-[8.5px] text-[var(--vg-text-dim)]">TOKEN DELTA</p>
                  <p
                    className={`mt-0.5 text-xs font-bold ${
                      activeDiff.tokens_delta <= 0 ? 'text-sky-400' : 'text-amber-400'
                    }`}
                    data-testid="diff-tokens-delta"
                  >
                    {activeDiff.tokens_delta > 0 ? '+' : ''}
                    {activeDiff.tokens_delta.toLocaleString()} ({activeDiff.tokens_delta_pct}%)
                  </p>
                </div>
                <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
                  <p className="text-[8.5px] text-[var(--vg-text-dim)]">LATENCY DELTA</p>
                  <p
                    className={`mt-0.5 text-xs font-bold ${
                      activeDiff.latency_delta_ms <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                    data-testid="diff-latency-delta"
                  >
                    {activeDiff.latency_delta_ms > 0 ? '+' : ''}
                    {activeDiff.latency_delta_ms}ms ({activeDiff.latency_delta_pct}%)
                  </p>
                </div>
                <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
                  <p className="text-[8.5px] text-[var(--vg-text-dim)]">GROUNDEDNESS</p>
                  <p
                    className="mt-0.5 text-xs font-bold text-emerald-400"
                    data-testid="diff-groundedness"
                  >
                    {activeDiff.groundedness_delta >= 0 ? '+' : ''}
                    {activeDiff.groundedness_delta.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Structured JSON State Key Diff Table */}
              {activeDiff.structured_state_diff && activeDiff.structured_state_diff.length > 0 && (
                <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5">
                  <p className="mb-1.5 font-mono text-[9.5px] font-semibold tracking-wider text-[var(--vg-text-muted)]">
                    LIVE JSON STATE DIFF ({activeDiff.base_branch_id.toUpperCase()} -&gt;{' '}
                    {activeDiff.compare_branch_id.toUpperCase()})
                  </p>
                  <div className="max-h-36 space-y-1 overflow-y-auto font-mono text-[10px]">
                    {activeDiff.structured_state_diff
                      .filter((entry) => entry.kind !== 'unchanged')
                      .slice(0, 10)
                      .map((entry) => (
                        <div
                          key={entry.path}
                          className="grid grid-cols-12 items-center gap-1.5 rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1"
                        >
                          <span className="col-span-4 truncate font-bold text-sky-400">
                            {entry.path}
                          </span>
                          <span className="col-span-4 truncate text-rose-400 line-through">
                            {entry.before === undefined ? '(unset)' : JSON.stringify(entry.before)}
                          </span>
                          <span className="col-span-4 truncate font-semibold text-emerald-400">
                            {entry.after === undefined ? '(removed)' : JSON.stringify(entry.after)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Side-by-Side Structured Output Diff (Branch A vs Branch B) */}
              <div
                data-testid="side-by-side-output-diff"
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
              >
                <div className="rounded-md border border-rose-400/35 bg-rose-500/8 p-2.5">
                  <p className="mb-1 font-mono text-[9.5px] font-bold text-rose-400">
                    [-] BRANCH A ({activeDiff.base_branch_id.toUpperCase()})
                  </p>
                  <pre className="vg-code max-h-36 overflow-auto rounded p-2 text-[9.5px] leading-relaxed text-[var(--vg-text)]">
                    {JSON.stringify(
                      activeDiff.base_structured_output ?? {
                        verdict: activeDiff.output_diff[0]?.text,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
                <div className="rounded-md border border-emerald-400/40 bg-emerald-500/8 p-2.5">
                  <p className="mb-1 font-mono text-[9.5px] font-bold text-emerald-400">
                    [+] BRANCH B ({activeDiff.compare_branch_id.toUpperCase()})
                  </p>
                  <pre className="vg-code max-h-36 overflow-auto rounded p-2 text-[9.5px] leading-relaxed text-[var(--vg-text)]">
                    {JSON.stringify(
                      activeDiff.compare_structured_output ?? {
                        verdict: activeDiff.output_diff[1]?.text,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>

              <div className="flex items-center justify-between font-mono text-[10px] text-[var(--vg-text-muted)]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  Guardrail: {activeDiff.base_guardrail.toUpperCase()} -&gt;{' '}
                  {activeDiff.compare_guardrail.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => setSubTab('dag')}
                  className="text-sky-400 hover:underline"
                >
                  Fork Another Branch
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
