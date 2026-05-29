# Transactional Email Framework

This guide defines the working model for transactional email in Etendo Go. Transactional email is a server-side capability for account recovery, account creation, security alerts, document notifications, and controlled support/admin communication.

The system must not become a generic email relay. Every send must be driven by an explicit, versioned email contract with authorization, recipient resolution, throttling, idempotency, audit, and operational controls.

## Non-Negotiable Rules

1. The frontend never calls the email provider endpoint directly.
2. Provider URLs, API keys, sender identity, and signing secrets stay in server configuration only.
3. The browser never sends a generic provider payload such as `{ "to": "...", "template": "...", "data": ... }`.
4. Every email send uses a named email contract and a versioned command schema.
5. Recipients are resolved server-side from the authenticated context or business record by default.
6. Caller-provided recipients are allowed only for explicit admin/support contracts with role checks, throttle, reason capture, and audit.
7. `custom` email is not a public capability. It can exist only as a controlled contract with sanitizer, allowlisted roles, tight throttle, and complete audit.
8. Reply-To is disabled by default and must never allow tenant-owned sender spoofing. If enabled, it must be validated and recorded.
9. Each contract must define throttle, idempotency, audit fields, kill switch behavior, and at least three edge cases.
10. Documentation and tests must move with behavior changes in the same PR.

## Architecture

Transactional email is executed inside Etendo Go, behind the NEO Headless boundary.

```
React SPA
  -> POST /sws/neo/email-contracts/{contractName}/send
  -> JWT auth and role/org context
  -> EmailContractExecutor
  -> Contract registry
  -> Authorization check
  -> Recipient resolver
  -> Variable resolver and validation
  -> Throttle, idempotency, suppression, kill switches
  -> Audit record
  -> Provider adapter
  -> External email provider
```

Schema Forge documents the contract methodology and generated UI integration points. Etendo Go owns runtime execution, provider configuration, persistence, and enforcement.

## Command Shape

The frontend sends a contract command, not an email provider payload.

```json
{
  "recordId": "E2F7A13B...",
  "version": "v1",
  "intent": "send-document",
  "idempotencyKey": "sales-invoice:E2F7A13B:email:v1",
  "clientReference": "ui-send-modal-2026-05-19T12:30:00Z"
}
```

The contract decides:

- which template is used
- who can execute it
- how recipients are resolved
- which variables are allowed
- how links are generated
- whether Reply-To is allowed
- how throttling and idempotency work
- which audit fields are stored
- what happens if a kill switch is active

## Contract Lifecycle

| Phase | Owner | Required Output |
|-------|-------|-----------------|
| Design | Product/engineering | Contract name, user story, allowed roles, recipient source, variables, edge cases |
| Implementation | Backend | Contract class/descriptor, executor wiring, provider adapter usage |
| UI integration | Frontend | Contract command call and mapped user-facing states |
| QA | QA/security | Authorization, throttling, idempotency, failure, sanitizer, and audit tests |
| Operations | Support/DevOps | Metrics, logs, runbook entry, kill switch path, alert thresholds |
| Documentation | Engineering | Contract entry in [email-contracts.md](email-contracts.md) and runbook updates |

## Initial Contract Families

### Password Reset

Purpose: send a recovery link to the account owner.

Expected contract: `reset-password`.

Edge cases:

- The requested user does not exist: return a neutral success response and do not reveal account existence.
- The user has no active email address: suppress the send, audit the reason, and return a neutral response.
- Multiple requests arrive in a short window: reuse idempotency and throttle by account, IP, recipient, and tenant.
- The reset token is expired or already used: the link target handles invalid token state without resending automatically.

### New Account

Purpose: notify a user that an account or environment is ready.

Expected contract: `new-account`.

Edge cases:

- The account exists but is inactive: block the send unless a dedicated activation flow permits it.
- The environment is not fully provisioned: do not send the email until readiness checks pass.
- The recipient email belongs to an existing user in another tenant: keep tenant context isolated and avoid cross-tenant data in variables.
- The invite link is regenerated: invalidate or supersede prior links according to the contract idempotency rule.

### Login Alert

Purpose: notify a user about security-relevant login events.

Expected contract: `login-alert`.

Edge cases:

