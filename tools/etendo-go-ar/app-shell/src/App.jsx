import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@etendosoftware/app-shell-core/auth';
import { LocaleProvider } from '@etendosoftware/app-shell-core/i18n';
import OnboardingPage from './pages/OnboardingPage.jsx';
import { buildOnboardingReturnTo } from '@etendosoftware/etendo-go-core/onboarding';
import es_AR from './locales/es_AR.json';

const LOCALE_DICTIONARIES = { es_AR };

function AuthGuard({ children }) {
  const { isAuthenticated, status } = useAuth();
  const location = useLocation();
  // ETP-4576 — the session now lives in a __Host- cookie, so AuthProvider has to
  // ask the server on mount and `isAuthenticated` is still false while that is in
  // flight. This check MUST come before the redirect below, or every reload
  // bounces an authenticated user back to onboarding mid-restore.
  if (status === 'booting') {
    return null;
  }
  if (!isAuthenticated) {
    return (
      <Navigate
        to={buildOnboardingReturnTo(location)}
        replace
      />
    );
  }
  return children;
}

function MainApp() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Etendo GO — Argentina</h1>
      <p>Has ingresado al sistema. Esta es la página principal (Dashboard).</p>
    </div>
  );
}

export default function App() {
  const [locale, setLocale] = useState('es_AR');

  return (
    <BrowserRouter>
      <LocaleProvider locale={locale} setLocale={setLocale} dictionaries={LOCALE_DICTIONARIES}>
        <AuthProvider>
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/login" element={<Navigate to="/onboarding" replace />} />
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <MainApp />
                </AuthGuard>
              }
            />
          </Routes>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
