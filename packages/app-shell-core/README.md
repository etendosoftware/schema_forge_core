# @etendosoftware/app-shell-core

Reusable runtime package for Schema Forge apps.

It contains the app shell pieces that can run without generated artifacts:
auth/session helpers, i18n, shared UI primitives, currency context, shell layout
primitives, styles, and a report viewer frame.

It intentionally does not include generated contracts, generated windows,
`@generated` imports, app-specific registries, or custom business windows.

The `./webmcp` export provides an opt-in `WebMcpAgentTools` facade. It registers
context, internal navigation, and chat-opening tools only when the consumer
enables it and the browser exposes `document.modelContext`.

`WebMcpMcpTools` mirrors the authenticated Etendo Go MCP catalog by calling
`tools/list` and delegating each invocation to `tools/call`. This keeps the
WebMCP catalog aligned with server-side RBAC, OAuth scopes, schemas, processes,
reports, and CRUD tools without duplicating those rules in the browser.

```json
{
  "dependencies": {
    "@etendosoftware/app-shell-core": "0.1.0"
  }
}
```

```jsx
import '@etendosoftware/app-shell-core/styles.css';
import {
  AppShellRuntime,
  createAppShellConfig,
  createMemoryAuthStorage,
} from '@etendosoftware/app-shell-core';

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

- `@etendosoftware/app-shell-core` for the complete runtime surface.
- `@etendosoftware/app-shell-core/runtime` for `AppShellRuntime`,
  `AppShellProviders`, `AuthGate`, and descriptor builders.
- `@etendosoftware/app-shell-core/auth` for session storage, auth context, and API
  fetch helpers.
- `@etendosoftware/app-shell-core/layout` for shell layout primitives.
- `@etendosoftware/app-shell-core/reports` for report descriptors and viewer frame.
- `@etendosoftware/app-shell-core/styles.css` for the CSS/Tailwind token layer.
- `@etendosoftware/app-shell-core/tailwind-preset` for the Tailwind theme tokens
  required by the published CSS and UI primitives.

The package still expects the host app to provide React, React Router, Radix UI,
Lucide, Tailwind/PostCSS, and the peer dependencies listed in `package.json`.
Generated contracts and generated windows remain outside this package by design.

## Network failures (ETP-5424)

`apiFetch` / `createApiFetch` never let the browser's `TypeError('Failed to fetch')`
escape. A request that got no HTTP answer rejects with a `NetworkError` (exported from
`@etendosoftware/app-shell-core/auth`) whose `message` is already user-facing, so a call
site that shows `err.message` needs no change:

| Situation | Result |
|-----------|--------|
| `fetch` rejects with a `TypeError` (offline, DNS, CORS, reset) | `NetworkError`, `reason: 'offline'`, original on `cause` |
| A body reader (`json`, `text`, `blob`, `arrayBuffer`, `formData`, `bytes`) rejects with a `TypeError` | `NetworkError`, `reason: 'offline'` |
| No response within `timeout` ms | `NetworkError`, `reason: 'timeout'` |
| The caller's own `signal` aborts | the caller's `AbortError`, unchanged — a cancellation is not a failure |
| Anything else (`SyntaxError` from bad JSON, a plain `Error`) | passed through unchanged |

Any `TypeError` from a body reader maps to `NetworkError('offline')`, with the
original kept on `cause` — engines word a cut stream differently, so the mapping keys on the
type, not the prose. Reads that bypass the readers, straight from `res.body.getReader()`
(streaming), are **not** mapped: such a call site handles the stream's `TypeError` itself.

`NetworkError` carries `name: 'NetworkError'`, `code: 'NETWORK'`,
`messageKey: 'networkErrorRetry'` (`NETWORK_ERROR_KEY`), `reason` and `cause`. Detect it
with `isNetworkError(err)`, which also matches on `code`, so an error from a duplicated
bundle is still recognized. A caller with more specific wording checks it before any
generic `messageKey` handling, as `classifyTransportError` in `lib/import` does.

**Localizing the message.** Core ships only the English fallback
(`NETWORK_ERROR_FALLBACK`, `'Could not complete the action. Try again.'`). The host app
registers its translator once, and again on a locale switch:

```js
import { registerErrorTranslator } from '@etendosoftware/app-shell-core/auth';

const unregister = registerErrorTranslator((key, params) => translate(key, params));
```

The translator follows the usual `translate` contract: returning the key unchanged,
an empty string, nothing, or throwing all fall back to the English text. The message is
resolved when the error is built, so register it before the first request. Tests reset it
with `resetErrorTranslatorForTests()`.

**Timeout.** Every request gets `timeout: DEFAULT_API_TIMEOUT_MS` (60 000 ms) unless it
passes its own. `timeout: 0` disables it. The option is not forwarded to `fetch`; apiFetch
combines its own timer with the caller's `signal`, and the timer covers only until `fetch`
settles — reading a large body, or a serialized write's wait behind the write ahead of it,
does not count. A call that legitimately waits longer than a minute for its response
headers (a long synchronous batch, a server-side export) must pass a larger `timeout` or `0`.

Raw `fetch` call sites that show an error to the user map a `TypeError` the same way,
e.g. `new NetworkError({ reason: 'offline', cause: err }).message` (see `AuthorizePage`).

## Session refresh

See [the session refresh contract](../../docs/auth-session-refresh.md) for the
ETP-5195 readiness/revision APIs, synchronous session ownership, legacy fallback,
and proposed backend metadata extension. Backend and functional integration are
separate follow-ups; a core-only change does not establish end-to-end acceptance.
