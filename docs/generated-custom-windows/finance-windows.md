# Finance windows

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md). It focuses on Finance menu windows that currently resolve through `tools/app-shell/src/menu.json`, `tools/app-shell/src/windows/registry.js`, and the matching `artifacts/<slug>/contract.json` files.

Shared shell behavior is not repeated here. Authentication, generic `/:windowName` loading, `/:windowName/:recordId` record routing, shared list/detail CRUD patterns, and global loader failure states are already documented in the shared guide.

Automation note: I did not find dedicated browser-style app-shell tests for these individual finance windows under `tools/app-shell`. Where a contract carries a `testManifest`, that gives field/filter expectations, but the reusable route/loading evidence still comes from the shared app-shell guide.

## Payment In

- **Purpose / surface:** Manage incoming payments and their scheduled allocation lines from the visible **Finance** menu entry.
- **Route:** `/payment-in` and `/payment-in/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Generated window route. `registry.js` resolves `payment-in` through the generated loader, and the generated page adds contract-backed custom surface elements.

### Functional cues

- The main record is `finPayment` with a child `finPaymentScheduleDetail` surface exposed as **Lines**.
- The header contract centers the flow on **Received From**, **Payment Date**, **Payment Method**, **Deposit To**, **Currency**, **Amount**, and **Status**.
- The generated page wires a **Related Documents** tab plus three notable custom components: `PaymentBottomPanel`, `PaymentActivityToggle`, and `NewPaymentModal`. In practice, expect a specialized create modal, top-right activity control, and extra bottom content beyond the stock generated form.
- The window enables document-preview framing (`Payment` title prefix), uses `description` as the notes field, and hides delete once a payment is complete.
- Search/filter support is limited to `documentNo`, `paymentDate`, and `businessPartner`.
- The contract adds a positive **Process Payment** action when status is `RPAP` (Awaiting Payment).
- The generated page exposes a destructive **Reverse Payment** action only when status is one of `RPPC`, `RPR`, or `RDNC`.
- The child **Lines** surface is intentionally narrow: due date, received amount, and invoice payment schedule are the key allocation fields.

### Manual verification

1. Open `/payment-in` from the Finance menu and confirm the list loads instead of a placeholder error.
2. Start a new record and confirm creation opens through the specialized modal flow instead of a plain inline form.
3. Fill a payment with at least **Received From**, **Payment Method**, **Deposit To**, **Payment Date**, and **Amount**, then save.
4. Reopen the saved record and confirm the page shows the **Related Documents** tab, the extra bottom panel area, and the top-right activity affordance.
5. Open the **Lines** child surface and confirm you can work with **Due Date**, **Received Amount**, and **Invoice Payment Schedule**.
6. If the record is still awaiting payment, confirm **Process Payment** is available. After the backend moves the payment to `RPR`, `RPPC`, or `RDNC`, confirm **Reverse Payment** becomes visible and delete is no longer the primary completion path.

### Automation note

- No finance-window-specific app-shell test file was found for `payment-in`.
- The current repo does show generated-page wiring for the related-documents tab and custom components.
- Use the shared guide for route registration, loader behavior, and shared `useEntity` CRUD expectations.

## Payment Out

- **Purpose / surface:** Manage outgoing payments, allocations, exchange-rate adjustments, used credit, and accounting impact from the visible **Finance** menu entry.
- **Route:** `/payment-out` and `/payment-out/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Custom route. `registry.js` lists both generated and custom loaders, and resolution order makes `tools/app-shell/src/windows/custom/payment-out/index.jsx` win.

### Functional cues

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

### Manual verification

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

### Automation note

- No dedicated frontend test file was found for `payment-out`.
- The custom wrapper and related-documents logic are code-backed in `tools/app-shell/src/windows/custom/payment-out/`, but they are not covered by a window-specific browser test.
- Use the shared guide for generic route/loading and shared CRUD behavior.

## Bank Reconciliation

