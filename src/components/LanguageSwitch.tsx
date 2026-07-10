import { useLanguage } from "../i18n/LanguageContext";

export function LanguageSwitch() {
  const { lang, toggleLang, t } = useLanguage();

  return (
    <button
      type="button"
      className="icon-btn lang-btn"
      onClick={toggleLang}
      aria-label={`Switch language: ${t("lang.switchTo")}`}
      title={t("lang.switchTo")}
    >
      {lang === "en" ? "EN" : "MY"}
    </button>
  );
}
