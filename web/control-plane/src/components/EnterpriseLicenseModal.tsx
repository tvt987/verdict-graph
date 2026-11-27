import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  Download,
  QrCode,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { Locale } from '../types/protocol';
import type { Translations } from '../i18n/translations';
import {
  ENTERPRISE_ADDONS,
  computeEnterpriseQuote,
  formatVnd,
  triggerEnterpriseQuoteDownload,
} from '../engine/enterpriseQuote';

interface EnterpriseLicenseModalProps {
  open: boolean;
  t: Translations;
  locale: Locale;
  onClose: () => void;
}

export const EnterpriseLicenseModal: React.FC<EnterpriseLicenseModalProps> = ({
  open,
  t,
  locale,
  onClose,
}) => {
  const [organization, setOrganization] = useState<string>('Enterprise AI Engineering');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [customRef, setCustomRef] = useState<string>('');
  const [copiedField, setCopiedField] = useState<'account' | 'ref' | null>(null);
  const [qrFailed, setQrFailed] = useState<boolean>(false);
  const [downloadedQuote, setDownloadedQuote] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const quote = useMemo(
    () => computeEnterpriseQuote(selectedAddonIds, organization, customRef),
    [customRef, organization, selectedAddonIds]
  );

  useEffect(() => {
    setQrFailed(false);
  }, [quote.vietQrUrl]);

  if (!open) return null;

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopy = (value: string, field: 'account' | 'ref') => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      void navigator.clipboard.writeText(value);
    }
    setCopiedField(field);
    window.setTimeout(() => setCopiedField(null), 1600);
  };

  const handleDownloadQuote = () => {
    triggerEnterpriseQuoteDownload(quote);
    setDownloadedQuote(true);
    window.setTimeout(() => setDownloadedQuote(false), 1800);
  };

  return (
    <div
      data-testid="enterprise-license-modal"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="vg-panel relative my-auto w-full max-w-4xl overflow-hidden rounded-xl border-emerald-400/40 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div className="h-1 w-full bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-400" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--vg-border)] px-4 py-3.5 sm:px-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h2 className="font-display text-sm font-bold tracking-wide text-[var(--vg-text)] sm:text-base">
                {t.licenseModalTitle}
              </h2>
              <span className="rounded border border-emerald-400/50 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                FLAGSHIP #3 · 19.9M VND
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[10px] text-[var(--vg-text-dim)]">
              {t.licenseModalSubtitle}
            </p>
          </div>
          <button
            type="button"
            data-testid="license-modal-close-btn"
            onClick={onClose}
            className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] p-1.5 text-[var(--vg-text-muted)] transition-colors hover:border-sky-400/50 hover:text-[var(--vg-text)]"
            aria-label="Close License Modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid max-h-[82vh] grid-cols-1 gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-12">
          {/* Left 7 cols: Flagship Scope + Add-on Quote Configurator */}
          <div className="flex flex-col gap-3 lg:col-span-7">
            {/* Base License Card */}
            <div className="rounded-lg border border-sky-400/40 bg-sky-500/8 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-[10px] font-bold tracking-wider text-sky-400">
                    CORE ENTERPRISE LICENSE · PERPETUAL SOURCE
                  </p>
                  <p className="mt-0.5 font-display text-sm font-bold text-[var(--vg-text)]">
                    Verdict Graph v3.0 Super VIP Pro Control Plane
                  </p>
                </div>
                <span className="shrink-0 font-mono text-sm font-bold text-emerald-400">
                  {quote.formattedBaseVnd}
                </span>
              </div>
              <ul className="mt-2.5 grid grid-cols-1 gap-1.5 font-mono text-[10px] text-[var(--vg-text-muted)] sm:grid-cols-2">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  React 19 + TS Strict Control Plane
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  Python 3.12 MCP / A2A / AG-UI Runtime
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  Custom DAG Builder &amp; Time-Travel Diff
                </li>
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  OWASP Top-10 Suite &amp; FinOps Pareto
                </li>
              </ul>
            </div>

            {/* Enterprise Add-Ons */}
            <div className="flex flex-col gap-1.5">
              <p className="font-mono text-[10px] font-semibold tracking-wider text-[var(--vg-text-muted)]">
                {locale === 'vi'
                  ? 'TÙY CHỌN MỞ RỘNG DOANH NGHIỆP (CẬP NHẬT VIETQR TỨC THÌ)'
                  : 'OPTIONAL ENTERPRISE ADD-ONS (LIVE VIETQR UPDATE)'}
              </p>
              {ENTERPRISE_ADDONS.map((addon) => {
                const checked = selectedAddonIds.includes(addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    data-testid={`license-addon-${addon.id}`}
                    onClick={() => toggleAddon(addon.id)}
                    className={`flex items-start justify-between gap-3 rounded-md border p-2.5 text-left transition-all ${
                      checked
                        ? 'border-emerald-400/60 bg-emerald-500/12'
                        : 'border-[var(--vg-border)] bg-[var(--vg-surface)] hover:border-sky-400/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                              : 'border-[var(--vg-border)] bg-[var(--vg-panel)]'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="font-mono text-[9.5px] font-bold text-sky-400">
                          {addon.code}
                        </span>
                        <span className="font-display text-xs font-semibold text-[var(--vg-text)]">
                          {locale === 'vi' ? addon.labelVi : addon.label}
                        </span>
                      </div>
                      <p className="mt-1 pl-5 text-[10.5px] text-[var(--vg-text-muted)]">
                        {locale === 'vi' ? addon.descriptionVi : addon.description}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10.5px] font-bold text-emerald-400">
                      +{formatVnd(addon.priceVnd)}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Organization & Transfer Reference Inputs */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="license-org-input"
                  className="flex items-center gap-1 font-mono text-[9.5px] font-semibold text-[var(--vg-text-muted)]"
                >
                  <Building2 className="h-3 w-3 text-sky-400" />
                  ORGANIZATION / CLIENT NAME
                </label>
                <input
                  id="license-org-input"
                  data-testid="license-org-input"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--vg-text)] outline-none focus:border-sky-400"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="license-ref-input"
                  className="font-mono text-[9.5px] font-semibold text-[var(--vg-text-muted)]"
                >
                  CUSTOM TRANSFER MEMO (OPTIONAL)
                </label>
                <input
                  id="license-ref-input"
                  type="text"
                  value={customRef}
                  onChange={(e) => setCustomRef(e.target.value)}
                  placeholder={quote.transferReference}
                  className="rounded border border-[var(--vg-border)] bg-[var(--vg-surface)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--vg-text)] outline-none focus:border-sky-400"
                />
              </div>
            </div>

            {/* Quote Download & Architect Contact */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface)] px-3 py-2.5">
              <div className="font-mono text-[10px] text-[var(--vg-text-muted)]">
                <p className="font-bold text-[var(--vg-text)]">
                  ARCHITECT: TRUONG VAN TINH (TVT STUDIO)
                </p>
                <p>tinhkun102@gmail.com · 0931 467 024 · github.com/tvt987</p>
              </div>
              <button
                type="button"
                data-testid="license-download-quote-btn"
                onClick={handleDownloadQuote}
                className="flex items-center gap-1.5 rounded border border-sky-400/50 bg-sky-500/15 px-2.5 py-1.5 font-mono text-[10px] font-bold text-sky-400 transition-colors hover:bg-sky-500/25"
              >
                {downloadedQuote ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Quote Saved</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Download Quote (.md)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right 5 cols: Live MBBank VietQR Payment Card */}
          <div className="flex flex-col justify-between gap-3 rounded-lg border border-emerald-400/40 bg-[var(--vg-surface)] p-3.5 lg:col-span-5">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-emerald-400">
                  <QrCode className="h-3.5 w-3.5" /> LIVE MBBANK VIETQR (970422)
                </span>
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                  {quote.quoteId}
                </span>
              </div>

              {/* VietQR Image Box */}
              <div className="mt-2.5 flex items-center justify-center rounded-lg border border-[var(--vg-border)] bg-white p-3">
                {!qrFailed ? (
                  <img
                    data-testid="license-vietqr-img"
                    src={quote.vietQrUrl}
                    alt={`MBBank VietQR for ${quote.accountHolder} ${quote.accountNumber}`}
                    className="h-56 w-auto max-w-full object-contain"
                    onError={() => setQrFailed(true)}
                  />
                ) : (
                  <div className="flex h-56 flex-col items-center justify-center p-4 text-center font-mono text-[11px] text-slate-700">
                    <QrCode className="h-10 w-10 text-sky-600" />
                    <p className="mt-2 font-bold">MBBank (970422) · {quote.accountNumber}</p>
                    <p>{quote.accountHolder}</p>
                    <p className="mt-1 font-bold text-emerald-700">{quote.formattedTotalVnd}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bank Details Table */}
            <div className="space-y-1.5 rounded-md border border-[var(--vg-border)] bg-[var(--vg-panel)] p-2.5 font-mono text-[10px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--vg-text-dim)]">BANK</span>
                <span className="font-bold text-[var(--vg-text)]">MBBank (BIN 970422)</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--vg-text-dim)]">ACCOUNT</span>
                <button
                  type="button"
                  data-testid="license-copy-account-btn"
                  onClick={() => handleCopy(quote.accountNumber, 'account')}
                  className="flex items-center gap-1 font-bold text-sky-400 hover:underline"
                >
                  <span>{quote.accountNumber}</span>
                  {copiedField === 'account' ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--vg-text-dim)]">HOLDER</span>
                <span className="font-bold text-[var(--vg-text)]">{quote.accountHolder}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--vg-text-dim)]">MEMO</span>
                <button
                  type="button"
                  data-testid="license-copy-ref-btn"
                  onClick={() => handleCopy(quote.transferReference, 'ref')}
                  className="flex items-center gap-1 truncate font-semibold text-amber-400 hover:underline"
                >
                  <span className="truncate">{quote.transferReference}</span>
                  {copiedField === 'ref' ? (
                    <Check className="h-3 w-3 shrink-0 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3 shrink-0" />
                  )}
                </button>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--vg-border)] pt-1.5 text-xs">
                <span className="font-bold text-[var(--vg-text-muted)]">TOTAL</span>
                <span
                  data-testid="license-total-vnd"
                  className="font-bold text-emerald-400"
                >
                  {quote.formattedTotalVnd}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
