import React from 'react';
import {
  Activity,
  Check,
  Command,
  Download,
  FileSearch,
  Globe,
  Moon,
  ShieldAlert,
  Sliders,
  Sun,
} from 'lucide-react';
import type { Locale } from '../types/protocol';
import type { Translations } from '../i18n/translations';

export type WorkspaceTab = 'orchestrator' | 'firewall' | 'routing' | 'audit';

interface TopBarProps {
  t: Translations;
  locale: Locale;
  onToggleLocale: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: (ev: React.MouseEvent<HTMLButtonElement>) => void;
  activeWorkspace: WorkspaceTab;
  onSelectWorkspace: (tab: WorkspaceTab) => void;
  onOpenCommandPalette: () => void;
  onExportAuditBundle: () => void;
  auditExportedRecently: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  t,
  locale,
  onToggleLocale,
  theme,
  onToggleTheme,
  activeWorkspace,
  onSelectWorkspace,
  onOpenCommandPalette,
  onExportAuditBundle,
  auditExportedRecently,
}) => {
  const isDark = theme === 'dark';

  const tabs: Array<{
    id: WorkspaceTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'orchestrator',
      label: t.tabOrchestrator,
      shortLabel: 'DAG',
      icon: <Activity className="h-3.5 w-3.5 shrink-0" />,
    },
    {
      id: 'firewall',
      label: t.tabFirewall,
      shortLabel: 'Firewall',
      icon: <ShieldAlert className="h-3.5 w-3.5 shrink-0" />,
    },
    {
      id: 'routing',
      label: t.tabRoutingArena,
      shortLabel: 'Routing',
      icon: <Sliders className="h-3.5 w-3.5 shrink-0" />,
    },
    {
      id: 'audit',
      label: t.tabAuditOtlp,
      shortLabel: 'Audit',
      icon: <FileSearch className="h-3.5 w-3.5 shrink-0" />,
    },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--vg-border)] bg-[var(--vg-panel)]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1520px] flex-col gap-2.5 px-4 py-2.5 sm:px-6 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:py-0">
        {/* Top Row (Mobile) / Left+Right Split */}
        <div className="flex items-center justify-between gap-3 lg:contents">
          {/* Brand Identity */}
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)]">
              <svg width="18" height="18" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                <path
                  d="M14 18L32 48L50 18"
                  stroke="currentColor"
                  className="text-[var(--vg-accent)]"
                  strokeWidth="5.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="14" cy="18" r="5.2" fill={isDark ? '#34D399' : '#059669'} />
                <circle cx="50" cy="18" r="5.2" fill={isDark ? '#FBBF24' : '#D97706'} />
                <circle cx="32" cy="48" r="5.2" fill={isDark ? '#818CF8' : '#4F46E5'} />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-bold tracking-tight text-[var(--vg-text)] sm:text-[15px]">
                Verdict Graph
              </span>
              <span
                data-testid="version-badge"
                className="rounded-full border border-[var(--vg-accent-border)] bg-[var(--vg-accent-soft)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--vg-accent)]"
              >
                v5.0
              </span>
            </div>
          </div>

          {/* Center: Spacious Single-Row Segmented Workspace Tabs (Desktop) */}
          <nav
            aria-label="Workspace navigation"
            role="tablist"
            className="hidden items-center gap-1 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-1 lg:flex"
          >
            {tabs.map((tab) => {
              const active = activeWorkspace === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`nav-tab-${tab.id}`}
                  onClick={() => onSelectWorkspace(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-[var(--vg-panel)] text-[var(--vg-accent)] shadow-xs ring-1 ring-[var(--vg-border)]'
                      : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Studio Utility Cluster */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Daylight Studio <-> Obsidian Graphite Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              data-testid="theme-toggle"
              className="flex items-center gap-1.5 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--vg-text)] transition-colors hover:border-[var(--vg-accent-border)] hover:bg-[var(--vg-surface-hover)]"
              aria-label="Toggle Daylight Studio and Obsidian Graphite theme"
              title="Toggle Crisp Engineering Daylight / Obsidian Graphite"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5 text-amber-400" />
              ) : (
                <Moon className="h-3.5 w-3.5 text-indigo-600" />
              )}
              <span className="hidden sm:inline">
                {isDark ? t.themeObsidian : t.themeDaylight}
              </span>
            </button>

            {/* Bilingual EN / VI Toggle */}
            <button
              type="button"
              onClick={onToggleLocale}
              data-testid="locale-toggle"
              className="flex items-center gap-1 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[var(--vg-text)] transition-colors hover:border-[var(--vg-accent-border)]"
              title="Switch English / Vietnamese"
            >
              <Globe className="h-3.5 w-3.5 text-[var(--vg-accent)]" />
              <span>{locale.toUpperCase()}</span>
            </button>

            {/* 1-Click Export Signed OTLP Audit Bundle */}
            <button
              type="button"
              onClick={onExportAuditBundle}
              data-testid="topbar-export-audit-btn"
              className="hidden items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 md:flex dark:text-emerald-300"
              title="Download signed JSON trace and OpenTelemetry OTLP spans"
            >
              {auditExportedRecently ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>{t.exportAuditSaved}</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>{t.exportAuditBtn}</span>
                </>
              )}
            </button>

            {/* CMD+K Quick Dispatch */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              data-testid="cmd-k-trigger"
              className="flex items-center gap-1 rounded-lg border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono text-[11px] font-medium text-[var(--vg-text-muted)] transition-colors hover:border-[var(--vg-accent-border)] hover:text-[var(--vg-text)]"
              aria-label="Open Command Palette"
            >
              <Command className="h-3 w-3" />
              <span>K</span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Single-Row Segmented Workspace Tabs (Zero Cramped Wrapping) */}
        <nav
          aria-label="Mobile workspace navigation"
          role="tablist"
          className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--vg-border)] bg-[var(--vg-surface)] p-1 lg:hidden"
        >
          {tabs.map((tab) => {
            const active = activeWorkspace === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`mobile-nav-tab-${tab.id}`}
                onClick={() => onSelectWorkspace(tab.id)}
                className={`flex items-center justify-center gap-1.5 truncate rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-all ${
                  active
                    ? 'bg-[var(--vg-panel)] text-[var(--vg-accent)] shadow-xs ring-1 ring-[var(--vg-border)]'
                    : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                }`}
              >
                <span className="hidden sm:inline-flex">{tab.icon}</span>
                <span className="truncate sm:hidden">{tab.shortLabel}</span>
                <span className="hidden truncate sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
