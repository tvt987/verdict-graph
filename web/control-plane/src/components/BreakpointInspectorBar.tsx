import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  GitFork,
  Play,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Sparkles,
  StepForward,
  AlertCircle,
} from 'lucide-react';
import type {
  DebuggerNode,
  EditableCheckpointState,
  ModelTier,
} from '../engines/interactiveGraphDebuggerEngine';

interface BreakpointInspectorBarProps {
  pausedNode: DebuggerNode;
  checkpointState: EditableCheckpointState;
  onUpdateState: (patch: Partial<EditableCheckpointState>) => void;
  onApplyJson: (rawJson: string) => { ok: boolean; error?: string };
  onStepOver: () => void;
  onResume: () => void;
  onLaunchForkRace: () => void;
}

const MODEL_TIERS: Array<{ id: ModelTier; label: string; badge: string }> = [
  { id: 'frontier', label: 'Frontier', badge: 'Claude 3.7' },
  { id: 'balanced', label: 'Cascade', badge: '-54% USD' },
  { id: 'fast', label: 'Fast Flash', badge: '-69% USD' },
];

const TOKEN_PRESETS = [1024, 2048, 4096, 8192];
const TOP_K_PRESETS = [4, 8, 16, 24];

export const BreakpointInspectorBar: React.FC<BreakpointInspectorBarProps> = ({
  pausedNode,
  checkpointState,
  onUpdateState,
  onApplyJson,
  onStepOver,
  onResume,
  onLaunchForkRace,
}) => {
  const [jsonDraft, setJsonDraft] = useState<string>(() =>
    JSON.stringify(checkpointState, null, 2)
  );
  const [jsonStatus, setJsonStatus] = useState<{ ok: boolean; message: string }>({
    ok: true,
    message: 'SYNCED WITH CHECKPOINT',
  });

  useEffect(() => {
    setJsonDraft(JSON.stringify(checkpointState, null, 2));
    setJsonStatus({ ok: true, message: 'SYNCED WITH CHECKPOINT' });
  }, [checkpointState]);

  const handleApplyJson = () => {
    const res = onApplyJson(jsonDraft);
    if (res.ok) {
      setJsonStatus({ ok: true, message: 'MUTATION APPLIED TO CHECKPOINT' });
    } else {
      setJsonStatus({ ok: false, message: res.error ?? 'Invalid JSON payload' });
    }
  };

  const handleApplyOptimal = () => {
    onUpdateState({
      modelTier: 'balanced',
      firewallStrict: true,
      stripPoisonedContext: true,
      ragTopK: 8,
      maxTokens: 4096,
      circuitBreakerFallback: true,
      customNote: 'Optimal Guarded Cascade (-54.2% USD, 0.99 groundedness)',
    });
  };

  return (
    <section
      data-testid="breakpoint-inspector-panel"
      className="vg-panel overflow-hidden rounded-xl border-rose-500/40 ring-1 ring-rose-500/15"
    >
      {/* Top Breakpoint Debugger Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--vg-border)] bg-rose-500/[0.06] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600 dark:bg-rose-500" />
          </span>
          <span className="font-mono text-[11px] font-bold tracking-wider text-rose-700 dark:text-rose-300">
            PAUSED AT BREAKPOINT
          </span>
          <span className="rounded-md border border-rose-500/35 bg-[var(--vg-panel)] px-2 py-0.5 font-mono text-[10.5px] font-bold text-[var(--vg-text)]">
            {pausedNode.index} · {pausedNode.title}
          </span>
          <span className="hidden rounded-full border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--vg-text-muted)] md:inline-flex">
            AG-UI INTERRUPT_REQUIRED
          </span>
        </div>

        {/* Debugger Execution Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStepOver}
            data-testid="bp-step-over-btn"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-panel)] px-3 py-1.5 font-mono text-[11px] font-bold text-[var(--vg-text)] transition-colors hover:border-[var(--vg-accent-border)] hover:text-[var(--vg-accent)]"
          >
            <StepForward className="h-3.5 w-3.5" />
            <span>STEP OVER</span>
          </button>

          <button
            type="button"
            onClick={onResume}
            data-testid="bp-resume-btn"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-panel)] px-3 py-1.5 font-mono text-[11px] font-semibold text-[var(--vg-text-muted)] transition-colors hover:border-emerald-500/45 hover:text-emerald-700 dark:hover:text-emerald-300"
          >
            <Play className="h-3.5 w-3.5" />
            <span>RESUME</span>
          </button>

          <button
            type="button"
            onClick={onLaunchForkRace}
            data-testid="bp-fork-race-btn"
            className="flex items-center gap-1.5 rounded-lg border border-indigo-600 bg-indigo-600 px-3.5 py-1.5 font-mono text-[11px] font-bold text-white shadow-xs transition-all hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            <GitFork className="h-3.5 w-3.5" />
            <span>FORK &amp; RACE SIDE-BY-SIDE</span>
          </button>
        </div>
      </div>

      {/* Interactive Checkpoint Mutation Controls + Live State JSON */}
      <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-12">
        {/* Left 6 Cols: Tactile State Mutation Controls */}
        <div className="flex flex-col gap-3.5 lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold tracking-wider text-[var(--vg-text-muted)]">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
              <span>LIVE AGENT CHECKPOINT MUTATOR</span>
            </div>
            <button
              type="button"
              onClick={handleApplyOptimal}
              data-testid="bp-optimal-preset-btn"
              className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 transition-colors hover:bg-emerald-500/18 dark:text-emerald-300"
            >
              <Sparkles className="h-3 w-3" />
              <span>Guarded Cascade Preset</span>
            </button>
          </div>

          {/* Model Tier Selector */}
          <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-3">
            <div className="mb-2 flex items-center justify-between font-mono text-[10px] font-bold text-[var(--vg-text-dim)]">
              <span>MODEL ROUTING TIER</span>
              <span className="text-[var(--vg-accent)]">
                {checkpointState.modelTier.toUpperCase()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {MODEL_TIERS.map((tier) => {
                const active = checkpointState.modelTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    type="button"
                    data-testid={`bp-tier-${tier.id}`}
                    onClick={() => onUpdateState({ modelTier: tier.id })}
                    className={`flex flex-col items-center rounded-lg border px-2 py-2 text-center transition-all ${
                      active
                        ? 'border-[var(--vg-accent-border)] bg-[var(--vg-panel)] text-[var(--vg-accent)] shadow-xs ring-1 ring-[var(--vg-accent-border)]'
                        : 'border-[var(--vg-border)] bg-[var(--vg-surface)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                    }`}
                  >
                    <span className="font-display text-xs font-bold">{tier.label}</span>
                    <span className="mt-0.5 font-mono text-[9.5px] opacity-85">{tier.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Security & Context Toggles */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              data-testid="bp-toggle-firewall"
              onClick={() =>
                onUpdateState({ firewallStrict: !checkpointState.firewallStrict })
              }
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all ${
                checkpointState.firewallStrict
                  ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
                  : 'border-rose-500/45 bg-rose-500/10 text-rose-800 dark:text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {checkpointState.firewallStrict ? (
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                ) : (
                  <ShieldOff className="h-4 w-4 shrink-0" />
                )}
                <div>
                  <p className="font-mono text-[10.5px] font-bold">OWASP Strict Shield</p>
                  <p className="text-[10.5px] opacity-80">
                    {checkpointState.firewallStrict ? 'Deflect LLM01-10' : 'Bypass (Vulnerable)'}
                  </p>
                </div>
              </div>
              <span className="rounded bg-[var(--vg-panel)] px-1.5 py-0.5 font-mono text-[9.5px] font-bold">
                {checkpointState.firewallStrict ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              data-testid="bp-toggle-strip"
              onClick={() =>
                onUpdateState({
                  stripPoisonedContext: !checkpointState.stripPoisonedContext,
                })
              }
              className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all ${
                checkpointState.stripPoisonedContext
                  ? 'border-indigo-500/45 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300'
                  : 'border-amber-500/45 bg-amber-500/10 text-amber-800 dark:text-amber-300'
              }`}
            >
              <div>
                <p className="font-mono text-[10.5px] font-bold">Strip Poisoned Context</p>
                <p className="text-[10.5px] opacity-80">
                  {checkpointState.stripPoisonedContext
                    ? 'Purge stale/injected chunks'
                    : 'Keep raw 24 chunks'}
                </p>
              </div>
              <span className="rounded bg-[var(--vg-panel)] px-1.5 py-0.5 font-mono text-[9.5px] font-bold">
                {checkpointState.stripPoisonedContext ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>

          {/* Token Cap + RAG Top-K Quick Pills */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-2.5">
              <p className="mb-1.5 font-mono text-[9.5px] font-bold text-[var(--vg-text-dim)]">
                MAX TOKENS CAP
              </p>
              <div className="grid grid-cols-4 gap-1">
                {TOKEN_PRESETS.map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => onUpdateState({ maxTokens: tok })}
                    className={`rounded-md py-1 font-mono text-[10px] font-bold transition-colors ${
                      checkpointState.maxTokens === tok
                        ? 'bg-[var(--vg-accent)] text-white'
                        : 'bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                    }`}
                  >
                    {tok >= 1000 ? `${tok / 1024}k` : tok}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface-subtle)] p-2.5">
              <p className="mb-1.5 font-mono text-[9.5px] font-bold text-[var(--vg-text-dim)]">
                HYBRID RAG TOP-K
              </p>
              <div className="grid grid-cols-4 gap-1">
                {TOP_K_PRESETS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => onUpdateState({ ragTopK: k })}
                    className={`rounded-md py-1 font-mono text-[10px] font-bold transition-colors ${
                      checkpointState.ragTopK === k
                        ? 'bg-[var(--vg-accent)] text-white'
                        : 'bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                    }`}
                  >
                    k={k}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Direct Editable Checkpoint State JSON */}
        <div className="flex flex-col gap-2 lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10.5px] font-bold tracking-wider text-[var(--vg-text-muted)]">
              EDITABLE AGENT STATE JSON ({pausedNode.id})
            </span>
            <button
              type="button"
              onClick={handleApplyJson}
              data-testid="bp-apply-json-btn"
              className="rounded-md border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--vg-accent)] transition-colors hover:opacity-90"
            >
              Apply JSON Patch
            </button>
          </div>

          <textarea
            data-testid="bp-state-json-editor"
            aria-label="Editable Agent Checkpoint State JSON"
            value={jsonDraft}
            onChange={(e) => setJsonDraft(e.target.value)}
            rows={8}
            spellCheck={false}
            className="vg-code w-full flex-1 resize-none rounded-lg p-3 font-mono text-[11.5px] leading-relaxed text-[var(--vg-text)] outline-none focus:border-[var(--vg-accent)] focus:ring-1 focus:ring-[var(--vg-accent)]"
          />

          <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                jsonStatus.ok
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {jsonStatus.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              <span>{jsonStatus.message}</span>
            </span>
            <span className="text-[var(--vg-text-dim)]">
              Mutate JSON -&gt; Step Over or Fork Race
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BreakpointInspectorBar;
