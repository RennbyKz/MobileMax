import { useEffect, useState } from "react";
import { searchCustomers, createCustomer } from "../lib/customers";
import { useLanguage } from "../i18n/LanguageContext";
import type { Customer } from "../types";

interface CustomerPickerProps {
  customer: Customer | null;
  onChange: (customer: Customer | null) => void;
}

export function CustomerPicker({ customer, onChange }: CustomerPickerProps) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const handle = window.setTimeout(() => {
      searchCustomers(query)
        .then((data) => {
          if (active) setResults(data);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [query]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createCustomer({ name: newName.trim(), phone: newPhone.trim(), address: newAddress.trim() });
      onChange(created);
      setShowCreate(false);
      setNewName("");
      setNewPhone("");
      setNewAddress("");
      setQuery("");
      setResults([]);
    } finally {
      setCreating(false);
    }
  }

  if (customer) {
    return (
      <div className="customer-picker">
        <div className="customer-chip">
          <div>
            <div className="name">{customer.name}</div>
            {customer.phone && <span className="tag">{customer.phone}</span>}
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => onChange(null)}>
            {t("customer.change")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-picker">
      <div className="field span-2">
        <label htmlFor="customer-search">{t("customer.search")}</label>
        <input
          id="customer-search"
          type="text"
          placeholder={t("customer.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {query.trim() && (
        <div className="customer-results">
          {searching && <div className="customer-result-empty">{t("customer.searching")}</div>}
          {!searching && results.length === 0 && (
            <div className="customer-result-empty">{t("customer.noResults")}</div>
          )}
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="customer-result"
              onClick={() => {
                onChange(c);
                setQuery("");
                setResults([]);
              }}
            >
              <span className="name" style={{ color: "black" }}>{c.name}</span>
              {c.phone && <span className="tag">{c.phone}</span>}
            </button>
          ))}
        </div>
      )}

      {!showCreate ? (
        <button type="button" className="btn btn-ghost customer-new-btn" onClick={() => setShowCreate(true)}>
          {t("customer.addNew")}
        </button>
      ) : (
        <div className="customer-create field-grid">
          <div className="field">
            <label htmlFor="customer-new-name">{t("customer.name")}</label>
            <input id="customer-new-name" type="text" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="customer-new-phone">{t("customer.phone")}</label>
            <input id="customer-new-phone" type="text" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          </div>
          <div className="field span-2">
            <label htmlFor="customer-new-address">{t("customer.address")}</label>
            <input
              id="customer-new-address"
              type="text"
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
            />
          </div>
          <div className="field span-2 customer-create-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
              {t("customer.cancel")}
            </button>
            <button type="button" className="btn btn-accent" onClick={handleCreate} disabled={!newName.trim() || creating}>
              {t("customer.save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
