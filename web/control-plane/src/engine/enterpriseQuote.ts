export const MBBANK_BIN = '970422';
export const MBBANK_ACCOUNT = '0325456574';
export const MBBANK_HOLDER = 'TRUONG VAN TINH';
export const MBBANK_BANK_NAME = 'MBBank (Military Commercial Joint Stock Bank)';
export const BASE_LICENSE_VND = 19_900_000;

export interface EnterpriseAddon {
  id: string;
  code: string;
  label: string;
  labelVi: string;
  description: string;
  descriptionVi: string;
  priceVnd: number;
}

export const ENTERPRISE_ADDONS: EnterpriseAddon[] = [
  {
    id: 'onprem_vllm',
    code: 'ADD-01',
    label: 'On-Premise vLLM & Air-Gapped VPC Kit',
    labelVi: 'Triển Khai On-Premise vLLM & VPC Riêng',
    description: 'Helm charts, GPU tensor-parallel configs, and local Qwen-72B router benchmarks.',
    descriptionVi: 'Helm chart, cấu hình GPU tensor-parallel và benchmark Qwen-72B nội bộ.',
    priceVnd: 4_500_000,
  },
  {
    id: 'owasp_soc2_pack',
    code: 'ADD-02',
    label: 'Custom OWASP LLM & SOC2 Policy Pack',
    labelVi: 'Gói Quy Tắc OWASP LLM & SOC2 Riêng',
    description: 'Bespoke regex/AST guardrails, DLP vault hooks, and GitHub Actions CI security gates.',
    descriptionVi: 'Guardrail AST/Regex tùy chỉnh, hook DLP Vault và cổng CI bảo mật.',
    priceVnd: 3_000_000,
  },
  {
    id: 'architect_onboarding',
    code: 'ADD-03',
    label: '14-Day Principal Architect Onboarding',
    labelVi: 'Đồng Hành Triển Khai 14 Ngày Với Kiến Trúc Sư',
    description: 'Direct integration review with Truong Van Tinh covering MCP, A2A, and OTel pipelines.',
    descriptionVi: 'Tư vấn tích hợp trực tiếp cùng Trương Văn Tình cho MCP, A2A và OpenTelemetry.',
    priceVnd: 2_500_000,
  },
];

export interface EnterpriseQuoteResult {
  quoteId: string;
  organization: string;
  baseLicenseVnd: number;
  selectedAddons: EnterpriseAddon[];
  addonsTotalVnd: number;
  totalVnd: number;
  formattedBaseVnd: string;
  formattedTotalVnd: string;
  bankBin: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  transferReference: string;
  vietQrUrl: string;
  generatedAt: string;
}

export function formatVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('de-DE')} VND`;
}

export function sanitizeTransferReference(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 42);
  return cleaned.length > 0 ? cleaned : 'VERDICTGRAPH V3 ENT';
}

export function buildVietQrUrl(amountVnd: number, transferReference: string): string {
  const safeRef = sanitizeTransferReference(transferReference);
  const safeAmount = Math.max(BASE_LICENSE_VND, Math.round(amountVnd));
  return `https://img.vietqr.io/image/${MBBANK_BIN}-${MBBANK_ACCOUNT}-compact2.png?amount=${safeAmount}&addInfo=${encodeURIComponent(
    safeRef
  )}&accountName=${encodeURIComponent(MBBANK_HOLDER)}`;
}

export function computeEnterpriseQuote(
  selectedAddonIds: string[],
  organization = 'Enterprise AI Engineering',
  customReference = ''
): EnterpriseQuoteResult {
  const idSet = new Set(selectedAddonIds);
  const selectedAddons = ENTERPRISE_ADDONS.filter((a) => idSet.has(a.id));
  const addonsTotalVnd = selectedAddons.reduce((sum, item) => sum + item.priceVnd, 0);
  const totalVnd = BASE_LICENSE_VND + addonsTotalVnd;

  const orgSlug = organization
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);

  const defaultRef = orgSlug ? `VERDICTGRAPH V3 ${orgSlug}` : 'VERDICTGRAPH V3 ENT';
  const transferReference = sanitizeTransferReference(customReference || defaultRef);
  const quoteId = `VG3-${(totalVnd / 100_000).toFixed(0)}-${selectedAddons.length}`;

  return {
    quoteId,
    organization: organization.trim() || 'Enterprise AI Engineering',
    baseLicenseVnd: BASE_LICENSE_VND,
    selectedAddons,
    addonsTotalVnd,
    totalVnd,
    formattedBaseVnd: formatVnd(BASE_LICENSE_VND),
    formattedTotalVnd: formatVnd(totalVnd),
    bankBin: MBBANK_BIN,
    bankName: MBBANK_BANK_NAME,
    accountNumber: MBBANK_ACCOUNT,
    accountHolder: MBBANK_HOLDER,
    transferReference,
    vietQrUrl: buildVietQrUrl(totalVnd, transferReference),
    generatedAt: new Date().toISOString(),
  };
}

export function buildEnterpriseQuoteMarkdown(quote: EnterpriseQuoteResult): string {
  const addonLines =
    quote.selectedAddons.length > 0
      ? quote.selectedAddons
          .map((a) => `- [${a.code}] **${a.label}**: ${formatVnd(a.priceVnd)}`)
          .join('\n')
      : '- None (Core Enterprise Flagship License only)';

  return [
    '# VERDICT GRAPH v3.0 ENTERPRISE SUPER VIP PRO — COMMERCIAL LICENSE QUOTE',
    '',
    `- **Quote ID:** ${quote.quoteId}`,
    `- **Prepared For:** ${quote.organization}`,
    `- **Generated At:** ${quote.generatedAt}`,
    '- **Vendor / Solution Architect:** Truong Van Tinh (TVT Studio · github.com/tvt987)',
    '- **Contact:** tinhkun102@gmail.com | +84 931 467 024',
    '',
    '## Deliverables Included in Flagship Base License',
    `- **Verdict Graph v3.0 Control Plane (React 19 + TypeScript Strict + Vite 6 + Tailwind v4):** ${quote.formattedBaseVnd}`,
    '- Full Python 3.12 FastAPI Multi-Agent Runtime (MCP JSON-RPC 2.0, A2A v0.2.2, AG-UI SSE, OTel GenAI)',
    '- Interactive Multi-Agent DAG Builder, Time-Travel Checkpoint Forking & State Diff Engine',
    '- Multi-Model FinOps Cost/Latency Router Matrix & OWASP LLM Top-10 Red-Team Suite',
    '- Commercial Perpetual Source Code Rights + Docker Compose & CI/CD Workflows',
    '',
    '## Selected Enterprise Add-Ons',
    addonLines,
    '',
    `## Total Commercial Investment: **${quote.formattedTotalVnd}**`,
    '',
    '## Direct Wire / VietQR Settlement Details',
    `- **Bank:** ${quote.bankName} (BIN: ${quote.bankBin})`,
    `- **Account Number:** ${quote.accountNumber}`,
    `- **Account Holder:** ${quote.accountHolder}`,
    `- **Transfer Reference:** \`${quote.transferReference}\``,
    `- **Live VietQR URL:** ${quote.vietQrUrl}`,
    '',
  ].join('\n');
}

export function triggerEnterpriseQuoteDownload(quote: EnterpriseQuoteResult): string {
  const filename = `verdict-graph-v3-quote-${quote.quoteId.toLowerCase()}.md`;
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return filename;
  }
  const md = buildEnterpriseQuoteMarkdown(quote);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
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
