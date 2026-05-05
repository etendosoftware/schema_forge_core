# Spain — SII (Suministro Inmediato de Información)

> Tema: Localización · Dev: B · Semanas: S1 (01/05) → S3 (12/05) · Prioridad: 🔵 P1

## Intent

Comply with the AEAT SII obligation: every issued and received invoice (above the threshold or for SII-bound taxpayers) must be sent to AEAT within 4 working days, in real time via SOAP web service. We must build the integration so it fires automatically from sales/purchase invoice posting.

## Scope (What this should do)

- On invoice "Complete" (sales + purchase), enqueue an SII submission asynchronously.
- Build the SII XML payload using the official AEAT XSD schemas (LR Facturas Emitidas + LR Facturas Recibidas).
- Sign the request with the org's digital certificate (X.509) and submit via mTLS to AEAT.
- Store AEAT response (CSV id, status, errors) per invoice.
- SII inbox view: list of pending / submitted / rejected invoices with retry action.
- Rejection handling: if AEAT returns a recoverable error (typo in NIF, etc.), the invoice goes back to draft for correction; non-recoverable errors stay flagged for manual review.
- Support invoice modifications (Tipo Comunicación = A0/A1/A4) for rectified invoices.

## Subtareas (How)

1. Add an org-level config: digital certificate file (encrypted at rest), test/prod toggle, AEAT environment URL.
2. Implement Java module `com.etendoerp.go.sii` with: `SiiPayloadBuilder`, `SiiSoapClient` (using JAX-WS), `SiiQueueProcessor`.
3. Hook into invoice completion via NeoHandler (`SalesInvoicePostHandler`, `PurchaseInvoicePostHandler`) — enqueue, do not submit synchronously.
4. Background job `SiiSubmitJob` polls the queue every minute and submits.
5. Build "SII Inbox" custom window with status, AEAT CSV, retry button, and direct link to the source invoice.
6. Implement rectified invoice flow: a credit note auto-generates the correct A4 communication.
7. Add comprehensive logging — every request/response stored verbatim for audit.

## Dependencies

- `chart-of-accounts-spain.md` — tax mappings must be correct (NIF, tax rate, base) before SII can succeed
- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md), [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md) — completion triggers SII
- Existing org's digital certificate (client provides)
- Outbound HTTPS to AEAT endpoints (test: `prewww1.aeat.es`, prod: `www1.agenciatributaria.gob.es`)

## Acceptance criteria

- [ ] A completed sales invoice is submitted to AEAT test env within 1 minute and the CSV is stored.
- [ ] A completed purchase invoice with the supplier's NIF is submitted to LR Facturas Recibidas successfully.
- [ ] AEAT-rejected invoice surfaces the error in the SII Inbox with a clear message in Spanish.
- [ ] Rectified invoice (credit note) generates an A4 communication with the correct reference to the original invoice.
- [ ] Tax report (`finanzas/financial-reports.md`) totals reconcile to the SII totals for the same period.
- [ ] All SOAP requests/responses logged for audit (24 months retention configurable).

## Related windows / artifacts

- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md)
- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- `chart-of-accounts-spain.md` — required tax setup
- `verifactu-tbai.md` — overlapping but DIFFERENT obligation (do not confuse)

## Notes / Risks

- SII is the highest-stakes integration in the Spain pack — failures can cause AEAT fines.
- The XSD schemas evolve — pin the version (currently SII v1.1) and monitor BOE for updates.
- Digital certificate handling: never log the cert, never include in error stack traces.
- Test environment is rate-limited; use it for CI but not for load tests.
