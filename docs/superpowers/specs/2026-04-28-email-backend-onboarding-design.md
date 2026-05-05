# Backend-Owned Email Sending + Onboarding Test Email

## Summary

Introduce a backend-owned email capability that hides the external AWS email endpoint behind an internal Schema Forge / NEO API. The backend becomes the sole owner of provider configuration, template validation, payload construction, error mapping, and observability. The first product consumer is the onboarding wizard email step, which uses a dedicated test-email action instead of talking to the provider directly.

## Context

The product already has an external email provider endpoint available at AWS API Gateway with an API key and a small initial template catalog:

- `reset-password` → `name`, `link`
- `login-alert` → `name`, `ip`, `date`
- `invoice` → `name`, `invoice_number`, `amount`, `download_link`
- `custom` → `subject`, `body`

The onboarding flow already expects email configuration and a test send before the setup is considered complete. The repository direction for this work is explicit: delegate email handling to the backend as much as possible.

## Goal

Build the minimum clean backend email abstraction that:

1. owns the AWS provider integration server-side
2. exposes an internal API stable enough for future email flows such as invoice sending
3. validates template names and required variables before calling the provider
4. powers onboarding step 4 with a dedicated "send test email" flow
5. keeps secrets and provider details out of the frontend
6. leaves the platform prepared for additional consumers without redesigning the integration boundary

## Non-Goals

This design intentionally does **not** include:

- direct frontend calls to AWS API Gateway
- durable outbox / queue / retry workers
- bulk email sending
- message open / click tracking
- multi-provider routing or failover
- wiring `reset-password`, `login-alert`, or `invoice` into live product flows in this first cut

## Decision Summary

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Ownership | Backend-only provider integration | Keeps API key, provider URL, validation, and error mapping out of the frontend |
| Internal API shape | Separate `sendTemplateEmail` and `sendTestEmail` operations | Onboarding should not depend on the generic `custom` template contract |
| Template catalog | Backend maintains an allowlist of known templates and required variables | Prevents silent bad requests to the provider and gives better UI errors |
| First consumer | Onboarding email step only | Gives one real flow without over-scoping the first slice |
| Failure model | Backend maps provider failures to stable domain errors | UI gets actionable messages without leaking provider internals |

## Architecture

### External boundary

The AWS endpoint stays an implementation detail:

- `POST https://7s6vd40j6i.execute-api.eu-west-3.amazonaws.com/prod/send-email`
- headers:
  - `Content-Type: application/json`
  - `x-api-key: <secret>`

The frontend must never know either the endpoint URL or the API key.

### Internal backend boundary

The backend exposes its own internal email API, owned by the runtime module. The email module is responsible for:

1. validating the request shape
2. checking the template allowlist
3. verifying all required variables exist
4. building the provider payload
5. performing the outbound HTTP call
6. mapping response failures to backend-owned error codes/messages
7. logging each attempt with enough metadata for support

The API is intentionally designed as a reusable platform capability. Onboarding is only the first consumer; later flows such as invoice delivery should be able to call the same backend-owned email boundary without exposing provider-specific details to the frontend or reworking the service contract.

### Frontend boundary

The frontend onboarding page only:

- collects the destination email address and any sender/display data needed by the wizard
- invokes the backend `sendTestEmail` action
- renders status (`idle`, `sending`, `success`, `error`)
- shows backend-provided actionable messages

No template decisions, API keys, provider URLs, or fallback behavior live in the frontend.

## Components

### 1. Email provider client

A backend HTTP client that knows how to call the AWS provider endpoint.

Responsibilities:

- read provider base URL and API key from backend configuration
- set required headers
- serialize the provider request body
- enforce a reasonable timeout
- surface transport-level failures to the domain service

This layer does **not** know about onboarding or UI copy.

### 2. Email service

A backend domain service that sits above the provider client.

Responsibilities:

- expose `sendTemplateEmail`
- expose `sendTestEmail`
- hold the canonical template definitions
- validate required fields per template
- normalize provider failures into stable internal errors
- emit structured logs / audit metadata

This is the main reusable entry point for later product flows.

### 3. Internal endpoint / handler

A backend-owned API surface consumed by the app shell.

Responsibilities:

- authenticate/authorize the caller according to existing app-shell/backend patterns
- parse request payloads
- call the email service
- return a stable response envelope for success/failure

### 4. Onboarding API integration

A thin frontend adapter in the onboarding area that calls the backend-owned test-email operation.

Responsibilities:

- send only the minimal request expected by the backend
- convert the backend response into local wizard state
- keep UI-specific concerns local to onboarding