- Login comes from a known device but a new IP: send only when the contract's risk threshold requires it.
- Login metadata is incomplete: send with a safe fallback for missing location/device fields.
- A burst of failed logins happens: throttle per account and IP while preserving audit records for security review.
- The account is locked after the event: send the lock-related alert contract instead of duplicating generic login alerts.

### Invoice and Document Notification

Purpose: send a business document notification derived from an Etendo record.

Expected contracts: `sales-invoice-send`, `sales-order-send`, `sales-quotation-send`, or a document-specific contract name.

Edge cases:

- The user cannot access the document: return unauthorized and do not disclose whether the record exists.
- The document has no valid recipient contact: block the send with a clear UI state and audit `NO_RECIPIENT`.
- The document is draft or voided: block unless the contract explicitly allows that document status.
- The same document is sent twice from the UI: idempotency returns a duplicate/sent state without a second provider call.

### Controlled Custom Support Email

Purpose: allow support/admin teams to send controlled HTML or rich text when no fixed template exists.

Expected contract: `support-custom-email`.

Edge cases:

- A general user attempts to execute the contract: return forbidden and audit the attempt.
- HTML contains scripts, event handlers, external tracking pixels, or unsafe links: sanitize or reject according to the contract.
- The operator omits a reason: reject the command because support custom sends must be justified.
- The recipient is outside the allowed domain policy: block or require elevated approval according to the contract.

## Required Runtime Controls

### Authorization

Each contract must verify the authenticated user, role, tenant, organization, and target record before resolving recipients or variables. Frontend button visibility is a UX hint only.

### Recipient Resolution

Contracts should resolve recipients from trusted server-side data:

- account owner email for authentication flows
- business partner contact email for documents
- responsible user email for internal alerts
- allowlisted caller-provided email only for admin/support contracts

### Throttling

Contracts must declare limits at the levels that apply to their abuse profile:

- per user
- per tenant/client
- per contract/template
- per recipient
- per domain
- per source IP when available
- per target record
- global provider safety limit

### Idempotency

All send commands must require or derive an idempotency key. Duplicate commands must not trigger duplicate provider calls within the configured window.

Recommended key shape:

```
{contractName}:{tenantId}:{recordOrSubjectId}:{semanticAction}:{version}
```

### Audit

Audit records must be written for success, blocked, duplicate, throttled, unauthorized, suppressed, sanitizer rejection, provider failure, and kill-switch outcomes. Audit must not store provider secrets or full HTML bodies.

### Kill Switches

The executor must support:

- global email kill switch
- tenant/client kill switch
- contract/template kill switch
- provider adapter disable switch
- emergency suppressions by recipient or domain

## UI State Contract

Frontend integrations must map executor responses to explicit user states:

| Executor Result | UI Behavior |
|-----------------|-------------|
| `SENT` | Show success and persist send status if the flow needs it |
| `DUPLICATE` | Show already sent or recently sent, not an error |
| `THROTTLED` | Show wait/retry guidance without provider details |
| `UNAUTHORIZED` | Hide/disallow action and show a permission message |
| `NO_RECIPIENT` | Ask the user to fix the business contact data |
| `SUPPRESSED` | Show that delivery is disabled for the recipient/domain |
| `KILL_SWITCHED` | Show service unavailable for email sends |
| `PROVIDER_FAILED` | Show retry/support message with request reference |

## Agent Checklist

When creating or maintaining email sending behavior:

1. Update or create the contract entry in [email-contracts.md](email-contracts.md).
2. Keep provider endpoint/API key in server config only.
3. Do not add frontend code that accepts arbitrary `to`, `template`, or raw provider data.
4. Implement backend authorization before recipient or variable resolution.
5. Add throttling, idempotency, audit, suppression, and kill switch handling.
6. Add at least three edge cases for the contract family.
7. Add tests for unauthorized access, invalid recipient, forbidden sender/reply-to fields, duplicate send, throttle, and provider failure.
8. Update [ops/transactional-email-security.md](ops/transactional-email-security.md) when operations behavior changes.

## Definition of Done

An email contract is done only when:

- the contract is documented
- the executor path is covered by automated tests
- the UI never exposes provider secrets or arbitrary provider payloads
- audit and metrics are emitted for all terminal outcomes
- throttle and idempotency behavior are deterministic
- kill switch behavior is verified
- security review covers custom HTML if the contract accepts rich text
