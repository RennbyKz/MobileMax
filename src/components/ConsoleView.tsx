import { useState } from "react";
import { TransactionZone } from "./TransactionZone";
import { CartReceipt } from "./CartReceipt";
import { CustomerPicker } from "./CustomerPicker";
import { useCart } from "../hooks/useCart";
import { useToastContext } from "../toast/ToastContext";
import { useLanguage } from "../i18n/LanguageContext";
import { submitVoucher } from "../lib/vouchers";
import type { Customer } from "../types";

export function ConsoleView() {
  const { lines, addLine, addLines, removeLine, clearCart, totals } = useCart();
  const { showToast } = useToastContext();
  const { t } = useLanguage();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handlePrint() {
    if (lines.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const voucher = await submitVoucher({ customerId: customer?.id ?? null, lines, totals });
      showToast(t("toast.printed", { voucherNo: voucher.voucher_no }), "success");
      clearCart();
      setCustomer(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      showToast(t("toast.checkoutError", { message }), "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <section className="panel customer-panel">
        <div className="panel-head">
          <div>
            <div className="panel-title">{t("customer.title")}</div>
          </div>
        </div>
        <div className="tab-panel">
          <CustomerPicker customer={customer} onChange={setCustomer} />
        </div>
      </section>
      <div className="layout">
        <TransactionZone onAddLine={addLine} onAddLines={addLines} onToast={showToast} />
        <CartReceipt
          lines={lines}
          totals={totals}
          customer={customer}
          submitting={submitting}
          onRemove={removeLine}
          onPrint={handlePrint}
        />
      </div>
    </>
  );
}
