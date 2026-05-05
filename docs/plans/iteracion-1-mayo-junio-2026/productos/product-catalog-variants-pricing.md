# Product Catalog + Variants + Price Lists

> Tema: Productos · Dev: C · Semanas: post S6 · Prioridad: 🟠 P3

## Intent

Give the user a clean catalog management experience: products with attributes, variants (size / color / etc.), categories, units of measure, and price lists. The current Etendo product window has ALL the fields but is overwhelming; we need a simplified, gallery-style UI that surfaces the 80% case and tucks away the rest.

## Scope (What this should do)

- Gallery view of products with image, name, code, category, current cost, current price, on-hand stock.
- Search + filter by category, supplier, attributes.
- Product detail with sections: identity, pricing, stock, sourcing, accounting, attributes, attachments.
- Variants: a parent product with child SKUs varying by attribute (Size: S/M/L; Color: red/blue). Each variant has its own SKU, barcode, stock, price.
- Price lists: support multiple price lists per org (e.g. Wholesale, Retail, Promo); per-product prices per list; date-bounded.
- Bulk import: XLSX upload of products, variants, prices (reusing the `xlsx` skill).
- Quick-add product: minimal form to onboard a product fast (name, code, category, price).

## Subtareas (How)

1. Confirm [product.md](../../../generated-custom-windows/product.md), [product-category.md](../../../generated-custom-windows/product-category.md), [price-list.md](../../../generated-custom-windows/price-list.md), [unit-of-measure.md](../../../generated-custom-windows/unit-of-measure.md) cover the model.
2. Build the gallery layout (already exists per `product.md`) — refine UX with sticky filters and infinite scroll.
3. Variants: leverage Etendo's existing attribute set / instance model (`m_attributeset`, `m_attributesetinstance`) and present it as a "variants" tab on the parent product.
4. Price list maintenance: improve [price-list.md](../../../generated-custom-windows/price-list.md) with bulk-edit and effective-date toggle.
5. Bulk import: parser handles parent + variants + per-list prices in one XLSX, validates referential integrity, reports per-row errors.
6. Quick-add modal: minimal fields, with sensible defaults from the org or category.

## Dependencies

- [product.md](../../../generated-custom-windows/product.md)
- [product-category.md](../../../generated-custom-windows/product-category.md)
- [price-list.md](../../../generated-custom-windows/price-list.md)
- [unit-of-measure.md](../../../generated-custom-windows/unit-of-measure.md)
- xlsx skill

## Acceptance criteria

- [ ] Gallery loads 1,000 products in <2s with images.
- [ ] Variant tab on a parent product shows its 12 SKUs, each with own stock and price.
- [ ] Switching active price list updates prices in lists / orders / invoices reactively.
- [ ] Bulk import of 500 products with variants and prices completes in <30s and reports invalid rows.
- [ ] Quick-add creates a usable product with a sensible default cost / price / category.
- [ ] Stock and pricing data shown in the product card matches the source-of-truth queries.

## Related windows / artifacts

- [product.md](../../../generated-custom-windows/product.md)
- [product-category.md](../../../generated-custom-windows/product-category.md)
- [price-list.md](../../../generated-custom-windows/price-list.md)
- [unit-of-measure.md](../../../generated-custom-windows/unit-of-measure.md)
- `../inventario/multi-warehouse-stock.md` — stock numbers shown on the card

## Notes / Risks

- Etendo's attribute model is powerful but confusing — invest in the variants UX so it feels native.
- Bulk import errors must be granular (per row, per field) — failing the whole import on one bad row is a poor experience.
- Image storage: attach to `c_file` and serve via the existing file gateway; do NOT embed images in the DB.
