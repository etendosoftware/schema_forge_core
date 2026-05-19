# Transactional Email Security Runbook

This runbook covers operational controls for transactional email in Etendo Go. Use it during implementation reviews, incidents, provider rotation, and production support.

## Security Boundary

The email provider is a backend-only dependency.

Never place these values in frontend code, generated artifacts, browser-visible JSON, screenshots, or committed fixtures:

- provider endpoint API key
- provider signing secret
- sender mailbox credentials
- internal provider URLs that are not public product endpoints
- raw message body from support custom sends

Frontend code may call only Etendo Go contract endpoints such as:

```http
POST /sws/neo/email-contracts/{contractName}/send
```

## Provider Configuration

Store provider configuration in server-side configuration only.

Recommended variables:

| Variable | Purpose |
|----------|---------|
| `ETGO_EMAIL_PROVIDER_BASE_URL` | Provider/API Gateway base URL |
| `ETGO_EMAIL_PROVIDER_API_KEY` | Secret API key |
| `ETGO_EMAIL_PROVIDER_TIMEOUT_MS` | Provider call timeout |
| `ETGO_EMAIL_PROVIDER_ENABLED` | Adapter-level kill switch |
| `ETGO_EMAIL_SENDER_ADDRESS` | Owned sender identity |
| `ETGO_EMAIL_SENDER_NAME` | Display sender name |

Configuration must be loaded at runtime by the backend. It must not be exported into Vite variables or any `public/` asset.

## Secret Rotation

Rotate provider credentials when onboarding the service, after suspected exposure, and on the regular security schedule.

Procedure:

1. Create a new provider key in the provider console.
2. Add the new key to the server secret store.
3. Deploy/restart the backend so the adapter uses the new key.
4. Send a test through a low-risk contract in staging.
5. Send a production smoke test to an internal mailbox.
6. Revoke the old provider key.
7. Check logs and metrics for `PROVIDER_FAILED` spikes.
8. Record the rotation in the operational change log.

If the key was exposed, also enable the provider kill switch until rotation is complete.

## Throttle Policy

Each contract defines its own limits, but operations must support these dimensions:

| Dimension | Example Use |
|-----------|-------------|
| User/account | Password reset and login alert bursts |
| Tenant/client | Tenant-level runaway workflows |
| Contract/template | Misconfigured contract or frontend loop |
| Recipient | Mailbox flooding |
| Domain | Abuse toward one customer domain |
| Source IP | Public auth endpoints |
| Record | Duplicate document sends |
| Global | Provider or reputation safety cap |

Throttle outcomes must be audited and counted as metrics. Do not call the provider after a throttle block.

## Suppression Policy

Suppression blocks delivery before provider submission.

Suppression sources:

- provider bounce or complaint events
- manual support suppression
- tenant-level disablement
- domain-level block
- legal or compliance block

Suppression records should include recipient or domain, reason, source, actor, timestamp, and optional expiry. Avoid storing full message content.

## Kill Switches

Kill switches are required at multiple levels.

| Switch | Scope | Expected Result |
|--------|-------|-----------------|
| Global email | All contracts | Return `KILL_SWITCHED`, audit, no provider call |
| Provider adapter | All provider calls | Return `KILL_SWITCHED` or `PROVIDER_FAILED` depending on state |
| Tenant/client | One tenant | Return `KILL_SWITCHED` for that tenant |
| Contract/template | One contract | Return `KILL_SWITCHED` for that contract |
| Recipient/domain | One target | Return `SUPPRESSED` |

Emergency response should prefer kill switches over code rollback when the risk is email abuse.

## Abuse Incident Response

Use this procedure when suspicious send volume, recipient complaints, or provider warnings appear.

1. Enable the narrowest effective kill switch.
2. Check metrics by contract, tenant, recipient, domain, and source IP.
3. Identify whether traffic came from UI, system job, public auth flow, or support/admin contract.
4. Review audit events for unauthorized attempts, throttle misses, duplicate keys, and custom HTML usage.
5. Suppress affected recipients or domains if required.
6. Rotate provider secrets if exposure is possible.
7. Patch the contract, throttle, or authorization gap.
8. Re-enable only after a staging smoke test and production canary.
9. Document the incident, root cause, affected contracts, and follow-up tickets.

## Bounce and Complaint Handling

When provider events are available:

- map hard bounces to recipient suppression
- map complaints to recipient or domain suppression depending on policy
- keep soft bounces as metrics first, then suppress after repeated failures
- audit provider event IDs and timestamps
- never expose bounce/complaint internals to general users

## Logging Rules

Structured logs should include:

- `requestId`
- `auditId`
- `contract`
- `version`
- `tenantId`
- `userId`
- `recordId` when applicable
- `status`
- `throttleBucket` when blocked
- `providerStatus` without provider secret values
- `durationMs`

Do not log:

- provider API keys
- reset tokens
- full message body
- raw HTML from custom sends
- complete recipient lists for bulk-like support operations

## Metrics and Alerts

Required metrics:

| Metric | Type | Labels |
|--------|------|--------|
| `sf_email_send_total` | Counter | contract, version, tenant, status |
| `sf_email_provider_duration_seconds` | Histogram | provider, contract, status |
| `sf_email_throttle_total` | Counter | contract, tenant, throttle_bucket |
| `sf_email_duplicate_total` | Counter | contract, tenant |
| `sf_email_suppression_total` | Counter | contract, tenant, reason |
| `sf_email_kill_switch_total` | Counter | scope, contract, tenant |
| `sf_email_provider_error_total` | Counter | provider, contract, error_class |

Recommended alerts:

- provider failure rate above threshold for 5 minutes
- throttled sends spike for one contract or tenant
- global send volume exceeds expected baseline
- suppression or complaint rate spikes
- kill switch activated
- custom support contract used outside expected support hours or volume

## Production Smoke Test

Use a controlled internal mailbox and a low-risk contract.

Checklist:

1. Confirm provider key is configured only server-side.
2. Confirm the contract is enabled for the test tenant.
3. Send one email with a unique idempotency key.
4. Repeat the same command and verify `DUPLICATE`.
5. Trigger a throttle scenario in staging, not production.
6. Confirm audit, metrics, and logs contain request IDs and no secrets.
7. Confirm the frontend maps success and duplicate states correctly.

## Custom Contract Review

Before enabling any controlled custom contract:

- role access is limited to support/admin roles
- every send requires a reason
- HTML sanitizer rejects scripts, event handlers, unsafe links, and tracking pixels unless explicitly allowed by policy
- throttle is stricter than fixed transactional contracts
- body storage is redacted or avoided in audit
- Reply-To uses allowlisted support mailboxes only
- metrics distinguish custom sends from fixed-template sends

## Local and CI Expectations

Documentation-only changes should at minimum pass whitespace checks and repository tests that are reasonable for the scope. Behavior changes must also pass the relevant backend/frontend tests and must account for the conditional Jenkins Etendo Go regeneration gate. If Jenkins is flaky, record the failing run and rerun once before treating it as a product failure.
