# Payment Out

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It focuses on the Payment Out finance window without repeating shared shell behavior such as authentication, generic `/:windowName` loading, `/:windowName/:recordId` routing, shared list/detail CRUD patterns, or global loader failure states.

- **Purpose / surface:** Manage outgoing payments, allocations, exchange-rate adjustments, used credit, and accounting impact from the visible **Finance** menu entry.
- **Route:** `/payment-out` and `/payment-out/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Custom route. `registry.js` lists both generated and custom loaders, and resolution order makes `tools/app-shell/src/windows/custom/payment-out/index.jsx` win.
- **Key functional cues:**
  - The custom window is a wrapper over the generated app, not a separate redesign. It keeps the generated header/detail flow, clears secondary tabs, keeps `description` as notes, and injects a custom **Related Documents** tab.
  - The custom related-documents implementation resolves linked **purchase invoices** and **purchase orders** from payment schedules on the payment lines, then routes users to `/purchase-invoice/:id` or `/purchase-order/:id`.
  - The main entity is `header`. The contract also exposes five child surfaces: **Lines**, **Execution History**, **Exchange rates**, **Used Credit Source**, and **Accounting**.
  - Header flow is organized around **Paying To**, **Paying From**, **Payment Method**, **Currency**, **Payment Date**, optional **Reference No.**, and payment status.
  - Search/filter support is broader than Payment In: `documentNo`, `referenceNo`, `paymentDate`, `businessPartner`, and `status`.
  - The **Lines** surface is the operational core. It combines **Paid Amount** with schedule references for orders and invoices, plus review columns such as **Expected Amount**, **Invoice No.**, **Order No.**, and **Write-off Amount**.
  - **Execution History** is a review tab for execution date, payment-run status, execution result, and backend messages.
  - **Exchange rates** allows document-level currency conversion records (`toCurrency`, `rate`, `foreignAmount`).
  - **Used Credit Source** lets users tie credit coming from another payment record.
  - **Accounting** is a ledger-impact review tab with period, account, debit, credit, and description values.
- **Manual verification:**
  1. Open `/payment-out` from the Finance menu and confirm the route loads the custom window rather than a placeholder.
  2. Create or open a payment and confirm the header shows the outgoing-payment fields: **Paying To**, **Paying From**, **Payment Method**, **Currency**, and **Payment Date**.
  3. Open **Lines** and confirm the user can work with **Paid Amount** plus invoice/order payment-schedule references while reviewing expected totals and write-off values.
  4. Save a payment linked to a purchase invoice or purchase order schedule, then open **Related Documents** and confirm the tab renders chips that navigate to `/purchase-invoice/:id` or `/purchase-order/:id`.
  5. Review the additional child surfaces one by one:
     - **Execution History** for run/result visibility
     - **Exchange rates** for conversion records
     - **Used Credit Source** for cross-payment credit usage
     - **Accounting** for read-only debit/credit impact
  6. Reopen the same record directly through `/payment-out/:recordId` and confirm the same child surfaces remain available.
- **Automated evidence:**
  - No dedicated frontend test file was found for `payment-out`.
  - The custom wrapper and related-documents logic are code-backed in `tools/app-shell/src/windows/custom/payment-out/`, but they are not covered by a window-specific browser test.
  - Use the shared guide for generic route/loading and shared CRUD behavior.
