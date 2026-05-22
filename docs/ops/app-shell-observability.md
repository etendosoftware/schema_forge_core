# App Shell Observability

App Shell initializes observability through a vendor-neutral layer in
`tools/app-shell/src/lib/observability`. Application code should use the shared
API instead of importing vendor SDKs directly.

## Providers

The browser initializer registers these providers:

| Provider | Enabled when | Purpose |
|----------|--------------|---------|
| Sentry | `VITE_SENTRY_DSN` is set | Error capture, tracing, and app context |
| AWS RUM | Hostname has matching RUM IDs | Browser performance, error, and HTTP telemetry |
| Mixpanel | `VITE_MIXPANEL_ENABLED=true` and `VITE_MIXPANEL_TOKEN` is set | Product analytics events |

Sentry keeps the existing compatibility setting `sendDefaultPii: true`. Treat
that as an explicit legacy decision; do not add product-event PII to
observability payloads.

AWS RUM keeps the current hostname-gated configuration for staging and
experimental environments. Missing config is a no-op.

Mixpanel is opt-in. If `VITE_MIXPANEL_ENABLED=true` is set without
`VITE_MIXPANEL_TOKEN`, the provider logs a warning and remains disabled. The SDK
is lazy-loaded only when the provider is enabled and used.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SENTRY_DSN` | Enables Sentry. |
| `VITE_RUM_APP_MONITOR_ID_STAGING` | CloudWatch RUM app monitor for `go.staging.etendo.cloud`. |
| `VITE_RUM_IDENTITY_POOL_ID_STAGING` | CloudWatch RUM identity pool for staging. |
| `VITE_RUM_APP_MONITOR_ID_EXPERIMENTAL` | CloudWatch RUM app monitor for `go.experimental.etendo.cloud`. |
| `VITE_RUM_IDENTITY_POOL_ID_EXPERIMENTAL` | CloudWatch RUM identity pool for experimental. |
| `VITE_MIXPANEL_ENABLED` | Set to `true` to enable Mixpanel. |
| `VITE_MIXPANEL_TOKEN` | Mixpanel project token. Required when Mixpanel is enabled. |
| `VITE_MIXPANEL_DEBUG` | Optional Mixpanel debug flag. |
| `VITE_MIXPANEL_API_HOST` | Optional custom Mixpanel API host. |

## Events

V1 emits only:

| Event | When |
|-------|------|
| `app_started` | After browser observability initialization completes. |
| `page_view` | On initial route mount and each pathname change. |

Route tracking ignores query-string and hash-only changes. Business events such
as CRUD actions, filters, document processing, and menu clicks are out of scope
for v1.

## Privacy Rules

Payloads are normalized before providers receive them:

- Allowed common fields: `app`, `environment`, `hostname`, `mockMode`, `route`,
  `routePattern`, `timestamp`, and `windowName`.
- Query strings, hashes, raw URLs, OAuth `code`/`state`, tokens, record IDs,
  document IDs, document numbers, labels, and names are stripped.
- Record-detail paths such as `/sales-order/ABC123` are emitted as
  `/sales-order/:recordId`.
- Nested opaque IDs are emitted as `:id`.

Do not pass free-form user-entered values to `track`, `page`, or future business
events. Add new event fields to the allowlist only when they are stable,
non-sensitive product metadata.

## Adding A Provider

1. Implement a provider object with `name`, `enabled`, and any supported methods:
   `init`, `track`, `page`, `identify`, `captureException`, `setContext`, or
   `flush`.
2. Register it from `buildBrowserObservabilityConfig`.
3. Keep initialization optional and failure-contained.
4. Add unit tests for disabled config, missing config, successful dispatch, and
   provider failures.

Provider failures are guarded by the registry. A failing provider must not block
app startup, rendering, routing, or other providers.

## V1 Limitations

- Observability is scoped to `tools/app-shell`.
- `packages/apps-sdk` does not receive observability context yet.
- Broad business-event instrumentation is not included.
- Sentry PII behavior is preserved for compatibility, but product analytics
  payloads remain allowlisted and redacted.
