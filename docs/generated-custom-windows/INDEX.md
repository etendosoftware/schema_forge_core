# Generated/custom windows

Functional documentation for the user-facing Schema Forge window surface.

This folder is the entry point for documentation that describes how generated and custom windows behave from a user and QA perspective: goals, routes, expected outcomes, visible errors, and testable verification paths.

## Contents

| File | Description |
|------|-------------|
| [app-shell-functional-flows.md](app-shell-functional-flows.md) | Cross-window functional guide for app-shell routes, generated/custom window loading, shared entity behavior, OAuth2 screens, and PWA update/recovery flows |
| [people-windows.md](people-windows.md) | Functional coverage for Contacts plus hidden People routes such as Business Partner, Deal, Activity, Lead, Employee, and Absence |
| [sales-windows.md](sales-windows.md) | Functional coverage for Sales windows including Sales Order, Sales Invoice, Goods Shipment, quotations, and return flows |
| [purchases-windows.md](purchases-windows.md) | Functional coverage for purchase-order, goods-receipt, purchase-invoice, and vendor-return flows |
| [inventory-windows.md](inventory-windows.md) | Functional coverage for product, warehouse, inventory movement, internal consumption, and storage-bin flows |
| [finance-windows.md](finance-windows.md) | Functional coverage for payment, reconciliation, chart-of-accounts, assets, and recurring-invoice flows |
| [projects-windows.md](projects-windows.md) | Functional coverage for hidden Projects routes: Project, Time Tracking, and Document |
| [settings-windows.md](settings-windows.md) | Functional coverage for reference/settings windows such as Price List, Payment Term, Payment Method, Tax, Unit of Measure, and User |

## Scope

Use this folder for:
- shared functional documentation that applies to generated and custom windows
- grouped functional guides that cover the current window set by menu/category
- verification-oriented flow documentation for QA and product review

Do not use this folder for:
- low-level generator implementation notes
- backend architecture documentation
- pipeline internals not visible from the window behavior
