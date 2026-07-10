import { useEffect, useState } from "react";
import { useProductsContext } from "../products/ProductsContext";
import { useProductUnitsContext } from "../products/ProductUnitsContext";
import { money } from "../utils/money";
import { useLanguage } from "../i18n/LanguageContext";
import type { ToastType } from "../hooks/useToast";
import type { CartLine } from "../types";

interface NewSalePanelProps {
  onAdd: (line: Omit<CartLine, "id">) => void;
  onToast: (message: string, type?: ToastType) => void;
}

export function NewSalePanel({ onAdd, onToast }: NewSalePanelProps) {
  const { t } = useLanguage();
  const { products, loading } = useProductsContext();
  const { units } = useProductUnitsContext();
  const sellable = products.filter((p) => p.is_active);
  const [productId, setProductId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [qty, setQty] = useState(1);
  const [imei, setImei] = useState("");
  const [warranty, setWarranty] = useState<"shop" | "manufacturer" | "none">("shop");

  useEffect(() => {
    if (!productId && sellable.length > 0) setProductId(sellable[0].id);
  }, [sellable, productId]);

  const product = sellable.find((p) => p.id === productId);
  const availableUnits = product?.is_serialized
    ? units.filter((u) => u.product_id === product.id && u.status === "in_stock")
    : [];

  useEffect(() => {
    if (!product?.is_serialized) {
      setUnitId("");
      return;
    }
    if (!availableUnits.some((u) => u.id === unitId)) {
      setUnitId(availableUnits[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.is_serialized, availableUnits.length]);

  function handleAdd() {
    if (!product) return;

    if (product.is_serialized) {
      const unit = availableUnits.find((u) => u.id === unitId);
      if (!unit) return;
      onAdd({
        lineType: "sale",
        productId: product.id,
        unitId: unit.id,
        qty: 1,
        unitPrice: product.price,
        imei: unit.imei1 ?? unit.imei2 ?? undefined,
        name: product.name,
        tag: t("tag.newSale"),
        amount: product.price,
      });
      onToast(t("toast.addedToCart", { name: product.name }), "success");
      return;
    }

    const quantity = Math.max(1, Math.min(qty, product.stock_qty));
    onAdd({
      lineType: "sale",
      productId: product.id,
      qty: quantity,
      unitPrice: product.price,
      imei: imei.trim() || undefined,
      name: product.name,
      tag: quantity > 1 ? t("tag.newSaleQty", { qty: quantity }) : t("tag.newSale"),
      amount: product.price * quantity,
    });
    onToast(t("toast.addedToCart", { name: product.name }), "success");
    setQty(1);
    setImei("");
  }

  if (loading) {
    return (
      <div className="tab-panel" role="tabpanel" aria-labelledby="tab-new-sale">
        <p className="empty-note">{t("inventory.loading")}</p>
      </div>
    );
  }

  if (sellable.length === 0) {
    return (
      <div className="tab-panel" role="tabpanel" aria-labelledby="tab-new-sale">
        <p className="empty-note">{t("inventory.empty")}</p>
      </div>
    );
  }

  const canAdd = product && (product.is_serialized ? availableUnits.length > 0 && unitId : product.stock_qty > 0);

  return (
    <div className="tab-panel" role="tabpanel" aria-labelledby="tab-new-sale">
      <div className="field-grid">
        <div className="field span-2">
          <label htmlFor="ns-product">{t("field.product")}</label>
          <div className="search-row">
            <select id="ns-product" value={productId} onChange={(e) => setProductId(e.target.value)}>
              {sellable.map((p) => (
                <option key={p.id} value={p.id} disabled={p.stock_qty === 0}>
                  {p.name} — {money(p.price)} {p.stock_qty === 0 ? `(${t("inventory.outOfStock")})` : `· ${p.stock_qty} ${t("inventory.inStock")}`}
                </option>
              ))}
            </select>
            {!product?.is_serialized && (
              <input
                className="qty-input"
                type="number"
                value={qty}
                min={1}
                max={product?.stock_qty ?? 1}
                aria-label={t("field.quantity")}
                onChange={(e) => setQty(Number(e.target.value) || 1)}
              />
            )}
          </div>
        </div>

        {product?.is_serialized ? (
          <div className="field span-2">
            <label htmlFor="ns-unit">{t("field.selectUnit")}</label>
            <select id="ns-unit" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
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
        ) : (
          <div className="field mono">
            <label htmlFor="ns-imei">{t("field.imei")}</label>
            <input
              id="ns-imei"
              type="text"
              placeholder="35 129208 685234 8"
              value={imei}
              onChange={(e) => setImei(e.target.value)}
            />
          </div>
        )}

        <div className="field">
          <label htmlFor="ns-warranty">{t("field.warranty")}</label>
          <select
            id="ns-warranty"
            value={warranty}
            onChange={(e) => setWarranty(e.target.value as typeof warranty)}
          >
            <option value="shop">{t("warranty.shop")}</option>
            <option value="manufacturer">{t("warranty.manufacturer")}</option>
            <option value="none">{t("warranty.none")}</option>
          </select>
        </div>
      </div>
      <div className="actions-row">
        <button className="btn btn-accent" onClick={handleAdd} disabled={!canAdd}>
          {t("button.addToCart")}
        </button>
      </div>
    </div>
  );
}