- **Purpose / surface:** Reconcile a bank statement header against transaction lines and optionally match those lines to invoices.
- **Route:** `/bank-reconciliation` and `/bank-reconciliation/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Generated window route.

### Functional cues

- The header entity is `bankReconciliation`; the child entity is `bankReconciliationLine`.
- Header flow is centered on **Bank Account**, **Statement Date**, **Ending Balance**, and read-only review values for **Document No.**, **Starting Balance**, **Difference**, and **Status**.
- The child line flow is centered on **Transaction Date**, **Description**, **Amount**, optional **Matched Invoice**, and read-only **Match Status**.
- Header filters target `documentNo`, `bankAccount`, and `statementDate`. Child-line filters target `description` and `transactionDate`.
- The backend contract declares an `autoMatch` process endpoint with preconditions around unmatched lines, eligible status, and an active bank account.
- The current generated frontend page builds with an empty `processes` array, so the checked SPA code does not currently show a dedicated in-page process button for that backend process.

### Manual verification

1. Open `/bank-reconciliation` from the Finance menu and confirm the list view exposes statement-level rows rather than a generic placeholder.
2. Create a reconciliation header with **Bank Account**, **Statement Date**, and **Ending Balance**.
3. Confirm **Starting Balance**, **Difference**, and **Status** behave as review values rather than ordinary editable business fields.
4. Add at least one transaction line and confirm the line form supports **Description**, **Amount**, and optional **Matched Invoice** selection.
5. After saving or refreshing, confirm **Match Status** reflects whether the line is matched and that the header **Difference** reacts to the line set.
6. If your deployed backend exposes reconciliation actions outside the current generated page, test them separately. In the checked SPA code, do not expect an explicit in-page **Auto Match** button yet.

### Automation note

- No dedicated app-shell test file was found for this window.
- The contract does carry field/type/filter expectations in its `testManifest`, but the current frontend evidence for route loading and shared CRUD still comes from the shared app-shell guide.

## Chart of Accounts

- **Purpose / surface:** Maintain the account master and review debit/credit/balance figures for each account from the visible **Finance** menu entry.
- **Route:** `/chart-of-accounts` and `/chart-of-accounts/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Generated window route.

### Functional cues

- The surface is intentionally simple: one `account` entity with no child entities and no contract process endpoints.
- Primary editable business fields are **Code**, **Name**, **Account Type**, and optional **Parent Account**.
- The table adds read-only financial review columns for **Debit**, **Credit**, and **Balance**.
- `isActive` is present but read-only in the generated form, so this screen behaves more like account maintenance plus balance review than a free-form activation toggle.
- Search/filter support is limited to `code`, `name`, and `accountType`.

### Manual verification

1. Open `/chart-of-accounts` from the Finance menu and confirm the list exposes account rows.
2. Verify the table shows **Code**, **Name**, **Account Type**, **Parent Account**, **Debit**, **Credit**, **Balance**, and active-state visibility.
3. Filter by **Code**, **Name**, and **Account Type**.
4. Create or edit an account and confirm the business-editable fields are **Code**, **Name**, **Account Type**, and optional **Parent Account**.
5. Open `/chart-of-accounts/:recordId` directly for an existing account and confirm the detail surface matches the list-driven navigation.

### Automation note

- No dedicated frontend test file was found for this window.
- The contract includes field-presence and field-type expectations, but route/loading coverage still belongs to the shared app-shell guide.

## Assets

- **Purpose / surface:** Maintain fixed assets, configure depreciation behavior, review amortization progress, and inspect accounting mappings from the visible **Finance** menu entry.
- **Route:** `/assets` and `/assets/:recordId`.
- **Visibility:** Visible in the Finance menu.
- **Implementation:** Generated window route with visible custom panels wired into the generated page.

### Functional cues

