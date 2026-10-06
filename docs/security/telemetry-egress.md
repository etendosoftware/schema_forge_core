# Telemetry data egress (ETP-4577, ETP-4578)

What the Etendo Go browser app can send to third-party telemetry providers, what stops it,
and what is still an open decision. Owners and legal data are **not** filled in here: every
`TBD(owner)` below is a gap that needs a named person before this inventory is approved.

## How data leaves

```
app code ──▶ host facade ──▶ gateway (sanitize: allowlist + value scrub) ──▶ adapter ──▶ SDK ──▶ provider
                                                                                ▲
SDK-native traffic (global error handlers, automatic breadcrumbs, tracing, ─────┘
page views, HTTP timing) ── never touches the gateway. Where the SDK offers an egress hook,
the adapter installs one. Some SDK traffic has no hook at all: Sentry's sessions and client
reports pass through none and are stopped only by the kill switch (see N4 below).
```

- **Deny by default.** A payload key survives only if it is in the caller's `allowedKeys`,
  at any depth. `sanitizeValue()` never throws; on failure the value becomes `[REDACTED]`.
- **Value scrub.** Even an allowed key's string value is checked for bearer tokens, JWTs,
  emails and opaque high-entropy runs; query strings and fragments of URLs and paths embedded
  in any string are stripped; id-like path segments collapse.
- **Key names.** An allowed key whose NAME looks sensitive (`session_id`, `token_count`) is
  `[REDACTED]` unless it is also listed in `trustedKeys` (a reviewed, explicit exemption that
  never widens the allowlist and never skips the value scrub). Names that can carry credentials
  (`password`, `secret`, `cookie`, `authorization`, `credential`, `apiKey`, `accessKey`,
  `privateKey`, `creditCard`, `cardNumber`, `bearer`, `pwd`, `jwt`, …) are never trustable:
  they are ignored with one warning, because the value scrub only catches long or token-shaped
  secrets and would let `hunter2` or `sid=abc123` through. **The host must pass the same
  `trustedKeys` to the gateway and to each adapter separately.** If they differ, the adapter
  redacts what the gateway let through (it fails closed, but the data is lost).
- **Routes.** `normalizeRoute()` drops query and fragment. An id segment (numeric, or 12+
  characters mixing letters and digits) becomes `:id`; a record's own page, `/<screen>/<id>`,
  becomes `/<screen>/:recordId`. **Visible change (C6):** the two-segment form used to be
  `/<screen>/:id` in the core and already was `:recordId` in the host, so anything grouped on
  the host's route pattern keeps its series. Words (`new`, `configuration-settings`) do not
  collapse. The measured comparison is frozen in `route-golden.test.js`.

## Inventory by provider

| | Datadog Browser RUM | Sentry / GlitchTip | AWS CloudWatch RUM | Mixpanel |
|---|---|---|---|---|
| Purpose | Sessions, views, errors, HTTP timing, user actions, web vitals, session replay, backend trace correlation | Error capture, tracing | Browser performance, errors, HTTP timing | Product analytics |
| Default | **Off**; needs an explicit opt-in plus application id, client token, site and env | Mandatory when a DSN is configured | **Off**; needs an explicit opt-in plus its IDs | **Off**; needs an explicit opt-in plus a token |
| Destination | The configured Datadog site (`datadoghq.eu`); trace headers to the configured API origins, `/sws/neo` only | The configured DSN host | `dataplane.rum.eu-west-3.amazonaws.com`, plus `cognito-identity` for credentials (N7) | The configured API host (host setting `VITE_MIXPANEL_API_HOST`) |
| Owner / DPA | TBD(owner) | TBD(owner) | TBD(owner) | TBD(owner) |
| Interception point | `beforeSend` (the SDK applies only changes to its list of modifiable fields per event type) | `beforeSend`, `beforeSendTransaction`, `beforeSendSpan`, `beforeBreadcrumb` | `clientBuilder` wrapper, BEFORE the request is serialized and signed | `property_blacklist`, `before_send_events/people/groups`, `before_register(_once)` |
| Fixed settings (not configurable) | `defaultPrivacyLevel: 'mask'`, `enablePrivacyForActionName: true`, manual views, no resource headers, `traceContextInjection: 'sampled'` | `sendDefaultPii: false` in every environment (no env override); `sampleRate: 1` | `enableXRay: false` | `track_pageview: false`, `autocapture: false`, session recording 0% |
| Defaults (configurable by the host) | sessions 100%, session replay 20%, traces 20%; no trace propagation and no remote configuration unless configured | `tracesSampleRate: 0.1`; console breadcrumbs dropped (`keepConsoleBreadcrumbs`); no request headers (`approvedRequestHeaders`) | `allowCookies: false`; telemetries `performance`, `errors`, `http`; session sample rate 0.1 | `ip: false` (`trackIp`); persistence `cookie` (`persistence`); URLs as a normalized path (`urlPropertyMode`) |
| What is rewritten | Each modifiable field that can carry user data: view, referrer, resource, LCP and long-task URLs normalized and scrubbed; error message, stack and handling stack scrubbed; action names scrubbed; context through the allowlist; headers emptied. `usr`/`account` are not modifiable, so only their `id` is ever set | Every event, field by field: no request headers unless approved (none by default); user, cookies and query never sent; URLs and stacks scrubbed per frame | Every batch: identity, then each event's metadata and details through allowlists; `document.title` never sent | Event and people properties through allowlists; `$current_url` as a normalized path, `$referrer` dropped when external |
| Fails closed | An event the hook cannot sanitize is dropped (views cannot be dropped by the SDK; see the kill switch) | An event the hook cannot rebuild is dropped | A batch that cannot be sanitized is dropped; if the SDK loses `defaultClientBuilder` nothing is sent | A payload a hook drops is never sent |

