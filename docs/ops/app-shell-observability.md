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

Sentry defaults to `sendDefaultPii: false`. Only enable it with an explicit
environment override after reviewing the privacy and legal impact. Release is
set from `VITE_SENTRY_RELEASE` when present, otherwise from available build
metadata such as `SENTRY_RELEASE.id` injected at build time.

AWS RUM uses hostname-gated configuration for staging, experimental, and
production (`go.etendo.cloud`). `VITE_RUM_SESSION_SAMPLE_RATE` is parsed as a
bounded number from `0` to `1`; invalid or missing values fall back to the
conservative default `0.1`. Missing host config is still a no-op.

Mixpanel is opt-in. If `VITE_MIXPANEL_ENABLED=true` is set without
`VITE_MIXPANEL_TOKEN`, the provider logs a warning and remains disabled. The SDK
is lazy-loaded only when the provider is enabled and used.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SENTRY_DSN` | Enables Sentry. |
| `VITE_SENTRY_RELEASE` | Optional explicit Sentry release. If unset, the app falls back to available build metadata. |
| `VITE_SENTRY_SEND_DEFAULT_PII` | Optional explicit Sentry PII gate. Defaults to `false`; set to `true` only with approved privacy review. |
| `VITE_RUM_APP_MONITOR_ID_STAGING` | CloudWatch RUM app monitor for `go.staging.etendo.cloud`. |
| `VITE_RUM_IDENTITY_POOL_ID_STAGING` | CloudWatch RUM identity pool for staging. |
| `VITE_RUM_APP_MONITOR_ID_EXPERIMENTAL` | CloudWatch RUM app monitor for `go.experimental.etendo.cloud`. |
| `VITE_RUM_IDENTITY_POOL_ID_EXPERIMENTAL` | CloudWatch RUM identity pool for experimental. |
| `VITE_RUM_APP_MONITOR_ID_PROD` | CloudWatch RUM app monitor for `go.etendo.cloud`. |
| `VITE_RUM_IDENTITY_POOL_ID_PROD` | CloudWatch RUM identity pool for `go.etendo.cloud`. |
| `VITE_RUM_SESSION_SAMPLE_RATE` | Optional RUM session sample rate. Values are clamped to `0..1`; invalid values fall back to `0.1`. |
| `VITE_MIXPANEL_ENABLED` | Set to `true` to enable Mixpanel. |
| `VITE_MIXPANEL_TOKEN` | Mixpanel project token. Required when Mixpanel is enabled. |
| `VITE_MIXPANEL_DEBUG` | Optional Mixpanel debug flag. |
| `VITE_MIXPANEL_API_HOST` | Optional custom Mixpanel API host. |

## Events

Event definitions live in
`tools/app-shell/src/lib/observability/events.js`. Add new product events there
first, then use `buildObservabilityEvent()` at call sites so only the
catalog-approved properties are passed to `track`.

The app currently emits these base lifecycle events:

| Event | When |
|-------|------|
| `app_started` | After browser observability initialization completes. |
| `page_view` | On initial route mount and each pathname change. |

Route tracking ignores query-string and hash-only changes.

The app also emits onboarding product events:

| Event | When |
|-------|------|
| `onboarding_auth_submitted` | Login or registration is submitted. |
| `onboarding_auth_succeeded` | Login or registration succeeds. |
| `onboarding_auth_failed` | Login or registration fails. |
| `onboarding_auth_logout` | The user logs out from onboarding. |
| `onboarding_setup_step_completed` | A setup step is completed. |
| `onboarding_setup_step_back` | The user moves back from a setup step. |
| `onboarding_run_started` | Environment creation starts. |
| `onboarding_run_succeeded` | Environment creation succeeds. |
| `onboarding_run_failed` | Environment creation fails. |
| `onboarding_environment_enter_submitted` | Environment entry starts. |
| `onboarding_environment_enter_succeeded` | Environment entry succeeds. |
| `onboarding_environment_enter_failed` | Environment entry fails. |

Broader business KPI events such as CRUD actions, filters, document processing,
backend checks, NPS, and timing events are catalogued for ETP-4214, but each
caller still needs explicit instrumentation and tests before the event is
considered emitted in production.

## Timing Metrics

Use `startTiming()` or `useTiming()` from `tools/app-shell/src/lib/observability`
for same-session duration metrics. Timing helpers only emit catalog-backed
events and add a rounded, non-negative `durationMs` value.

```js
import { OBSERVABILITY_EVENTS } from '../lib/observability/events.js';
import { startTiming } from '../lib/observability/timing.js';

