# Datadog monitor — intermittent Google SSO 403s

> **Status:** SPECIFICATION, not activated. This file defines the monitor so a human
> with Datadog access can create it in one step. It is deliberately **not** applied
> by CI: this repository has no Datadog credentials and no monitor-as-code pipeline
> (no `terraform/`, no `monitors.yaml`; `docs/architecture/10-observability.md` in
> `schema_forge` still lists alerting as "None"). If you are reading this while
> on call, the alert does not exist yet.
>
> **Ticket:** ETP-5679 · **First seen:** 2026-10-08 · **Owner:** platform
>
> **Scope note.** ETP-5679 explicitly forbids application code changes. Nothing
> under `src/`, no servlet, no SPA file and no window artifact is touched by this
> ticket. The observability gap described in [What a 403 actually
> means](#what-a-403-actually-means) would be closed by a code change, so it is
> recorded here as a follow-up instead of fixed here.

## Why this monitor exists

On **2026-10-08** production returned `403` for two `POST` requests to
`/etendo/sws/go/session/sso/google`, at `12:17:20Z` and `12:17:28Z` — eight
seconds apart. The requests were visible at CloudFront and at the ALB. No
correlated etendo-core error log, RUM event or APM span was found.

Two 403s inside ten minutes is the threshold this monitor uses. **A single 403 is
an investigation signal, not an incident** and must not page anyone.

## The endpoint

| Property | Value | Source |
| --- | --- | --- |
| Public path | `POST /etendo/sws/go/session/sso/google` | `packages/etendo-go-core/src/onboarding/api.js:209`, asserted in `packages/etendo-go-core/test/api.test.js:132` |
| Servlet route | `dispatchSessionPost` → prefix `/session/sso/` → `handleSessionCreateSso` | `com.etendoerp.go` `src/com/etendoerp/go/rest/EtendoGoJwtServlet.java` (~line 661) |
| Servlet prefix | `/sws/go` (WAD) inside the Tomcat context `/etendo` | `src-db/database/sourcedata/AD_MODEL_OBJECT.xml`, "EtendoGo JWT Servlet" |
| Edge topology | CloudFront → ALB → Tomcat, `/etendo/*` behavior | [`../cloudfront-alb-routing.md`](../cloudfront-alb-routing.md) |

`/etendo` is the Tomcat context path and is backend configuration — it can differ
per deployment. The monitor query below matches production as it is deployed; if
a deployment uses a different context path, adjust the path facet to match.

## The search expression, exactly as requested

```
@http.url_details.path:/etendo/sws/go/session/sso/google @http.status_code:403
```

This is the search expression from ETP-5679, kept verbatim. It is what you run
ad hoc in Logs Explorer; the monitor wraps it with the aggregation and the window
(see [Monitor definition](#monitor-definition)).

## Recommended query — the deduplicated form

**Read this before activating the query above.**

One viewer request produces **two** edge log lines: one at CloudFront and one at
the ALB. If both are ingested into the same Datadog source, the query above counts
each failure **twice**, so a `count >= 2` threshold is met by a **single**
failing request — which directly contradicts the rule that a single 403 is not an
incident.

The 403 on this route is produced by the **backend** (`EtendoGoJwtServlet` /
`EtendoGoGoogleIdentityVerifier`), not by the edge, so the ALB line is the one that
reflects the backend's answer. Count the ALB source only:

```
@http.url_details.path:/etendo/sws/go/session/sso/google @http.status_code:403 @<alb-source-facet>:<alb-source-name>
```

In the monitor's `query` field that expression is wrapped, with the same window
and threshold as above:

```
logs("@http.url_details.path:/etendo/sws/go/session/sso/google @http.status_code:403 @<alb-source-facet>:<alb-source-name>").index("*").rollup("count").last("10m") >= 2
```

`<alb-source-facet>` / `<alb-source-name>` are **placeholders on purpose.** The
facet and source names under which ALB logs are ingested are not documented in any
repository and cannot be discovered without Datadog access. Determine them at
activation time by running the base query in the Datadog Logs Explorer and reading
the source facet off a live 403 line — then pin the facet here.

## Monitor definition

Datadog log monitor. Importable via the Datadog API (`POST /api/v1/monitor`) or
the UI "Import JSON" dialog.

The `query` field uses the **log-monitor query form**, not a bare search string:

```
logs("<search>").index("*").rollup("count").last("10m") >= 2
```

- `rollup("count")` — the value evaluated against the threshold is the number of
  matching log events.
- `last("10m")` — **the ten-minute window is enforced here.** Without it the
  monitor has no evaluation period and the "at least 2 in 10 minutes" rule is not
  expressed at all; `thresholds.critical` alone only compares against whatever
  range `last()` names.
- `index("*")` — matches every log index the search can reach.

`<search>` is the search expression below, wrapped in double quotes. Keep the raw
expression (without the wrapper) to run it ad hoc in Logs Explorer.

```json
{
  "name": "[GO] Google SSO authorization failures (>=2 403s / 10m)",
  "type": "log alert",
  "query": "logs(\"@http.url_details.path:/etendo/sws/go/session/sso/google @http.status_code:403\").index(\"*\").rollup(\"count\").last(\"10m\") >= 2",
  "message": "@slack-oncall\nGoogle SSO authorization is failing: {{value}} HTTP 403 responses on POST /etendo/sws/go/session/sso/google in the last 10 minutes.\n\nAlert triggered (UTC): {{last_triggered_at}}\nprovider=google  path=/etendo/sws/go/session/sso/google  status=403  count={{value}}\n\nLog query:\nhttps://app.datadoghq.com/logs?query=%40http.url_details.path%3A%2Fetendo%2Fsws%2Fgo%2Fsession%2Fsso%2Fgoogle%20%40http.status_code%3A403\n\nA single 403 is an investigation signal and does not page. The only 403 on this\nroute is a CSRF double-submit rejection that logs nothing, so a backend log\nsearch will return no correlated line. See\nschema_forge_core/docs/ops/datadog-monitors/google-sso-403.md for triage.",
  "tags": ["service:go", "component:auth", "type:sso", "severity:low"],
  "options": {
    "thresholds": {
      "critical": 2
    },
    "renotify_interval": 60,
    "renotify_evaluated": true,
    "renotify_no_data": false,
    "notify_no_data": false,
    "evaluation_delay": 0,
    "new_group_delay": 0,
    "timeout_h": 0,
    "include_metrics": false,
    "no_data_timeframe": 20,
    "notify_audit": false,
    "silence_duration": 0
  },
  "priority": 5
}
```

### Settings, and why each one

| Setting | Value | Reason |
| --- | --- | --- |
| `type` | `log alert` | The signal lives in edge access logs, not in a metric. A log monitor is the only Datadog monitor type that reads them. |
| `query` | `logs("…").index("*").rollup("count").last("10m") >= 2` | Carries the search, the aggregation, **and the ten-minute window**. `last("10m")` is what makes "at least 2 in 10 minutes" true; `thresholds.critical` then compares the resulting count against `2`. |
| `thresholds.critical` | `2` | The ticket's rule: alert at two or more 403s in ten minutes. One 403 pages nobody. |
| `renotify_interval` / `renotify_evaluated` | `60` / `true` | Re-notifies hourly while the condition is still true, so a persistent failure does not go quiet after one page. |
| `notify_no_data` / `renotify_no_data` | `false` | Silence from the edge source is an ingestion problem, not an SSO incident. Paging on it would be noise. |
| `no_data_timeframe` | `20` | Twice the evaluation window, so a genuinely empty result does not immediately report "no data". |
| `priority` | `5` | Lowest urgency: an investigation signal, not a customer outage. |
| `silence_duration` | `0` | Downtime maintenance must not silently mute a real auth failure. |

### Notification template — field by field

The template carries **only** the five elements the ticket asks for:

| Required element | Rendered by | Variable |
| --- | --- | --- |
| UTC timestamp | the alert evaluation time, rendered in UTC | `{{last_triggered_at}}` |
| provider | literal text | `provider=google` |
| path | literal text | `path=/etendo/sws/go/session/sso/google` |
| HTTP status | literal text | `status=403` |
| link to the log query | the Logs Explorer URL | — (static link) |

The evaluated count also appears, as `{{value}}` — Datadog exposes the rolled-up
`count` under `{{value}}`; `{{count}}` is not a Datadog template variable and would
render empty.

`{{last_triggered_at}}` is the alert evaluation time, not a per-log-event
timestamp. A log monitor evaluates over a window rather than per event, so a
per-event timestamp (`{{log.timestamp}}`) has no single value to report here; the
Logs Explorer link is what takes the on-call to the individual events.

The on-call channel is the `@slack-oncall` handle in the template. Replace it with
the real channel identifier at activation time; no repository documents it.

## Never add these to the monitor

The ticket forbids it, and on **this specific route** it is a real hazard rather
than a formality: the 403 we are monitoring is a **CSRF double-submit rejection**
(see below). Any facet or template field that surfaces the offending value turns a
security signal into a leaked secret.

- Credentials, API keys, `Authorization` headers
- **The `g_csrf_token` value — never, in any field, on this route**
- Cookies of any kind (the session cookie, `g_csrf_token`)
- Google callback codes, ID tokens, or any assertion
- Email addresses
- Raw request or response bodies

If a future change needs one of these to diagnose something, that change belongs
to its own ticket with its own review — not here.

## What a 403 actually means

**Read this before writing any investigation.** It is the reason the reported
symptom produced no backend log, and it changes what an on-call engineer should
look at.

The SSO route has exactly **one** code path that can answer `403`, and it writes
**no log**:

`EtendoGoGoogleIdentityVerifier.validateCsrfTokenIfPresent`
(`com.etendoerp.go`, `src/com/etendoerp/go/rest/EtendoGoGoogleIdentityVerifier.java`,
lines 163–175) throws, at line 173,

```java
throw new EtendoGoSsoAssertionException(HttpServletResponse.SC_FORBIDDEN,
    "Invalid Google CSRF token");
```

when the request body carries a `g_csrf_token` whose value does not match the
`g_csrf_token` cookie (constant-time compare via `MessageDigest.isEqual`).
`EtendoGoJwtServlet.handleSessionCreateSso` catches it and returns
`writeError(statusCode, message)` — with no `log.warn`, which is exactly why the
2026-10-08 pair produced no etendo-core error log, no RUM event and no APM span.

Every other status on this route is a different value, so **a 403 on this path is a
CSRF double-submit mismatch**:

| Status | Meaning | Source |
| --- | --- | --- |
| `400` | Malformed body, missing/unreadable CSRF cookie | `decode`, `badRequest` |
| `401` | Google credential audience not in the configured client IDs | `validateClientId` → `unauthorized` |
| `403` | **CSRF token mismatch only** | `validateCsrfTokenIfPresent` |
| `404` | Unknown provider | `EtendoGoSsoProviderRegistry:76` |
| `503` | Google token validation unavailable | `EtendoGoGoogleIdentityVerifier:91` |

A `403` here is the CSRF control **working as designed**. Common non-incident
causes: a stale tab whose `g_csrf_token` was replaced by a newer sign-in; a
sign-in attempt racing an account switch; a browser extension rewriting the
request. `docs/adr/0001-backend-managed-session.md` (D4) and
`docs/onboarding-flow.md` both record that the GIS **callback flow is not gated** on
the cookie — the token is only validated when a flow actually sends one, so a
present-but-stale token is the expected shape of a benign 403.

**Do not propose a code change on the strength of an alert alone.** Two 403s from
one stale tab is not a defect.

## Triage

1. **Check whether it is one user or many.** Two 403s eight seconds apart, as on
   2026-10-08, is the signature of a single browser tab retrying — most likely a
   stale tab whose `g_csrf_token` was rotated by a newer sign-in. Confirm by
   grouping the log lines on the source IP / user agent before anything else.
2. **If several users hit it at once**, it stops being benign. Escalate per the
   table above: a burst of `401` is an audience/client-id configuration problem,
   a burst of `503` is Google-side.
3. **Correlating with backend logs will show nothing** for this 403. That is not
   an investigation failure; see the section above. The absent signal is the
   reason the follow-up in ETP-5679 ("correlate with the edge requests with
   provider status and backend logs") is **not executable as written**.

## Known limitations

- **Not activated.** No Datadog API/app key exists in the development
  environment and none is stored in this repository; creating the monitor requires
  a human with Datadog access.
- **The source facet is unresolved.** `Recommended query` above is a template until
  someone reads the real source names off a live log line.
- **A single 403 is invisible to this monitor** by design. That is the ticket's
  requirement, not an oversight; grep the same query in Logs Explorer when
  investigating a single occurrence.
- **The 403 leaves no backend trace.** This is the limitation with the real cost:
  the ticket's own follow-up step cannot be performed. Closing it means logging
  the CSRF rejection at `warn` — application code, therefore out of scope here, and
  the recommended follow-up.

## Activation checklist

- [ ] Confirm the Tomcat context path in the target environment is `/etendo`
      (production as documented; it is backend configuration).
- [ ] Run the base query in Logs Explorer; confirm it returns lines for
      `@http.status_code:403` on this path.
- [ ] Read the source facet off a live 403 line and decide whether CloudFront and
      ALB share a source. If they do, pin the ALB facet as in *Recommended query*.
- [ ] Replace `@slack-oncall` with the real platform/on-call channel.
- [ ] Create the monitor (API or UI import), leaving it **muted**.
- [ ] Send a test notification and confirm the five required fields render and
      nothing forbidden is present.
- [ ] Unmute, and record the monitor ID and its Datadog dashboard link here.

## Change log

- **2026-10-22** — ETP-5679. Monitor specified from the reported 2026-10-08
  evidence. Not activated. Recorded that the route's only 403 is a CSRF
  double-submit rejection which logs nothing, and that the deduplicated query must
  pin the ALB source so a single failure cannot meet the two-in-ten-minutes
  threshold.