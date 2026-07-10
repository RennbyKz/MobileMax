import { Fragment, useState, type FormEvent } from "react";
import { useProductsContext } from "../products/ProductsContext";
import { useProductUnitsContext } from "../products/ProductUnitsContext";
import { useLanguage } from "../i18n/LanguageContext";
import { useToastContext } from "../toast/ToastContext";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { exportToExcel } from "../lib/exportExcel";
import { money } from "../utils/money";
import type { Product } from "../types";

interface EditDraft {
  name: string;
  brand_name: string;
  category: string;
  price: string;
  cost_price: string;
}

function toDraft(p: Product): EditDraft {
  return {
    name: p.name,
    brand_name: p.brand_name ?? "",
    category: p.category ?? "",
    price: String(p.price),
    cost_price: p.cost_price != null ? String(p.cost_price) : "",
  };
}

export function InventoryPage() {
  const { t } = useLanguage();
  const { showToast } = useToastContext();
  const { isAdmin } = useAuth();
  const { products, loading } = useProductsContext();
  const { units } = useProductUnitsContext();
  const [showArchived, setShowArchived] = useState(false);
  const [name, setName] = useState("");
  const [brandName, setBrandName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [isSerialized, setIsSerialized] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [newImei1, setNewImei1] = useState("");
  const [newImei2, setNewImei2] = useState("");
  const [newUnitCost, setNewUnitCost] = useState("");
  const [addingUnit, setAddingUnit] = useState(false);

  const visible = products.filter((p) => (showArchived ? !p.is_active : p.is_active));

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !price) return;
    setCreating(true);
    const { error } = await supabase.from("products").insert({
      name: name.trim(),
      brand_name: brandName.trim() || null,
      category: category.trim() || null,
      price: Number(price),
      cost_price: costPrice ? Number(costPrice) : null,
      stock_qty: isSerialized ? 0 : Number(stockQty) || 0,
      is_serialized: isSerialized,
    });
    setCreating(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(t("inventory.added", { name: name.trim() }), "success");
    setName("");
    setBrandName("");
    setCategory("");
    setPrice("");
    setCostPrice("");
    setStockQty("");
    setIsSerialized(false);
  }

  async function adjustStock(id: string, delta: number, current: number) {
    const next = Math.max(0, current + delta);
    const { error } = await supabase.from("products").update({ stock_qty: next }).eq("id", id);
    if (error) showToast(error.message, "error");
  }

  async function toggleActive(id: string, isActive: boolean) {
    const { error } = await supabase.from("products").update({ is_active: !isActive }).eq("id", id);
    if (error) showToast(error.message, "error");
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setDraft(toDraft(p));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(id: string) {
    if (!draft || !draft.name.trim() || !draft.price) return;
    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({
        name: draft.name.trim(),
        brand_name: draft.brand_name.trim() || null,
        category: draft.category.trim() || null,
        price: Number(draft.price),
        cost_price: draft.cost_price ? Number(draft.cost_price) : null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(t("inventory.updated"), "success");
    cancelEdit();
  }

  async function handleDelete(p: Product) {
    if (!window.confirm(t("inventory.deleteConfirm", { name: p.name }))) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) {
      if (error.code === "23503") {
        showToast(t("inventory.deleteBlocked"), "error");
      } else {
        showToast(error.message, "error");
      }
      return;
    }
    showToast(t("inventory.deleted", { name: p.name }), "success");
  }

  function openManageUnits(id: string) {
    setManagingId(managingId === id ? null : id);
    setNewImei1("");
    setNewImei2("");
    setNewUnitCost("");
  }

  async function handleAddUnit(productId: string) {
    if (!newImei1.trim() && !newImei2.trim()) return;
    setAddingUnit(true);
    const { error } = await supabase.from("product_units").insert({
      product_id: productId,
      imei1: newImei1.trim() || null,
      imei2: newImei2.trim() || null,
      cost_price: newUnitCost ? Number(newUnitCost) : null,
    });
    setAddingUnit(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast(t("inventory.unitAdded"), "success");
    setNewImei1("");
    setNewImei2("");
    setNewUnitCost("");
  }

  async function handleRemoveUnit(unitId: string) {
    if (!window.confirm(t("inventory.removeUnitConfirm"))) return;
    const { error } = await supabase.from("product_units").delete().eq("id", unitId);
    if (error) showToast(error.message, "error");
  }

  async function handleExport() {
    const rows = visible.map((p) => ({
      [t("inventory.itemName")]: p.name,
      [t("inventory.brand")]: p.brand_name ?? "",
      [t("inventory.category")]: p.category ?? "",
      [t("inventory.price")]: p.price,
      [t("inventory.costPrice")]: p.cost_price ?? "",
      [t("inventory.stockQty")]: p.stock_qty,
      [t("inventory.serialized")]: p.is_serialized ? "Yes" : "No",
    }));
    try {
      await exportToExcel(`mobilemax-inventory-${showArchived ? "archived" : "active"}`, "Inventory", rows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-eyebrow">{t("inventory.eyebrow")}</div>
          <div className="panel-title">{t("inventory.title")}</div>
        </div>
      </div>

      <div className="tab-panel">
        {isAdmin && (
        <form className="field-grid" onSubmit={handleAdd}>
          <div className="field">
            <label htmlFor="inv-name">{t("inventory.itemName")}</label>
            <input id="inv-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="inv-brand">{t("inventory.brand")}</label>
            <input id="inv-brand" type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="inv-category">{t("inventory.category")}</label>
            <input id="inv-category" type="text" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="inv-price">{t("inventory.price")}</label>
            <input id="inv-price" type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="inv-cost">{t("inventory.costPrice")}</label>
            <input id="inv-cost" type="number" min={0} value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          </div>
          {!isSerialized && (
            <div className="field">
              <label htmlFor="inv-stock">{t("inventory.stockQty")}</label>
              <input id="inv-stock" type="number" min={0} value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            </div>
          )}
          <div className="field span-2 inventory-serialized-toggle">
            <label>
              <input type="checkbox" checked={isSerialized} onChange={(e) => setIsSerialized(e.target.checked)} />
              {t("inventory.serializedLabel")}
            </label>
            <span className="inventory-serialized-hint">{t("inventory.serializedHint")}</span>
          </div>
          <div className="field span-2 actions-row">
            <button className="btn btn-accent" type="submit" disabled={creating || !name.trim() || !price}>
              {t("inventory.addItem")}
            </button>
          </div>
        </form>
        )}

        <div className="inventory-toolbar">
          <div className="tabs" role="tablist" aria-label="Inventory filter">
            <button className="tab" role="tab" aria-selected={!showArchived} onClick={() => setShowArchived(false)}>
              {t("inventory.active")}
            </button>
            <button className="tab" role="tab" aria-selected={showArchived} onClick={() => setShowArchived(true)}>
              {t("inventory.archived")}
            </button>
          </div>
          <button className="btn btn-ghost" onClick={handleExport} disabled={visible.length === 0}>
            {t("export.excel")}
          </button>
        </div>

        <div className="data-table-wrap">
          {loading ? (
            <p className="empty-note">{t("inventory.loading")}</p>
          ) : visible.length === 0 ? (
            <p className="empty-note">{t("inventory.empty")}</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("inventory.itemName")}</th>
                  <th>{t("inventory.brand")}</th>
                  <th>{t("inventory.category")}</th>
                  <th>{t("inventory.price")}</th>
                  <th>{t("inventory.costPrice")}</th>
                  <th>{t("inventory.stockQty")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const productUnits = units.filter((u) => u.product_id === p.id);
                  return (
                    <Fragment key={p.id}>
                      {editingId === p.id && draft ? (
                        <tr key={p.id} className="data-table-editing-row">
                          <td>
                            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                          </td>
                          <td>
                            <input
                              value={draft.brand_name}
                              onChange={(e) => setDraft({ ...draft, brand_name: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              value={draft.category}
                              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              value={draft.price}
                              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              value={draft.cost_price}
                              onChange={(e) => setDraft({ ...draft, cost_price: e.target.value })}
                            />
                          </td>
                          <td>{p.stock_qty}</td>
                          <td className="data-table-actions">
                            <button className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                              {t("customer.cancel")}
                            </button>
                            <button className="btn btn-accent" onClick={() => saveEdit(p.id)} disabled={saving}>
                              {t("customer.save")}
                            </button>
                          </td>
                        </tr>
                      ) : (
                        <tr key={p.id}>
                          <td>
                            {p.name}
                            {p.is_serialized && <span className="status-badge" style={{ marginLeft: 6 }}>{t("inventory.serialized")}</span>}
                          </td>
                          <td>{p.brand_name ?? "—"}</td>
                          <td>{p.category ?? "—"}</td>
                          <td>{money(p.price)}</td>
                          <td>{p.cost_price != null ? money(p.cost_price) : "—"}</td>
                          <td>
                            <span className={p.stock_qty <= p.low_stock_threshold ? "status-badge warning" : "status-badge"}>
                              {p.stock_qty}
                            </span>
                          </td>
                          <td className="data-table-actions">
                            {isAdmin && !showArchived && p.is_serialized && (
                              <button className="btn btn-ghost" onClick={() => openManageUnits(p.id)}>
                                {t("inventory.manageUnits")} ({productUnits.filter((u) => u.status === "in_stock").length})
                              </button>
                            )}
                            {isAdmin && !showArchived && !p.is_serialized && (
                              <>
                                <button className="btn btn-ghost" onClick={() => adjustStock(p.id, -1, p.stock_qty)}>
                                  −
                                </button>
                                <button className="btn btn-ghost" onClick={() => adjustStock(p.id, 1, p.stock_qty)}>
                                  +
                                </button>
                              </>
                            )}
                            {isAdmin && !showArchived && (
                              <button className="btn btn-ghost" onClick={() => startEdit(p)}>
                                {t("inventory.edit")}
                              </button>
                            )}
                            {isAdmin && (
                              <button className="btn btn-ghost" onClick={() => toggleActive(p.id, p.is_active)}>
                                {showArchived ? t("inventory.restore") : t("inventory.archive")}
                              </button>
                            )}
                            {isAdmin && (
                              <button className="btn btn-ghost btn-danger" onClick={() => handleDelete(p)}>
                                {t("inventory.delete")}
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                      {managingId === p.id && (
                        <tr>
                          <td colSpan={7}>
                            <div className="unit-manager">
                              {productUnits.length === 0 ? (
                                <p className="empty-note">{t("inventory.noUnits")}</p>
                              ) : (
                                <table className="data-table">
                                  <thead>
                                    <tr>
                                      <th>IMEI 1</th>
                                      <th>IMEI 2</th>
                                      <th>{t("inventory.costPrice")}</th>
                                      <th>{t("inventory.status")}</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {productUnits.map((u) => (
                                      <tr key={u.id}>
                                        <td className="mono">{u.imei1 ?? "—"}</td>
                                        <td className="mono">{u.imei2 ?? "—"}</td>
                                        <td>{u.cost_price != null ? money(u.cost_price) : "—"}</td>
                                        <td>
                                          <span className={`status-badge ${u.status === "sold" ? "critical" : "success"}`}>
                                            {t(`inventory.unit.${u.status}`)}
                                          </span>
                                        </td>
                                        <td>
                                          {u.status === "in_stock" && (
                                            <button className="btn btn-ghost btn-danger" onClick={() => handleRemoveUnit(u.id)}>
                                              {t("inventory.delete")}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              <div className="field-grid unit-add-form">
                                <div className="field mono">
                                  <label htmlFor={`unit-imei1-${p.id}`}>IMEI 1</label>
                                  <input
                                    id={`unit-imei1-${p.id}`}
                                    value={newImei1}
                                    onChange={(e) => setNewImei1(e.target.value)}
                                  />
                                </div>
                                <div className="field mono">
                                  <label htmlFor={`unit-imei2-${p.id}`}>IMEI 2</label>
                                  <input
                                    id={`unit-imei2-${p.id}`}
                                    value={newImei2}
                                    onChange={(e) => setNewImei2(e.target.value)}
                                  />
                                </div>
                                <div className="field">
                                  <label htmlFor={`unit-cost-${p.id}`}>{t("inventory.costPrice")}</label>
                                  <input
                                    id={`unit-cost-${p.id}`}
                                    type="number"
                                    min={0}
                                    value={newUnitCost}
                                    onChange={(e) => setNewUnitCost(e.target.value)}
                                  />
                                </div>
                                <div className="field actions-row">
                                  <button
                                    type="button"
                                    className="btn btn-accent"
                                    onClick={() => handleAddUnit(p.id)}
                                    disabled={addingUnit || (!newImei1.trim() && !newImei2.trim())}
                                  >
                                    {t("inventory.addUnit")}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