## Internal Contracts

### `sendTemplateEmail`

Purpose: generic internal operation for future product use.

Request shape:

```json
{
  "to": "user@example.com",
  "template": "reset-password",
  "data": {
    "name": "Lucas",
    "link": "https://app.etendo.cloud/reset?token=abc123"
  }
}
```

Rules:

- `to` is required and must be a valid email address
- `template` is required and must belong to the backend allowlist
- `data` is required
- all required variables for the selected template must be present and non-empty
- extra variables may be tolerated but should not be required by the contract

### `sendTestEmail`

Purpose: onboarding-specific verification that the configured sender path works.

Request shape:

```json
{
  "to": "user@example.com",
  "name": "Lucas"
}
```

Rules:

- `to` is required and must be a valid email address
- `name` is optional unless the chosen test template requires it
- backend decides the concrete provider payload
- frontend does not send arbitrary HTML for this operation

Recommended implementation:

- implement this as a dedicated service method
- render a backend-controlled subject/body for the test email, or reuse a fixed internal wrapper around the provider `custom` template

The important point is contract ownership: onboarding calls a stable test-email action, not a generic HTML escape hatch.

## Template Catalog Ownership

The backend should define the canonical required variables for the initial provider-backed templates:

- `reset-password`: `name`, `link`
- `login-alert`: `name`, `ip`, `date`
- `invoice`: `name`, `invoice_number`, `amount`, `download_link`
- `custom`: `subject`, `body`

This catalog belongs in backend code/config close to the email service so future consumers get one source of truth.

## Error Handling

The backend should map failures into stable, UI-usable categories such as:

- `invalid_email_address`
- `unknown_template`
- `missing_template_data`
- `provider_auth_failed`
- `provider_timeout`
- `provider_unavailable`
- `unexpected_provider_response`

Each category should return:

- machine-readable code
- short user-safe message
- optional support/debug details in backend logs only

### UI expectations

Onboarding should be able to distinguish:

- validation error the user can fix now
- transient provider problem worth retrying
- hard configuration problem that should block step completion

## Observability and Audit

Minimum first-cut observability:

- log operation type (`sendTemplateEmail` or `sendTestEmail`)
- log template name when applicable
- log destination domain or masked recipient, not full secrets in noisy logs if project policy requires masking
- log provider status code / timeout category
- log correlation identifiers when available

Nice-to-have but not required for this cut:

- persistence of delivery attempts in a dedicated table
- operational dashboard of send outcomes

## Security

- store the AWS API key in backend-managed configuration, never in frontend code
- do not expose the provider URL to the browser as a required client dependency
- validate inputs before issuing outbound calls
- do not echo provider credentials or raw upstream failures to the UI
- keep `custom` email usage behind backend-owned operations; do not let arbitrary frontend callers become a raw HTML email proxy without explicit authorization design

## Testing Strategy

### Backend tests

Add tests that prove:

1. known template + complete data builds the expected provider payload
2. unknown template fails before the outbound call
3. missing required variables fail before the outbound call
4. invalid recipient fails validation
5. provider timeout maps to the expected domain error
6. provider 4xx/5xx responses map to stable internal errors
7. `sendTestEmail` produces the expected backend-controlled payload

### Frontend tests

Add onboarding tests that prove:

1. clicking "send test email" calls the onboarding API adapter
2. success state is rendered correctly
3. validation / provider errors from the backend are surfaced correctly
4. step completion remains blocked when test send fails

## Rollout Shape

Phase 1:

- implement backend email client + service + internal endpoint
- wire onboarding `sendTestEmail`
- keep other email flows untouched

Phase 2 later:

- migrate real reset-password / alert / invoice flows to the internal backend email service
- optionally add persistence/retries if operational evidence justifies it

## Open Questions

These are intentionally deferred until implementation planning, not design blockers:

1. exact runtime module/class/file locations for the email service and handler
2. whether the provider endpoint should be configured globally or per organization
3. whether test-email success should be mandatory to advance the onboarding step or only to finish the wizard

## Acceptance Criteria

- The browser does not call the AWS email endpoint directly.
- The AWS API key is only used server-side.
- The backend rejects unknown templates and missing variables before contacting the provider.
- Onboarding step 4 can send a test email through a dedicated backend action.
- Onboarding surfaces meaningful success/error feedback based on backend responses.
- The platform is left prepared for future consumers such as invoice sending through the same backend-owned API.
- The design leaves a clean path for future reset-password, login-alert, and invoice consumers without changing the frontend contract shape.
