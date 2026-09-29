# Telemetry data egress (ETP-4577, ETP-4578)

What the Etendo Go browser app can send to third-party telemetry providers, what stops it,
and what is still an open decision. Owners and legal data are **not** filled in here: every
`TBD(owner)` below is a gap that needs a named person before this inventory is approved.

## How data leaves

```
app code ──▶ host facade ──▶ gateway (sanitize: allowlist + value scrub) ──▶ adapter ──▶ SDK ──▶ provider
                                                                                ▲
SDK-native traffic (global error handlers, automatic breadcrumbs, tracing, ─────┘
page views, HTTP timing) ── never touches the gateway, so it is sanitized by the SDK's own
egress hooks, which the adapters install.
```

- **Deny by default.** A payload key survives only if it is in the caller's `allowedKeys`,
  at any depth. `sanitizeValue()` never throws; on failure the value becomes `[REDACTED]`.
- **Value scrub.** Even an allowed key's string value is checked for bearer tokens, JWTs,
  emails and opaque high-entropy runs; query strings and fragments of URLs and paths embedded
  in any string are stripped; id-like path segments collapse.
- **Key names.** An allowed key whose NAME looks sensitive (`session_id`, `token_count`) is
  `[REDACTED]` unless it is also listed in `trustedKeys` (a reviewed, explicit exemption that
  never widens the allowlist and never skips the value scrub).
- **Routes.** `normalizeRoute()` drops query and fragment. An id segment (numeric, or 12+
  characters mixing letters and digits) becomes `:id`; a record's own page, `/<screen>/<id>`,
  becomes `/<screen>/:recordId`. **Visible change (C6):** the two-segment form used to be
  `/<screen>/:id` in the core and already was `:recordId` in the host, so anything grouped on
  the host's route pattern keeps its series. Words (`new`, `configuration-settings`) do not
  collapse. The measured comparison is frozen in `route-golden.test.js`.

## Inventory by provider

| | Sentry / GlitchTip | AWS CloudWatch RUM | Mixpanel |
|---|---|---|---|
| Purpose | Error capture, tracing | Browser performance, errors, HTTP timing | Product analytics |
| Default | Mandatory when a DSN is configured | **Off**; needs an explicit opt-in plus its IDs | **Off**; needs an explicit opt-in plus a token |
| Destination | The configured DSN host | `dataplane.rum.eu-west-3.amazonaws.com` | The configured API host (host setting `VITE_MIXPANEL_API_HOST`) |
| Owner / DPA | TBD(owner) | TBD(owner) | TBD(owner) |
| Interception point | `beforeSend`, `beforeSendTransaction`, `beforeSendSpan`, `beforeBreadcrumb` | `clientBuilder` wrapper, BEFORE the request is serialized and signed | `property_blacklist`, `before_send_events/people/groups`, `before_register(_once)` |
| Fixed settings | `sendDefaultPii: false` in every environment (no env override); `sampleRate: 1`; console breadcrumbs dropped | `allowCookies: false`, `enableXRay: false`; telemetries `performance`, `errors`, `http` | `ip: false`, `track_pageview: false`, `autocapture: false`, session recording 0% |
| What is rebuilt | Every event, field by field: user, request headers, cookies and query never sent; URLs and stacks scrubbed per frame | Every batch: identity, then each event's metadata and details through allowlists; `document.title` never sent | Event and people properties through allowlists; `$current_url` as a normalized path, `$referrer` dropped when external |
| Fails closed | An event the hook cannot rebuild is dropped | A batch that cannot be sanitized is dropped; if the SDK loses `defaultClientBuilder` nothing is sent | A payload a hook drops is never sent |

Everything an SDK appends AFTER its hooks (Sentry's `sdk` block: integration and package names
and versions, the `infer_ip` setting) is library identification, not user data, and is pinned
by the host's real-SDK tests so a new field turns them red.

## Kill switch

Independent of the sanitizer: `disable()` on the gateway, per provider or global, stops the
provider. A provider disabled BEFORE `init()` is never started (zero calls, its SDK is not
imported); one disabled after is shut down in place. After `init()`, a killed adapter the
gateway is not running (its init failed or timed out) is shut down too, once.

Contract for hosts: **call `init()` before anything else.** It is what starts adapters, and
before it a kill has nothing to stop. The host does this inside `initObservability()` and has
a test for it. The host drives the switch from a build default and from runtime flags (see the
host's `docs/ops/app-shell-observability.md`).

## Tests that prove it

Adapters are unit-tested with fakes here; the host's tests drive the REAL `@sentry/react`,
`mixpanel-browser` and `aws-rum-web` and read what would go on the wire, and each was checked
to fail against the previous provider code.

## Open items

- **Owners and legal data** for all three providers: `TBD(owner)`. Retention, DPA, region and
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
- **N6 and N7:** from the ETP-4578 review notes; to be written up here by the reviewer.
- **Rate limits and the 7-day observation window** in the ticket depend on the providers'
  own configuration and are outside this repository.
