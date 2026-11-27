import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cpu,
  DollarSign,
  Eye,
  Flame,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Zap,
} from 'lucide-react';
import type { Locale } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import {
  ALL_FIREWALL_OWASP_IDS,
  BREAKER_MODELS,
  type CircuitBreakerMode,
  FIREWALL_PRESETS,
  type FallbackModelId,
  type FrontierModelId,
  OWASP_SHORT_LABELS,
  scanPromptFirewall,
  simulateBudgetCircuitBreaker,
} from '../engine/promptFirewallEngine';

interface PromptFirewallLabProps {
  t: Translations;
  locale: Locale;
}

const FRONTIER_OPTIONS: FrontierModelId[] = [
  'claude-3.7-sonnet',
  'gpt-4o',
  'gemini-2.5-pro',
];

const FALLBACK_OPTIONS: FallbackModelId[] = ['gemini-2.5-flash', 'vllm-qwen-72b'];

export const PromptFirewallLab: React.FC<PromptFirewallLabProps> = ({ t, locale }) => {
  // Left Panel: OWASP LLM01-LLM10 Prompt Firewall state
  const [selectedPresetId, setSelectedPresetId] = useState<string>(FIREWALL_PRESETS[0].id);
  const [promptText, setPromptText] = useState<string>(FIREWALL_PRESETS[0].prompt);
  const [inspectorView, setInspectorView] = useState<'highlighted' | 'sanitized'>('highlighted');

  // Right Panel: Live Token / USD Budget Circuit Breaker state
  const [breakerMode, setBreakerMode] = useState<CircuitBreakerMode>('DOWNGRADE_MODEL');
  const [frontierModel, setFrontierModel] = useState<FrontierModelId>('claude-3.7-sonnet');
  const [fallbackModel, setFallbackModel] = useState<FallbackModelId>('gemini-2.5-flash');
  const [maxTokenCap, setMaxTokenCap] = useState<number>(16_000);
  const [maxUsdCap, setMaxUsdCap] = useState<number>(0.035);

  const scanResult = useMemo(() => scanPromptFirewall(promptText), [promptText]);

  const breakerResult = useMemo(
    () =>
      simulateBudgetCircuitBreaker({
        maxTokenCap,
        maxUsdCap,
        softThresholdRatio: 0.55,
        breakerMode,
        frontierModel,
        fallbackModel,
      }),
    [breakerMode, fallbackModel, frontierModel, maxTokenCap, maxUsdCap]
  );

  const handleSelectPreset = (presetId: string) => {
    const preset = FIREWALL_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(preset.id);
    setPromptText(preset.prompt);
  };

  const applyBreakerPreset = (preset: 'tight' | 'downgrade' | 'generous') => {
    if (preset === 'tight') {
      setBreakerMode('HARD_STOP');
      setFrontierModel('claude-3.7-sonnet');
      setMaxTokenCap(12_000);
      setMaxUsdCap(0.022);
    } else if (preset === 'downgrade') {
      setBreakerMode('DOWNGRADE_MODEL');
      setFrontierModel('claude-3.7-sonnet');
      setFallbackModel('gemini-2.5-flash');
      setMaxTokenCap(16_000);
      setMaxUsdCap(0.035);
    } else {
      setBreakerMode('HARD_STOP');
      setFrontierModel('gemini-2.5-pro');
      setMaxTokenCap(20_000);
      setMaxUsdCap(0.12);
    }
  };

  const decisionBadgeClass =
    scanResult.decision === 'BLOCK'
      ? 'border-rose-500/60 bg-rose-500/15 text-rose-400'
      : scanResult.decision === 'SANITIZE_WARN'
        ? 'border-amber-400/60 bg-amber-500/15 text-amber-400'
        : 'border-emerald-400/60 bg-emerald-500/15 text-emerald-400';

  const breakerBadgeClass =
    breakerResult.breakerState === 'TRIPPED_HARD_STOP'
      ? 'border-rose-500/60 bg-rose-500/15 text-rose-400'
      : breakerResult.breakerState === 'DOWNGRADED_FLASH'
        ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
        : 'border-emerald-400/60 bg-emerald-500/15 text-emerald-400';

  return (
    <section
      id="prompt-firewall-deck"
      data-testid="prompt-firewall-lab"
      className="vg-panel flex flex-col rounded-lg"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.firewallLabTitle}
            </h2>
            <span className="rounded border border-sky-400/45 bg-sky-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-sky-400">
              v4.0 LIVE GUARD
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
            {t.firewallLabSubtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[9.5px]">
          <span className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-0.5 text-[var(--vg-text-muted)]">
            SCANNER: <strong className="text-sky-400">{scanResult.scanLatencyMs}ms</strong>
          </span>
          <span className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-0.5 text-[var(--vg-text-muted)]">
            BREAKER:{' '}
            <strong
              className={
                breakerResult.breakerState === 'TRIPPED_HARD_STOP'
                  ? 'text-rose-400'
                  : breakerResult.breakerState === 'DOWNGRADED_FLASH'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
              }
            >
              {breakerResult.breakerState}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 gap-3.5 p-3.5 xl:grid-cols-12">
        {/* LEFT: Real-Time OWASP LLM01-LLM10 Prompt Firewall Scanner */}
        <div className="flex min-w-0 flex-col gap-3 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3 xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] pb-2">
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-rose-400" />
              <h3 className="font-mono text-[10.5px] font-bold tracking-wider text-[var(--vg-text)]">
                {t.firewallScannerHeading}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                data-testid="firewall-decision-badge"
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${decisionBadgeClass}`}
              >
                {scanResult.decision}
              </span>
              <span
                data-testid="firewall-risk-score"
                className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-0.5 font-mono text-[10px] font-bold text-[var(--vg-text)]"
              >
                RISK {scanResult.riskScore}/100
              </span>
            </div>
          </div>

          {/* Preset Pills */}
          <div className="flex flex-wrap gap-1.5">
            {FIREWALL_PRESETS.map((preset) => {
              const active = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`firewall-preset-${preset.id}`}
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`flex items-center gap-1 rounded border px-2 py-1 font-mono text-[9.5px] font-semibold transition-colors ${
                    active
                      ? preset.expectedDecision === 'ALLOW'
                        ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
                        : 'border-rose-400/60 bg-rose-500/15 text-rose-300'
                      : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-muted)] hover:border-sky-400/50 hover:text-[var(--vg-text)]'
                  }`}
                >
                  <span
                    className={
                      preset.expectedDecision === 'ALLOW' ? 'text-emerald-400' : 'text-rose-400'
                    }
                  >
                    {preset.code}
                  </span>
                  <span>{locale === 'vi' ? preset.labelVi : preset.label}</span>
                </button>
              );
            })}
          </div>

          {/* Arbitrary User Prompt Textarea */}
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[9.5px] text-[var(--vg-text-dim)]">
              <span>LIVE PROMPT PAYLOAD INSPECTOR</span>
              <span>
                {scanResult.estimatedPromptTokens.toLocaleString()} EST. TOKENS ·{' '}
                {scanResult.findings.length} PATTERN HIT(S)
              </span>
            </div>
            <textarea
              data-testid="firewall-prompt-input"
              value={promptText}
              onChange={(e) => {
                setSelectedPresetId('custom');
                setPromptText(e.target.value);
              }}
              rows={3}
              spellCheck={false}
              aria-label="Prompt Firewall Input"
              className="vg-code w-full resize-none rounded-md p-2.5 text-[11px] leading-relaxed text-[var(--vg-text)] outline-none focus:border-sky-400/60"
              placeholder="Paste or type any user prompt to inspect against OWASP LLM01-LLM10..."
            />
          </div>

          {/* Highlighted Risk Spans / Sanitized Prompt Output (Pure escaped JSX spans) */}
          <div className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-panel)] p-2.5">
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold text-[var(--vg-text-muted)]">
                <Eye className="h-3.5 w-3.5 text-sky-400" />
                <span>
                  {inspectorView === 'highlighted'
                    ? 'HIGHLIGHTED RISKY PATTERN SPANS'
                    : 'SANITIZED REDACTED OUTPUT'}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5 font-mono text-[9px]">
                <button
                  type="button"
                  data-testid="firewall-view-highlighted"
                  onClick={() => setInspectorView('highlighted')}
                  className={`rounded px-1.5 py-0.5 font-semibold ${
                    inspectorView === 'highlighted'
                      ? 'bg-sky-500/20 text-sky-400'
                      : 'text-[var(--vg-text-muted)]'
                  }`}
                >
                  HIGHLIGHT
                </button>
                <button
                  type="button"
                  data-testid="firewall-view-sanitized"
                  onClick={() => setInspectorView('sanitized')}
                  className={`rounded px-1.5 py-0.5 font-semibold ${
                    inspectorView === 'sanitized'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-[var(--vg-text-muted)]'
                  }`}
                >
                  SANITIZED
                </button>
              </div>
            </div>

            {inspectorView === 'highlighted' ? (
              <div
                data-testid="firewall-highlighted-view"
                className="vg-code max-h-28 overflow-y-auto break-words rounded p-2 text-[11px] leading-relaxed text-[var(--vg-text)]"
              >
                {scanResult.highlightSegments.map((seg, idx) =>
                  seg.flagged ? (
                    <span
                      key={`${idx}-${seg.ruleId ?? 'flag'}`}
                      data-testid="firewall-flagged-span"
                      className="mx-0.5 inline rounded border border-rose-400/60 bg-rose-500/20 px-1 py-0.5 font-semibold text-rose-300"
                    >
                      {seg.text}
                      {seg.owaspId && (
                        <span className="ml-1 rounded bg-rose-500/40 px-1 text-[8.5px] font-bold text-white">
                          {seg.owaspId}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span key={idx}>{seg.text}</span>
                  )
                )}
              </div>
            ) : (
              <div
                data-testid="firewall-sanitized-view"
                className="vg-code max-h-28 overflow-y-auto break-words rounded p-2 text-[11px] leading-relaxed text-emerald-300"
              >
                {scanResult.sanitizedPrompt || '(empty prompt)'}
              </div>
            )}
          </div>

          {/* OWASP LLM01-LLM10 Coverage Grid */}
          <div>
            <p className="mb-1.5 font-mono text-[9.5px] font-semibold tracking-wider text-[var(--vg-text-dim)]">
              OWASP LLM01–LLM10 REAL-TIME COVERAGE MATRIX
            </p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {ALL_FIREWALL_OWASP_IDS.map((id) => {
                const flagged = scanResult.owaspCoverageMatrix[id] === 'FLAGGED';
                return (
                  <div
                    key={id}
                    data-testid={`firewall-matrix-${id}`}
                    title={OWASP_SHORT_LABELS[id]}
                    className={`flex items-center justify-between rounded border px-1.5 py-1 font-mono text-[9px] ${
                      flagged
                        ? 'border-rose-500/60 bg-rose-500/15 text-rose-300'
                        : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text-dim)]'
                    }`}
                  >
                    <span className="font-bold">{id}</span>
                    <span className={flagged ? 'font-bold text-rose-400' : 'text-emerald-400'}>
                      {flagged ? 'HIT' : 'OK'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Triggered Findings Remediation List */}
          <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
            {scanResult.findings.length === 0 ? (
              <div className="flex items-center gap-2 rounded border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-2 font-mono text-[10px] text-emerald-300">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>All 10 OWASP LLM vectors CLEAN. Zero risky patterns detected — safe to route.</span>
              </div>
            ) : (
              scanResult.findings.map((finding, idx) => (
                <div
                  key={`${finding.ruleId}-${idx}`}
                  className="rounded border border-rose-400/35 bg-[var(--vg-panel)] px-2.5 py-1.5 font-mono text-[9.5px]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-rose-400">
                      [{finding.owaspId}] {finding.vectorLabel}
                    </span>
                    <span className="rounded border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 text-[8.5px] font-bold text-rose-300">
                      +{finding.weight} RISK · {finding.severity}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[var(--vg-text-muted)]">
                    Match: <span className="text-[var(--vg-text)]">{finding.matchedText}</span>
                  </p>
                  <p className="mt-0.5 text-sky-400">{finding.remediation}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Live Token & USD Budget Circuit Breaker */}
        <div className="flex min-w-0 flex-col gap-3 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3 xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vg-border)] pb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <h3 className="font-mono text-[10.5px] font-bold tracking-wider text-[var(--vg-text)]">
                {t.budgetBreakerHeading}
              </h3>
            </div>
            <span
              data-testid="breaker-status-badge"
              className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${breakerBadgeClass}`}
            >
              {breakerResult.breakerState === 'TRIPPED_HARD_STOP'
                ? 'TRIPPED · HARD STOP'
                : breakerResult.breakerState === 'DOWNGRADED_FLASH'
                  ? 'DOWNGRADED · FLASH'
                  : 'CLOSED · NOMINAL'}
            </span>
          </div>

          {/* Mode Toggle + Quick Scenario Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] p-0.5 font-mono text-[9.5px]">
              <button
                type="button"
                data-testid="breaker-mode-hard-stop"
                onClick={() => setBreakerMode('HARD_STOP')}
                className={`rounded px-2 py-1 font-bold transition-colors ${
                  breakerMode === 'HARD_STOP'
                    ? 'bg-rose-500/20 text-rose-300'
                    : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                }`}
              >
                HARD_STOP
              </button>
              <button
                type="button"
                data-testid="breaker-mode-downgrade"
                onClick={() => setBreakerMode('DOWNGRADE_MODEL')}
                className={`rounded px-2 py-1 font-bold transition-colors ${
                  breakerMode === 'DOWNGRADE_MODEL'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
                }`}
              >
                DOWNGRADE_MODEL
              </button>
            </div>

            <div className="flex flex-wrap gap-1 font-mono text-[9px]">
              <button
                type="button"
                data-testid="breaker-preset-tight"
                onClick={() => applyBreakerPreset('tight')}
                className="rounded border border-rose-400/40 bg-rose-500/10 px-2 py-1 font-semibold text-rose-300 hover:bg-rose-500/20"
              >
                Trip Hard Stop
              </button>
              <button
                type="button"
                data-testid="breaker-preset-downgrade"
                onClick={() => applyBreakerPreset('downgrade')}
                className="rounded border border-amber-400/40 bg-amber-500/10 px-2 py-1 font-semibold text-amber-300 hover:bg-amber-500/20"
              >
                Auto-Downgrade
              </button>
              <button
                type="button"
                data-testid="breaker-preset-generous"
                onClick={() => applyBreakerPreset('generous')}
                className="rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                All Closed
              </button>
            </div>
          </div>

          {/* Frontier -> Flash Model Pair Selectors */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 font-mono text-[9.5px] text-[var(--vg-text-dim)]">
              <span>PRIMARY FRONTIER MODEL</span>
              <select
                data-testid="breaker-frontier-select"
                value={frontierModel}
                onChange={(e) => setFrontierModel(e.target.value as FrontierModelId)}
                className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5 font-mono text-[10.5px] text-[var(--vg-text)] outline-none focus:border-sky-400/60"
              >
                {FRONTIER_OPTIONS.map((id) => (
                  <option key={id} value={id}>
                    {BREAKER_MODELS[id].label} (${BREAKER_MODELS[id].inputUsdPer1M}/1M in)
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 font-mono text-[9.5px] text-[var(--vg-text-dim)]">
              <span>FLASH FALLBACK TARGET</span>
              <select
                data-testid="breaker-fallback-select"
                value={fallbackModel}
                onChange={(e) => setFallbackModel(e.target.value as FallbackModelId)}
                className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5 font-mono text-[10.5px] text-[var(--vg-text)] outline-none focus:border-sky-400/60"
              >
                {FALLBACK_OPTIONS.map((id) => (
                  <option key={id} value={id}>
                    {BREAKER_MODELS[id].label} (${BREAKER_MODELS[id].inputUsdPer1M}/1M in)
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Token Cap & USD Cap Sliders */}
          <div className="grid grid-cols-1 gap-2.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-panel)] p-2.5 sm:grid-cols-2">
            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[9.5px]">
                <span className="flex items-center gap-1 text-[var(--vg-text-dim)]">
                  <Cpu className="h-3 w-3 text-sky-400" /> TOKEN CAP
                </span>
                <span className="font-bold text-sky-400" data-testid="breaker-token-cap-value">
                  {maxTokenCap.toLocaleString()} tok
                </span>
              </div>
              <input
                type="range"
                data-testid="breaker-token-cap-slider"
                min={2000}
                max={20000}
                step={500}
                value={maxTokenCap}
                onChange={(e) => setMaxTokenCap(Number(e.target.value))}
                className="vg-slider w-full"
                aria-label="Token Budget Cap"
              />
              <div className="mt-1 flex items-center justify-between font-mono text-[8.5px] text-[var(--vg-text-dim)]">
                <span>USED: {breakerResult.totalTokensUsed.toLocaleString()}</span>
                <span>{breakerResult.tokenUtilizationPct}%</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--vg-surface)]">
                <div
                  className={`h-full transition-all ${
                    breakerResult.tokenUtilizationPct >= 85
                      ? 'bg-rose-400'
                      : breakerResult.tokenUtilizationPct >= 60
                        ? 'bg-amber-400'
                        : 'bg-sky-400'
                  }`}
                  style={{ width: `${Math.min(100, breakerResult.tokenUtilizationPct)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between font-mono text-[9.5px]">
                <span className="flex items-center gap-1 text-[var(--vg-text-dim)]">
                  <DollarSign className="h-3 w-3 text-emerald-400" /> USD CAP
                </span>
                <span className="font-bold text-emerald-400" data-testid="breaker-usd-cap-value">
                  ${maxUsdCap.toFixed(3)}
                </span>
              </div>
              <input
                type="range"
                data-testid="breaker-usd-cap-slider"
                min={10}
                max={120}
                step={2}
                value={Math.round(maxUsdCap * 1000)}
                onChange={(e) => setMaxUsdCap(Number((Number(e.target.value) / 1000).toFixed(3)))}
                className="vg-slider w-full"
                aria-label="USD Budget Cap"
              />
              <div className="mt-1 flex items-center justify-between font-mono text-[8.5px] text-[var(--vg-text-dim)]">
                <span>SPENT: ${breakerResult.totalCostUsd.toFixed(4)}</span>
                <span>{breakerResult.usdUtilizationPct}%</span>
              </div>
              <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--vg-surface)]">
                <div
                  className={`h-full transition-all ${
                    breakerResult.usdUtilizationPct >= 85
                      ? 'bg-rose-400'
                      : breakerResult.usdUtilizationPct >= 60
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, breakerResult.usdUtilizationPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Trip Reason / Savings Summary */}
          <div className="grid grid-cols-3 gap-2 font-mono">
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">ACTUAL RUN COST</p>
              <p className="text-xs font-bold text-[var(--vg-text)]" data-testid="breaker-actual-cost">
                ${breakerResult.totalCostUsd.toFixed(4)}
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">FRONTIER BASELINE</p>
              <p className="text-xs font-bold text-[var(--vg-text-muted)]">
                ${breakerResult.baselineFrontierCostUsd.toFixed(4)}
              </p>
            </div>
            <div className="rounded border border-emerald-400/35 bg-emerald-500/10 px-2 py-1.5">
              <p className="text-[8.5px] text-emerald-300">SAVED BY BREAKER</p>
              <p className="text-xs font-bold text-emerald-400" data-testid="breaker-usd-saved">
                ${breakerResult.usdSavedByBreaker.toFixed(4)}
              </p>
            </div>
          </div>

          {breakerResult.tripReason && (
            <div
              data-testid="breaker-trip-reason"
              className={`flex items-start gap-2 rounded border px-2.5 py-1.5 font-mono text-[9.5px] ${
                breakerResult.breakerState === 'TRIPPED_HARD_STOP'
                  ? 'border-rose-400/50 bg-rose-500/10 text-rose-300'
                  : 'border-amber-400/50 bg-amber-500/10 text-amber-200'
              }`}
            >
              {breakerResult.breakerState === 'TRIPPED_HARD_STOP' ? (
                <AlertOctagon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
              ) : (
                <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              )}
              <span>{breakerResult.tripReason}</span>
            </div>
          )}

          {/* 6-Node Execution Chain Ledger */}
          <div className="space-y-1">
            <div className="flex items-center justify-between font-mono text-[9px] text-[var(--vg-text-dim)]">
              <span className="flex items-center gap-1">
                <Sliders className="h-3 w-3 text-sky-400" /> PER-NODE EXECUTION GUARDRAIL LEDGER
              </span>
              <span>
                {breakerResult.completedNodes}/6 RAN · {breakerResult.downgradedNodes} FLASH ·{' '}
                {breakerResult.haltedNodes} HALTED
              </span>
            </div>
            {breakerResult.steps.map((step) => {
              const isHalted =
                step.status === 'HALTED_BUDGET' || step.status === 'SKIPPED_CIRCUIT_OPEN';
              const isDowngraded = step.status === 'DOWNGRADED';
              return (
                <div
                  key={step.nodeId}
                  data-testid={`breaker-step-${step.nodeId}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded border px-2 py-1 font-mono text-[9.5px] ${
                    isHalted
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                      : isDowngraded
                        ? 'border-amber-400/45 bg-amber-500/10 text-amber-200'
                        : 'border-[var(--vg-border)] bg-[var(--vg-panel)] text-[var(--vg-text)]'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    {isHalted ? (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-rose-400" />
                    ) : isDowngraded ? (
                      <Zap className="h-3 w-3 shrink-0 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
                    )}
                    <span className="truncate font-semibold">{step.label}</span>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-[9px]">
                    {isDowngraded ? (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.2 text-amber-300">
                        <span>{step.requestedModel}</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span className="font-bold text-emerald-300">{step.executedModel}</span>
                      </span>
                    ) : (
                      <span className="text-[var(--vg-text-dim)]">{step.executedModel}</span>
                    )}
                    <span className="font-semibold text-sky-400">
                      ${step.cumulativeCostUsd.toFixed(4)}
                    </span>
                    <span
                      className={`rounded px-1 py-0.2 text-[8px] font-bold ${
                        isHalted
                          ? 'bg-rose-500/30 text-rose-200'
                          : isDowngraded
                            ? 'bg-amber-500/30 text-amber-200'
                            : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {step.status === 'SKIPPED_CIRCUIT_OPEN'
                        ? 'SKIPPED'
                        : step.status === 'HALTED_BUDGET'
                          ? 'HALTED'
                          : step.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default PromptFirewallLab;
