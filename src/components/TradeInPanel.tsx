import { useEffect, useState } from "react";
import { useProductsContext } from "../products/ProductsContext";
import { useProductUnitsContext } from "../products/ProductUnitsContext";
import { money } from "../utils/money";
import { useLanguage } from "../i18n/LanguageContext";
import type { ToastType } from "../hooks/useToast";
import type { CartLine, Condition } from "../types";

interface TradeInPanelProps {
  onAdd: (lines: Omit<CartLine, "id">[]) => void;
  onToast: (message: string, type?: ToastType) => void;
}

export function TradeInPanel({ onAdd, onToast }: TradeInPanelProps) {
  const { t } = useLanguage();
  const { products, loading } = useProductsContext();
  const { units } = useProductUnitsContext();
  const sellable = products.filter((p) => p.is_active && p.stock_qty > 0);
  const [model, setModel] = useState("");
  const [imei, setImei] = useState("");
  const [condition, setCondition] = useState<Condition>("good");
  const [valuation, setValuation] = useState(0);
  const [outgoingId, setOutgoingId] = useState("");
  const [outgoingUnitId, setOutgoingUnitId] = useState("");

  useEffect(() => {
    if (!outgoingId && sellable.length > 0) setOutgoingId(sellable[0].id);
  }, [sellable, outgoingId]);

  const outgoing = sellable.find((p) => p.id === outgoingId);
  const availableUnits = outgoing?.is_serialized
    ? units.filter((u) => u.product_id === outgoing.id && u.status === "in_stock")
    : [];
  const credit = Math.max(0, valuation) || 0;
  const balance = outgoing ? Math.max(outgoing.price - credit, 0) : 0;

  useEffect(() => {
    if (!outgoing?.is_serialized) {
      setOutgoingUnitId("");
      return;
    }
    if (!availableUnits.some((u) => u.id === outgoingUnitId)) {
      setOutgoingUnitId(availableUnits[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outgoing?.id, outgoing?.is_serialized, availableUnits.length]);

  function handleAdd() {
    if (!outgoing) return;
    const outgoingUnit = outgoing.is_serialized
      ? availableUnits.find((u) => u.id === outgoingUnitId)
      : undefined;
    if (outgoing.is_serialized && !outgoingUnit) return;

    onAdd([
      {
        lineType: "trade_in",
        name: model.trim() || t("device.incoming.title"),
        tag: t("tag.tradeIn", { condition: t(`condition.${condition}`) }),
        amount: -credit,
        imei: imei.trim() || undefined,
        condition,
      },
      {
        lineType: "sale",
        productId: outgoing.id,
        unitId: outgoingUnit?.id,
        qty: 1,
        unitPrice: outgoing.price,
        imei: outgoingUnit ? outgoingUnit.imei1 ?? outgoingUnit.imei2 ?? undefined : undefined,
        name: outgoing.name,
        tag: t("tag.newSaleTradeIn"),
        amount: outgoing.price,
      },
    ]);
    onToast(t("toast.tradeInApplied", { name: outgoing.name }), "success");
    setModel("");
    setImei("");
    setValuation(0);
  }

  if (loading) {
    return (
      <div className="tab-panel" role="tabpanel" aria-labelledby="tab-trade-in">
        <p className="empty-note">{t("inventory.loading")}</p>
      </div>
    );
  }

  if (sellable.length === 0) {
    return (
      <div className="tab-panel" role="tabpanel" aria-labelledby="tab-trade-in">
        <p className="empty-note">{t("inventory.empty")}</p>
      </div>
    );
  }

  const canAdd = outgoing && (outgoing.is_serialized ? availableUnits.length > 0 && outgoingUnitId : true);

  return (
    <div className="tab-panel" role="tabpanel" aria-labelledby="tab-trade-in">
      <div className="device-card">
        <div className="device-card-head">
          <span className="device-dot incoming" />
          <h3>{t("device.incoming.title")}</h3>
          <span>{t("device.incoming.sub")}</span>
        </div>
        <div className="field-grid">
          <div className="field">
            <label htmlFor="ti-model">{t("field.model")}</label>
            <input
              id="ti-model"
              type="text"
              placeholder="e.g. iPhone 12, 64GB"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
          <div className="field mono">
            <label htmlFor="ti-imei">{t("field.imei")}</label>
            <input
              id="ti-imei"
              type="text"
              placeholder="35 812304 991122 4"
              value={imei}
              onChange={(e) => setImei(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ti-condition">{t("field.condition")}</label>
            <select
              id="ti-condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value as Condition)}
            >
              <option value="excellent">{t("condition.excellent")}</option>
              <option value="good">{t("condition.good")}</option>
              <option value="fair">{t("condition.fair")}</option>
              <option value="poor">{t("condition.poor")}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ti-valuation">{t("field.valuation")}</label>
            <input
              id="ti-valuation"
              type="number"
              value={valuation}
              step={5000}
              min={0}
              onChange={(e) => setValuation(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      <div className="flow-connector" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 3v14m0 0 5-5m-5 5-5-5"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {t("flow.creditAppliesTo")}
        </span>
      </div>

      <div className="device-card">
        <div className="device-card-head">
          <span className="device-dot outgoing" />
          <h3>{t("device.outgoing.title")}</h3>
          <span>{t("device.outgoing.sub")}</span>
        </div>
        <div className="field span-2">
          <label htmlFor="ti-product">{t("field.searchProduct")}</label>
          <select id="ti-product" value={outgoingId} onChange={(e) => setOutgoingId(e.target.value)}>
            {sellable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.price)} · {p.stock_qty} {t("inventory.inStock")}
              </option>
            ))}
          </select>
        </div>
        {outgoing?.is_serialized && (
          <div className="field span-2">
            <label htmlFor="ti-unit">{t("field.selectUnit")}</label>
            <select id="ti-unit" value={outgoingUnitId} onChange={(e) => setOutgoingUnitId(e.target.value)}>
              {availableUnits.length === 0 ? (
                <option value="">{t("inventory.noUnits")}</option>
              ) : (
                availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {[u.imei1, u.imei2].filter(Boolean).join(" / ") || u.id}
                  </option>
                ))
              )}
            </select>
          </div>
        )}
      </div>

      <div className="summary">
        <div className="summary-row">
          <span className="label">{t("summary.newDevicePrice")}</span>
          <span className="value">{outgoing ? money(outgoing.price) : "—"}</span>
        </div>
        <div className="summary-row credit">
          <span className="label">{t("summary.creditApplied")}</span>
          <span className="value">− {money(credit)}</span>
        </div>
        <div className="summary-row balance">
          <span className="label">{t("summary.finalBalance")}</span>
          <span className="value">{money(balance)}</span>
        </div>
      </div>

      <div className="actions-row">
        <button className="btn btn-accent" onClick={handleAdd} disabled={!canAdd}>
          {t("button.addTradeIn")}
        </button>
      </div>
    </div>
  );
}