- The page is intentionally more guided than a stock list/detail view. The generated page wires `AssetsAmortizationPanel` as a footer area, `AssetsConfigPanel` as a named primary tab, and `AssetsSidebar` as detail-side content.
- Window-level presentation is specialized: sidebar layout is enabled, print and more-menu affordances are hidden, the content background is customized, and the page hides list filters in the shell even though the table still defines filterable fields.
- The main record is `assets`; child surfaces are **Asset Amortization** (`amortizationLine`) and **Accounting** (`assetAcct`).
- The primary tabs are **Overview** and **Depreciation Setup**.
- The key business setup fields are **Search Key**, **Name**, **Asset Category**, **Depreciate**, **Depreciation Type**, **Calculate Type**, **Annual Depreciation %**, **Amortize**, **Usable Life - Years**, **Usable Life - Months**, and purchase/acquisition dates and values.
- The contract adds a positive asset process action. At window level it is presented as **Create Amortization**; the underlying field is `processAsset` / **Generate Amortization Plan**.
- List/search support targets `searchKey`, `name`, `assetCategory`, `depreciate`, and `fullyDepreciated`.
- Detail ordering for amortization lines is explicit: `sEQNoAsset asc`.

### Manual verification

1. Open `/assets` from the Finance menu and confirm the list loads without the usual list-filter chrome, print button, or more-menu affordances.
2. Create or edit an asset and confirm the base flow starts with **Search Key**, **Name**, and **Asset Category**.
3. Toggle **Depreciate** and confirm the depreciation-oriented setup becomes relevant in the **Depreciation Setup** tab.
4. Switch between depreciation calculation styles and confirm the visible inputs change accordingly:
   - percentage-based setup should emphasize **Annual Depreciation %**
   - time-based setup should emphasize **Amortize** and usable-life fields
5. On a saved asset, confirm the page shows the custom footer area, the right-side sidebar content, and the child surfaces for **Asset Amortization** and **Accounting**.
6. When depreciation is enabled, confirm the emphasized amortization action is available and review the resulting amortization rows in sequence order.

### Automation note

- No dedicated app-shell test file was found for `assets`.
- The repo does show concrete generated-page wiring for the custom footer, sidebar, and setup tab, which supports the functional expectations above.
- Use the shared guide for the common route and CRUD mechanics.

## Recurring Invoice

- **Purpose / surface:** Maintain recurring billing templates with next-run scheduling and status tracking.
- **Route:** `/recurring-invoice` and `/recurring-invoice/:recordId`.
- **Visibility:** Hidden in the Finance menu. `menu.json` marks the item `hidden: true`, and `buildMenuGroups()` filters hidden items out of the visible menu.
- **Implementation:** Generated window route. The slug still exists in `registry.js`, so the page remains reachable by direct URL.

### Functional cues

- The window is a single-entity surface for `recurringInvoice`; there are no child entities, related-document tabs, or process endpoints in the checked contract.
- Required business fields are **Name**, **Business Partner**, **Frequency**, **Next Date**, **Amount**, **Currency**, **Status**, and **Start Date**.
- **End Date** is optional and **Last Generated** is read-only, so the surface behaves like a schedule template editor rather than a transaction screen.
- Search/filter support is limited to `name`, `businessPartner`, and `status`.
- The generated form groups core identity/scheduling fields in the principal section, with money/status/date controls following in the secondary section.

### Manual verification

1. Sign in and confirm the Finance side menu does **not** show a visible **Recurring Invoice** entry.
2. Navigate directly to `/recurring-invoice` and confirm the generated list loads successfully.
3. Verify the list can be filtered by **Name**, **Business Partner**, and **Status**.
4. Create or edit a recurring invoice and confirm the required fields are **Name**, **Business Partner**, **Frequency**, **Next Date**, **Amount**, **Currency**, **Status**, and **Start Date**.
5. Confirm **Last Generated** is review-only and that `/recurring-invoice/:recordId` loads the same record directly.

### Automation note

- No dedicated frontend test file was found for this window.
- The contract includes field/type expectations, but shared route/loading behavior should still be validated through the shared app-shell guide.
