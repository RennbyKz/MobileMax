import { useState } from "react";
import { NewSalePanel } from "./NewSalePanel";
import { TradeInPanel } from "./TradeInPanel";
import { useLanguage } from "../i18n/LanguageContext";
import type { ToastType } from "../hooks/useToast";
import type { CartLine } from "../types";

interface TransactionZoneProps {
  onAddLine: (line: Omit<CartLine, "id">) => void;
  onAddLines: (lines: Omit<CartLine, "id">[]) => void;
  onToast: (message: string, type?: ToastType) => void;
}

type TabId = "new-sale" | "trade-in";

export function TransactionZone({ onAddLine, onAddLines, onToast }: TransactionZoneProps) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<TabId>("trade-in");

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-eyebrow">{t("panel.eyebrow")}</div>
          <div className="panel-title">{t("panel.title")}</div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Transaction type">
        <button
          className="tab"
          role="tab"
          id="tab-new-sale"
          aria-selected={tab === "new-sale"}
          aria-controls="panel-new-sale"
          onClick={() => setTab("new-sale")}
        >
          {t("tab.newSale")}
        </button>
        <button
          className="tab"
          role="tab"
          id="tab-trade-in"
          aria-selected={tab === "trade-in"}
          aria-controls="panel-trade-in"
          onClick={() => setTab("trade-in")}
        >
          {t("tab.tradeIn")}
        </button>
      </div>

      {tab === "new-sale" ? (
        <NewSalePanel onAdd={onAddLine} onToast={onToast} />
      ) : (
        <TradeInPanel onAdd={onAddLines} onToast={onToast} />
      )}
    </section>
  );
}
