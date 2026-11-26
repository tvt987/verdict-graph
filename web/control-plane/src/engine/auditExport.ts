import type { ControlPlaneRun, OTelGenAISpan } from '../types/protocol';
import type { FinOpsSimulationResult } from './finopsSimulator';
import type { RedTeamSimulationResult } from './redTeamClassifier';

export interface OtlpAttributeValue {
  stringValue?: string;
  intValue?: string;
  doubleValue?: number;
  boolValue?: boolean;
}

export interface OtlpKeyValue {
  key: string;
  value: OtlpAttributeValue;
}

export interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'SPAN_KIND_INTERNAL' | 'SPAN_KIND_CLIENT';
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: OtlpKeyValue[];
  status: {
    code: 'STATUS_CODE_OK' | 'STATUS_CODE_ERROR' | 'STATUS_CODE_UNSET';
    message?: string;
  };
}

export interface OtlpResourceSpansBundle {
  resourceSpans: Array<{
    resource: {
      attributes: OtlpKeyValue[];
    };
    scopeSpans: Array<{
      scope: {
        name: string;
        version: string;
      };
      spans: OtlpSpan[];
    }>;
  }>;
}

export interface SignedAuditBundle {
  schema_version: 'verdict-graph.audit.v2';
  exported_at: string;
  run_metadata: {
    run_id: string;
    scenario_id: string;
    active_branch_id: string;
    status: string;
    branch_count: number;
    checkpoint_count: number;
    otel_span_count: number;
  };
  integrity: {
    algorithm: 'SHA256-CANONICAL-SIM';
    signature_scheme: 'Ed25519-Det-v2';
    canonical_digest: string;
    signature: string;
  };
  branches: ControlPlaneRun['branches'];
  branch_diffs: ControlPlaneRun['branch_diffs'];
  wire_capture: {
    mcp_jsonrpc_envelopes: ControlPlaneRun['mcp_logs'];
    a2a_envelopes: ControlPlaneRun['a2a_logs'];
    ag_ui_sse_events: ControlPlaneRun['ag_ui_events'];
  };
  otlp_trace: OtlpResourceSpansBundle;
  red_team_simulation: RedTeamSimulationResult | null;
  finops_projection: FinOpsSimulationResult | null;
}

function toOtlpValue(raw: unknown): OtlpAttributeValue {
  if (typeof raw === 'boolean') return { boolValue: raw };
  if (typeof raw === 'number') {
    if (Number.isInteger(raw)) return { intValue: String(raw) };
    return { doubleValue: raw };
  }
  return { stringValue: String(raw) };
}

export function toOtlpResourceSpans(
  run: ControlPlaneRun,
  baseEpochMs = Date.UTC(2026, 10, 26, 10, 0, 0)
): OtlpResourceSpansBundle {
  const spans: OtlpSpan[] = run.otel_spans.map((span: OTelGenAISpan) => {
    const startNano = BigInt(Math.round(baseEpochMs + span.start_ms)) * 1_000_000n;
    const endNano =
      BigInt(Math.round(baseEpochMs + span.start_ms + span.duration_ms)) * 1_000_000n;

    const attributes: OtlpKeyValue[] = Object.entries(span.attributes).map(([key, val]) => ({
      key,
      value: toOtlpValue(val),
    }));

    const isClient =
      span.attributes['gen_ai.operation.name'] === 'execute_tool' ||
      span.attributes['gen_ai.operation.name'] === 'delegate_a2a';

    return {
      traceId: span.trace_id,
      spanId: span.span_id,
      ...(span.parent_span_id ? { parentSpanId: span.parent_span_id } : {}),
      name: span.name,
      kind: isClient ? 'SPAN_KIND_CLIENT' : 'SPAN_KIND_INTERNAL',
      startTimeUnixNano: startNano.toString(),
      endTimeUnixNano: endNano.toString(),
      attributes,
      status:
        span.status === 'ERROR'
          ? { code: 'STATUS_CODE_ERROR', message: 'Guardrail policy violation reroute' }
          : span.status === 'PAUSED'
            ? { code: 'STATUS_CODE_UNSET', message: 'Awaiting HITL operator authorization' }
            : { code: 'STATUS_CODE_OK' },
    };
  });

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'verdict-graph-control-plane' } },
            { key: 'service.version', value: { stringValue: '2.0.0' } },
            { key: 'verdict.scenario.id', value: { stringValue: run.scenario_id } },
            { key: 'verdict.run.id', value: { stringValue: run.run_id } },
            { key: 'verdict.branch.active', value: { stringValue: run.active_branch_id } },
          ],
        },
        scopeSpans: [
          {
            scope: {
              name: 'verdict-graph.otel.genai',
              version: '2.0.0',
            },
            spans,
          },
        ],
      },
    ],
  };
}

