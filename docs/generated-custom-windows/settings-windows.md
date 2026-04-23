# Settings Windows

This guide covers the current System > Settings windows exposed by `tools/app-shell/src/menu.json`. It complements `docs/generated-custom-windows/app-shell-functional-flows.md`: use the shared guide for authenticated shell behavior, generic `/:windowName` loading, and shared list/detail data behavior.

All windows below are currently visible in the menu. None of the assigned entries carries `hidden: true`, so the expected entry points are the standard list/detail routes `/<slug>` and `/<slug>/:recordId`.

Window-specific automated evidence is limited in the current worktree. Each assigned contract includes a `testManifest` with schema-level checks, but there is no dedicated browser E2E coverage for these settings screens. For shared route/loading coverage, refer back to the app-shell guide.

## Price List

- **Purpose and surface:** Maintains price-list headers plus per-product pricing. The visible header form exposes `Name`, `Currency`, `Sales Price List`, `Price list based on cost`, `Price includes Tax`, and `Default`.
- **Route:** `/price-list` and `/price-list/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `menu.json`.
- **Implementation type:** Custom window. `tools/app-shell/src/windows/registry.js` declares both a generated loader and a custom loader for this slug, and the custom loader wins.
- **Key functional cues:**
  - The current contract defines a header entity (`priceList`) plus a child entity (`priceListLine`), searchable by `name` and `product` respectively.
  - The custom wrapper does not follow the stock generated child-grid flow. It wraps the generated app, disables the generated `detailEntity`, and injects a custom `Product Price` workspace instead.
  - That workspace resolves the hidden price-list version first and then manages `productPrice` rows with `Product`, `Unit Price`, and `List Price` columns.
  - Unsaved headers show a save-first message. Saved headers without a hidden version show an explicit empty state instead of a broken child grid.
  - The current contract declares no process/action endpoints for this window.
- **Automated evidence:** `artifacts/price-list/contract.json` includes schema-level checks for both `priceList` and `priceListLine`, including searchable filter coverage for `product`. There is no dedicated SPA test for the custom wrapper or its side-panel editing flow.
- **Manual verification:**
  1. Open `/price-list` and confirm the list shows existing price lists.
  2. Open `/price-list/new` and confirm the detail area asks you to save the header before managing products.
  3. Open `/price-list/<recordId>` and confirm the record shows a custom **Product Price** area rather than the stock generated line table.
  4. On a saved record with a hidden version, add a product and confirm `Product`, `Unit Price`, and `List Price` appear in the table.
  5. Select a product-price row, update the two price fields in the side panel, save, then delete the row and confirm the table refreshes.
  6. On a saved record without a hidden version, confirm the screen shows the explicit empty-state warning instead of failing silently.

## Payment Term

- **Purpose and surface:** Maintains due-date rules for payment terms.
- **Route:** `/payment-term` and `/payment-term/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `menu.json`.
- **Implementation type:** Generated window.
- **Key functional cues:**
  - The frontend contract is a default-layout, single-header surface whose visible form fields are `Search Key`, `Name`, `Offset Month Due`, `Overdue Payment Days Rule`, and `Default`.
  - The `Default` field is decorated in the contract with badge metadata, so the flag is intended to read as a status-style value instead of plain text.
  - The generated page hides both **Print** and the **More** menu for list and detail views.
  - The backend contract still declares `detailEntity: "lines"`, but the generated frontend bundle only exposes the header list/detail flow. In the current build, users should expect a header-only screen.
  - The current contract declares no process/action endpoints for this window.
- **Automated evidence:** `artifacts/payment-term/contract.json` includes schema-level checks for field presence, type, and searchable filters on `searchKey` and `name`. There is no dedicated SPA test for the visible Payment Term screen.
- **Manual verification:**
  1. Open `/payment-term` and confirm the list view loads.
  2. Open `/payment-term/<recordId>` and confirm the detail page hides **Print** and **More**.
  3. Confirm the form currently exposes only the five principal fields listed above.
  4. Toggle the `Default` flag, save, and reopen the record to confirm the state persists.
  5. Confirm the current detail page does not expose a child-lines panel.

## Payment Method

