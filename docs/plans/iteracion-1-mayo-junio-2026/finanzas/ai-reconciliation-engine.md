# AI Reconciliation Engine — Automatic Matching

> Tema: Finanzas · Dev: A · Semanas: S3 (12/05) → S5 (26/05) · Prioridad: 🔵 P1

## Intent

Replace the existing manual reconciliation workflow with an AI-driven matching engine that proposes pairings between bank movements and accounting documents (sales invoices, purchase invoices, payments) and auto-confirms high-confidence matches. The goal is to reach >80% auto-match rate on a typical SME's daily statement.

## Scope (What this should do)

- For each unmatched `bankMovement`, compute candidate matches against `salesInvoice`, `purchaseInvoice`, `paymentIn`, `paymentOut` using rules: amount equality (with currency), date proximity (±7d), document number / reference text similarity, BP name fuzzy match.
- Each candidate gets a confidence score 0–1 and a reason ("amount + reference + BP match").
- High confidence (≥0.95) → auto-match and update `matchStatus` to `Matched` on the line, decrement statement difference accordingly.
- Medium confidence (0.6–0.95) → surface as "Suggested match" in the reconciliation UI for one-click approval.
- Low confidence (<0.6) → leave unmatched.
- Expose the engine as a NEO process `autoMatch` already declared in the bank-reconciliation contract; the existing endpoint becomes the entry point.
- Persist match decisions with `matchedAt`, `matchedBy` (system / user), `matchedConfidence`, `matchedReason` for later learning (see suggestions task).

## Subtareas (How)

1. Implement the matching service in `com.etendoerp.go`: `BankReconciliationMatchingService` with pluggable scorers (amount, date, reference, name).
2. Add `Java_Qualifier="bank-reconciliation-line"` to the relevant `ETGO_SF_ENTITY` and create `BankReconciliationLineHandler` to enrich line responses with `suggestedMatches`.
3. Wire the `autoMatch` process in the bank-reconciliation generated page — surface the button (currently the contract has it but the SPA does not show it; see gap in `bank-reconciliation.md`).
4. Build a "Suggested matches" panel in the line detail view: table of candidates with confidence, reason, and "Accept" / "Reject" actions.
5. Update `matchStatus` and statement `difference` reactively after each accept/reject.
6. Add audit columns to `c_bankreconciliation_line`: `matched_at`, `matched_by_user_id`, `matched_confidence`, `matched_reason`.

## Dependencies

- `bankMovement` entity populated by PSD2 sync (`psd2-bank-connection.md`).
- Existing bank-reconciliation window (`generated-custom-windows/bank-reconciliation.md`) — extend, do not rewrite.
- NEO Headless extensibility via NeoHandler — see `docs/neo-headless-extensibility.md`.

## Acceptance criteria

- [ ] Running `autoMatch` on a statement with 100 lines completes in <5s and matches at least 80% on a representative dataset.
- [ ] High-confidence matches update `matchStatus` and statement `difference` without user intervention.
- [ ] Medium-confidence suggestions appear in the UI with confidence badge and reason text.
- [ ] Reject does not delete the candidate but flags it as `rejected` for later learning.
- [ ] Unit tests cover each scorer in isolation; integration test runs `autoMatch` against a fixture statement.
- [ ] Static analysis (`./cli/sonar-check.sh`) clean on the new Java sources.

## Related windows / artifacts

- [bank-reconciliation.md](../../../generated-custom-windows/bank-reconciliation.md) — extended in this task
- `artifacts/bank-reconciliation/decisions.json` — add `customComponents.sidePanel` for suggestions panel
- `psd2-bank-connection.md` — feeds the engine

## Notes / Risks

- Don't auto-match below 0.95 — false positives are extremely costly in accounting.
- Currency mismatches must hard-fail the match regardless of other signals.
- Keep the engine deterministic at this stage (rule-based scoring). The "AI suggestions" task adds the learning layer on top.
