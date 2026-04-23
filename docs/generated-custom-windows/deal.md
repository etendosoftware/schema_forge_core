# Deal

## Intent

Use this window to qualify and track a commercial opportunity from initial interest to a sales outcome. The current contract presents Deal as a CRM record where a user captures the customer account, current stage, commercial value, expected close timing, owner, and lead source so the opportunity can be reviewed and progressed.

## What this window should allow

- Create and review deal records for named opportunities.
- Associate each deal with a business partner and a current sales stage.
- Capture the expected commercial value through amount and currency.
- Record forecast-oriented inputs such as probability and expected close date.
- Assign ownership and identify the originating source when that information is available.
- Search the list by deal name, business partner, or stage to find opportunities that need follow-up.

## Interaction model

- **Route:** `/deal` for the list and `/deal/:recordId` for the detail record.
- **Visibility:** Hidden in `tools/app-shell/src/menu.json`, so this is currently route-only rather than menu-visible.
- **Implementation type:** Generated standard window backed by `ListView` for the collection route and `DetailView` for the record route.
- **Window shape:** Single-entity window. Current generated evidence shows only the `deal` entity and no master-child layout.

## Reactive behavior and dependencies

- The business partner field is a search-based foreign-key input, so deal creation depends on selecting an existing customer/account record.
- Stage, currency, assigned user, and source are selector-based foreign-key inputs, so those fields depend on reference data being available in their respective catalogs.
- The current generated form is a plain `EntityForm` with no visible child tabs, no parent/child synchronization, no related-documents panel, and no window-specific process actions.
- No automatic reactions are visible in current evidence between stage and probability, between stage and allowed actions, or between amount/currency and any derived totals, discounts, or taxes.
- Generic app-shell behavior still applies: opening a new record may request backend defaults, and save/update behavior follows the shared list/detail entity flow described in `app-shell-functional-flows.md`. No deal-specific defaulting rules are visible in the deal contract or generated form.

## Gap assessment

- Opportunity management usually implies a governed progression through stages, but the current evidence only shows `stage` as a required selector. It does not show stage transition rules, stage-specific actions, or validation around allowed progression.
- Forecasting usually implies some relationship between stage and probability, but the current evidence exposes `probability` as an independent numeric field. If probability should react to stage changes, that behavior is not evidenced here.
- The window captures amount and currency, but there is no visible evidence of weighted forecast amounts, pipeline totals, or other derived commercial indicators inside this window.
- The `source` field suggests qualification reporting, but the current evidence does not show source-driven defaults, filtering, or attribution behavior beyond storing the selected value.
- Because the window is hidden in the menu, discoverability is currently limited to direct routing or links from elsewhere. If broader CRM usage is expected, menu exposure remains an open product decision rather than a confirmed behavior.

## Manual verification

1. Open `/deal` directly and confirm the window loads even though it is hidden from the navigation menu.
2. Create a new deal and confirm the form allows entry of name, business partner, stage, amount, currency, probability, expected close date, assignee, and source.
3. Open an existing deal at `/deal/<recordId>` and confirm the same fields are editable in a single-record detail view.
4. Confirm the list can filter by name, business partner, and stage.
5. Confirm there are no child tabs, no related-document area, and no stage-driven action buttons visible in the current UI.
6. If the backend exposes defaults for new deals, confirm they prefill the form; otherwise confirm the record still opens without deal-specific default behavior.

## Automated evidence

- `artifacts/deal/contract.json` defines a single `deal` entity with required fields `name`, `businessPartner`, `stage`, `amount`, and `currency`, plus optional `probability`, `expectedCloseDate`, `assignedTo`, and `source`. It also declares searchable fields `name`, `businessPartner`, and `stage`.
- `artifacts/deal/generated/web/deal/index.jsx` renders `ListView` on `/deal` and `DetailView` on `/deal/:recordId`, confirming a standard generated list/detail implementation.
- `artifacts/deal/generated/web/deal/DealForm.jsx` shows the current form as a plain `EntityForm` with the deal fields and no deal-specific reactive hooks.
- `tools/app-shell/src/menu.json` marks `deal` as hidden, confirming route-only visibility.
- `tools/app-shell/src/windows/registry.js` registers `deal` in the generated window loader map, so the route is expected to resolve through the shared window-loading flow.
- No deal-specific automated test was found. Automated confidence is limited to contract shape, generated component structure, and the shared app-shell route/loading behavior documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.