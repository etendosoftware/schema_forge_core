# App Shell Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the production app shell — login, sidebar, routing — where Schema Forge generated UIs mount.

**Architecture:** Vite + React 18 app at `tools/app-shell/` using Shadcn/ui + Tailwind for the shell chrome and React Router v7 for navigation. Auth via JWT against `/etendo/sws/login`. Generated components mount as direct React imports receiving `{ token, apiBaseUrl, window }` props.

**Tech Stack:** React 18, Vite 6, Shadcn/ui, Tailwind CSS, React Router v7, React Context (auth)

---

## Task 1: Scaffold Vite + React + Tailwind + Shadcn

**Files:**
- Create: `tools/app-shell/package.json`
- Create: `tools/app-shell/index.html`
- Create: `tools/app-shell/vite.config.js`
- Create: `tools/app-shell/tailwind.config.js`
- Create: `tools/app-shell/postcss.config.js`
- Create: `tools/app-shell/components.json`
- Create: `tools/app-shell/src/main.jsx`
- Create: `tools/app-shell/src/App.jsx`
- Create: `tools/app-shell/src/index.css`
- Create: `tools/app-shell/src/lib/utils.js`

**Step 1: Create package.json**

```json
{
  "name": "@schema-forge/app-shell",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^7.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0",
    "lucide-react": "^0.400.0",
    "class-variance-authority": "^0.7.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

**Step 2: Create vite.config.js**

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3100,
    proxy: {
      '/etendo': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 3: Create tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

**Step 4: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 5: Create components.json (Shadcn config)**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

**Step 6: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Schema Forge</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Step 7: Create src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --card-foreground: 0 0% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  --secondary: 0 0% 96.1%;
  --secondary-foreground: 0 0% 9%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --accent: 0 0% 96.1%;
  --accent-foreground: 0 0% 9%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 0 0% 89.8%;
  --input: 0 0% 89.8%;
  --ring: 0 0% 3.9%;
  --radius: 0.5rem;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
}
```

**Step 8: Create src/lib/utils.js**

```javascript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

**Step 9: Create src/main.jsx**

```jsx
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<App />);
```

**Step 10: Create src/App.jsx (placeholder)**

```jsx
export default function App() {
  return <div className="p-8 text-lg">Schema Forge — App Shell Loading...</div>;
}
```

**Step 11: Install dependencies and verify build**

Run: `cd tools/app-shell && npm install && npm run build`
Expected: Build succeeds, `dist/` created

**Step 12: Commit**

```bash
git add tools/app-shell/
git commit -m "feat: scaffold app-shell with Vite + React + Tailwind + Shadcn config"
```

---

## Task 2: Auth — Context + API wrapper

**Files:**
- Create: `tools/app-shell/src/auth/AuthContext.jsx`
- Create: `tools/app-shell/src/auth/api.js`
- Test: `tools/app-shell/src/auth/__tests__/api.test.js`

**Step 1: Write test for api.js**

```javascript
// tools/app-shell/src/auth/__tests__/api.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildHeaders, isTokenExpired } from '../api.js';

describe('buildHeaders', () => {
  it('includes Authorization header when token provided', () => {
    const headers = buildHeaders('my-jwt-token');
    assert.equal(headers['Authorization'], 'Bearer my-jwt-token');
    assert.equal(headers['Content-Type'], 'application/json');
  });

  it('omits Authorization when no token', () => {
    const headers = buildHeaders(null);
    assert.ok(!headers['Authorization']);
    assert.equal(headers['Content-Type'], 'application/json');
  });
});

describe('isTokenExpired', () => {
  it('returns true for null token', () => {
    assert.equal(isTokenExpired(null), true);
  });

  it('returns true for empty string', () => {
    assert.equal(isTokenExpired(''), true);
  });

  it('returns false for non-empty token (no expiry check in v1)', () => {
    assert.equal(isTokenExpired('some-token'), false);
  });
});
```

**Step 2: Run test — verify it fails**

Run: `node --test tools/app-shell/src/auth/__tests__/api.test.js`
Expected: FAIL — module not found

**Step 3: Implement api.js**

```javascript
// tools/app-shell/src/auth/api.js

const DEFAULT_BASE_URL = '/etendo';

export function buildHeaders(token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export function isTokenExpired(token) {
  return !token;
}

export async function login(baseUrl, username, password) {
  const res = await fetch(`${baseUrl || DEFAULT_BASE_URL}/sws/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: username, password }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Login failed: ${res.status}`);
  }
  return res.json();
}

