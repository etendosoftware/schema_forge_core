# Bank Reconciliation

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It focuses on the Bank Reconciliation finance window without repeating shared shell behavior such as authentication, generic `/:windowName` loading, `/:windowName/:recordId` routing, shared list/detail CRUD patterns, or global loader failure states.

- **Purpose / surface:** Reconcile a bank statement header against transaction lines and optionally match those lines to invoices.
- **Route:** `/bank-reconciliation` and `/bank-reconciliation/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Generated window route.
- **Key functional cues:**
  - The header entity is `bankReconciliation`; the child entity is `bankReconciliationLine`.
  - Header flow is centered on **Bank Account**, **Statement Date**, **Ending Balance**, and read-only review values for **Document No.**, **Starting Balance**, **Difference**, and **Status**.
  - The child line flow is centered on **Transaction Date**, **Description**, **Amount**, optional **Matched Invoice**, and read-only **Match Status**.
  - Header filters target `documentNo`, `bankAccount`, and `statementDate`. Child-line filters target `description` and `transactionDate`.
  - The backend contract declares an `autoMatch` process endpoint with preconditions around unmatched lines, eligible status, and an active bank account.
  - The current generated frontend page builds with an empty `processes` array, so the checked SPA code does not currently show a dedicated in-page process button for that backend process.
- **Manual verification:**
  1. Open `/bank-reconciliation` from the Finance menu and confirm the list view exposes statement-level rows rather than a generic placeholder.
  2. Create a reconciliation header with **Bank Account**, **Statement Date**, and **Ending Balance**.
  3. Confirm **Starting Balance**, **Difference**, and **Status** behave as review values rather than ordinary editable business fields.
  4. Add at least one transaction line and confirm the line form supports **Description**, **Amount**, and optional **Matched Invoice** selection.
  5. After saving or refreshing, confirm **Match Status** reflects whether the line is matched and that the header **Difference** reacts to the line set.
  6. If your deployed backend exposes reconciliation actions outside the current generated page, test them separately. In the checked SPA code, do not expect an explicit in-page **Auto Match** button yet.
- **Automated evidence:**
  - No dedicated app-shell test file was found for this window.
  - The contract does carry field/type/filter expectations in its `testManifest`, but the current frontend evidence for route loading and shared CRUD still comes from the shared app-shell guide.
