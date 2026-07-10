import { Fragment, useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useToastContext } from "../toast/ToastContext";
import { useProductsContext } from "../products/ProductsContext";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { money } from "../utils/money";
import { voidVoucher, deleteVoucher } from "../lib/vouchers";
import { exportToExcel } from "../lib/exportExcel";
import { fetchAllCustomers } from "../lib/customers";
import { VoucherPreview } from "./VoucherPreview";
import {
  fetchVouchers,
  fetchVoucherLines,
  fetchRevenueDaily,
  fetchRevenueMonthly,
  type VoucherRow,
  type RevenuePoint,
} from "../lib/reports";
import type { Customer, VoucherLine } from "../types";

type ReportTab = "vouchers" | "inventory" | "revenue" | "customers";

export function ReportsPage() {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<ReportTab>("vouchers");

  const activeTab = tab === "revenue" && !isAdmin ? "vouchers" : tab;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-eyebrow">{t("reports.eyebrow")}</div>
          <div className="panel-title">{t("reports.title")}</div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Reports">
        <button className="tab" role="tab" aria-selected={activeTab === "vouchers"} onClick={() => setTab("vouchers")}>
          {t("reports.tab.vouchers")}
        </button>
        <button className="tab" role="tab" aria-selected={activeTab === "inventory"} onClick={() => setTab("inventory")}>
          {t("reports.tab.inventory")}
        </button>
        {isAdmin && (
          <button className="tab" role="tab" aria-selected={activeTab === "revenue"} onClick={() => setTab("revenue")}>
            {t("reports.tab.revenue")}
          </button>
        )}
        <button className="tab" role="tab" aria-selected={activeTab === "customers"} onClick={() => setTab("customers")}>
          {t("reports.tab.customers")}
        </button>
      </div>

      <div className="tab-panel">
        {activeTab === "vouchers" && <VoucherHistory />}
        {activeTab === "inventory" && <StockReport />}
        {activeTab === "revenue" && isAdmin && <RevenueSummary />}
        {activeTab === "customers" && <CustomerList />}
      </div>
    </section>
  );
}

