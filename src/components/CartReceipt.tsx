import { money } from "../utils/money";
import { useLanguage } from "../i18n/LanguageContext";
import type { CartLine, Customer } from "../types";

interface CartReceiptProps {
  lines: CartLine[];
  totals: { subtotal: number; credit: number; grandTotal: number };
  customer: Customer | null;
  submitting: boolean;
  onRemove: (id: string) => void;
  onPrint: () => void;
}

export function CartReceipt({ lines, totals, customer, submitting, onRemove, onPrint }: CartReceiptProps) {
  const { lang, t } = useLanguage();
  const receiptTime = new Date().toLocaleString(lang === "my" ? "my" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <aside className="receipt">
      <div className="receipt-header">
        <div className="panel-eyebrow">{t("receipt.eyebrow")}</div>
        <div className="panel-title">{t("receipt.title")}</div>
        <div className="receipt-scallop" />
      </div>
      <div className="receipt-body">
        <div className="receipt-meta">
          <span>{receiptTime}</span>
          <span>09780055570</span>
        </div>
        {customer && (
          <div className="receipt-customer">
            <span className="name">{customer.name}</span>
            {customer.phone && <span className="tag">{customer.phone}</span>}
          </div>
        )}
        <div className="cart-list">
          {lines.length === 0 ? (
            <div className="cart-empty">{t("cart.empty")}</div>
          ) : (
            lines.map((item) => (
              <div className="cart-item" key={item.id}>
                <div>
                  <div className="name">{item.name}</div>
                  <span className="tag">{item.tag}</span>
                </div>
                <div className={`amount${item.amount < 0 ? " negative" : ""}`}>
                  {item.amount < 0 ? "− " : ""}
                  {money(Math.abs(item.amount))}
                </div>
                <button
                  className="remove"
                  aria-label={t("cart.remove", { name: item.name })}
                  onClick={() => onRemove(item.id)}
                  disabled={submitting}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
        <div className="receipt-totals">
          <div className="row">
            <span>{t("totals.subtotal")}</span>
            <span className="v">{money(totals.subtotal)}</span>
          </div>
          <div className="row">
            <span>{t("totals.tradeInCredit")}</span>
            <span className="v">
              {totals.credit > 0 ? "− " : ""}
              {money(totals.credit)}
            </span>
          </div>
        </div>
        <div className="receipt-grand">
          <span className="l">{t("totals.totalDue")}</span>
          <span className="v">{money(totals.grandTotal)}</span>
        </div>
      </div>
      <div className="receipt-footer">
        <button className="print-btn" disabled={lines.length === 0 || submitting} onClick={onPrint}>
          {submitting ? t("print.submitting") : t("print.button")}
        </button>
      </div>
    </aside>
  );
}
