import { useLanguage } from "../i18n/LanguageContext";
import { initials } from "../utils/initials";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSwitch } from "./ThemeSwitch";
import type { Profile } from "../types";
import type { View } from "../App";

interface TopBarProps {
  profile: Profile;
  view: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}

export function TopBar({ profile, view, onNavigate, onLogout }: TopBarProps) {
  const { lang, t } = useLanguage();
  const today = new Date().toLocaleDateString(lang === "my" ? "my" : "en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const displayName = profile.display_name ?? profile.email;

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M2 20V4l5.2 6.4L12 4l0 0 4.8 6.4L22 4v16h-3.4V9.6L14 16l-2-2.6-2 2.6-4.6-6.4V20H2Z"
              fill="#fff"
            />
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-word">Mobile Max</span>
          <span className="brand-sub">{t("brand.sub")}</span>
        </div>
      </div>
      <nav className="topnav" aria-label="Primary">
        <a href="#" className={view === "console" ? "active" : ""} onClick={(e) => { e.preventDefault(); onNavigate("console"); }}>
          {t("nav.transactions")}
        </a>
        <a href="#" className={view === "inventory" ? "active" : ""} onClick={(e) => { e.preventDefault(); onNavigate("inventory"); }}>
          {t("nav.inventory")}
        </a>
        <a href="#" className={view === "reports" ? "active" : ""} onClick={(e) => { e.preventDefault(); onNavigate("reports"); }}>
          {t("nav.reports")}
        </a>
        {profile.role === "admin" && (
          <a href="#" className={view === "staff" ? "active" : ""} onClick={(e) => { e.preventDefault(); onNavigate("staff"); }}>
            {t("nav.staff")}
          </a>
        )}
      </nav>
      <div className="topbar-right">
        <LanguageSwitch />
        <ThemeSwitch />
        <div className="today">
          <strong>{today}</strong>
          {t("today.location")}
        </div>
        <button type="button" className="avatar" title={`${displayName} — ${t("logout")}`} onClick={onLogout}>
          {initials(displayName)}
        </button>
      </div>
    </header>
  );
}
