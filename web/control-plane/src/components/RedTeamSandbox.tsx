import React, { useState } from 'react';
import {
  AlertOctagon,
  ArrowRight,
  CheckCircle2,
  Crosshair,
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
  RED_TEAM_PRESETS,
  type RedTeamSimulationResult,
  simulateAdversarialAttack,
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
  const [selectedPresetId, setSelectedPresetId] = useState<AttackVectorId | 'custom'>(
    'indirect_sql_exfil'
  );
  const [payloadText, setPayloadText] = useState<string>(RED_TEAM_PRESETS[0].payload);
  const [showSanitized, setShowSanitized] = useState<boolean>(false);

  const handleSelectPreset = (presetId: AttackVectorId) => {
    const preset = RED_TEAM_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setPayloadText(preset.payload);
  };

  const handleRunSimulation = () => {
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
      <div className="flex items-start justify-between gap-2 border-b border-[var(--vg-border)] px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Crosshair className="h-4 w-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <h2 className="font-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--vg-text)]">
              {t.redTeamTitle}
            </h2>
            <span className="rounded border border-rose-500/35 bg-rose-500/10 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-600 dark:text-rose-400">
              8 RULES
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
            {t.redTeamSubtitle}
          </p>
        </div>

        {activeResult && (
          <button
            type="button"
            onClick={onClearOverlay}
            data-testid="redteam-clear-btn"
            className="flex shrink-0 items-center gap-1 rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2 py-1 font-mono text-[10px] text-[var(--vg-text-muted)] transition-colors hover:border-sky-400/50 hover:text-[var(--vg-text)]"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{t.redTeamClearBtn}</span>
          </button>
        )}
      </div>

      {/* Body */}
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
            onClick={handleRunSimulation}
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
              deterministic multi-rule policy classification, light up Node 04 quarantine, and watch
              cyclic <span className="font-mono text-rose-400">04 -&gt; 01</span> safe replanning live
              on the graph above.
            </p>
          </div>
        ) : (
          <div
            data-testid="redteam-result-card"
            className="flex flex-col gap-2.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] p-3"
          >
            {/* Top Risk Score Bar & Verdict */}
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

            {/* Segmented Risk Gauge */}
            <div>
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
              <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-[var(--vg-text-dim)]">
                <span>0.00 CLEAN</span>
                <span>{activeResult.blast_radius.impact_label}</span>
                <span>1.00 CRITICAL</span>
              </div>
            </div>

            {/* Blast Radius KPIs */}
            <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
              <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5">
                <p className="text-[8.5px] text-[var(--vg-text-dim)]">DETECTORS FIRED</p>
                <p className={`font-bold ${isBlocked ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {activeResult.detectors_triggered.length} / {activeResult.detectors_checked}
                </p>
              </div>
              <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5">
                <p className="text-[8.5px] text-[var(--vg-text-dim)]">DATA LEAKED</p>
                <p className="font-bold text-emerald-400">
                  {activeResult.blast_radius.leaked_bytes} BYTES
                </p>
              </div>
              <div className="rounded border border-[var(--vg-border)] bg-[var(--vg-panel)] px-2 py-1.5">
                <p className="text-[8.5px] text-[var(--vg-text-dim)]">CYCLIC REPLAN</p>
                <p className={`font-bold ${isBlocked ? 'text-sky-400' : 'text-[var(--vg-text-muted)]'}`}>
                  {activeResult.blast_radius.cyclic_reroute_triggered ? '04 -> 01 -> 06' : 'DIRECT 04 -> 06'}
                </p>
              </div>
            </div>

            {/* Triggered Policy Detectors */}
            {activeResult.detectors_triggered.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {activeResult.detectors_triggered.map((hit) => (
                  <div
                    key={hit.rule_id}
                    className="rounded border border-rose-400/35 bg-rose-500/8 px-2.5 py-1.5 font-mono text-[10px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-bold text-rose-400">
                        {hit.rule_id} · {hit.detector_name}
                      </span>
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[9px] font-bold text-rose-300">
                        W={hit.risk_weight.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-[var(--vg-text)]">
                      MATCH: <span className="text-amber-300">{hit.matched_snippet}</span>
                    </p>
                    <p className="mt-0.5 text-[9.5px] text-[var(--vg-text-muted)]">
                      {hit.mitigation}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Cyclic 04 -> 01 Safe Replan Path */}
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
                    title={step.detail}
                  >
                    {step.node_label}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* Optional Sanitized Context Preview */}
            {showSanitized && (
              <div>
                <p className="mb-1 font-mono text-[9.5px] font-semibold text-emerald-400">
                  SANITIZED PAYLOAD FORWARDED TO NODE 01 PLANNER
                </p>
                <pre className="vg-code max-h-28 overflow-auto rounded p-2 text-[10px] leading-relaxed text-[var(--vg-text)]">
                  {activeResult.sanitized_payload}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
