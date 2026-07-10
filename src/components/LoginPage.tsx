import { useState, type FormEvent } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeSwitch } from "./ThemeSwitch";

export function LoginPage() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  function raiseError(message: string) {
    setError(message);
    setErrorNonce((n) => n + 1);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      raiseError(t("login.error"));
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: authError } = await login(email.trim(), password);
    setSubmitting(false);
    if (authError) {
      raiseError(authError === "Invalid login credentials" ? t("login.invalidCredentials") : authError);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-toolbar">
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
      <div className="login-card">
        <div className="login-brand">
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
            <span className="brand-sub">{t("login.tagline")}</span>
          </div>
        </div>

        <h1 className="login-heading">{t("login.heading")}</h1>
        <p className="login-subheading">{t("login.subheading")}</p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="login-email">{t("login.email")}</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder={t("login.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">{t("login.password")}</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder={t("login.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className="login-error" role="alert" key={errorNonce}>
              {error}
            </p>
          )}

          <button className="btn btn-accent btn-block" type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <span className="spinner" aria-hidden="true" />
                {t("login.submitting")}
              </>
            ) : (
              t("login.submit")
            )}
          </button>
        </form>
      </div>
      <p className="login-location">{t("login.location")}</p>
    </div>
  );
}