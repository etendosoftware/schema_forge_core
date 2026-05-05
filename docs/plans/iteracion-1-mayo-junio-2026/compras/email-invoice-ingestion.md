# Email Invoice Ingestion (facturas@empresa)

> Tema: Compras · Dev: D · Semanas: S3 (12/05) → S4 (19/05) · Prioridad: 🟢 P2

## Intent

Provide a dedicated mailbox per organization (e.g. `facturas@empresa.com`) where suppliers can email their invoices. The system polls the inbox, extracts attachments, runs OCR, and creates draft purchase invoices automatically — eliminating the manual "open email → save PDF → upload" loop.

## Scope (What this should do)

- Per-org configurable inbox: IMAP credentials OR a Gmail / O365 OAuth connector.
- Background poller fetches new messages every 5 minutes.
- For each message: extract attachments (PDF, images), run OCR via `ocr-smart-scan.md`, create draft purchase invoices, and link them to the original email.
- Sender allowlist / blocklist: only process messages from known supplier domains by default.
- "Email inbox" window: list of received emails with status (Pending / Processed / Errored) and the resulting drafts.
- Reply / forward actions from the inbox to the responsible buyer.
- Anti-spam guardrails: drop messages without attachments, oversized attachments, suspicious senders.

## Subtareas (How)

1. Add org-level email config (IMAP host/port/user/pass OR OAuth tokens for Gmail/O365). Encrypt at rest.
2. Build the poller as a scheduled task (`InvoiceMailboxPoller`) — connect, fetch unread, mark as read after processing.
3. For each attachment, call `OcrInvoiceExtractor` (from `ocr-smart-scan.md`) and create the draft invoice.
4. Link the email + attachments to the draft invoice as `c_file` references; store the email body too for audit.
5. Build the "Email Inbox" window with the status pipeline.
6. Allowlist / blocklist editable from the inbox window.
7. Notify the buyer (configurable per BP) when a draft is created.

## Dependencies

- `ocr-smart-scan.md` — sibling task; this one feeds it
- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- Org email infrastructure
- `../configuracion/onboarding-roles-email.md` — config UI

## Acceptance criteria

- [ ] Sending an email with a PDF invoice from an allowlisted sender creates a draft invoice within 10 minutes.
- [ ] Email without attachments is logged but not processed.
- [ ] Attachments larger than the configured limit (default 20MB) are rejected with a logged reason.
- [ ] Draft invoice links back to the source email for audit.
- [ ] Buyer notification arrives with a deeplink to the draft.
- [ ] Allowlist toggle blocks an unwanted sender on the next poll cycle.
- [ ] OAuth refresh works automatically for Gmail/O365 connectors.

## Related windows / artifacts

- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- `ocr-smart-scan.md`
- `../configuracion/onboarding-roles-email.md`
- `../ventas/sales-payment-collection.md` — outbound email engine (reuse infrastructure)

## Notes / Risks

- IMAP idle vs. polling: polling is simpler and "fast enough" for this use case; idle adds complexity for marginal gain.
- OAuth tokens expire — refresh path must be robust.
- Suppliers sometimes attach two PDFs (invoice + delivery note); use OCR to classify or process both as separate drafts.
