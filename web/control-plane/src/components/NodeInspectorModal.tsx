import React from 'react';
import { Cpu, DollarSign, Timer, X } from 'lucide-react';
import type { Checkpoint, NodeMeta } from '../types/protocol';
import type { Translations } from '../i18n/translations';

interface NodeInspectorModalProps {
  t: Translations;
  node: NodeMeta;
  checkpoint: Checkpoint | null;
  onClose: () => void;
}

export const NodeInspectorModal: React.FC<NodeInspectorModalProps> = ({
  t,
  node,
  checkpoint,
  onClose,
}) => {
  return (
    <section
      data-testid="node-state-inspector"
      className="vg-panel rounded-lg border-sky-400/45 p-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-400">
            NODE {node.index}
          </span>
          <h3 className="font-display text-sm font-bold text-[var(--vg-text)]">{node.title}</h3>
          <span className="font-mono text-[10px] text-[var(--vg-text-dim)]">
            {t.nodeInspectorTitle}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[var(--vg-border)] p-1 text-[var(--vg-text-muted)] hover:border-sky-400/50 hover:text-[var(--vg-text)]"
          aria-label="Close Node Inspector"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!checkpoint ? (
        <p className="mt-3 font-mono text-xs text-[var(--vg-text-dim)]">
          Node {node.index} ({node.title}) has not executed yet on the active branch. Run or step the graph to inspect its state snapshot.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {/* Metrics Row */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
              <p className="text-[9px] text-[var(--vg-text-dim)]">CHECKPOINT</p>
              <p className="mt-0.5 text-xs font-bold text-sky-400">{checkpoint.checkpoint_id}</p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
              <p className="flex items-center gap-1 text-[9px] text-[var(--vg-text-dim)]">
                <Timer className="h-3 w-3" /> LATENCY
              </p>
              <p className="mt-0.5 text-xs font-bold text-[var(--vg-text)]">
                {checkpoint.latency_ms.toFixed(1)} ms
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
              <p className="flex items-center gap-1 text-[9px] text-[var(--vg-text-dim)]">
                <Cpu className="h-3 w-3" /> TOKENS (IN / OUT)
              </p>
              <p className="mt-0.5 text-xs font-bold text-[var(--vg-text)]">
                {checkpoint.input_tokens.toLocaleString()} / {checkpoint.output_tokens.toLocaleString()}
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-2 font-mono">
              <p className="flex items-center gap-1 text-[9px] text-[var(--vg-text-dim)]">
                <DollarSign className="h-3 w-3" /> STEP COST
              </p>
              <p className="mt-0.5 text-xs font-bold text-emerald-400">
                ${checkpoint.cost_usd.toFixed(5)}
              </p>
            </div>
          </div>

          {/* 3-Column JSON Snapshot */}
          <div className="grid gap-2.5 lg:grid-cols-3">
            <div>
              <p className="mb-1 font-mono text-[10px] font-semibold text-sky-400">
                PROMPT / TOOL ARGUMENTS
              </p>
              <pre className="vg-code max-h-44 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                {JSON.stringify(checkpoint.prompt_or_args, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] font-semibold text-[var(--vg-text-muted)]">
                INPUT STATE SNAPSHOT
              </p>
              <pre className="vg-code max-h-44 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                {JSON.stringify(checkpoint.input_state, null, 2)}
              </pre>
            </div>
            <div>
              <p className="mb-1 font-mono text-[10px] font-semibold text-emerald-400">
                OUTPUT STATE SNAPSHOT
              </p>
              <pre className="vg-code max-h-44 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                {JSON.stringify(checkpoint.state_snapshot, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