Sentry is no longer wired by the host since ETP-5605 replaced it with Datadog; its adapter stays
here, inert without a DSN.

Everything an SDK appends AFTER its hooks (Sentry's `sdk` block: integration and package names
and versions, the `infer_ip` setting) is library identification, not user data, and is pinned
by the host's real-SDK tests so a new field turns them red.

## Kill switch

Independent of the sanitizer: `disable()` on the gateway, per provider or global, stops the
provider. A provider disabled BEFORE `init()` is never started (zero calls, its SDK is not
imported); one disabled after is shut down in place. After `init()`, a killed adapter the
gateway is not running (its init failed or timed out) is shut down too, once.

Contract for hosts: **call `init()` before anything else.** It is what starts adapters. Calls
made before it are dispatched to adapters that have not been started: Mixpanel loads its SDK
on the first call, and a kill that lands during that load is not respected (3 requests went
out in the `firstload2` probe). A kill before `init()` only helps when `init()` follows it.
The host does this inside `initObservability()` and has a test for it. The host drives the switch from a build default and from runtime flags (see the
host's `docs/ops/app-shell-observability.md`).

Datadog cannot drop a view event from `beforeSend`, so its kill withdraws tracking consent
(`setTrackingConsent('not-granted')`, which stops collection and sending) and `beforeSend` drops
every other event still in flight; reviving it grants consent again, which starts a new session.

Note (NB-E): after `init()`, a kill also shuts down an adapter whose `enabled` is `false` and
that never started. For Sentry that means `getClient()` and `close()` on the global client.
It is harmless when Sentry was never initialized, and is left as is on purpose.

## Tests that prove it

Adapters are unit-tested with fakes here; the host's tests drive the REAL `@sentry/react`,
`mixpanel-browser` and `aws-rum-web` and read what would go on the wire, and each was checked
to fail against the previous provider code.

## Open items

- **Owners and legal data** for all four providers: `TBD(owner)`. Retention, DPA, region and
  sub-processors per provider: `TBD(owner)`.
- **RUM cookies.** `allowCookies` is off by default. Turning it on needs a consent decision:
  `TBD(owner)` (Privacy).
- **Mixpanel persistence.** The SDK keeps identity and super-properties in a first-party
  cookie by default, which is not governed by cookie consent. `localStorage` is supported.
  Decision: `TBD(owner)`.
- **Mixpanel `$name` and identify id.** `$name` goes only behind an explicit allowlist; the
  identify id is a host decision (D6/D10). `TBD(owner)`.
- **Group super-property.** Mixpanel's group super-property is filtered by `before_register`
  when its key is not in the allowlist (NB-4).
- **Sentry `browserSessionIntegration` (N4).** An SDK default integration; whether its session
  envelopes must be disabled or filtered: `TBD(owner)`.
- **Re-enabling Sentry** after a kill restarts the SDK (`init()` clears its stopped state).
  Whether a remote flag may re-enable it within a page lifetime: `TBD(owner)`.
- **N6 (RUM): an orphan SDK after a failed construction.** If `new AwsRum(...)` throws part
  way through, the SDK is left half built and `shutdown()` cannot reach it, because the
  adapter's `rum` variable stays undefined. Observed with the real SDK in jsdom: after an
  "init failed" warning, 2 calls to Cognito and 1 PUT still went out. The throw was provoked
  by APIs jsdom lacks (`History`, `performance.getEntriesByType`, `self`), so this is a limit
  of a half-finished construction, not a failure observed in a real browser. Possible
  mitigation: mark the adapter permanently failed and document it. `TBD(owner)`.
- **N7 (RUM): an extra endpoint and local storage.** On init the SDK makes 2 calls to
  `cognito-identity` before any event (measured with a session sample rate of 1; sessions
  that are not sampled were not verified). The Cognito identity id and the temporary
  credentials are kept in `localStorage` even when `allowCookies` is false
  (`CognitoIdentityClient.js:78`, `EnhancedAuthentication.js:87` and, in the basic
  authentication flow, `BasicAuthentication.js:96` in `aws-rum-web`). They
  are not telemetry data, but they belong in this inventory as local storage and as an
  additional endpoint (`cognito-identity`).
- **Datadog session cookie.** The SDK keeps its session in a first-party cookie (`_dd_s`); with
  session replay at 20% it also records the DOM, masked (`defaultPrivacyLevel: 'mask'`).
  Consent decision for both: `TBD(owner)` (Privacy).
- **Datadog remote configuration.** Off unless the host passes `remoteConfigurationId`. When on,
  the Datadog UI can change the privacy level, the tracing URLs and the user and global context,
  outside code review; `beforeSend` still applies to the context, but not to `usr`.
- **Datadog error causes.** `error.causes` is not in the SDK's modifiable list, so a cause
  message cannot be scrubbed in `beforeSend`. Errors reported through the gateway carry no
  causes; an unhandled error with a `cause` chain can. `TBD(owner)`.
- **Rate limits and the 7-day observation window** in the ticket depend on the providers'
  own configuration and are outside this repository.
