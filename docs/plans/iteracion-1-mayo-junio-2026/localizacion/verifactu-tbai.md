# Spain — Verifactu + TBAI

> Tema: Localización · Dev: B · Semanas: S3 (12/05) → S4 (19/05) · Prioridad: 🔵 P1

## Intent

Comply with two parallel anti-fraud invoice obligations: **Verifactu** (national, AEAT, mandatory for non-SII taxpayers from 2026) and **TBAI** (Basque Country: Bizkaia, Gipuzkoa, Araba). Both require generating signed invoice records and attaching machine-verifiable codes (QR + hash chain) to printed invoices.

## Scope (What this should do)

### Verifactu (national)

- For every issued invoice, generate a signed `RegistroFacturacion` with the prior invoice hash → builds an immutable chain.
- Submit to AEAT in real time (Verifactu mode) OR keep the chain locally and provide it on demand (No-Verifactu mode).
- Include the QR code on the printed invoice that points to AEAT's verification URL with the invoice id.
- Store the chain hash on every `c_invoice` row.

### TBAI (Basque)

- Same logic but submission goes to the corresponding Diputación (Bizkaia / Gipuzkoa / Araba) endpoint.
- Different XML schema (TicketBai schema).
- Different QR encoding rules and verification URL.

### Common

- Org-level setting "Invoice anti-fraud regime": SII / Verifactu / TBAI Bizkaia / TBAI Gipuzkoa / TBAI Araba (mutually exclusive with SII for some regimes).
- The signed record is appended automatically on invoice completion.
- Rejection handling and status inbox (mirror of SII inbox).

## Subtareas (How)

1. Add the regime setting to the org config; gate the integration based on it.
2. Implement Verifactu module: `VerifactuPayloadBuilder` + `VerifactuSoapClient` against AEAT's Verifactu endpoint.
3. Implement TBAI module: separate package since the schemas differ; `TbaiPayloadBuilder` + per-Diputación clients.
4. Maintain the hash chain: each new invoice signs over (prior_hash + this_invoice_data).
5. Generate QR code (using `zxing`) and embed it in the invoice PDF template.
6. Extend the invoice PDF template to include the QR + the legible hash + the verification URL.
7. Build a unified anti-fraud inbox window that shows submission status across regimes.

## Dependencies

- `sii-spain.md` — sibling integration; share the certificate / SOAP infrastructure where possible
- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md)
- PDF skill for invoice template extension
- Digital certificate (same one as SII)

## Acceptance criteria

- [ ] Verifactu submission for a test invoice succeeds against AEAT pre-prod and the response CSV is stored.
- [ ] TBAI submission for a test Bizkaia invoice succeeds against the Bizkaia test env.
- [ ] Hash chain across 100 sequential invoices is verifiable end-to-end (re-compute chain and compare).
- [ ] Printed invoice PDF shows a scannable QR that opens the AEAT / Diputación verification page.
- [ ] Switching regime at org level immediately gates new invoices via the correct submission path.
- [ ] Anti-fraud inbox surfaces failures and supports retry.

## Related windows / artifacts

- [sales-invoice.md](../../../generated-custom-windows/sales-invoice.md)
- `sii-spain.md` — sibling regime
- `chart-of-accounts-spain.md` — required tax setup

## Notes / Risks

- Verifactu and TBAI are NOT the same — three separate Diputación endpoints + Verifactu = four implementations.
- Regimes are mutually exclusive in most cases — clear UX is critical so customers pick the right one.
- Hash chain integrity is non-negotiable: any gap means AEAT can void the entire chain. Use DB-level constraints to prevent gaps.
