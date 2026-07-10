import { useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useToastContext } from "../toast/ToastContext";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { createStaffAccount, StaffCreationError } from "../lib/createStaffAccount";
import type { Profile, Role } from "../types";

interface EditDraft {
  display_name: string;
  phone: string;
  address: string;
}

export function StaffPage() {
  const { t } = useLanguage();
  const { showToast } = useToastContext();
  const { profile: currentProfile, refreshProfile } = useAuth();
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newRole, setNewRole] = useState<Role>("manager");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadStaff() {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at");
    if (error) showToast(error.message, "error");
    setStaff((data as Profile[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeRole(id: string, role: Role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setStaff((prev) => prev.map((p) => (p.id === id ? { ...p, role } : p)));
    if (id === currentProfile?.id) await refreshProfile();
    showToast(t("staff.roleUpdated"), "success");
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim() || !newDisplayName.trim()) return;
    setCreating(true);
    try {
      const created = await createStaffAccount({
        email: newEmail.trim(),
        password: newPassword,
        displayName: newDisplayName.trim(),
        phone: newPhone.trim(),
        address: newAddress.trim(),
        role: newRole,
      });
      setStaff((prev) => [...prev, created]);
      showToast(t("staff.accountCreated", { name: created.display_name ?? created.email }), "success");
      setShowCreate(false);
      setNewEmail("");
      setNewPassword("");
      setNewDisplayName("");
      setNewPhone("");
      setNewAddress("");
      setNewRole("manager");
    } catch (err) {
      if (err instanceof StaffCreationError && err.accountCreated) {
        showToast(err.message, "error");
        await loadStaff();
      } else {
        showToast(err instanceof Error ? err.message : String(err), "error");
      }
    } finally {
      setCreating(false);
    }
  }

  function startEdit(p: Profile) {
    setEditingId(p.id);
    setDraft({ display_name: p.display_name ?? "", phone: p.phone ?? "", address: p.address ?? "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit(id: string) {
    if (!draft) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: draft.display_name.trim() || null,
        phone: draft.phone.trim() || null,
        address: draft.address.trim() || null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    setStaff((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, display_name: draft.display_name.trim() || null, phone: draft.phone.trim() || null, address: draft.address.trim() || null }
          : p
      )
    );
    if (id === currentProfile?.id) await refreshProfile();
    showToast(t("staff.detailsUpdated"), "success");
    cancelEdit();
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <div className="panel-eyebrow">{t("staff.eyebrow")}</div>
          <div className="panel-title">{t("staff.title")}</div>
        </div>
      </div>

      <div className="tab-panel">
        <p className="staff-instructions">{t("staff.instructions")}</p>

        {!showCreate ? (
          <button type="button" className="btn btn-accent" onClick={() => setShowCreate(true)}>
            {t("staff.createAccount")}
          </button>
        ) : (
          <form className="field-grid staff-create-form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="staff-name">{t("staff.name")}</label>
              <input id="staff-name" value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="staff-email">{t("staff.email")}</label>
              <input id="staff-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="staff-password">{t("staff.password")}</label>
              <input
                id="staff-password"
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="staff-role">{t("staff.role")}</label>
              <select id="staff-role" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                <option value="manager">{t("staff.role.manager")}</option>
                <option value="admin">{t("staff.role.admin")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="staff-phone">{t("customer.phone")}</label>
              <input id="staff-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="staff-address">{t("customer.address")}</label>
              <input id="staff-address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
            </div>
            <div className="field span-2 customer-create-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)} disabled={creating}>
                {t("customer.cancel")}
              </button>
              <button
                type="submit"
                className="btn btn-accent"
                disabled={creating || !newEmail.trim() || !newPassword.trim() || !newDisplayName.trim()}
              >
                {creating ? t("login.submitting") : t("staff.createAccount")}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="empty-note">{t("inventory.loading")}</p>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("staff.name")}</th>
                  <th>{t("staff.email")}</th>
                  <th>{t("customer.phone")}</th>
                  <th>{t("customer.address")}</th>
                  <th>{t("staff.role")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((p) =>
                  editingId === p.id && draft ? (
                    <tr key={p.id} className="data-table-editing-row">
                      <td>
                        <input
                          value={draft.display_name}
                          onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
                        />
                      </td>
                      <td>{p.email}</td>
                      <td>
                        <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
                      </td>
                      <td>
                        <input
                          value={draft.address}
                          onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                        />
                      </td>
                      <td>
                        <span className={`role-badge ${p.role}`}>{t(`staff.role.${p.role}`)}</span>
                      </td>
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
                      <td>{p.display_name ?? "—"}</td>
                      <td>{p.email}</td>
                      <td>{p.phone ?? "—"}</td>
                      <td>{p.address ?? "—"}</td>
                      <td>
                        <span className={`role-badge ${p.role}`}>{t(`staff.role.${p.role}`)}</span>
                      </td>
                      <td className="data-table-actions">
                        <button className="btn btn-ghost" onClick={() => startEdit(p)}>
                          {t("inventory.edit")}
                        </button>
                        {p.id !== currentProfile?.id && (
                          <button
                            className="btn btn-ghost"
                            onClick={() => changeRole(p.id, p.role === "admin" ? "manager" : "admin")}
                          >
                            {p.role === "admin" ? t("staff.demote") : t("staff.promote")}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
