import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginPage from './auth/LoginPage.jsx';
import AppLayout from './layout/AppLayout.jsx';
import WindowLoader from './windows/WindowLoader.jsx';
import { buildMenuFromContract, buildWindowMap } from './windows/registry.js';

const API_BASE_URL = '/etendo_sf/api';

async function loadContract() {
  try {
    const res = await fetch('/contract.json');
    if (res.ok) return res.json();
  } catch { /* fall through */ }
  return {
    frontendContract: {
      window: { name: 'Sales Order' },
      entities: {
        order: { fields: [], searchableFields: [] },
      },
    },
  };
}

function AuthGuard({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes({ menuItems, windowMap }) {
  const { isAuthenticated } = useAuth();

  if (menuItems.length === 0) {
    return <div className="p-8 text-muted-foreground">Loading contract...</div>;
  }

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
        <Route index element={<Navigate to={`/${menuItems[0].name}`} replace />} />
        <Route
          path=":windowName"
          element={<WindowLoader windowMap={windowMap} apiBaseUrl={API_BASE_URL} />}
        />
      </Route>
    </Routes>
  );
}

export default function App() {
  const [menuItems, setMenuItems] = useState([]);
  const [windowMap, setWindowMap] = useState({});

  useEffect(() => {
    loadContract().then(contract => {
      setMenuItems(buildMenuFromContract(contract));
      setWindowMap(buildWindowMap(contract));
    });
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes menuItems={menuItems} windowMap={windowMap} />
      </AuthProvider>
    </BrowserRouter>
  );
}
