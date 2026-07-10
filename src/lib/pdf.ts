import { money } from "../utils/money";
import type { VoucherLine } from "../types";
import type { VoucherRow } from "./reports";

export async function buildVoucherPdf(voucher: VoucherRow, lines: VoucherLine[]): Promise<void> {
  const [{ default: jsPDF }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const marginX = 32;
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(234, 90, 31);
  doc.text("MOBILE MAX", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 100, 90);
  y += 16;
  doc.text("Brand New & Second Hand Phones, Accessories and Gadget", marginX, y);
  y += 12;
  doc.text("Thingangyun, Yangon · 09780055570", marginX, y);

  y += 22;
  doc.setDrawColor(220, 210, 195);
  doc.line(marginX, y, doc.internal.pageSize.getWidth() - marginX, y);

  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(30, 25, 20);
  doc.text(`Voucher #${String(voucher.voucher_no).padStart(4, "0")}`, marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(new Date(voucher.created_at).toLocaleString(), doc.internal.pageSize.getWidth() - marginX, y, {
    align: "right",
  });

  y += 20;
  doc.setFontSize(10);
  doc.text(`Customer: ${voucher.customers?.name ?? "Walk-in"}${voucher.customers?.phone ? ` · ${voucher.customers.phone}` : ""}`, marginX, y);
  y += 14;
  doc.text(`Served by: ${voucher.profiles?.display_name ?? voucher.profiles?.email ?? "—"}`, marginX, y);
  y += 14;
  doc.text(`Status: ${voucher.status === "void" ? "VOID" : "Completed"}`, marginX, y);

  y += 16;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [["Item", "Detail", "Amount"]],
    body: lines.map((line) => [
      line.name,
      line.tag,
      `${line.amount < 0 ? "− " : ""}${money(Math.abs(line.amount))}`,
    ]),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [234, 90, 31], textColor: [255, 255, 255] },
    theme: "grid",
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 20;
  let ty = afterTable;

  doc.setFontSize(10);
  doc.text("Subtotal", marginX, ty);
  doc.text(money(voucher.subtotal), doc.internal.pageSize.getWidth() - marginX, ty, { align: "right" });
  ty += 14;
  doc.text("Trade-in credit", marginX, ty);
  doc.text(`− ${money(voucher.trade_in_credit)}`, doc.internal.pageSize.getWidth() - marginX, ty, {
    align: "right",
  });
  ty += 18;
  doc.setDrawColor(220, 210, 195);
  doc.line(marginX, ty - 10, doc.internal.pageSize.getWidth() - marginX, ty - 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(184, 66, 14);
  doc.text("Total due", marginX, ty);
  doc.text(money(voucher.grand_total), doc.internal.pageSize.getWidth() - marginX, ty, { align: "right" });

  doc.save(`mobilemax-voucher-${String(voucher.voucher_no).padStart(4, "0")}.pdf`);
}
