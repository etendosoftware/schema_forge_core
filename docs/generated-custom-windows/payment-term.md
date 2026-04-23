# Payment Term

This window-specific guide complements `app-shell-functional-flows.md`. Use the shared guide for authenticated shell behavior, generic `/:windowName` loading, and shared list/detail data behavior.

- **Purpose and surface:** Maintains due-date rules for payment terms.
- **Route:** `/payment-term` and `/payment-term/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `tools/app-shell/src/menu.json`.
- **Implementation type:** Generated window.
- **Key functional cues:**
  - The frontend contract is a default-layout, single-header surface whose visible form fields are `Search Key`, `Name`, `Offset Month Due`, `Overdue Payment Days Rule`, and `Default`.
  - The `Default` field is decorated in the contract with badge metadata, so the flag is intended to read as a status-style value instead of plain text.
  - The generated page hides both **Print** and the **More** menu for list and detail views.
  - The backend contract still declares `detailEntity: "lines"`, but the generated frontend bundle only exposes the header list/detail flow. In the current build, users should expect a header-only screen.
  - The current contract declares no process/action endpoints for this window.
- **Manual verification:**
  1. Open `/payment-term` and confirm the list view loads.
  2. Open `/payment-term/<recordId>` and confirm the detail page hides **Print** and **More**.
  3. Confirm the form currently exposes only the five principal fields listed above.
  4. Toggle the `Default` flag, save, and reopen the record to confirm the state persists.
  5. Confirm the current detail page does not expose a child-lines panel.
- **Automated evidence:** `artifacts/payment-term/contract.json` includes schema-level checks for field presence, type, and searchable filters on `searchKey` and `name`. There is no dedicated SPA test for the visible Payment Term screen.