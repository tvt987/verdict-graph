import React, { useState } from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import type { HitlAction, HitlContext } from '../types/protocol';
import type { Translations } from '../i18n/translations';

interface HitlBannerProps {
  t: Translations;
  context: HitlContext;
  onDecide: (action: HitlAction, canaryPercent: number) => void;
}

export const HitlBanner: React.FC<HitlBannerProps> = ({ t, context, onDecide }) => {
  const [canaryPercent, setCanaryPercent] = useState<number>(25);

  return (
    <section
      data-testid="hitl-approval-banner"
      className="vg-panel rounded-xl border-amber-500/45 bg-amber-500/8 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber-400/50 bg-amber-500/15">
            <AlertOctagon className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-amber-300">
                INTERRUPT · {context.checkpoint_id}
              </span>
              <span className="font-mono text-[11px] font-semibold text-amber-400">
                {t.hitlTitle}
              </span>
            </div>
            <p className="mt-1 font-display text-sm font-semibold text-[var(--vg-text)]">
              {context.proposed_action}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--vg-text-muted)]">
              <span>CLUSTER: {context.cluster}</span>
              <span>BLAST: {context.blast_radius}</span>
              <span className="text-rose-400">
                P99: {context.current_p99_ms}ms (SLO {context.target_p99_ms}ms)
              </span>
            </div>
          </div>
        </div>

        {/* Canary Traffic Slider */}
        <div className="min-w-[210px] rounded-md border border-[var(--vg-border)] bg-[var(--vg-panel)] p-2.5">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="flex items-center gap-1 text-[var(--vg-text-muted)]">
              <SlidersHorizontal className="h-3 w-3 text-amber-400" />
              {t.canaryLabel}
            </span>
            <span className="font-bold text-amber-400">{canaryPercent}%</span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={canaryPercent}
            onChange={(e) => setCanaryPercent(Number(e.target.value))}
            className="mt-1.5 w-full accent-amber-400"
            aria-label="Canary Traffic Percentage"
          />
          <div className="mt-0.5 flex justify-between font-mono text-[9px] text-[var(--vg-text-dim)]">
            <span>5%</span>
            <span>25%</span>
            <span>50%</span>
          </div>
        </div>
      </div>

      {/* Operator Decision Actions */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="hitl-btn-approve"
          onClick={() => onDecide('approve_rollback', 100)}
          className="flex items-center gap-1.5 rounded border border-emerald-500/55 bg-emerald-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 dark:border-emerald-400/60 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>{t.approveRollback}</span>
        </button>

        <button
          type="button"
          data-testid="hitl-btn-canary"
          onClick={() => onDecide('modify_canary', canaryPercent)}
          className="flex items-center gap-1.5 rounded border border-amber-500/55 bg-amber-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500/25 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/30"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span>
            {t.modifyCanaryApprove} ({canaryPercent}%)
          </span>
        </button>

        <button
          type="button"
          data-testid="hitl-btn-reject"
          onClick={() => onDecide('reject_escalate', 0)}
          className="flex items-center gap-1.5 rounded border border-rose-500/50 bg-rose-500/12 px-3 py-1.5 font-mono text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-500/22 dark:border-rose-400/50 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25"
        >
          <XCircle className="h-4 w-4" />
          <span>{t.rejectEscalate}</span>
        </button>
      </div>
    </section>
  );
};
