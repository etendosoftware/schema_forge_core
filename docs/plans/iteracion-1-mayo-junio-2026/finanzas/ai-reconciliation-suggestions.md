# AI Reconciliation Engine — Smart Suggestions + Learning

> Tema: Finanzas · Dev: A · Semanas: S5 (26/05) → S6 (02/06) · Prioridad: 🔵 P1

## Intent

Layer a learning component on top of the rule-based matching engine: capture which suggestions the user accepts/rejects and use that signal to improve scoring over time, plus surface natural-language reconciliation summaries ("This statement closes with €0.00 difference; 47 of 50 lines matched automatically").

## Scope (What this should do)

- Track every suggestion outcome (accepted / rejected / ignored) per scoring feature, per organization.
- Adjust feature weights nightly based on accumulated outcomes (simple online learning — no need for a heavy ML stack).
- Surface a per-organization "match accuracy" metric in the bank-reconciliation list view.
- LLM-assisted explanation: when the user opens a suggested match, optionally call Copilot to phrase the reason in plain language ("Matches invoice INV-2026-0234 because the amount €1,210.00 equals the invoice total and the reference 'INV234' appears in the bank description").
- Learn organization-specific patterns: BP-specific reference formats, recurring payment schedules, typical transfer descriptions.

## Subtareas (How)

1. Add table `ETGO_SF_RECONCILE_LEARN` with: org id, scorer name, accepted count, rejected count, weighted score, updated at.
2. Hook into accept/reject actions in `BankReconciliationMatchingService` to increment the learning counters.
3. Build a nightly job `ReconcileLearningJob` that recomputes per-org scorer weights using a simple Bayesian update.
4. Inject the learned weights back into the matching engine at runtime (cache for 1h).
5. Add an optional LLM call (via existing Copilot agent infrastructure) gated behind a feature flag for the explanation text.
6. Surface "Match accuracy: 87% (last 30 days)" KPI on the bank-reconciliation list and on the finance dashboard.

## Dependencies

- `ai-reconciliation-engine.md` must be deployed first — this task extends it.
- Copilot agent infrastructure (`copilot/ai-specialized-agents.md`) — only needed for the LLM explanations feature.

## Acceptance criteria

- [ ] After 100 accept/reject events, the per-scorer weights have measurably shifted from the defaults.
- [ ] Nightly job runs idempotently — re-running on the same data does not double-count.
- [ ] LLM explanation feature flag works: ON shows natural-language reasons, OFF shows rule-based reasons only.
- [ ] Match accuracy KPI matches manual SQL count within 1%.
- [ ] No PII leaks into LLM prompts — verify with a test that BP names are tokenized before being sent.

## Related windows / artifacts

- [bank-reconciliation.md](../../../generated-custom-windows/bank-reconciliation.md)
- `ai-reconciliation-engine.md` — base engine
- `../copilot/ai-specialized-agents.md` — LLM provider

## Notes / Risks

- Keep the learning model simple. Per-org weights via Bayesian counts beat a neural net on this problem at SME scale.
- Feature-flag the LLM explanations — they cost money and not every customer wants OpenAI-style calls.
- Privacy: never send raw bank descriptions to a third-party LLM without org consent.
