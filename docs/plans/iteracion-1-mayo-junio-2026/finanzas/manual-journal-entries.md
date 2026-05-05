# Simple G/L Journal — Manual Accounting Entries

> Tema: Finanzas · Dev: B · Semanas: post S6 · Prioridad: 🔵 P1

## Intent

Give the accountant a fast, keyboard-driven screen to post manual G/L journal entries (adjustments, accruals, reclassifications) without the friction of Etendo's classic AD form. Inspired by the Holded-style "asiento simple" UX: one row per debit/credit, auto-balance helper, post in one click.

## Scope (What this should do)

- Header: date, description, period (auto-derived from date), document type (Manual / Adjustment / Closing / Opening).
- Lines: account, debit, credit, line description, optional cost center, optional BP.
- Total row at bottom: total debit, total credit, difference (must be 0 to post).
- "Balance" helper button: if difference ≠ 0, fills the next empty line with the missing amount on the opposite side.
- Templates: save a frequently used entry as a template, recall it later.
- Recurring: schedule an entry to auto-post monthly (e.g. monthly amortization adjustments).
- Posts directly to `fact_acct` via Etendo's posting service — no separate intermediate state.

## Subtareas (How)

1. Define a custom window `manual-journal` with a master/lines layout. Header is a new lightweight entity `etgoManualJournal`; lines reuse `gl_journalline` semantics.
2. Build a custom HeaderForm + custom LineTable component with keyboard navigation (Tab moves through fields, Enter creates new line).
3. Implement the "Balance" helper as a client-side action; "Post" calls a `PostManualJournalHandler` that maps to Etendo's `org.openbravo.erpCommon.ad_actionButton.PostingProcess`.
4. Templates table `etgo_manual_journal_template` — save a snapshot of header + lines.
5. Recurring schedule: reuse the existing scheduled-task infrastructure to instantiate a new entry from the template each period.
6. Validation: prevent posting if difference ≠ 0, period is closed, or any account is inactive.

## Dependencies

- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md) — account selector
- Etendo posting infrastructure (`PostingProcess`)
- Scheduled tasks for recurring entries

## Acceptance criteria

- [ ] Posting a balanced 4-line entry creates the correct `fact_acct` rows in <1s.
- [ ] Posting an unbalanced entry returns a clear error and does NOT write any rows.
- [ ] "Balance" helper produces a balanced entry on the next empty line.
- [ ] Saving + recalling a template recreates the exact same entry.
- [ ] Recurring entry posts on schedule on the configured date and stops after the configured end date.
- [ ] All operations are auditable (created_by, updated_by, posted_at).

## Related windows / artifacts

- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md)
- `financial-reports.md` — drill-down target for these entries
- `year-end-close.md` — closing/opening entries reuse this infrastructure

## Notes / Risks

- Don't reinvent posting — wrap Etendo's `PostingProcess` carefully or you risk drift.
- Closed-period guard must be enforced server-side — never trust the client.
- Holded's UX is a strong reference: optimize for speed, not for showing every Etendo field.
