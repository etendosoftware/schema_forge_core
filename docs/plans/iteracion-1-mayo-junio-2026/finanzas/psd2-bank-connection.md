# PSD2 Bank Connection + Movement Sync

> Tema: Finanzas · Dev: A · Semanas: S2 (06/05) → S3 (12/05) · Prioridad: 🔵 P1

## Intent

Let the user connect their real bank accounts via a PSD2 aggregator (e.g. GoCardless Bank Account Data, Tink, Nordigen) and pull bank movements automatically into Etendo. This eliminates manual CSV uploads and feeds the AI reconciliation engine with fresh data daily.

## Scope (What this should do)

- "Connect bank" CTA on the bank-account form launches an OAuth-style consent flow with the aggregator (redirect → user authenticates with their bank → callback returns a requisition id).
- Persist the requisition / institution id and refresh token on the bank account record (encrypted).
- Background job polls the aggregator daily for new movements and inserts them as `bankMovement` rows linked to the bank account.
- Manual "Sync now" action on the bank account triggers an on-demand pull.
- Show last-sync timestamp and last-sync status (ok / error / pending) on the bank account form.
- Handle expired consents — surface a "Re-authorize" banner when the requisition expires (90 days for most EU banks).

## Subtareas (How)

1. Choose aggregator and obtain sandbox credentials (recommend GoCardless Bank Account Data — free tier, EU coverage).
2. Add config table `ETGO_PSD2_PROVIDER` with provider id, base URL, client id/secret per organization.
3. Add columns to `c_bank_account`: `psd2_provider_id`, `psd2_requisition_id`, `psd2_consent_expires`, `psd2_last_sync`, `psd2_last_status`.
4. Implement Java handler `Psd2ConnectionHandler` (NeoHandler pattern) that initiates the OAuth flow and stores the requisition.
5. Implement scheduled job (Etendo `ProcessRequest`) `Psd2SyncJob` that iterates bank accounts, calls the aggregator's transactions endpoint, and inserts `bankMovement` rows (dedup by external transaction id).
6. Add UI: "Connect bank" button in `bank-account` custom form, redirect handler, success/error toast, last-sync indicator.
7. Encrypt refresh tokens at rest using Etendo's `org.openbravo.base.secureApp.SecureApp` utilities.

## Dependencies

- New `bankMovement` entity (if it does not already exist) — verify and create via `extract-from-db.js`.
- Outbound HTTPS allowlist for the aggregator domain in the deployment.
- Org-level setting screen to enter aggregator credentials.

## Acceptance criteria

- [ ] User can complete the consent flow in sandbox and see "Connected" status on the bank account.
- [ ] Sync job inserts movements without duplicates across multiple runs.
- [ ] Re-authorization banner appears when consent is expired and the link works end-to-end.
- [ ] Refresh tokens are encrypted in the DB (verified by SQL inspection).
- [ ] Failed sync logs an actionable error and does NOT silently swallow exceptions.
- [ ] Unit test for dedup logic; integration test against the aggregator sandbox.

## Related windows / artifacts

- [bank-reconciliation.md](../../../generated-custom-windows/bank-reconciliation.md) — consumes the imported movements
- `accounting-dashboard.md` — surfaces sync status

## Notes / Risks

- PSD2 consent expires every 90 days in the EU — UX must surface this clearly.
- Aggregator rate limits can be tight (4 calls / day per account on free tier). Schedule job once daily and back off.
- Different banks return different transaction shapes — normalize at the import layer, never in the reconciliation logic.
