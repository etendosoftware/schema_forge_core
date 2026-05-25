# @schema-forge/app-shell-core

Reusable runtime package for Schema Forge apps.

It contains the app shell pieces that can run without generated artifacts:
auth/session helpers, i18n, shared UI primitives, currency context, shell layout
primitives, styles, and a report viewer frame.

It intentionally does not include generated contracts, generated windows,
`@generated` imports, app-specific registries, or custom business windows.

```json
{
  "dependencies": {
    "@schema-forge/app-shell-core": "0.1.0"
  }
}
```

```jsx
import '@schema-forge/app-shell-core/styles.css';
import {
  AppShellRuntime,
  createAppShellConfig,
  createMemoryAuthStorage,
} from '@schema-forge/app-shell-core';

const config = createAppShellConfig({
  menuGroups: [
    {
      id: 'main',
      title: 'Main',
      items: [{ label: 'Dashboard', path: '/dashboard' }],
    },
  ],
  routes: [
    { path: '/dashboard', element: <Dashboard /> },
    { path: '/login', public: true, element: <Login /> },
  ],
  reports: [
    { id: 'sales-summary', title: 'Sales summary' },
  ],
});

export function App() {
  return (
    <AppShellRuntime
      config={config}
      auth={{
        loginPath: '/login',
        storage: createMemoryAuthStorage(),
      }}
      currency={{ value: 'EUR' }}
    />
  );
}
```

## Public Runtime Contract

External consumers should depend on the package entrypoints instead of internal
paths:

- `@schema-forge/app-shell-core` for the complete runtime surface.
- `@schema-forge/app-shell-core/runtime` for `AppShellRuntime`,
  `AppShellProviders`, `AuthGate`, and descriptor builders.
- `@schema-forge/app-shell-core/auth` for session storage, auth context, and API
  fetch helpers.
- `@schema-forge/app-shell-core/layout` for shell layout primitives.
- `@schema-forge/app-shell-core/reports` for report descriptors and viewer frame.
- `@schema-forge/app-shell-core/styles.css` for the CSS/Tailwind token layer.
- `@schema-forge/app-shell-core/tailwind-preset` for the Tailwind theme tokens
  required by the published CSS and UI primitives.

The package still expects the host app to provide React, React Router, Radix UI,
Lucide, Tailwind/PostCSS, and the peer dependencies listed in `package.json`.
Generated contracts and generated windows remain outside this package by design.
