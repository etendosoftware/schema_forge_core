# Payment In

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It focuses on the Payment In finance window without repeating shared shell behavior such as authentication, generic `/:windowName` loading, `/:windowName/:recordId` routing, shared list/detail CRUD patterns, or global loader failure states.

- **Purpose / surface:** Manage incoming payments and their scheduled allocation lines from the visible **Finance** menu entry.
- **Route:** `/payment-in` and `/payment-in/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Generated window route. `registry.js` resolves `payment-in` through the generated loader, and the generated page adds contract-backed custom surface elements.
- **Key functional cues:**
  - The main record is `finPayment` with a child `finPaymentScheduleDetail` surface exposed as **Lines**.
  - The header contract centers the flow on **Received From**, **Payment Date**, **Payment Method**, **Deposit To**, **Currency**, **Amount**, and **Status**.
  - The generated page wires a **Related Documents** tab plus three notable custom components: `PaymentBottomPanel`, `PaymentActivityToggle`, and `NewPaymentModal`. In practice, expect a specialized create modal, top-right activity control, and extra bottom content beyond the stock generated form.
  - The window enables document-preview framing (`Payment` title prefix), uses `description` as the notes field, and hides delete once a payment is complete.
  - Search/filter support is limited to `documentNo`, `paymentDate`, and `businessPartner`.
  - The contract adds a positive **Process Payment** action when status is `RPAP` (Awaiting Payment).
  - The generated page exposes a destructive **Reverse Payment** action only when status is one of `RPPC`, `RPR`, or `RDNC`.
  - The child **Lines** surface is intentionally narrow: due date, received amount, and invoice payment schedule are the key allocation fields.
- **Manual verification:**
  1. Open `/payment-in` from the Finance menu and confirm the list loads instead of a placeholder error.
  2. Start a new record and confirm creation opens through the specialized modal flow instead of a plain inline form.
  3. Fill a payment with at least **Received From**, **Payment Method**, **Deposit To**, **Payment Date**, and **Amount**, then save.
  4. Reopen the saved record and confirm the page shows the **Related Documents** tab, the extra bottom panel area, and the top-right activity affordance.
  5. Open the **Lines** child surface and confirm you can work with **Due Date**, **Received Amount**, and **Invoice Payment Schedule**.
  6. If the record is still awaiting payment, confirm **Process Payment** is available. After the backend moves the payment to `RPR`, `RPPC`, or `RDNC`, confirm **Reverse Payment** becomes visible and delete is no longer the primary completion path.
- **Automated evidence:**
  - No finance-window-specific app-shell test file was found for `payment-in`.
  - The current repo does show generated-page wiring for the related-documents tab and custom components.
  - Use the shared guide for route registration, loader behavior, and shared `useEntity` CRUD expectations.
