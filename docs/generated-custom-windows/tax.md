# Tax

This guide covers the current **System > Settings** Tax window exposed by `tools/app-shell/src/menu.json`. It complements `app-shell-functional-flows.md`: use the shared guide for authenticated shell behavior, generic `/:windowName` loading, and shared list/detail data behavior.

- **Purpose and surface:** Maintains tax-rate records and the rule fields that define where and how the rate applies.
- **Route:** `/tax` and `/tax/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `menu.json`.
- **Implementation type:** Generated window.
- **Key functional cues:**
  - The contract is a single-entity screen with no child entities and no declared process/action endpoints.
  - The form exposes `Name`, `Rate`, `Applicable To`, `Valid From`, `Doc Tax Amount`, and `Base Amount`.
  - `Applicable To` is rendered from three contract values: `Both`, `Sales Tax`, and `Purchase Tax`.
  - `Doc Tax Amount` currently offers `Document Amount` and `Line Amount`; `Base Amount` offers the contract-backed tax-base options such as `Line Net Amount`, `Line Net Amount + Tax`, and `Alternative Base Amount`.
  - The generated table renders the rate as a percentage chip and the applicability field as Sales/Purchase scope pills, which makes list scanning easier than reading raw codes.
- **Manual verification:**
  1. Open `/tax` and confirm the list view loads.
  2. Confirm the list renders rates as percentage badges and applicability as Sales/Purchase scope pills.
  3. Open `/tax/<recordId>` and confirm the form exposes the six fields listed above.
  4. Check the `Applicable To` selector and confirm it offers `Both`, `Sales Tax`, and `Purchase Tax`.
  5. Check the `Doc Tax Amount` and `Base Amount` selectors and confirm they expose the current contract-backed options.
  6. Save a change and reopen the record to confirm the updated values persist.
- **Automated evidence:** `artifacts/tax/contract.json` includes schema-level checks for field presence, type, and searchable filters on `name`. There is no dedicated SPA test for the rendered chips/pills or the full record flow.
