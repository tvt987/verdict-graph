import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  Check,
  CheckCircle2,
  Crosshair,
  Download,
  FileJson,
  FileText,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react';
import type { Locale } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import {
  type AttackVectorId,
  BENIGN_BASELINE_PAYLOAD,
  OWASP_LLM_TOP10_PROBES,
  type OwaspProbeId,
  type OwaspProbeResult,
  type OwaspSuiteComplianceReport,
  RED_TEAM_PRESETS,
  type RedTeamSimulationResult,
  runOwaspProbe,
  runOwaspTop10Suite,
  simulateAdversarialAttack,
  triggerOwaspReportDownload,
} from '../engine/redTeamClassifier';

interface RedTeamSandboxProps {
  t: Translations;
  locale: Locale;
  activeResult: RedTeamSimulationResult | null;
  onSimulateAttack: (result: RedTeamSimulationResult) => void;
  onClearOverlay: () => void;
}

export const RedTeamSandbox: React.FC<RedTeamSandboxProps> = ({
  t,
  locale,
  activeResult,
  onSimulateAttack,
  onClearOverlay,
}) => {
  const [mode, setMode] = useState<'owasp' | 'custom'>('owasp');
  const [suiteReport, setSuiteReport] = useState<OwaspSuiteComplianceReport>(() =>
    runOwaspTop10Suite()
  );
  const [selectedProbeId, setSelectedProbeId] = useState<OwaspProbeId>('LLM01');
  const [exportedFmt, setExportedFmt] = useState<'json' | 'markdown' | null>(null);

  // Custom Sandbox state
  const [selectedPresetId, setSelectedPresetId] = useState<AttackVectorId | 'custom'>(
    'indirect_sql_exfil'
  );
  const [payloadText, setPayloadText] = useState<string>(RED_TEAM_PRESETS[0].payload);
  const [showSanitized, setShowSanitized] = useState<boolean>(false);

  const probeResultMap = useMemo(() => {
    const map = new Map<OwaspProbeId, OwaspProbeResult>();
    for (const r of suiteReport.results) {
      map.set(r.probeId, r);
    }
    return map;
  }, [suiteReport]);

  const handleRunAllOwasp = () => {
    const fresh = runOwaspTop10Suite();
    setSuiteReport(fresh);
    const first = fresh.results[0];
    if (first) {
      setSelectedProbeId(first.probeId);
      onSimulateAttack(first.simulation);
    }
  };

  const handleRunSingleProbe = (probeId: OwaspProbeId) => {
    const probe = OWASP_LLM_TOP10_PROBES.find((p) => p.id === probeId);
    if (!probe) return;
    const single = runOwaspProbe(probe);
    setSelectedProbeId(probeId);
    setSuiteReport((prev) => {
      const updatedResults = prev.results.map((r) => (r.probeId === probeId ? single : r));
      const blockedCount = updatedResults.filter((r) => r.status === 'BLOCKED').length;
      const defenseRatePct = Number(((blockedCount / updatedResults.length) * 100).toFixed(1));
      const avgLat = Number(
        (
          updatedResults.reduce((s, r) => s + r.guardrailLatencyMs, 0) / updatedResults.length
        ).toFixed(1)
      );
      return {
        ...prev,
        generatedAt: new Date().toISOString(),
        blockedCount,
        passedCount: updatedResults.length - blockedCount,
        defenseRatePct,
        avgGuardrailLatencyMs: avgLat,
        results: updatedResults,
      };
    });
    onSimulateAttack(single.simulation);
  };

  const handleExportReport = (fmt: 'json' | 'markdown') => {
    triggerOwaspReportDownload(suiteReport, fmt);
    setExportedFmt(fmt);
    window.setTimeout(() => setExportedFmt(null), 1800);
  };

  const handleSelectPreset = (presetId: AttackVectorId) => {
    const preset = RED_TEAM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setPayloadText(preset.payload);
  };

  const handleRunCustomSimulation = () => {
    const preset = RED_TEAM_PRESETS.find((p) => p.id === selectedPresetId);
    const label = preset ? preset.label : 'Custom Adversarial Payload';
    const result = simulateAdversarialAttack(payloadText, label);
    onSimulateAttack(result);
  };

  const handleTestBenign = () => {
    setSelectedPresetId('custom');
    setPayloadText(BENIGN_BASELINE_PAYLOAD);
    const result = simulateAdversarialAttack(BENIGN_BASELINE_PAYLOAD, 'Benign Production Baseline');
    onSimulateAttack(result);
  };

  const selectedProbeResult = probeResultMap.get(selectedProbeId) ?? suiteReport.results[0];
  const riskScore = activeResult?.risk_score ?? 0;
  const riskPct = Math.round(riskScore * 100);
  const isBlocked = Boolean(activeResult && !activeResult.passed);

  return (
    <section
      id="red-team-deck"
      data-testid="red-team-sandbox"
      className="vg-panel flex h-full flex-col rounded-lg"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Crosshair className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.owaspSuiteTitle}
            </h2>
            <span className="rounded border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-600 dark:text-rose-400">
              10 PROBES · 14 RULES
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
            {t.owaspSuiteSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Mode Switcher */}
          <div className="flex items-center gap-0.5 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-0.5">
            <button
              type="button"
              data-testid="redteam-tab-owasp"
              onClick={() => setMode('owasp')}
              className={`rounded px-2 py-0.5 font-mono text-[9.5px] font-semibold transition-colors ${
                mode === 'owasp'
                  ? 'bg-rose-500/20 text-rose-400'
                  : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
              }`}
            >
              OWASP TOP-10
            </button>
            <button
              type="button"
              data-testid="redteam-tab-custom"
              onClick={() => setMode('custom')}
              className={`rounded px-2 py-0.5 font-mono text-[9.5px] font-semibold transition-colors ${
                mode === 'custom'
                  ? 'bg-sky-500/20 text-sky-400'
                  : 'text-[var(--vg-text-muted)] hover:text-[var(--vg-text)]'
              }`}
            >
              CUSTOM LAB
            </button>
          </div>

          {activeResult && (
            <button
              type="button"
              onClick={onClearOverlay}
              data-testid="redteam-clear-btn"
              className="flex shrink-0 items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[9.5px] text-[var(--vg-text-muted)] transition-colors hover:border-sky-400/50 hover:text-[var(--vg-text)]"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">{t.redTeamClearBtn}</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {mode === 'owasp' ? (
        <div className="flex flex-1 flex-col gap-3 p-3.5" data-testid="owasp-suite-panel">
          {/* Action & Export Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              data-testid="owasp-run-all-btn"
              onClick={handleRunAllOwasp}
              className="flex items-center gap-1.5 rounded border border-rose-500/60 bg-rose-500/20 px-3 py-1.5 font-mono text-[10.5px] font-bold text-rose-300 transition-colors hover:bg-rose-500/30"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{t.owaspRunAllBtn}</span>
            </button>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="owasp-export-json-btn"
                onClick={() => handleExportReport('json')}
                className="flex items-center gap-1 rounded border border-sky-400/45 bg-sky-500/10 px-2 py-1 font-mono text-[9.5px] font-semibold text-sky-400 transition-colors hover:bg-sky-500/20"
              >
                {exportedFmt === 'json' ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <FileJson className="h-3 w-3" />
                )}
                <span>{t.owaspExportJsonBtn}</span>
              </button>

              <button
                type="button"
                data-testid="owasp-export-md-btn"
                onClick={() => handleExportReport('markdown')}
                className="flex items-center gap-1 rounded border border-emerald-400/45 bg-emerald-500/10 px-2 py-1 font-mono text-[9.5px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
              >
                {exportedFmt === 'markdown' ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <FileText className="h-3 w-3" />
                )}
                <span>{t.owaspExportMdBtn}</span>
              </button>
            </div>
          </div>

          {/* Compliance Posture KPI Strip */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono">
            <div className="rounded border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1.5">
              <p className="text-[8.5px] text-emerald-300/80">BLOCKED RATE</p>
              <p
                data-testid="owasp-defense-rate"
                className="text-xs font-bold text-emerald-400"
              >
                {suiteReport.blockedCount}/{suiteReport.totalProbes} ({suiteReport.defenseRatePct}%)
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">COMPLIANCE GRADE</p>
              <p className="text-xs font-bold text-sky-400">
                GRADE {suiteReport.complianceGrade}
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">AVG GUARD LATENCY</p>
              <p className="text-xs font-bold text-[var(--vg-text)]">
                {suiteReport.avgGuardrailLatencyMs}ms
              </p>
            </div>
            <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5">
              <p className="text-[8.5px] text-[var(--vg-text-dim)]">P95 GUARD LATENCY</p>
              <p className="text-xs font-bold text-amber-400">
                {suiteReport.p95GuardrailLatencyMs}ms
              </p>
            </div>
          </div>

          {/* 10 Adversarial Probe Matrix */}
          <div className="grid max-h-[250px] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {OWASP_LLM_TOP10_PROBES.map((probe) => {
              const res = probeResultMap.get(probe.id);
              const isSelected = selectedProbeId === probe.id;
              const blocked = res?.status === 'BLOCKED';
              return (
                <button
                  key={probe.id}
                  type="button"
                  data-testid={`owasp-probe-${probe.id}`}
                  onClick={() => handleRunSingleProbe(probe.id)}
                  className={`flex flex-col rounded-md border px-2.5 py-2 text-left transition-all ${
                    isSelected
                      ? 'border-rose-400/65 bg-rose-500/12 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.2)]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface)] hover:border-rose-400/40'
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-1.5 font-mono">
                    <span className="text-[9.5px] font-bold text-rose-400">{probe.id}</span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold ${
                          blocked
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {res ? res.status : 'READY'}
                      </span>
                      {res && (
                        <span className="text-[8.5px] text-[var(--vg-text-dim)]">
                          {Math.round(res.confidenceScore * 100)}% · {res.guardrailLatencyMs}ms
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-0.5 truncate font-display text-[11.5px] font-semibold text-[var(--vg-text)]">
                    {locale === 'vi' ? probe.nameVi : probe.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[8.5px] text-[var(--vg-text-dim)]">
                    {res?.triggeredRules.join(', ') || probe.targetChannel}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Selected Probe Forensic Breakdown */}
          {selectedProbeResult && (
            <div
              data-testid="owasp-selected-forensics"
              className="rounded-md border border-rose-400/35 bg-[var(--vg-surface)] p-2.5 font-mono text-[10px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-rose-400">
                  {selectedProbeResult.probeId} · {selectedProbeResult.owaspCategory}
                </span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                  {selectedProbeResult.status} · CONF {(selectedProbeResult.confidenceScore * 100).toFixed(0)}% ·{' '}
                  {selectedProbeResult.guardrailLatencyMs}ms
                </span>
              </div>
              <p className="mt-1 truncate text-[9.5px] text-[var(--vg-text)]">
                MATCH: <span className="text-amber-300">{selectedProbeResult.matchedSnippet}</span>
              </p>
              <p className="mt-0.5 text-[9.5px] text-[var(--vg-text-muted)]">
                MITIGATION: {selectedProbeResult.mitigation}
              </p>
              <div className="mt-1.5 flex items-center justify-between border-t border-[var(--vg-border)] pt-1.5 text-[9px] text-[var(--vg-text-dim)]">
                <span>RULES: {selectedProbeResult.triggeredRules.join(', ')}</span>
                <button
                  type="button"
                  onClick={() => handleExportReport('markdown')}
                  className="flex items-center gap-1 font-semibold text-sky-400 hover:underline"
                >
                  <Download className="h-3 w-3" /> Audit Certificate
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Custom Payload Sandbox Mode (retains all v2 interactive controls) */
        <div className="flex flex-1 flex-col gap-3 p-3.5">
          {/* 4 Attack Vector Quick-Pick Chips */}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {RED_TEAM_PRESETS.map((preset) => {
              const active = selectedPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`redteam-preset-${preset.id}`}
                  onClick={() => handleSelectPreset(preset.id)}
                  className={`rounded-md border px-2.5 py-2 text-left transition-all ${
                    active
                      ? 'border-rose-400/60 bg-rose-500/12 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.18)]'
                      : 'border-[var(--vg-border)] bg-[var(--vg-surface)] hover:border-rose-400/35'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono text-[9px] font-bold tracking-wider text-rose-400">
                      {preset.code}
                    </span>
                    <span className="truncate font-mono text-[9px] text-[var(--vg-text-dim)]">
                      {preset.targetChannel.split('//')[0]}
                    </span>
                  </div>
                  <p className="mt-0.5 font-display text-xs font-semibold text-[var(--vg-text)]">
                    {locale === 'vi' ? preset.labelVi : preset.label}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--vg-text-muted)]">
                    {preset.shortDesc}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Custom Adversarial Payload Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="flex items-center gap-1.5 font-semibold text-[var(--vg-text-muted)]">
                <TerminalSquare className="h-3.5 w-3.5 text-rose-400" />
                ADVERSARIAL PAYLOAD BUFFER (EDITABLE)
              </span>
              <span className="text-[9px] text-[var(--vg-text-dim)]">
                {payloadText.length} CHARS
              </span>
            </div>
            <textarea
              data-testid="redteam-payload-input"
              value={payloadText}
              onChange={(e) => {
                setSelectedPresetId('custom');
                setPayloadText(e.target.value);
              }}
              rows={3}
              spellCheck={false}
              placeholder="Type any adversarial SQL injection, prompt override, PII leak, or runaway loop payload..."
              className="vg-code w-full resize-none rounded-md p-2.5 text-[11px] leading-relaxed text-[var(--vg-text)] outline-none focus:border-rose-400/70"
            />
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="redteam-simulate-btn"
              onClick={handleRunCustomSimulation}
              disabled={!payloadText.trim()}
              className="flex items-center gap-1.5 rounded border border-rose-500/60 bg-rose-500/15 px-3 py-1.5 font-mono text-[11px] font-bold text-rose-700 transition-colors hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-400/65 dark:bg-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/30"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>{t.redTeamSimulateBtn}</span>
            </button>

            <button
              type="button"
              data-testid="redteam-benign-btn"
              onClick={handleTestBenign}
              className="flex items-center gap-1.5 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono text-[11px] font-medium text-[var(--vg-text-muted)] transition-colors hover:border-emerald-400/50 hover:text-emerald-400"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t.redTeamBenignBtn}</span>
            </button>

            {activeResult && (
              <button
                type="button"
                onClick={() => setShowSanitized((v) => !v)}
                className="ml-auto font-mono text-[10px] text-sky-400 hover:underline"
              >
                {showSanitized ? 'HIDE SANITIZED DIFF' : 'VIEW SANITIZED CONTEXT'}
              </button>
            )}
          </div>

          {/* Simulation Verdict & Risk Meter */}
          {!activeResult ? (
            <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-[var(--vg-border)] bg-[var(--vg-surface)]/40 px-4 py-5 text-center">
              <AlertOctagon className="h-5 w-5 text-rose-400/70" />
              <p className="mt-1.5 font-mono text-[11px] font-semibold text-[var(--vg-text)]">
                SELECT AN ATTACK VECTOR OR TYPE A CUSTOM PAYLOAD
              </p>
              <p className="mt-1 max-w-md text-[11px] text-[var(--vg-text-muted)]">
                Press <span className="font-mono text-rose-400">Simulate Attack</span> to execute
                deterministic multi-rule policy classification, light up Node 04 quarantine, and
                watch cyclic <span className="font-mono text-rose-400">04 -&gt; 01</span> safe
                replanning live on the graph above.
              </p>
            </div>
          ) : (
            <div
              data-testid="redteam-result-card"
              className="flex flex-col gap-2.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isBlocked ? (
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  <span
                    data-testid="redteam-verdict-badge"
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${
                      isBlocked
                        ? 'border-rose-400/55 bg-rose-500/20 text-rose-300'
                        : 'border-emerald-400/50 bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {activeResult.blast_radius.verdict_code}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-[10px] text-[var(--vg-text-dim)]">
                    EVAL {activeResult.evaluation_ms}ms
                  </span>
                  <span
                    data-testid="redteam-risk-score"
                    className={`font-bold ${isBlocked ? 'text-rose-400' : 'text-emerald-400'}`}
                  >
                    RISK {activeResult.risk_score.toFixed(2)} / 1.00
                  </span>
                </div>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--vg-panel)]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    riskScore >= 0.9
                      ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.7)]'
                      : riskScore >= 0.7
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.max(4, riskPct)}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2.5 py-2 font-mono text-[9.5px]">
                {activeResult.replan_trace.map((step, idx) => (
                  <React.Fragment key={step.step_index}>
                    {idx > 0 && <ArrowRight className="h-3 w-3 shrink-0 text-[var(--vg-text-dim)]" />}
                    <span
                      className={`rounded border px-1.5 py-0.5 font-semibold ${
                        step.status === 'blocked'
                          ? 'border-rose-400/50 bg-rose-500/15 text-rose-300'
                          : step.status === 'rerouted'
                            ? 'border-amber-400/50 bg-amber-500/15 text-amber-300'
                            : 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {step.node_label}
                    </span>
                  </React.Fragment>
                ))}
              </div>

              {showSanitized && (
                <pre className="vg-code max-h-24 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                  {activeResult.sanitized_payload}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default RedTeamSandbox;
