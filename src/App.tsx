import { useState } from "react";
import "./App.css";
import { TopBar } from "./components/TopBar";
import { ConsoleView } from "./components/ConsoleView";
import { InventoryPage } from "./components/InventoryPage";
import { ReportsPage } from "./components/ReportsPage";
import { StaffPage } from "./components/StaffPage";
import { LoginPage } from "./components/LoginPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ProductsProvider } from "./products/ProductsContext";
import { ProductUnitsProvider } from "./products/ProductUnitsContext";
import { ToastProvider } from "./toast/ToastContext";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { ThemeProvider } from "./theme/ThemeContext";

export type View = "console" | "inventory" | "reports" | "staff";

function Splash() {
  const { t } = useLanguage();
  return (
    <div className="app-splash">
      <div className="brand-mark">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M2 20V4l5.2 6.4L12 4l0 0 4.8 6.4L22 4v16h-3.4V9.6L14 16l-2-2.6-2 2.6-4.6-6.4V20H2Z"
            fill="#fff"
          />
        </svg>
      </div>
      <p>{t("app.loading")}</p>
    </div>
  );
}

function AppShell() {
  const { session, profile, loading, logout } = useAuth();
  const [view, setView] = useState<View>("console");

  if (!session) {
    if (loading) return <Splash />;
    return <LoginPage />;
  }

  if (!profile) return <Splash />;

  return (
    <ProductsProvider>
      <ProductUnitsProvider>
        <div className="app">
          <TopBar profile={profile} view={view} onNavigate={setView} onLogout={logout} />
          {view === "console" && <ConsoleView />}
          {view === "inventory" && <InventoryPage />}
          {view === "reports" && <ReportsPage />}
          {view === "staff" && profile.role === "admin" && <StaffPage />}
        </div>
      </ProductUnitsProvider>
    </ProductsProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
