import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginPage from './auth/LoginPage.jsx';
import AppLayout from './layout/AppLayout.jsx';
import ExplorerPage from './explorer/ExplorerPage.jsx';

function detectBasePath() {
  const path = window.location.pathname;
  const webIdx = path.indexOf('/web/');
  if (webIdx === -1) return '/';
  const moduleSegment = path.substring(webIdx + 1).split('/').slice(0, 2).join('/');
  return `${path.substring(0, webIdx)}/${moduleSegment}`;
}

const routerBase = detectBasePath();

function AuthGuard({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/explorer" replace /> : <LoginPage />}
      />
      <Route
        element={
          <AuthGuard>
            <AppLayout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/explorer" replace />} />
        <Route path="explorer" element={<ExplorerPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={routerBase}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
