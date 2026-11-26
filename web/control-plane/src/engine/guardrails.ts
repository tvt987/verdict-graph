import type { GuardrailFinding, GuardrailReport } from '../types/protocol';

const INJECTION_RULES: Array<{
  ruleId: string;
  regex: RegExp;
  risk: number;
  category: GuardrailFinding['category'];
  mitigation: string;
}> = [
  {
    ruleId: 'INJ-OVERRIDE-001',
    regex: /(ignore\s+(all\s+)?previous\s+instructions|disregard\s+system\s+prompt|override\s+policy)/i,
    risk: 0.96,
    category: 'prompt_injection',
    mitigation: 'Strip adversarial instruction override directives prior to planner re-entry.',
  },
  {
    ruleId: 'INJ-EXFIL-001',
    regex: /(exfiltrate|attacker\.io|webhook_send|send\s+.*\b(api[_\s]?keys?|secrets?|tokens?)\b)/i,
    risk: 0.98,
    category: 'data_exfiltration',
    mitigation: 'Block outbound tool call and quarantine untrusted external payload.',
  },
  {
    ruleId: 'PII-SECRET-001',
    regex: /(sk-[a-z0-9]{16,}|ghp_[a-z0-9]{20,}|AKIA[0-9A-Z]{16})/i,
    risk: 0.95,
    category: 'pii_leak',
    mitigation: 'Redact exposed credential secret before downstream serialization.',
  },
  {
    ruleId: 'PII-SSN-002',
    regex: /\b\d{3}-\d{2}-\d{4}\b/,
    risk: 0.84,
    category: 'pii_leak',
    mitigation: 'Mask government identifier and substitute salted audit hash.',
  },
];

export function evaluateGuardrailsClient(payloadText: string): GuardrailReport {
  const findings: GuardrailFinding[] = [];
  let sanitized = payloadText;

  for (const rule of INJECTION_RULES) {
    const match = payloadText.match(rule.regex);
    if (match) {
      findings.push({
        rule_id: rule.ruleId,
        category: rule.category,
        severity: rule.risk >= 0.9 ? 'critical' : 'warn',
        risk_score: rule.risk,
        matched_snippet: match[0],
        mitigation: rule.mitigation,
      });
      sanitized = sanitized.replace(new RegExp(rule.regex.source, 'gi'), '[REDACTED_ADVERSARIAL_DIRECTIVE]');
    }
  }

  const maxRisk = findings.length > 0 ? Math.max(...findings.map((f) => f.risk_score)) : 0.02;
  const hasInjection = findings.some(
    (f) => f.category === 'prompt_injection' || f.category === 'data_exfiltration'
  );
  const hasCritical = findings.some((f) => f.severity === 'critical');

  if (hasInjection) {
    return {
      passed: false,
      action: 'sanitize_and_reroute',
      max_risk_score: maxRisk,
      findings,
      sanitized_text: sanitized,
    };
  }
  if (hasCritical) {
    return {
      passed: false,
      action: 'block',
      max_risk_score: maxRisk,
      findings,
      sanitized_text: sanitized,
    };
  }
  return {
    passed: true,
    action: 'allow',
    max_risk_score: maxRisk,
    findings,
    sanitized_text: sanitized,
  };
}
