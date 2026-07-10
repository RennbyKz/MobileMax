import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useToastContext } from "../toast/ToastContext";
import { money } from "../utils/money";
import { buildVoucherPdf } from "../lib/pdf";
import type { VoucherRow } from "../lib/reports";
import type { VoucherLine } from "../types";

interface VoucherPreviewProps {
  voucher: VoucherRow;
  lines: VoucherLine[];
  onClose: () => void;
}

export function VoucherPreview({ voucher, lines, onClose }: VoucherPreviewProps) {
  const { t } = useLanguage();
  const { showToast } = useToastContext();
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleDownload() {
    setDownloading(true);
    try {
      await buildVoucherPdf(voucher, lines);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card receipt" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <div className="receipt-header">
          <div className="panel-eyebrow">{t("reports.preview.eyebrow")}</div>
          <div className="panel-title">
            {t("reports.voucherNo")} #{String(voucher.voucher_no).padStart(4, "0")}
          </div>
          <div className="receipt-scallop" />
        </div>
        <div className="receipt-body">
          <div className="receipt-meta">
            <span>{new Date(voucher.created_at).toLocaleString()}</span>
            <span className={`status-badge ${voucher.status === "void" ? "critical" : "success"}`}>
              {t(`reports.status.${voucher.status}`)}
            </span>
          </div>
          <div className="receipt-customer">
            <span className="name">{voucher.customers?.name ?? t("reports.walkIn")}</span>
            {voucher.customers?.phone && <span className="tag">{voucher.customers.phone}</span>}
          </div>
          <p className="voucher-preview-staff">
            {t("reports.staff")}: {voucher.profiles?.display_name ?? voucher.profiles?.email ?? "—"}
          </p>
          <div className="cart-list">
            {lines.map((line) => (
              <div className="cart-item" key={line.id}>
                <div>
                  <div className="name">{line.name}</div>
                  <span className="tag">{line.tag}</span>
                </div>
                <div className={`amount${line.amount < 0 ? " negative" : ""}`}>
                  {line.amount < 0 ? "− " : ""}
                  {money(Math.abs(line.amount))}
                </div>
              </div>
            ))}
          </div>
          <div className="receipt-totals">
            <div className="row">
              <span>{t("totals.subtotal")}</span>
              <span className="v">{money(voucher.subtotal)}</span>
            </div>
            <div className="row">
              <span>{t("totals.tradeInCredit")}</span>
              <span className="v">− {money(voucher.trade_in_credit)}</span>
            </div>
          </div>
          <div className="receipt-grand">
            <span className="l">{t("totals.totalDue")}</span>
            <span className="v">{money(voucher.grand_total)}</span>
          </div>
        </div>
        <div className="receipt-footer">
          <button className="print-btn" onClick={handleDownload} disabled={downloading}>
            {downloading ? t("print.submitting") : t("reports.preview.downloadPdf")}
          </button>
        </div>
      </div>
    </div>
  );
}