function VoucherHistory() {
  const { t } = useLanguage();
  const { showToast } = useToastContext();
  const { isAdmin } = useAuth();
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [lines, setLines] = useState<VoucherLine[]>([]);
  const [voidReason, setVoidReason] = useState("");
  const [preview, setPreview] = useState<{ voucher: VoucherRow; lines: VoucherLine[] } | null>(null);

  useEffect(() => {
    let active = true;
    fetchVouchers()
      .then((data) => {
        if (active) setVouchers(data);
      })
      .catch((err) => active && showToast(err instanceof Error ? err.message : String(err), "error"))
      .finally(() => active && setLoading(false));

    const channel = supabase
      .channel("vouchers-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "vouchers" }, () => {
        fetchVouchers()
          .then((data) => active && setVouchers(data))
          .catch((err) => active && showToast(err instanceof Error ? err.message : String(err), "error"));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [showToast]);

  const filtered = vouchers.filter((v) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      String(v.voucher_no).includes(term) ||
      v.customers?.name.toLowerCase().includes(term) ||
      v.customers?.phone?.toLowerCase().includes(term)
    );
  });

  async function toggleExpand(voucher: VoucherRow) {
    if (expanded === voucher.id) {
      setExpanded(null);
      return;
    }
    setExpanded(voucher.id);
    setVoidReason("");
    const data = await fetchVoucherLines(voucher.id);
    setLines(data);
  }

  async function openPreview(voucher: VoucherRow) {
    try {
      const data = await fetchVoucherLines(voucher.id);
      setPreview({ voucher, lines: data });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  async function handleVoid(voucherId: string) {
    try {
      await voidVoucher(voucherId, voidReason.trim() || t("reports.void.defaultReason"));
      showToast(t("reports.void.success"), "success");
      const data = await fetchVouchers();
      setVouchers(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  async function handleDelete(voucher: VoucherRow) {
    if (!window.confirm(t("reports.delete.confirm", { voucherNo: String(voucher.voucher_no).padStart(4, "0") }))) return;
    try {
      await deleteVoucher(voucher.id);
      showToast(t("reports.delete.success"), "success");
      setExpanded(null);
      const data = await fetchVouchers();
      setVouchers(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  async function handleExport() {
    const rows = filtered.map((v) => ({
      [t("reports.voucherNo")]: `#${String(v.voucher_no).padStart(4, "0")}`,
      [t("reports.customer")]: v.customers?.name ?? t("reports.walkIn"),
      Phone: v.customers?.phone ?? "",
      [t("reports.staff")]: v.profiles?.display_name ?? v.profiles?.email ?? "",
      [t("totals.subtotal")]: v.subtotal,
      [t("totals.tradeInCredit")]: v.trade_in_credit,
      [t("reports.total")]: v.grand_total,
      [t("reports.status")]: v.status,
      Date: new Date(v.created_at).toLocaleString(),
    }));
    try {
      await exportToExcel("mobilemax-vouchers", "Vouchers", rows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  return (
    <div>
      <div className="reports-toolbar">
        <div className="field span-2">
          <label htmlFor="voucher-search">{t("reports.search")}</label>
          <input
            id="voucher-search"
            type="text"
            placeholder={t("reports.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-ghost" onClick={handleExport} disabled={filtered.length === 0}>
          {t("export.excel")}
        </button>
      </div>

      {loading ? (
        <p className="empty-note">{t("inventory.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="empty-note">{t("reports.noVouchers")}</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("reports.voucherNo")}</th>
                <th>{t("reports.customer")}</th>
                <th>{t("reports.staff")}</th>
                <th>{t("reports.total")}</th>
                <th>{t("reports.status")}</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <Fragment key={v.id}>
                  <tr className="data-table-row-clickable" onClick={() => toggleExpand(v)}>
                    <td>#{String(v.voucher_no).padStart(4, "0")}</td>
                    <td>{v.customers?.name ?? t("reports.walkIn")}</td>
                    <td>{v.profiles?.display_name ?? v.profiles?.email ?? "—"}</td>
                    <td>{money(v.grand_total)}</td>
                    <td>
                      <span className={`status-badge ${v.status === "void" ? "critical" : "success"}`}>
                        {t(`reports.status.${v.status}`)}
                      </span>
                    </td>
                    <td>{new Date(v.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreview(v);
                        }}
                      >
                        {t("reports.preview.action")}
                      </button>
                    </td>
                  </tr>
                  {expanded === v.id && (
                    <tr>
                      <td colSpan={7}>
                        <div className="voucher-detail">
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
                          {isAdmin && v.status === "completed" && (
                            <div className="void-row">
                              <input
                                type="text"
                                placeholder={t("reports.void.reasonPlaceholder")}
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                              />
                              <button className="btn btn-ghost" onClick={() => handleVoid(v.id)}>
                                {t("reports.void.action")}
                              </button>
                            </div>
                          )}
                          {isAdmin && v.status === "void" && (
                            <div className="void-row">
                              <button className="btn btn-ghost btn-danger" onClick={() => handleDelete(v)}>
                                {t("reports.delete.action")}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <VoucherPreview voucher={preview.voucher} lines={preview.lines} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

function StockReport() {
  const { t } = useLanguage();
  const { showToast } = useToastContext();
  const { products, loading } = useProductsContext();
  const active = [...products.filter((p) => p.is_active)].sort((a, b) => a.stock_qty - b.stock_qty);

  async function handleExport() {
    const rows = active.map((p) => ({
      [t("inventory.itemName")]: p.name,
      [t("inventory.stockQty")]: p.stock_qty,
      [t("reports.stockValue")]: p.price * p.stock_qty,
    }));
    try {
      await exportToExcel("mobilemax-stock-report", "Stock", rows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  if (loading) return <p className="empty-note">{t("inventory.loading")}</p>;

  return (
    <div>
      <div className="reports-toolbar reports-toolbar-end">
        <button className="btn btn-ghost" onClick={handleExport} disabled={active.length === 0}>
          {t("export.excel")}
        </button>
      </div>
      {active.length === 0 ? (
        <p className="empty-note">{t("inventory.empty")}</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("inventory.itemName")}</th>
                <th>{t("inventory.stockQty")}</th>
                <th>{t("reports.stockValue")}</th>
              </tr>
            </thead>
            <tbody>
              {active.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>
                    <span className={p.stock_qty <= p.low_stock_threshold ? "status-badge warning" : "status-badge"}>
                      {p.stock_qty}
                    </span>
                  </td>
                  <td>{money(p.price * p.stock_qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RevenueSummary() {
  const { t } = useLanguage();
  const { showToast } = useToastContext();
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const [points, setPoints] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetcher = period === "daily" ? fetchRevenueDaily : fetchRevenueMonthly;
    fetcher()
      .then(setPoints)
      .finally(() => setLoading(false));
  }, [period]);

  const max = Math.max(1, ...points.map((p) => p.total));
  const totals = points.reduce(
    (acc, p) => ({ gross: acc.gross + p.total, cost: acc.cost + p.total_cost, profit: acc.profit + p.profit }),
    { gross: 0, cost: 0, profit: 0 }
  );

  async function handleExport() {
    const rows = points.map((p) => ({
      [period === "daily" ? "Day" : "Month"]: p.day ?? p.month ?? "",
      Vouchers: p.voucher_count,
      [t("reports.grossRevenue")]: p.total,
      [t("reports.costOfGoods")]: p.total_cost,
      [t("reports.profit")]: p.profit,
    }));
    try {
      await exportToExcel(`mobilemax-revenue-${period}`, "Revenue", rows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  return (
    <div>
      <div className="reports-toolbar">
        <div className="tabs" role="tablist" aria-label="Revenue period">
          <button className="tab" role="tab" aria-selected={period === "daily"} onClick={() => setPeriod("daily")}>
            {t("reports.daily")}
          </button>
          <button className="tab" role="tab" aria-selected={period === "monthly"} onClick={() => setPeriod("monthly")}>
            {t("reports.monthly")}
          </button>
        </div>
        <button className="btn btn-ghost" onClick={handleExport} disabled={points.length === 0}>
          {t("export.excel")}
        </button>
      </div>

      {loading ? (
        <p className="empty-note">{t("inventory.loading")}</p>
      ) : points.length === 0 ? (
        <p className="empty-note">{t("reports.noRevenue")}</p>
      ) : (
        <>
          <div className="revenue-stats">
            <div className="revenue-stat">
              <span className="revenue-stat-label">{t("reports.grossRevenue")}</span>
              <span className="revenue-stat-value">{money(totals.gross)}</span>
            </div>
            <div className="revenue-stat">
              <span className="revenue-stat-label">{t("reports.costOfGoods")}</span>
              <span className="revenue-stat-value">{money(totals.cost)}</span>
            </div>
            <div className="revenue-stat revenue-stat-profit">
              <span className="revenue-stat-label">{t("reports.profit")}</span>
              <span className="revenue-stat-value">{money(totals.profit)}</span>
            </div>
          </div>
          <div className="revenue-bars">
            {points.map((p) => (
              <div className="revenue-bar-row" key={p.day ?? p.month}>
                <span className="revenue-bar-label">{p.day ?? p.month}</span>
                <div className="revenue-bar-track">
                  <div className="revenue-bar-fill" style={{ width: `${(p.total / max) * 100}%` }} />
                </div>
                <span className="revenue-bar-value">
                  {money(p.total)}
                  <span className="revenue-bar-profit">{t("reports.profit")}: {money(p.profit)}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomerList() {
  const { t } = useLanguage();
  const { showToast } = useToastContext();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    fetchAllCustomers()
      .then((data) => active && setCustomers(data))
      .catch((err) => active && showToast(err instanceof Error ? err.message : String(err), "error"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [showToast]);

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return c.name.toLowerCase().includes(term) || (c.phone ?? "").toLowerCase().includes(term);
  });

  async function handleExport() {
    const rows = filtered.map((c) => ({
      [t("customer.name")]: c.name,
      [t("customer.phone")]: c.phone ?? "",
      [t("customer.address")]: c.address ?? "",
      Joined: new Date(c.created_at).toLocaleDateString(),
    }));
    try {
      await exportToExcel("mobilemax-customers", "Customers", rows);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    }
  }

  return (
    <div>
      <div className="reports-toolbar">
        <div className="field span-2">
          <label htmlFor="customer-list-search">{t("reports.search")}</label>
          <input
            id="customer-list-search"
            type="text"
            placeholder={t("customer.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-ghost" onClick={handleExport} disabled={filtered.length === 0}>
          {t("export.excel")}
        </button>
      </div>

      {loading ? (
        <p className="empty-note">{t("inventory.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="empty-note">{t("reports.noCustomers")}</p>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("customer.name")}</th>
                <th>{t("customer.phone")}</th>
                <th>{t("customer.address")}</th>
                <th>{t("reports.joined")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.phone ?? "—"}</td>
                  <td>{c.address ?? "—"}</td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
