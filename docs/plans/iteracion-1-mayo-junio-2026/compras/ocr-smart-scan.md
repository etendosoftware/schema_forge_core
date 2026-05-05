# Smart Scan / OCR — Invoice Capture (Copilot AI)

> Tema: Compras · Dev: D · Semanas: S2 (06/05) → S3 (12/05) · Prioridad: 🟢 P2

## Intent

Let the user upload a supplier invoice as a PDF or image and have the AI extract supplier, invoice number, date, due date, lines, taxes, and totals automatically — landing as a draft purchase invoice ready for review and post.

## Scope (What this should do)

- Upload action on the purchase-invoice list: accepts PDF, JPG, PNG, and HEIC.
- The file goes into a queue; OCR pipeline runs asynchronously.
- Extraction returns a structured payload (supplier match, invoice metadata, lines, taxes, totals) with per-field confidence.
- A draft purchase invoice is created with the extracted data + a "Source PDF" attachment.
- High-confidence fields (>0.95) are saved without flagging; low-confidence fields are highlighted for review.
- Supplier matching: try by NIF / CIF first, then by name fuzzy match; if no match, prompt the user to confirm or create.
- Reprocess action if extraction is wrong.
- Bulk upload (drag 50 PDFs into a folder watcher) — used together with `email-invoice-ingestion.md`.

## Subtareas (How)

1. Pick the OCR provider: native LLM via Anthropic (Claude with vision) is preferred for accuracy + per-org tax/currency awareness.
2. Implement `OcrInvoiceExtractor` Java service that posts the file to the LLM with a structured-output prompt.
3. Define the JSON schema for the extracted payload (supplier, dates, lines, taxes, totals, confidence per field).
4. Implement the supplier matcher: NIF first, then fuzzy name + tax-id heuristics.
5. Build the upload UI: drag-zone on the purchase-invoice list, async progress indicator, draft creation toast.
6. Highlight low-confidence fields visually (yellow border + "Verify" tooltip).
7. Background folder watcher (configurable per org) for bulk drop-in.
8. Audit log: store the file, the extracted payload, and the final accepted values.

## Dependencies

- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md) — destination
- LLM provider config (org-level API key)
- `c_file` storage for source PDFs
- Encryption at rest for uploaded documents

## Acceptance criteria

- [ ] Uploading a clean PDF invoice produces a draft purchase invoice with ≥95% field accuracy.
- [ ] Supplier match by NIF works on a known supplier; name match works when NIF is missing.
- [ ] Low-confidence fields are visibly highlighted in the form.
- [ ] Reprocess re-runs OCR on the same file and updates the draft.
- [ ] Bulk drop of 20 files produces 20 drafts within 5 minutes.
- [ ] Source PDF is attached and downloadable from the draft invoice.
- [ ] No PII goes to the LLM beyond what's already on the invoice.

## Related windows / artifacts

- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- `email-invoice-ingestion.md` — sibling capture channel
- `../copilot/ai-specialized-agents.md` — LLM provider abstraction

## Notes / Risks

- LLMs hallucinate occasionally — never auto-post; always require human review on at least totals.
- Tax extraction is the trickiest part (Spanish tax breakdowns vary). Test against 50+ real Spanish invoices.
- Cost per call matters at scale; consider a cheaper first-pass model with fallback to the strong model on low confidence.
