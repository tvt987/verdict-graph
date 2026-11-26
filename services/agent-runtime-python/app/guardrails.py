"""Prompt Injection, Exfiltration, PII, and Policy Mutation Guardrail Engine."""

from __future__ import annotations

import re
from app.models import GuardrailFinding, GuardrailReport, GuardrailSeverity


INJECTION_PATTERNS: list[tuple[str, str, float, str]] = [
    (
        "INJ-OVERRIDE-001",
        r"(?i)(ignore\s+(all\s+)?previous\s+instructions|disregard\s+system\s+prompt|override\s+policy)",
        0.96,
        "Strip adversarial instruction override directives before planner re-entry.",
    ),
    (
        "INJ-EXFIL-001",
        r"(?i)(exfiltrate|attacker\.io|webhook_send|curl\s+https?://|send\s+.*\b(api[_\s]?keys?|secrets?|tokens?)\b)",
        0.98,
        "Block unauthorized outbound tool invocation and quarantine untrusted payload.",
    ),
    (
        "INJ-JAILBREAK-002",
        r"(?i)(you\s+are\s+now\s+dan|developer\s+mode\s+enabled|bypass\s+guardrail)",
        0.93,
        "Reject persona hijack attempt and maintain immutable system policy.",
    ),
]

PII_PATTERNS: list[tuple[str, str, float, str]] = [
    (
        "PII-SECRET-001",
        r"(?i)(sk-[a-z0-9]{16,}|ghp_[a-z0-9]{20,}|AKIA[0-9A-Z]{16})",
        0.95,
        "Redact credential token from tool context and rotate affected key.",
    ),
    (
        "PII-SSN-002",
        r"\b\d{3}-\d{2}-\d{4}\b",
        0.84,
        "Mask government identifier prior to cross-agent serialization.",
    ),
    (
        "PII-CARD-003",
        r"\b(?:\d[ -]*?){13,16}\b",
        0.82,
        "Replace PAN sequence with salted SHA-256 audit reference.",
    ),
]

POLICY_MUTATION_PATTERNS: list[tuple[str, str, float, str]] = [
    (
        "POL-MUTATE-001",
        r"(?i)(drop\s+table|rm\s+-rf|delete\s+from\s+prod|force_deploy\s+--no-approval)",
        0.94,
        "Require explicit HITL cryptographic approval before destructive cluster mutation.",
    ),
]


def evaluate_guardrails(payload_text: str, allow_mutation_with_hitl: bool = True) -> GuardrailReport:
    """Inspect untrusted tool outputs or agent actions for injection, exfiltration, PII, and destructive policy mutations."""
    findings: list[GuardrailFinding] = []
    sanitized = payload_text

    for rule_id, pattern, score, mitigation in INJECTION_PATTERNS:
        match = re.search(pattern, payload_text)
        if match:
            findings.append(
                GuardrailFinding(
                    rule_id=rule_id,
                    category="data_exfiltration" if "EXFIL" in rule_id else "prompt_injection",
                    severity=GuardrailSeverity.CRITICAL,
                    risk_score=score,
                    matched_snippet=match.group(0),
                    mitigation=mitigation,
                )
            )
            sanitized = re.sub(pattern, "[REDACTED_ADVERSARIAL_DIRECTIVE]", sanitized)

    for rule_id, pattern, score, mitigation in PII_PATTERNS:
        match = re.search(pattern, payload_text)
        if match:
            findings.append(
                GuardrailFinding(
                    rule_id=rule_id,
                    category="pii_leak",
                    severity=GuardrailSeverity.CRITICAL if score >= 0.9 else GuardrailSeverity.WARN,
                    risk_score=score,
                    matched_snippet=match.group(0),
                    mitigation=mitigation,
                )
            )
            sanitized = re.sub(pattern, "[REDACTED_PII]", sanitized)

    for rule_id, pattern, score, mitigation in POLICY_MUTATION_PATTERNS:
        match = re.search(pattern, payload_text)
        if match:
            findings.append(
                GuardrailFinding(
                    rule_id=rule_id,
                    category="policy_mutation",
                    severity=GuardrailSeverity.WARN if allow_mutation_with_hitl else GuardrailSeverity.CRITICAL,
                    risk_score=score,
                    matched_snippet=match.group(0),
                    mitigation=mitigation,
                )
            )

    max_risk = max((f.risk_score for f in findings), default=0.02)
    has_injection = any(f.category in ("prompt_injection", "data_exfiltration") for f in findings)
    has_critical_non_hitl = any(f.severity == GuardrailSeverity.CRITICAL for f in findings)

    if has_injection:
        return GuardrailReport(
            passed=False,
            action="sanitize_and_reroute",
            max_risk_score=max_risk,
            findings=findings,
            sanitized_text=sanitized,
        )

    if has_critical_non_hitl:
        return GuardrailReport(
            passed=False,
            action="block",
            max_risk_score=max_risk,
            findings=findings,
            sanitized_text=sanitized,
        )

    return GuardrailReport(
        passed=True,
        action="allow",
        max_risk_score=max_risk,
        findings=findings,
        sanitized_text=sanitized,
    )