- **Purpose and surface:** Defines payment methods and the inbound/outbound automation flags attached to each method.
- **Route:** `/payment-method` and `/payment-method/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `menu.json`.
- **Implementation type:** Generated window with a custom bottom-section component.
- **Key functional cues:**
  - The contract is a default-layout, single-entity window. The main generated form keeps only `Name` and `Description` in the principal section.
  - The contract declares `customComponents.bottomSection = "PaymentGroupsSection"`, and the generated page wires that component into the detail view.
  - The bottom section groups toggles into two cards: a payment-in group (`Payment In Allowed`, `Automatic Receipt`, `Automatic Deposit`) and a payment-out group (`Payment Out Allowed`, `Automatic Payment`, `Automatic Withdrawn`).
  - Contract display logic makes the two automatic inbound toggles depend on `Payment In Allowed`, and the two automatic outbound toggles depend on `Payment Out Allowed`.
  - The generated page hides both **Print** and the **More** menu. The current contract declares no process/action endpoints.
- **Automated evidence:** `artifacts/payment-method/contract.json` includes schema-level checks for field presence/type plus rule declarations for the current display-logic branches. There is no dedicated SPA test for the two-card bottom section.
- **Manual verification:**
  1. Open `/payment-method` and confirm the list view loads.
  2. Open `/payment-method/<recordId>` and confirm the detail page hides **Print** and **More**.
  3. Confirm the main form shows only `Name` and `Description`, and that the lower area renders separate payment-in and payment-out cards.
  4. Toggle `Payment In Allowed` and confirm the `Automatic Receipt` and `Automatic Deposit` controls become relevant on that side of the form.
  5. Toggle `Payment Out Allowed` and confirm the `Automatic Payment` and `Automatic Withdrawn` controls become relevant on that side of the form.
  6. Save the record and reopen it to confirm the grouped checkbox state persists.

## Tax

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
- **Automated evidence:** `artifacts/tax/contract.json` includes schema-level checks for field presence, type, and searchable filters on `name`. There is no dedicated SPA test for the rendered chips/pills or the full record flow.
- **Manual verification:**
  1. Open `/tax` and confirm the list view loads.
  2. Confirm the list renders rates as percentage badges and applicability as Sales/Purchase scope pills.
  3. Open `/tax/<recordId>` and confirm the form exposes the six fields listed above.
  4. Check the `Applicable To` selector and confirm it offers `Both`, `Sales Tax`, and `Purchase Tax`.
  5. Check the `Doc Tax Amount` and `Base Amount` selectors and confirm they expose the current contract-backed options.
  6. Save a change and reopen the record to confirm the updated values persist.

## Unit of Measure

- **Purpose and surface:** Maintains unit-of-measure master data and, at the contract level, the conversion rows attached to each unit.
- **Route:** `/unit-of-measure` and `/unit-of-measure/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `menu.json`.
- **Implementation type:** Generated window.
- **Key functional cues:**
  - The contract declares a default-layout header entity plus a `conversion` child entity.
  - The current generated header form exposes `EDI Code`, `Name`, `Symbol`, `Standard Precision`, `Costing Precision`, `Default`, and `UOM Type`.
  - `UOM Type` is backed by the contract enum values `Area`, `Length`, `Time`, `Volume`, and `Weight`.
  - The broader frontend contract also describes additional header fields under secondary sections (`Description`, `Breakdown`, `Use In Production`), but the current generated page only wires the base header fields listed above.
  - The `conversion` child entity defines `To UOM`, `Multiple Rate By`, and `Divide Rate By`, with callout metadata for rate recalculation. Generated `ConversionTable.jsx` and `ConversionForm.jsx` exist, but `UnitOfMeasurePage.jsx` does not currently mount a conversion detail pane.
  - The current contract declares no process/action endpoints.
- **Automated evidence:** `artifacts/unit-of-measure/contract.json` includes schema-level checks for both header and `conversion`, including selector coverage for `toUOM` and callout declarations for the conversion-rate fields. There is no dedicated SPA test for the visible Unit of Measure page.
- **Manual verification:**
  1. Open `/unit-of-measure` and confirm the list view loads.
  2. Open `/unit-of-measure/<recordId>` and confirm the detail page exposes the base header fields listed above.
  3. Open the `UOM Type` selector and confirm it offers `Area`, `Length`, `Time`, `Volume`, and `Weight`.
  4. Save a change and reopen the record to confirm the edited header values persist.
  5. Confirm the current detail page does not surface a conversion subtable, even though conversion contract metadata and generated conversion components exist in the bundle.

## User

- **Purpose and surface:** Maintains user identity data, security state, role assignments, defaults, and contract-backed email-configuration metadata.
- **Route:** `/user` and `/user/:recordId`.
- **Visibility:** Visible in **System > Settings**; not marked hidden in `menu.json`.
- **Implementation type:** Generated window.
- **Key functional cues:**
  - The main generated form is split into `principal`, `security`, `details`, and `defaults` sections.
  - The visible form includes identity fields (`Name`, `Username`, `First Name`, `Last Name`, `Email`), search selectors (`Business Partner`, `Supervisor`), security fields (`Password`, `Expired Password`, `Locked`, `Last Password Update`), and default selectors for role/language/client/organization/warehouse.
  - `Name`, `First Name`, and `Last Name` carry the same user-name callout, so those fields are intended to stay synchronized.
  - `Default Client` and `Default Organization` depend on the selected `Default Role`, and `Default Warehouse` depends on `Default Client`.
  - The generated detail page actively wires `userRoles` as the visible child entity. Users can add role rows with a `Role` selector and a `Role Administrator` checkbox.
  - The contract also defines a second child entity, `emailConfiguration`, plus an SMTP connection-test action. Generated table/form files for that child exist, but `UserPage.jsx` does not currently mount an email-configuration detail pane.
  - Contract action metadata also exists for `processNow` and `grantPortalAccess` on the user entity, but the current generated page keeps its `processes` array empty, so there is no visible evidence of dedicated action buttons in this screen.
- **Automated evidence:** `artifacts/user/contract.json` includes schema-level checks for user fields, selectors, `userRoles`, `emailConfiguration`, and the SMTP action endpoint metadata. There is no dedicated SPA test covering the visible child-pane behavior on the current user detail page.
- **Manual verification:**
  1. Open `/user` and confirm the list supports the current searchable fields: `name`, `username`, and `email`.
  2. Open `/user/<recordId>` and confirm the detail summary shows `Expired Password`, `Locked`, and `Last Password Update`.
  3. In the `defaults` section, choose a `Default Role` and confirm the dependent `Default Client` and `Default Organization` selectors react to that choice; then choose a client and confirm `Default Warehouse` follows that dependency chain.
  4. In the child area, add or edit a `User Roles` row and confirm the row exposes `Role` plus `Role Administrator`.
  5. Confirm the current user detail page does not surface an `Email Configuration` child pane or an SMTP connection-test button, even though the contract and generated bundle define that metadata.
