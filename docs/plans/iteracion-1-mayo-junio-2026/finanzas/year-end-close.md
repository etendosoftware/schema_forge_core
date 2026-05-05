# Year-End Close (Guided Wizard)

> Tema: Finanzas · Dev: A · Semanas: post S6 · Prioridad: 🔵 P1

## Intent

Guide the finance user through closing the fiscal year in a multi-step wizard that consolidates today's separate Etendo manual steps (close periods, generate closing entries, regenerate opening entries, lock the year) into a single supervised flow with rollback safety.

## Scope (What this should do)

- Multi-step wizard: (1) Pre-flight checks, (2) Confirm pending operations, (3) Close periods, (4) Generate closing journal, (5) Generate opening journal, (6) Lock the year, (7) Summary.
- Pre-flight checks include: unposted documents, open reconciliations, unbalanced periods, missing exchange rates, draft documents in scope.
- Each step is idempotent — re-running it on a partially closed year resumes from the right point.
- Hard rollback button until step 6 (lock); after lock the action is irreversible and requires manager confirmation.
- Generates a downloadable PDF closing report with year-end balances and the journal entries created.
- Audit log of every action (who, when, which step, success/failure).

## Subtareas (How)

1. Define a `yearEndClose` window with a custom `layoutType: "wizard"` (new layout type — coordinate with Schema Forge Developer).
2. Implement pre-flight check service in Java: `YearEndCloseValidator` returns a list of issues with severity (blocker / warning).
3. Wrap Etendo's existing `org.openbravo.erpCommon.ad_process.YearEndCloseProcess` so the wizard drives it step by step instead of running end-to-end.
4. Add an `etgo_year_close_state` table to track wizard progress per fiscal year + organization.
5. Generate the PDF report using the `pdf` skill conventions — store under `c_file` and link from the wizard summary.
6. Add a "Re-open year" supervisor action gated behind a role permission (default: only `F&A Supervisor`).

## Dependencies

- Etendo's existing `YearEndCloseProcess` Java class.
- New `wizard` layout type in the frontend generator (Schema Forge Developer task — coordinate before this task starts).
- Audit logging infrastructure.

## Acceptance criteria

- [ ] Wizard completes a full year close on a test database with sample data without manual SQL fixes.
- [ ] Pre-flight blocks the user from advancing if there are unposted documents.
- [ ] Rollback at step 5 cleanly removes the closing journal.
- [ ] Lock at step 6 is irreversible without supervisor role.
- [ ] PDF report opens, contains correct totals, and matches the journal entries created.
- [ ] E2E test covers happy path + one rollback scenario.

## Related windows / artifacts

- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md)
- `manual-journal-entries.md` — the closing/opening journals reuse the same posting infrastructure

## Notes / Risks

- Year-end close is the single highest-stakes operation in the system. Belt-and-braces UX: confirm, confirm again, then confirm a third time before lock.
- Re-opening a closed year is a separate workflow with stricter permissions.
- Don't reinvent Etendo's posting logic — wrap it, don't replace it.
