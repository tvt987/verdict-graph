import React from 'react';
import {
  Activity,
  Check,
  Command,
  Cpu,
  DollarSign,
  Download,
  Gauge,
  Globe,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import type {
  BranchSummary,
  Locale,
  RuntimeMode,
  SpeedMode,
} from '../types/protocol';
import type { Translations } from '../i18n/translations';

interface TopBarProps {
  t: Translations;
  locale: Locale;
  onToggleLocale: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: (ev: React.MouseEvent<HTMLButtonElement>) => void;
  speed: SpeedMode;
  onChangeSpeed: (s: SpeedMode) => void;
  runtimeMode: RuntimeMode;
  clusterOnline: boolean;
  onOpenCommandPalette: () => void;
  onExportAuditBundle: () => void;
  auditExportedRecently: boolean;
  branch: BranchSummary;
  activeBranchId: string;
}

const SPEED_OPTIONS: SpeedMode[] = ['0.5x', '1x', '2x', 'instant'];

export const TopBar: React.FC<TopBarProps> = ({
  t,
  locale,
  onToggleLocale,
  theme,
  onToggleTheme,
  speed,
  onChangeSpeed,
  runtimeMode,
  clusterOnline,
  onOpenCommandPalette,
  onExportAuditBundle,
  auditExportedRecently,
  branch,
  activeBranchId,
}) => {
  const totalTokens = branch.total_input_tokens + branch.total_output_tokens;
  const groundednessDisplay = branch.groundedness > 0 ? branch.groundedness.toFixed(2) : '--';
  const groundednessColor =
    branch.groundedness >= 0.9
      ? 'text-emerald-400'
      : branch.groundedness > 0
        ? 'text-amber-400'
        : 'text-[var(--vg-text-muted)]';

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--vg-border)] bg-[var(--vg-panel)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5">
        {/* Brand Identity */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sky-400/35 bg-sky-500/10">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <path
                d="M14 18L32 48L50 18"
                stroke="currentColor"
                className="text-sky-400"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="14" cy="18" r="5" fill="#10B981" />
              <circle cx="50" cy="18" r="5" fill="#F59E0B" />
              <circle cx="32" cy="48" r="5" fill="#38BDF8" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-bold tracking-[0.12em] text-[var(--vg-text)]">
                VERDICT GRAPH
              </span>
              <span
                data-testid="version-badge"
                className="rounded border border-emerald-400/45 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-emerald-400"
              >
                v2.0
              </span>
              <span className="rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-sky-400">
                {activeBranchId.toUpperCase()}
              </span>
            </div>
            <p className="hidden font-mono text-[10px] tracking-[0.08em] text-[var(--vg-text-muted)] sm:block">
              {t.brandSubtitle}
            </p>
          </div>
        </div>

        {/* Live FinOps & Quality Ticker */}
        <div className="hidden items-center gap-1.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1 xl:flex">
          <div className="flex items-center gap-1.5 border-r border-[var(--vg-border)] pr-2.5">
            <DollarSign className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono text-[10px] text-[var(--vg-text-dim)]">{t.finopsCost}</span>
            <span className="font-mono text-xs font-semibold text-[var(--vg-text)]" data-testid="ticker-cost">
              ${branch.total_cost_usd.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 border-r border-[var(--vg-border)] px-2.5">
            <Cpu className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono text-[10px] text-[var(--vg-text-dim)]">{t.finopsTokens}</span>
            <span className="font-mono text-xs font-semibold text-[var(--vg-text)]" data-testid="ticker-tokens">
              {totalTokens.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 border-r border-[var(--vg-border)] px-2.5">
            <Activity className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-mono text-[10px] text-[var(--vg-text-dim)]">{t.finopsLatency}</span>
            <span className="font-mono text-xs font-semibold text-[var(--vg-text)]">
              {branch.total_latency_ms.toFixed(0)}ms
            </span>
          </div>
          <div className="flex items-center gap-1.5 pl-2.5">
            <ShieldCheck className={`h-3.5 w-3.5 ${groundednessColor}`} />
            <span className="font-mono text-[10px] text-[var(--vg-text-dim)]">{t.finopsGroundedness}</span>
            <span className={`font-mono text-xs font-bold ${groundednessColor}`} data-testid="ticker-groundedness">
              {groundednessDisplay}
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5">
          {/* Runtime Badge */}
          <div
            className="hidden items-center gap-1.5 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[10px] 2xl:flex"
            title={clusterOnline ? t.clusterOnline : t.clusterOffline}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                runtimeMode === 'python' && clusterOnline
                  ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                  : runtimeMode === 'byok'
                    ? 'bg-amber-400'
                    : 'bg-sky-400'
              }`}
            />
            <span className="text-[var(--vg-text-muted)]">
              {runtimeMode === 'python' && clusterOnline
                ? 'CLUSTER :8090'
                : runtimeMode === 'byok'
                  ? 'BYOK LIVE'
                  : 'BROWSER ENGINE'}
            </span>
          </div>

          {/* Speed Selector */}
          <div className="hidden items-center gap-0.5 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5 md:flex">
            <Gauge className="mx-1.5 h-3.5 w-3.5 text-[var(--vg-text-dim)]" />
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChangeSpeed(opt)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors ${
                  speed === opt
                    ? 'bg-sky-500/20 text-sky-400'
                    : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                }`}
              >
                {opt === 'instant' ? 'MAX' : opt}
              </button>
            ))}
          </div>

          {/* 1-Click Export Audit Bundle */}
          <button
            type="button"
            onClick={onExportAuditBundle}
            data-testid="topbar-export-audit-btn"
            className="hidden items-center gap-1.5 rounded border border-sky-400/40 bg-sky-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-sky-400 transition-colors hover:bg-sky-500/20 sm:flex"
            title="Download signed JSON trace & OpenTelemetry OTLP spans"
          >
            {auditExportedRecently ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">{t.exportAuditSaved}</span>
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                <span>{t.exportAuditBtn}</span>
              </>
            )}
          </button>

          {/* Bilingual EN/VI Toggle */}
          <button
            type="button"
            onClick={onToggleLocale}
            data-testid="locale-toggle"
            className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[11px] font-medium text-[var(--vg-text)] transition-colors hover:border-sky-400/50"
            title="Switch English / Vietnamese"
          >
            <Globe className="h-3.5 w-3.5 text-sky-400" />
            <span>{locale.toUpperCase()}</span>
          </button>

          {/* Theme View-Transitions Toggle */}
          <button
            type="button"
            onClick={onToggleTheme}
            data-testid="theme-toggle"
            className="flex items-center justify-center rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-1.5 text-[var(--vg-text)] transition-colors hover:border-sky-400/50"
            aria-label="Toggle Obsidian / Blueprint Theme"
            title="Toggle Deep Aerospace Obsidian / Light Technical Blueprint"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-sky-600" />}
          </button>

          {/* CMD+K Palette Button */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            data-testid="cmd-k-trigger"
            className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[11px] text-[var(--vg-text-muted)] transition-colors hover:border-sky-400/50 hover:text-[var(--vg-text)]"
          >
            <Command className="h-3 w-3" />
            <span>K</span>
          </button>
        </div>
      </div>
    </header>
  );
};