const stop = startTiming(OBSERVABILITY_EVENTS.TIME_TO_CREATE, {
  properties: {
    category: 'sales',
    entity: 'sales_order',
    operation: 'create',
    specName: 'sales-order',
  },
});

await stop({ status: 'success' });
```

## Privacy Rules

Payloads are normalized before providers receive them:

- Allowed common fields: `app`, `environment`, `hostname`, `mockMode`, `route`,
  `routePattern`, `timestamp`, and `windowName`.
- Allowed KPI numeric fields: `accuracy`, `attempt`, `count`, `durationMs`,
  `position`, `score`, `step`, and `value`. These must be finite numbers within
  their configured bounds; strings and booleans are dropped for numeric keys.
- Allowed low-cardinality metadata fields include `action`, `category`,
  `component`, `enabled`, `entity`, `event`, `locale`, `operation`, `provider`,
  `source`, `specName`, `status`, `supportRequested`, and `type`.
- Query strings, hashes, raw URLs, OAuth `code`/`state`, tokens, record IDs,
  document IDs, document numbers, labels, and names are stripped.
- Record-detail paths such as `/sales-order/ABC123` are emitted as
  `/sales-order/:recordId`.
- Nested opaque IDs are emitted as `:id`.

Do not pass free-form user-entered values to `track`, `page`, or future business
events. Add new event fields to the allowlist only when they are stable,
non-sensitive product metadata.

## Adding Business Events

Use the shared API from the app-shell observability facade:

```js
import { track } from '../lib/observability.js';
```

Event names should be lowercase `snake_case`, describe the product action, and
avoid implementation details. Prefer names such as `onboarding_setup_step_completed`
or `fiscal_setup_started`; avoid names with route IDs, document numbers, user
names, or UI copy.

Business event payloads are allowlisted. Only these keys are emitted:

`action`, `accuracy`, `app`, `attempt`, `category`, `component`, `count`,
`durationMs`, `enabled`, `entity`, `environment`, `event`, `hostname`, `locale`,
`mockMode`, `operation`, `position`, `provider`, `route`, `routePattern`,
`score`, `source`, `specName`, `status`, `step`, `supportRequested`,
`timestamp`, `type`, `value`, and `windowName`.

Values must be stable, low-cardinality product metadata. Do not send PII,
free-form text, raw URLs, OAuth values, tokens, record IDs, document IDs,
document numbers, customer names, labels, or user-entered values. Unknown keys
and denylisted keys are stripped before providers receive the payload, but call
sites should still avoid constructing sensitive payloads.

Prefer fire-and-forget dispatch from UI handlers so analytics never blocks the
workflow:

```js
void track('onboarding_step_completed', {
  action: 'complete',
  component: 'onboarding_wizard',
  source: 'company_profile',
  status: 'success',
  type: 'initial_setup',
});
```

Do not await `track` in render paths or user-facing flows unless the caller is a
test or an explicit observability lifecycle step. Provider failures are logged
and isolated by the registry.

Expected tests for new instrumentation:

- Unit test the caller with a mocked `track` and assert the event name and safe
  payload.
- Add payload normalization coverage when a new allowed field is needed.
- Assert sensitive values are not passed by the caller, not only that the
  sanitizer removes them.
- Keep disabled-provider and provider-failure behavior covered in observability
  adapter tests when provider behavior changes.

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
- Product analytics payloads remain allowlisted and redacted even when Sentry is
  enabled.
