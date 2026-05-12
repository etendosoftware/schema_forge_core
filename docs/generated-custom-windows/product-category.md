# Product Category

## Intent

Product Category should let users maintain the category header that classifies products and review which products are already assigned to that category. In current evidence, this window behaves as a category master record with a child view over assigned products rather than a place to edit the full product definition.

## What this window should allow

Users should be able to:

- browse product categories by Search Key and Name
- open a category and maintain its header fields: Search Key, Name, Description, Default, Summary Level, and Image
- review the products already linked to the selected category in the **Assigned Products** child grid
- identify assigned products by Search Key, Name, and Product Type without leaving the category context
- inspect any row-level product-related actions that the runtime exposes for assigned products

## Interaction model

- **Route:** `/product-category`, `/product-category/:recordId`
- **Visibility:** visible in the Inventory menu as **Product Category**
- **Implementation type:** generated window loaded from the app-shell registry
- **Window shape:** master-child window; `productCategory` is the header entity and `assignedProducts` is the child entity
- **List behavior:** the category list shows Search Key and Name and supports filtering by those same fields
- **Record behavior:** opening a category record renders a detail view with the category header form plus the **Assigned Products** child table
- **Child behavior:** the generated child table exposes Search Key, Name, and Product Type filters/columns, and the generated child form is read-only for those same fields

## Reactive behavior and dependencies

- The child grid depends on the selected category record. Current app-shell flow evidence shows child entities load under the header record context and use a parent filter (`parentId={id}`) when fetching child rows.
- The category header exposes no status field, summary badges, or header-level process actions in the generated page.
- No dependent selectors are defined for this window in the generated API contract.
- The only explicit default visible in current evidence is `Summary Level`, which is generated with a default value of `N`.
- No totals, discounts, tax recalculations, or other derived financial reactions are visible in the current contract or generated UI for this window.
- The contract declares several row-level actions for assigned products (`processNow`, variant actions, service-relation actions, and `updateInvariants`), but current window-specific generated files do not show where those actions are surfaced in the UI.

## Gap assessment

- The business intent suggests users may expect category-specific operations on assigned products, but the current generated child form is read-only and the page defines no quick-add child fields. It is therefore ambiguous whether users can create or meaningfully edit category assignments from this window, despite the CRUD contract allowing child POST/PATCH/DELETE calls.
- Assigned-product actions exist contractually, but their visible placement is not evident in the current window-specific UI code. Treat those actions as expected runtime capabilities, not confirmed visible controls.
- The current evidence does not show any explicit rule enforcing what the `Default` or `Summary Level` flags should trigger elsewhere in the product catalog.

## Manual verification

1. Open `/product-category` and confirm the list filters Search Key and Name.
2. Open an existing category and confirm the header form shows Search Key, Name, Description, Default, Summary Level, and Image.
3. Confirm the **Assigned Products** child grid loads under the selected category and only exposes identifying product fields instead of the full product form.
4. Inspect an assigned-product row and confirm whether variant, service-relation, processing, or invariant-update actions are actually visible in the runtime UI; if not, record that as a delivery gap against the contract.
5. Attempt the child interactions the runtime allows and verify whether assigned products are review-only or truly editable from this window.

## Automated evidence

- `tools/app-shell/src/menu.json` places **Product Category** under the Inventory menu.
- `tools/app-shell/src/windows/registry.js` registers the `product-category` slug for generated window loading.
- `artifacts/product-category/contract.json` defines a master-child window with `productCategory` as the primary entity, `assignedProducts` as the detail entity, category header fields, child filters, `Summary Level` defaulting, and multiple assigned-product actions.
- `artifacts/product-category/generated/web/product-category/ProductCategoryPage.jsx` renders `ListView` for the list route and `DetailView` for record routes, wiring `AssignedProductsTable` and `AssignedProductsForm` as the child components.
- `artifacts/product-category/generated/web/product-category/ProductCategoryTable.jsx`, `ProductCategoryForm.jsx`, `AssignedProductsTable.jsx`, and `AssignedProductsForm.jsx` show the visible list/header/child fields described above.
- No dedicated Product Category browser test was found. Shared route/loading and entity-data behavior are documented in `docs/generated-custom-windows/app-shell-functional-flows.md`.

## Pipeline regeneration — ETP-3908

Regenerated on 2026-05-12 as part of the feature/ETP-3908 epic merge. No functional changes to this window.

- `linesLayout: "classic"` is now written explicitly to `contract.json`; previously the classic layout was the implicit default.
- `requiredHeaderFields` is now emitted in the page component; this window has no required header fields so the array is empty and there is no behavioral change.