function deterministicHashHex(input: string, length: number): string {
  let h1 = 0x811c9dc5 ^ input.length;
  let h2 = 0x9e3779b9 ^ input.length;
  let out = '';
  for (let round = 0; out.length < length; round += 1) {
    for (let i = 0; i < input.length; i += 1) {
      const ch = input.charCodeAt(i) + round * 17;
      h1 = Math.imul(h1 ^ ch, 16777619);
      h2 = Math.imul(h2 ^ ch, 2654435761);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 15), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 11), 1597334677);
    out += (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
  }
  return out.slice(0, length);
}

export function computeCanonicalAuditSignature(canonicalPayload: string): {
  canonical_digest: string;
  signature: string;
} {
  const digest = deterministicHashHex(`verdict-digest-v2:${canonicalPayload}`, 64);
  const sig = deterministicHashHex(`ed25519-verdict-key:${digest}`, 64);
  return {
    canonical_digest: `sha256:${digest}`,
    signature: `ed25519:${sig}`,
  };
}

export function buildSignedAuditBundle(
  run: ControlPlaneRun,
  options?: {
    redTeamResult?: RedTeamSimulationResult | null;
    finopsResult?: FinOpsSimulationResult | null;
    exportedAt?: string;
  }
): SignedAuditBundle {
  const exportedAt = options?.exportedAt ?? new Date().toISOString();
  const otlpTrace = toOtlpResourceSpans(run);
  const checkpointCount = Object.values(run.branches).reduce(
    (sum, branch) => sum + branch.checkpoints.length,
    0
  );

  const unsignedBody = {
    schema_version: 'verdict-graph.audit.v2' as const,
    exported_at: exportedAt,
    run_metadata: {
      run_id: run.run_id,
      scenario_id: run.scenario_id,
      active_branch_id: run.active_branch_id,
      status: run.status,
      branch_count: Object.keys(run.branches).length,
      checkpoint_count: checkpointCount,
      otel_span_count: run.otel_spans.length,
    },
    branches: run.branches,
    branch_diffs: run.branch_diffs,
    wire_capture: {
      mcp_jsonrpc_envelopes: run.mcp_logs,
      a2a_envelopes: run.a2a_logs,
      ag_ui_sse_events: run.ag_ui_events,
    },
    otlp_trace: otlpTrace,
    red_team_simulation: options?.redTeamResult ?? null,
    finops_projection: options?.finopsResult ?? null,
  };

  const { canonical_digest, signature } = computeCanonicalAuditSignature(
    JSON.stringify(unsignedBody)
  );

  return {
    schema_version: unsignedBody.schema_version,
    exported_at: unsignedBody.exported_at,
    run_metadata: unsignedBody.run_metadata,
    integrity: {
      algorithm: 'SHA256-CANONICAL-SIM',
      signature_scheme: 'Ed25519-Det-v2',
      canonical_digest,
      signature,
    },
    branches: unsignedBody.branches,
    branch_diffs: unsignedBody.branch_diffs,
    wire_capture: unsignedBody.wire_capture,
    otlp_trace: unsignedBody.otlp_trace,
    red_team_simulation: unsignedBody.red_team_simulation,
    finops_projection: unsignedBody.finops_projection,
  };
}

export function triggerAuditBundleDownload(bundle: SignedAuditBundle): string {
  const filename = `verdict-graph-audit-${bundle.run_metadata.run_id}.json`;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return filename;
  }
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
