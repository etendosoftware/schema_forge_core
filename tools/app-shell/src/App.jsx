import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginPage from './auth/LoginPage.jsx';
import AppLayout from './layout/AppLayout.jsx';
import WindowLoader from './windows/WindowLoader.jsx';
import PreviewPage from './preview/PreviewPage.jsx';
import { buildMenuFromContract, buildWindowMap } from './windows/registry.js';
import { createMockFetch } from './lib/mockFetch.js';

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

/**
 * Load mock data for all entity windows and merge into a single store.
 */
async function loadAllMockData() {
  const modules = await Promise.all([
    import('@generated/sales-order/generated/web/sales-order/mockData.js'),
    import('@generated/business-partner/generated/web/business-partner/mockData.js'),
    import('@generated/warehouse/generated/web/warehouse/mockData.js'),
    import('@generated/price-list/generated/web/price-list/mockData.js'),
    import('@generated/payment-term/generated/web/payment-term/mockData.js'),
    import('@generated/payment-method/generated/web/payment-method/mockData.js'),
    import('@generated/product/generated/web/product/mockData.js'),
    import('@generated/tax/generated/web/tax/mockData.js'),
    import('@generated/uom/generated/web/uom/mockData.js'),
    import('@generated/user/generated/web/user/mockData.js'),
  ]);

  const merged = {};
  for (const mod of modules) {
    for (const [key, value] of Object.entries(mod)) {
      if (key !== 'default') {
        merged[key] = value;
      }
    }
  }
  return merged;
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
        <Route path="preview" element={<PreviewPage />} />
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
    loadContract().then(async contract => {
      if (import.meta.env.VITE_MOCK === 'true') {
        const mockData = await loadAllMockData();
        const mockFetch = createMockFetch(mockData, API_BASE_URL);
        const originalFetch = window.fetch;
        window.fetch = async (url, opts) => {
          const mockResult = await mockFetch(url, opts);
          if (mockResult !== undefined) return mockResult;
          return originalFetch(url, opts);
        };
      }
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
