# Payment Method

## Intent

This window should let finance and operations administrators define which payment methods can be used for incoming collections and outgoing disbursements, and whether each direction is allowed to trigger automatic execution steps. In current evidence, the SPA exposes this as a simple maintenance window for the method name, description, and grouped inbound/outbound control flags.

## What this window should allow

- Create, review, edit, and delete payment method records from the Settings area.
- Maintain the business-facing identity of the method through `Name` and `Description`.
- Decide whether the method can be used for payment-in flows (`Payment In Allowed`) and payment-out flows (`Payment Out Allowed`).
- Configure the automatic flags associated with each direction:
  - payment in: `Automatic Receipt`, `Automatic Deposit`
  - payment out: `Automatic Payment`, `Automatic Withdrawn`
- Reopen an existing method and confirm the stored toggle combination still reflects how the method should behave.

## Interaction model

- **Route:** `/payment-method` for the list and `/payment-method/:recordId` for the record detail.
- **Visibility:** visible from **Settings > Payment Method**; the menu entry is present and not hidden.
- **Implementation type:** generated single-entity window with a custom bottom section (`PaymentGroupsSection`) rendered on the detail page.
- **Window shape:** single-entity. The contract declares no child/detail entity, so users work on one payment-method record at a time rather than a master-child structure.
- **Primary interaction:** the list route opens the payment-method dataset; selecting or opening a record shows a detail form whose main generated section currently contains only `Name` and `Description`, with the grouped payment-direction checkboxes rendered below. An **Attachments** tab is placed below the `PaymentGroupsSection` panel (via `customTabsAfterBottom: true`), keeping the toggle controls as the visual focus while still allowing files to be attached to each payment method record.
- **Available page actions:** the current generated page hides both **Print** and the **More** menu, and no process actions are declared in the contract.

## Reactive behavior and dependencies

- The current design groups the boolean controls into two separate cards: one for payment-in behavior and one for payment-out behavior.
- Contract display logic declares an inbound dependency chain where `Automatic Receipt` and `Automatic Deposit` depend on `Payment In Allowed` being enabled.
- Contract display logic also declares an outbound dependency chain where `Automatic Payment` and `Automatic Withdrawn` depend on `Payment Out Allowed` being enabled.
- There is no parent/child data interaction in this window because the contract declares no detail entity.
- There are no dependent selectors, totals, discounts, taxes, or status-driven actions visible in the current evidence.
- Defaulting is visible at contract level: new records start with both directional allow flags enabled by default and each automatic flag disabled by default.

## Gap assessment

- The business intent suggests that the automatic flags should be subordinate to their corresponding allow flag. However, the current custom `PaymentGroupsSection` renders all inbound and outbound checkboxes unconditionally and does not visibly hide or disable the dependent automatic toggles. The dependency is declared in the contract, but it is not clearly enforced in the current custom UI implementation.
- Expected finance-side follow-up behavior, such as financial-account mappings, execution process dependencies, or clearing/deposit/withdrawal account setup, is not visible in the current app-shell surface. If those dependencies are required for a usable payment-method setup, they remain a gap or an unresolved ambiguity in the current evidence.
- Several backend/payment-method fields are explicitly discarded in decisions and are not exposed in the SPA. That keeps the window focused, but it also means the current UI documents toggle intent more clearly than it documents any downstream operational configuration tied to those toggles.
- There is no dedicated automated SPA test proving that the grouped toggle dependencies behave correctly in the rendered custom bottom section.

## Manual verification

1. Open `/payment-method` and confirm the list view loads from the Settings menu entry.
2. Open `/payment-method/:recordId` and confirm the detail page hides **Print** and **More**.
3. Confirm the main generated form shows only `Name` and `Description`, and the lower section renders separate payment-in and payment-out cards.
4. Check the initial values for a new record and confirm `Payment In Allowed` and `Payment Out Allowed` default to enabled while the four automatic flags default to disabled.
5. Toggle `Payment In Allowed` and verify whether `Automatic Receipt` and `Automatic Deposit` become hidden, disabled, or otherwise constrained. If they remain freely editable, record that as the current UI behavior.
6. Toggle `Payment Out Allowed` and verify whether `Automatic Payment` and `Automatic Withdrawn` become hidden, disabled, or otherwise constrained. If they remain freely editable, record that as the current UI behavior.
7. Save the record, reopen it, and confirm the chosen toggle combination persists.
8. Scroll below the `PaymentGroupsSection` panel and confirm the **Attachments** tab strip appears. Upload a file and verify it appears in the table. Confirm "Download all (ZIP)" and "Delete all" appear in the table header when files are present, and that "Delete all" requires confirmation before executing.

## Automated evidence

- `tools/app-shell/src/menu.json` exposes `payment-method` as a visible Settings entry.
- `tools/app-shell/src/windows/registry.js` registers `payment-method` as a loadable generated window.
- `artifacts/payment-method/contract.json` defines a single-entity `Payment Method` window with `hidePrint`, `hideMoreMenu`, `customComponents.bottomSection = "PaymentGroupsSection"`, default values for the six boolean fields, and display-logic dependencies from the automatic flags to their corresponding inbound/outbound allow flags.
- `artifacts/payment-method/generated/web/payment-method/PaymentMethodForm.jsx` shows that the main generated form contains only `Name` and `Description`.
- `artifacts/payment-method/generated/web/payment-method/PaymentMethodPage.jsx` mounts `PaymentGroupsSection` as the bottom section and the generic `AttachmentsTab` below it via `customTabsAfterBottom`.
- `artifacts/payment-method/decisions.json` declares `customTabsAfterBottom: true`, which positions the `AttachmentsTab` after `PaymentGroupsSection` rather than in the primary tab strip.
- `tools/app-shell/src/windows/custom/payment-method/PaymentGroupsSection.jsx` confirms the grouped two-card layout for inbound and outbound toggles, and also shows that the current custom component renders each checkbox directly rather than visibly implementing the contract's toggle dependency rules.
- `docs/generated-custom-windows/app-shell-functional-flows.md` provides the shared authenticated-shell, generic route, and entity list/detail behavior that this window inherits.