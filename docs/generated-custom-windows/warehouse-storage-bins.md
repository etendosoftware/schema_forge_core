# Warehouse Storage Bins

This guide complements [app-shell-functional-flows.md](app-shell-functional-flows.md) with window-level notes for Warehouse Storage Bins.

- **Purpose / surface:** Warehouse Storage Bins is a warehouse-to-locator maintenance view used to manage storage-bin coordinates and defaults under a warehouse.
- **Route:** `/warehouse-storage-bins`, `/warehouse-storage-bins/:recordId`
- **Visibility:** Hidden from the visible Inventory menu (`hidden: true` in `menu.json`). This is a route-only surface.
- **Implementation type:** Generated.
- **Key functional cues:**
  - `buildMenuGroups()` filters out hidden menu items, so this window is not rendered in the side menu.
  - `buildWindowMap()` still registers loaders for every `menu.json` item, including hidden ones, so the route remains directly addressable.
  - The generated page is master/detail on `warehouse -> locator`, not a standalone locator-only list.
  - Warehouse header fields focus on Search Key, Name, Description, address lines, City, Country, and Active status.
  - Locator lines focus on Search Key, X/Y/Z coordinates, Relative Priority, Default, and Active status.
  - Locator search support is limited to `searchKey`.
- **Manual verification:**
  1. Confirm there is no visible **Storage Bin** entry in the Inventory menu.
  2. Navigate directly to `/warehouse-storage-bins` and confirm the window loads successfully.
  3. Open a warehouse record from that list, or load `/warehouse-storage-bins/:recordId` directly, and confirm the detail page shows locator rows under the warehouse header.
  4. Create or edit a locator row and confirm the UI exposes Search Key, X, Y, Z, Relative Priority, and Default, while Active remains read-only in the form.
- **Automated evidence:** No dedicated window-specific test file was found for Warehouse Storage Bins. Use [app-shell-functional-flows.md](app-shell-functional-flows.md) for shared route/loading coverage.