export function createApiFetch(baseUrl, getToken, onUnauthorized) {
  return async function apiFetch(path, options = {}) {
    const token = getToken();
    const res = await fetch(`${baseUrl || DEFAULT_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...buildHeaders(token),
        ...options.headers,
      },
    });
    if (res.status === 401) {
      onUnauthorized();
      throw new Error('Unauthorized');
    }
    return res;
  };
}
```

**Step 4: Run test — verify it passes**

Run: `node --test tools/app-shell/src/auth/__tests__/api.test.js`
Expected: PASS

**Step 5: Implement AuthContext.jsx**

```jsx
// tools/app-shell/src/auth/AuthContext.jsx
import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { login as apiLogin } from './api.js';

const AuthContext = createContext(null);

const STORAGE_KEY = 'sf_auth_token';
const USERNAME_KEY = 'sf_auth_user';

export function AuthProvider({ children, baseUrl }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [username, setUsername] = useState(() => localStorage.getItem(USERNAME_KEY));

  const login = useCallback(async (user, password) => {
    const data = await apiLogin(baseUrl, user, password);
    const jwt = data.token;
    setToken(jwt);
    setUsername(user);
    localStorage.setItem(STORAGE_KEY, jwt);
    localStorage.setItem(USERNAME_KEY, user);
    return jwt;
  }, [baseUrl]);

  const logout = useCallback(() => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USERNAME_KEY);
  }, []);

  const value = useMemo(() => ({
    token,
    username,
    isAuthenticated: !!token,
    login,
    logout,
  }), [token, username, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

**Step 6: Verify build still works**

Run: `cd tools/app-shell && npm run build`
Expected: PASS

**Step 7: Commit**

```bash
git add tools/app-shell/src/auth/
git commit -m "feat: add auth context with JWT login, logout, and API wrapper"
```

---

## Task 3: Login Page

**Files:**
- Create: `tools/app-shell/src/auth/LoginPage.jsx`

**Step 1: Install Shadcn button and input components**

Shadcn components are copy-pasted, not installed via CLI (since we're in JSX not TSX). Create them manually:

Create: `tools/app-shell/src/components/ui/button.jsx`

```jsx
import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline: 'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
));
Button.displayName = 'Button';

export { Button, buttonVariants };
```

Create: `tools/app-shell/src/components/ui/input.jsx`

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';

export { Input };
```

Create: `tools/app-shell/src/components/ui/card.jsx`

```jsx
import * as React from 'react';
import { cn } from '@/lib/utils';

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl border bg-card text-card-foreground shadow', className)} {...props} />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cn('font-semibold leading-none tracking-tight', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardContent };
```

**Step 2: Implement LoginPage.jsx**

```jsx
// tools/app-shell/src/auth/LoginPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card.jsx';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Schema Forge</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your Etendo instance</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-medium">Username</label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Verify build**

Run: `cd tools/app-shell && npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add tools/app-shell/src/components/ui/ tools/app-shell/src/auth/LoginPage.jsx
git commit -m "feat: add login page with Shadcn card, input, button components"
```

---

## Task 4: Layout — Sidebar + TopBar + Content Area

**Files:**
- Create: `tools/app-shell/src/layout/AppLayout.jsx`
- Create: `tools/app-shell/src/layout/Sidebar.jsx`
- Create: `tools/app-shell/src/layout/TopBar.jsx`

**Step 1: Implement Sidebar.jsx**

```jsx
// tools/app-shell/src/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard } from 'lucide-react';

export default function Sidebar({ menuItems }) {
  return (
    <aside className="w-60 border-r bg-muted/30 flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-lg font-bold tracking-tight">Schema Forge</h1>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {menuItems.map(item => (
          <NavLink
            key={item.name}
            to={`/${item.name}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive && 'bg-accent text-accent-foreground'
              )
            }
          >
            <LayoutDashboard className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
```

**Step 2: Implement TopBar.jsx**

```jsx
// tools/app-shell/src/layout/TopBar.jsx
import { useAuth } from '@/auth/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { LogOut } from 'lucide-react';

export default function TopBar() {
  const { username, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="h-12 border-b flex items-center justify-end px-4 gap-4 bg-background">
      <span className="text-sm text-muted-foreground">{username}</span>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="h-4 w-4 mr-1" />
        Logout
      </Button>
    </header>
  );
}
```

**Step 3: Implement AppLayout.jsx**

```jsx
// tools/app-shell/src/layout/AppLayout.jsx
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';

export default function AppLayout({ menuItems }) {
  return (
    <div className="h-screen flex">
      <Sidebar menuItems={menuItems} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

**Step 4: Verify build**

Run: `cd tools/app-shell && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/app-shell/src/layout/
git commit -m "feat: add app layout with sidebar, topbar, and content area"
```

---

## Task 5: Routing + Auth Guard + Window Loader

**Files:**
- Create: `tools/app-shell/src/windows/WindowLoader.jsx`
- Modify: `tools/app-shell/src/App.jsx`

**Step 1: Implement WindowLoader.jsx**

```jsx
// tools/app-shell/src/windows/WindowLoader.jsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext.jsx';

export default function WindowLoader({ windowMap, apiBaseUrl }) {
  const { windowName } = useParams();
  const { token } = useAuth();
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setComponent(null);

    const windowConfig = windowMap[windowName];
    if (!windowConfig) {
      setError(`Window "${windowName}" not found`);
      setLoading(false);
      return;
    }

    // Dynamic import of generated component
    // Generated components live at: artifacts/{window}/generated/web/{window}/{entity}.jsx
    windowConfig.loader()
      .then(mod => {
        setComponent(() => mod.default);
        setLoading(false);
      })
      .catch(err => {
        setError(`Failed to load window "${windowName}": ${err.message}`);
        setLoading(false);
      });
  }, [windowName, windowMap]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive font-medium">{error}</p>
          <p className="text-sm text-muted-foreground mt-2">Check that the component has been generated.</p>
        </div>
      </div>
    );
  }

  if (!Component) return null;

  return (
    <Component
      token={token}
      apiBaseUrl={apiBaseUrl}
      window={windowMap[windowName]}
    />
  );
}
```

**Step 2: Rewrite App.jsx with routing**

```jsx
// tools/app-shell/src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginPage from './auth/LoginPage.jsx';
import AppLayout from './layout/AppLayout.jsx';
import WindowLoader from './windows/WindowLoader.jsx';

// Default contract for development — replace with actual contract loading
const DEFAULT_API_BASE_URL = '/etendo/api';

// Menu items derived from contract.json frontendContract.entities
// In production, these are loaded from the generated contract
const DEFAULT_MENU_ITEMS = [
  { name: 'sales-order', label: 'Sales Order' },
];

// Window map: maps route name to loader + config
// In production, these point to actual generated components
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
```

**Step 3: Create placeholder window for dev**

Create: `tools/app-shell/src/windows/PlaceholderWindow.jsx`

```jsx
// tools/app-shell/src/windows/PlaceholderWindow.jsx
export default function PlaceholderWindow({ token, apiBaseUrl, window: windowConfig }) {
  return (
    <div style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h2 style={{ marginBottom: 16 }}>
        {windowConfig?.label || 'Window'} — Placeholder
      </h2>
      <p style={{ color: '#666' }}>
        This is a placeholder. The generated component will replace this.
      </p>
      <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 13, marginTop: 16 }}>
        {JSON.stringify({ token: token ? '***' : null, apiBaseUrl, window: windowConfig?.name }, null, 2)}
      </pre>
    </div>
  );
}
```

**Step 4: Verify build**

Run: `cd tools/app-shell && npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add tools/app-shell/src/
git commit -m "feat: add routing, auth guard, and window loader with placeholder"
```

---

## Task 6: Contract-Driven Menu + Window Registry

**Files:**
- Create: `tools/app-shell/src/windows/registry.js`
- Test: `tools/app-shell/src/windows/__tests__/registry.test.js`

**Step 1: Write test for registry**

```javascript
// tools/app-shell/src/windows/__tests__/registry.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildMenuFromContract, buildWindowMap } from '../registry.js';

const sampleContract = {
  frontendContract: {
    window: { name: 'Sales Order' },
    entities: {
      order: {
        fields: [
          { name: 'documentNo', tsType: 'string', visibility: 'readOnly' },
        ],
        searchableFields: ['documentNo'],
      },
      orderLine: {
        fields: [
          { name: 'product', tsType: 'string', visibility: 'editable' },
        ],
        searchableFields: ['product'],
      },
    },
  },
};

describe('buildMenuFromContract', () => {
  it('creates menu items from contract entities', () => {
    const items = buildMenuFromContract(sampleContract);
    assert.equal(items.length, 2);
    assert.equal(items[0].name, 'order');
    assert.equal(items[1].name, 'orderLine');
  });

  it('generates labels from entity names', () => {
    const items = buildMenuFromContract(sampleContract);
    assert.equal(items[0].label, 'Order');
    assert.equal(items[1].label, 'Order Line');
  });

  it('returns empty array for empty contract', () => {
    const items = buildMenuFromContract({});
    assert.deepEqual(items, []);
  });
});

describe('buildWindowMap', () => {
  it('creates window map with loaders', () => {
    const loaders = { order: () => Promise.resolve({ default: () => null }) };
    const map = buildWindowMap(sampleContract, loaders);
    assert.ok(map.order);
    assert.ok(map.order.loader);
    assert.equal(map.order.name, 'order');
  });

  it('uses placeholder loader when no loader provided', () => {
    const map = buildWindowMap(sampleContract, {});
    assert.ok(map.order);
    assert.ok(map.order.loader); // should have a fallback
  });
});
```

**Step 2: Run test — verify it fails**

Run: `node --test tools/app-shell/src/windows/__tests__/registry.test.js`
Expected: FAIL

**Step 3: Implement registry.js**

```javascript
// tools/app-shell/src/windows/registry.js

/**
 * Convert camelCase entity name to display label.
 * 'orderLine' → 'Order Line'
 */
function toLabel(name) {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/**
 * Build menu items from a contract.json frontendContract.
 */
export function buildMenuFromContract(contract) {
  const entities = contract?.frontendContract?.entities;
  if (!entities) return [];

  return Object.keys(entities).map(name => ({
    name,
    label: toLabel(name),
  }));
}

/**
 * Build window map with loaders for each entity.
 * loaders: { entityName: () => import('...') }
 * Falls back to a placeholder component if no loader is provided.
 */
export function buildWindowMap(contract, loaders = {}) {
  const entities = contract?.frontendContract?.entities;
  if (!entities) return {};

  const map = {};
  for (const name of Object.keys(entities)) {
    map[name] = {
      name,
      label: toLabel(name),
      entityConfig: entities[name],
      loader: loaders[name] || (() =>
        import('./PlaceholderWindow.jsx')
      ),
    };
  }
  return map;
}
```

**Step 4: Run test — verify it passes**

Run: `node --test tools/app-shell/src/windows/__tests__/registry.test.js`
Expected: PASS

**Step 5: Run ALL tests**

Run: `node --test 'cli/test/*.test.js' 'tools/app-shell/src/**/__tests__/*.test.js'`
Expected: All PASS

**Step 6: Commit**

```bash
git add tools/app-shell/src/windows/registry.js tools/app-shell/src/windows/__tests__/
git commit -m "feat: add contract-driven menu builder and window registry"
```

---

## Task 7: Wire Everything Together + Update generate-ui Skill

**Files:**
- Modify: `tools/app-shell/src/App.jsx` (use registry)
- Modify: `.claude/skills/generate-ui.md` (add props contract)

**Step 1: Update App.jsx to use registry**

Replace the hardcoded defaults in App.jsx:

```jsx
// tools/app-shell/src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext.jsx';
import LoginPage from './auth/LoginPage.jsx';
import AppLayout from './layout/AppLayout.jsx';
import WindowLoader from './windows/WindowLoader.jsx';
import { buildMenuFromContract, buildWindowMap } from './windows/registry.js';

const API_BASE_URL = '/etendo/api';

// In production, load contract.json from artifacts dir or embedded at build time.
// For now, try to fetch it; fall back to a minimal default.
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
```

**Step 2: Update generate-ui skill**

Append to `.claude/skills/generate-ui.md`:

```markdown

## Component Props Contract

Generated components MUST accept these props from the app shell:

```jsx
export default function WindowName({ token, apiBaseUrl, window }) {
  // token: JWT string for Authorization header
  // apiBaseUrl: base URL for API calls (e.g., '/etendo/api')
  // window: { name, label, entityConfig } from contract
}
```

When making API calls, use:
```javascript
const res = await fetch(`${apiBaseUrl}/v1/${window.name}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
```

NEVER hardcode API URLs or tokens. Always use the props.
```

**Step 3: Verify final build**

Run: `cd tools/app-shell && npm run build`
Expected: PASS

**Step 4: Run all tests**

Run: `node --test 'cli/test/*.test.js' 'tools/app-shell/src/**/__tests__/*.test.js'`
Expected: All PASS

**Step 5: Commit**

```bash
git add tools/app-shell/src/App.jsx .claude/skills/generate-ui.md
git commit -m "feat: wire app shell with contract-driven routing and update generate-ui skill"
```

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | Scaffold Vite+React+Tailwind+Shadcn | 10 created | build check |
| 2 | Auth Context + API wrapper | 3 created | 3 unit tests |
| 3 | Login Page + Shadcn components | 4 created | build check |
| 4 | Layout (Sidebar + TopBar + Content) | 3 created | build check |
| 5 | Routing + Auth Guard + WindowLoader | 3 created | build check |
| 6 | Contract-driven registry | 2 created | 5 unit tests |
| 7 | Wire together + update skill | 2 modified | build + all tests |
