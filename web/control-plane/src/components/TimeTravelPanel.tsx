import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  GitBranch,
  GitCompare,
  GitFork,
  History,
  Wand2,
} from 'lucide-react';
import type { Checkpoint, ControlPlaneRun } from '../types/protocol';
import type { Translations } from '../i18n/translations';

interface TimeTravelPanelProps {
  t: Translations;
  run: ControlPlaneRun;
  selectedCheckpointId: string | null;
  onSelectCheckpoint: (cpId: string) => void;
  onSelectBranch: (branchId: string) => void;
  onForkAndReplay: (checkpointId: string, overrides: Record<string, unknown>) => void;
  presetTriggerCount: number;
}

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
      setEditorText(JSON.stringify(optimal, null, 2));
      setJsonError(null);
      setSubTab('dag');
    }
  }, [presetTriggerCount]);

  // Automatically surface Diff tab when a new fork diff arrives
  useEffect(() => {
    if (run.branch_diffs.length > 0) {
      setSubTab('diff');
    } else {
      setSubTab('dag');
    }
  }, [run.branch_diffs.length, run.run_id]);

  const handleApplyOptimalPreset = () => {
    try {
      const parsed = JSON.parse(editorText) as Record<string, unknown>;
      const updated = { ...parsed, top_k: 8, rerank: true, strict_grounding: true };
      setEditorText(JSON.stringify(updated, null, 2));
      setJsonError(null);
    } catch {
      setEditorText(JSON.stringify({ top_k: 8, rerank: true, strict_grounding: true }, null, 2));
      setJsonError(null);
    }
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
      // Extract mutated or explicit override keys
      const overrides: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (JSON.stringify(effectiveCp.state_snapshot[k]) !== JSON.stringify(v)) {
          overrides[k] = v;
        }
      }
      if (Object.keys(overrides).length === 0) {
        overrides.top_k = parsed.top_k ?? 8;
        overrides.rerank = parsed.rerank ?? true;
        overrides.strict_grounding = parsed.strict_grounding ?? true;
      }
      onForkAndReplay(effectiveCp.checkpoint_id, overrides);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax');
    }
  };

  const branchesList = Object.values(run.branches);
  const latestDiff = run.branch_diffs[run.branch_diffs.length - 1] ?? null;

  return (
    <section className="vg-panel flex h-full flex-col rounded-lg" data-testid="time-travel-panel">
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
                              <div className="max-w-[118px] truncate font-mono text-[9px] opacity-80">
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

          {/* Editable JSON State Inspector & Fork Controls */}
          <div className="flex flex-1 flex-col rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-semibold tracking-wider text-[var(--vg-text)]">
                  {t.stateInspectorTitle}
                </span>
                {effectiveCp && (
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-400">
                    {effectiveCp.checkpoint_id}
                  </span>
                )}
              </div>

              <button
                type="button"
                data-testid="btn-apply-optimal-preset"
                onClick={handleApplyOptimalPreset}
                className="flex items-center gap-1 rounded border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-sky-400 transition-colors hover:bg-sky-500/20"
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
              rows={7}
              spellCheck={false}
              className="vg-code w-full flex-1 resize-none rounded p-2.5 text-[11px] leading-relaxed text-[var(--vg-text)] outline-none focus:border-sky-400"
            />

            {jsonError && (
              <p className="mt-1.5 font-mono text-[10px] text-rose-400">JSON ERROR: {jsonError}</p>
            )}

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-[var(--vg-text-dim)]">
                Original checkpoint remains immutable; replay executes on a new fork branch.
              </span>
              <button
                type="button"
                data-testid="btn-fork-replay"
                disabled={!effectiveCp}
                onClick={handleForkClick}
                className="flex items-center gap-1.5 rounded border border-emerald-400/60 bg-emerald-500/20 px-3 py-1.5 font-mono text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <GitFork className="h-3.5 w-3.5" />
                <span>{t.forkReplayBtn}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Live Side-by-Side Branch Diff Viewer */
        <div className="flex flex-1 flex-col gap-3 p-3.5" data-testid="branch-diff-viewer">
          {!latestDiff ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-[var(--vg-border)] p-6 text-center">
              <GitCompare className="h-6 w-6 text-[var(--vg-text-dim)]" />
              <p className="mt-2 font-display text-xs font-semibold text-[var(--vg-text)]">
                No Forked Branches Yet
              </p>
              <p className="mt-1 max-w-xs text-[11px] text-[var(--vg-text-muted)]">
                Select any checkpoint in the DAG tab, edit state JSON (for example top_k: 8, rerank: true), and click Fork &amp; Replay Branch to inspect side-by-side diffs.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 font-mono text-[11px]">
                <span className="font-semibold text-emerald-300">
                  DIFF: {latestDiff.base_branch_id.toUpperCase()} vs{' '}
                  {latestDiff.compare_branch_id.toUpperCase()}
                </span>
                <span className="text-[var(--vg-text-muted)]">
                  FORK ORIGIN: {latestDiff.fork_checkpoint_id}
                </span>
              </div>

              {/* Delta Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2">
                  <p className="font-mono text-[9px] text-[var(--vg-text-dim)]">GROUNDEDNESS</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-emerald-400" data-testid="diff-groundedness">
                    {latestDiff.groundedness_delta >= 0 ? '+' : ''}
                    {latestDiff.groundedness_delta.toFixed(2)}
                  </p>
                </div>
                <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2">
                  <p className="font-mono text-[9px] text-[var(--vg-text-dim)]">COST DELTA</p>
                  <p
                    className={`mt-0.5 font-mono text-xs font-bold ${
                      latestDiff.cost_delta_pct <= 0 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                    data-testid="diff-cost-pct"
                  >
                    {latestDiff.cost_delta_pct > 0 ? '+' : ''}
                    {latestDiff.cost_delta_pct}%
                  </p>
                </div>
                <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2">
                  <p className="font-mono text-[9px] text-[var(--vg-text-dim)]">TOKEN DELTA</p>
                  <p
                    className={`mt-0.5 font-mono text-xs font-bold ${
                      latestDiff.tokens_delta <= 0 ? 'text-sky-400' : 'text-amber-400'
                    }`}
                  >
                    {latestDiff.tokens_delta > 0 ? '+' : ''}
                    {latestDiff.tokens_delta.toLocaleString()} ({latestDiff.tokens_delta_pct}%)
                  </p>
                </div>
                <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2">
                  <p className="font-mono text-[9px] text-[var(--vg-text-dim)]">LATENCY DELTA</p>
                  <p className="mt-0.5 font-mono text-xs font-bold text-sky-400">
                    {latestDiff.latency_delta_ms > 0 ? '+' : ''}
                    {latestDiff.latency_delta_ms}ms
                  </p>
                </div>
              </div>

              {/* Mutated State Keys */}
              {latestDiff.state_changes.length > 0 && (
                <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2.5">
                  <p className="mb-1.5 font-mono text-[10px] font-semibold text-[var(--vg-text-muted)]">
                    STATE MUTATIONS APPLIED AT {latestDiff.fork_checkpoint_id}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {latestDiff.state_changes.map((chg) => (
                      <span
                        key={chg.key}
                        className="flex items-center gap-1 rounded border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px]"
                      >
                        <span className="text-[var(--vg-text)]">{chg.key}:</span>
                        <span className="text-rose-400 line-through">
                          {JSON.stringify(chg.before)}
                        </span>
                        <ArrowRight className="h-2.5 w-2.5 text-[var(--vg-text-dim)]" />
                        <span className="font-bold text-emerald-400">
                          {JSON.stringify(chg.after)}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Side-by-Side Output Diff */}
              <div className="flex flex-col gap-2">
                {latestDiff.output_diff.map((line, i) => (
                  <div
                    key={i}
                    className={`rounded-md border p-2.5 font-mono text-[11px] leading-relaxed ${
                      line.kind === 'removed'
                        ? 'border-rose-400/35 bg-rose-500/10 text-rose-200'
                        : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    }`}
                  >
                    <span className="mr-2 font-bold">
                      {line.kind === 'removed' ? '[-] BRANCH A (MAIN)' : '[+] BRANCH B (FORK)'}
                    </span>
                    <span className="text-[var(--vg-text)]">{line.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between font-mono text-[10px] text-[var(--vg-text-muted)]">
                <span className="flex items-center gap-1 text-emerald-400">
                  <Check className="h-3.5 w-3.5" />
                  Guardrail: {latestDiff.base_guardrail.toUpperCase()} -&gt;{' '}
                  {latestDiff.compare_guardrail.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => setSubTab('dag')}
                  className="text-sky-400 hover:underline"
                >
                  Back to Checkpoint DAG
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
};
