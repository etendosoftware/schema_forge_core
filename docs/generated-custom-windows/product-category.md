# Product Category

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-level notes for Product Category.

- **Purpose / surface:** Product Category groups products under a shared classification and gives category-level access to the products already assigned to that category.
- **Route:** `/product-category`, `/product-category/:recordId`
- **Visibility:** Visible in the Inventory menu as **Product Category**.
- **Implementation type:** Generated.
- **Key functional cues:**
  - The contract uses `layoutType: "default"` and declares `detailEntity: "assignedProducts"`, so record pages are master/detail rather than single-form only.
  - Category header fields focus on `searchKey`, `name`, `description`, `default`, `summaryLevel`, and `image`.
  - The detail grid is **Assigned Products** and exposes only identifying fields in the frontend contract: Search Key, Name, and Product Type.
  - Assigned-product list filters are `searchKey`, `name`, and `productType`.
  - The contract declares row-level actions on assigned products for processing, creating/managing variants, relating products/categories/services, and updating invariants.
- **Manual verification:**
  1. Open `/product-category` and verify the list can be filtered by Search Key or Name.
  2. Open a category record and confirm the **Assigned Products** detail grid is present.
  3. Verify the child grid shows identifying product fields only, not the full editable product form.
  4. Inspect an assigned-product row and confirm the environment exposes the contract-declared product-category actions that apply to that row, such as variant or service-relation actions.
- **Automated evidence:** No dedicated window-specific test file was found for Product Category. Use [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared loader/route coverage.
