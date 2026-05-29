# Document Email Contract Implementation Guide

Use this guide when adding or changing a document-send email contract exposed from a Schema Forge window.

Schema Forge owns the contract methodology, generated UI integration points, and window documentation. Etendo Go owns the runtime contract implementation, provider configuration, and enforcement.

## Before You Start

1. Read [transactional-email-framework.md](transactional-email-framework.md) and [email-contracts.md](email-contracts.md).
2. If the contract belongs to a generated window, open [generated-custom-windows/INDEX.md](generated-custom-windows/INDEX.md) and then the matching window guide.
3. Confirm the browser flow only sends a contract command to Etendo Go:

   ```http
   POST /sws/neo/email-contracts/{contractName}/send
   ```

4. Do not add frontend fields for `to`, `template`, `data`, `subject`, `body`, sender, Reply-To, provider URL, or provider metadata.

## Naming

Use stable kebab-case names:

| Window | Contract Name |
|--------|---------------|
| Sales Invoice | `sales-invoice-send` |
| Sales Order | `sales-order-send` |
| Sales Quotation | `sales-quotation-send` |

For new document families, prefer:

```text
{document-spec-name}-send
```

Do not hardcode or guess window, menu, process, or tab identifiers. Resolve them through the existing Schema Forge and NEO configuration flow.

## Default Document Payload

Document-send contracts should use the default minimal payload:

| Variable | Source |
|----------|--------|
| `name` | Business partner or contact display name |
| `document_type` | Contract-defined document label |
| `document_number` | Document number from the trusted record |
| `download_link` | Server-generated document URL |

Do not include monetary amounts by default. `amount` is allowed only when the explicit provider template requires it. Document-specific aliases, such as `invoice_number`, are also compatibility exceptions and must be declared by the explicit contract.

## Schema Forge Steps

1. Add or update the contract entry in [email-contracts.md](email-contracts.md).
2. Document the contract name, template, caller, recipient policy, variables, idempotency strategy, and at least three edge cases.
3. Update the window guide in `docs/generated-custom-windows/<window>.md`.
4. Verify that the UI sends only the contract command:

   ```json
   {
     "version": "v1",
     "recordId": "E2F7A13B...",
     "intent": "send-document",
     "idempotencyKey": "sales-order-send:E2F7A13B:send:v1"
   }
   ```

5. Keep recipient preview fields read-only when shown in the UI. The final recipient must be resolved server-side from trusted records.
6. If generated artifacts change, update the generator or source decisions instead of manually editing `artifacts/*/generated/`.

## Etendo Go Implementation Handoff

The runtime implementation belongs in `modules/com.etendoerp.go`. The Etendo Go PR should:

1. Add a server-side `EmailContract` implementation or extend the shared document contract base.
2. Add a resolver method to load the trusted document record.
3. Resolve recipients from the business partner or active contact email.
4. Register the contract in the default registry.
5. Add behavioral tests for registry lookup, recipient resolution, default payload, and edge cases.
6. Update the module runtime documentation.

See `modules/com.etendoerp.go/docs/document-email-contract-implementation.md` for the Java-side checklist.

## Required Edge Cases

Every document-send contract must document and test at least these cases:

1. The caller cannot access the target record.
2. The trusted document record has no valid recipient email.
3. The browser command tries to override recipient, template, or provider fields.
4. A repeated command arrives within the idempotency window.
5. A global, tenant, provider, or contract kill switch disables sending.

## Review Checklist

- Contract name is stable and versioned.
- Frontend sends a command, not a provider payload.
- Recipient resolution is server-side.
- Default document payload stays minimal.
- Optional variables are explicitly justified by the provider template.
- Throttle, idempotency, audit, suppression, and kill switches are covered.
- Contract documentation and window documentation are updated in the same PR.
- Runtime tests cover success and security/failure paths.
