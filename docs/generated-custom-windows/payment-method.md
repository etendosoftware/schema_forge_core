# Payment Method

This window-specific guide complements `app-shell-functional-flows.md`. Use the shared guide for authenticated shell behavior, generic `/:windowName` loading, and shared list/detail data behavior.

- **Purpose and surface:** Defines payment methods and the inbound/outbound automation flags attached to each method.
- **Route:** `/payment-method` and `/payment-method/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `tools/app-shell/src/menu.json`.
- **Implementation type:** Generated window with a custom bottom-section component.
- **Key functional cues:**
  - The contract is a default-layout, single-entity window. The main generated form keeps only `Name` and `Description` in the principal section.
  - The contract declares `customComponents.bottomSection = "PaymentGroupsSection"`, and the generated page wires that component into the detail view.
  - The bottom section groups toggles into two cards: a payment-in group (`Payment In Allowed`, `Automatic Receipt`, `Automatic Deposit`) and a payment-out group (`Payment Out Allowed`, `Automatic Payment`, `Automatic Withdrawn`).
  - Contract display logic makes the two automatic inbound toggles depend on `Payment In Allowed`, and the two automatic outbound toggles depend on `Payment Out Allowed`.
  - The generated page hides both **Print** and the **More** menu. The current contract declares no process/action endpoints.
- **Manual verification:**
  1. Open `/payment-method` and confirm the list view loads.
  2. Open `/payment-method/<recordId>` and confirm the detail page hides **Print** and **More**.
  3. Confirm the main form shows only `Name` and `Description`, and that the lower area renders separate payment-in and payment-out cards.
  4. Toggle `Payment In Allowed` and confirm the `Automatic Receipt` and `Automatic Deposit` controls become relevant on that side of the form.
  5. Toggle `Payment Out Allowed` and confirm the `Automatic Payment` and `Automatic Withdrawn` controls become relevant on that side of the form.
  6. Save the record and reopen it to confirm the grouped checkbox state persists.
- **Automated evidence:** `artifacts/payment-method/contract.json` includes schema-level checks for field presence/type plus rule declarations for the current display-logic branches. There is no dedicated SPA test for the two-card bottom section.