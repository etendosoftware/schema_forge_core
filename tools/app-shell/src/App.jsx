import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginPage from './auth/LoginPage.jsx';
import AppLayout from './layout/AppLayout.jsx';
import WindowLoader from './windows/WindowLoader.jsx';

const DEFAULT_API_BASE_URL = '/etendo/api';

const DEFAULT_MENU_ITEMS = [
  { name: 'sales-order', label: 'Sales Order' },
];

const DEFAULT_WINDOW_MAP = {
  'sales-order': {
    name: 'sales-order',
    label: 'Sales Order',
    loader: () => import('./windows/PlaceholderWindow.jsx'),
  },
};

function AuthGuard({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes({ menuItems, windowMap, apiBaseUrl }) {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <AuthGuard>
            <AppLayout menuItems={menuItems} />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to={`/${menuItems[0]?.name || 'home'}`} replace />} />
        <Route
          path=":windowName"
          element={<WindowLoader windowMap={windowMap} apiBaseUrl={apiBaseUrl} />}
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes
          menuItems={DEFAULT_MENU_ITEMS}
          windowMap={DEFAULT_WINDOW_MAP}
          apiBaseUrl={DEFAULT_API_BASE_URL}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}
