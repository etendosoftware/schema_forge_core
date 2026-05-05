# Payment Out (Supplier Payments) + Standard Cost

> Tema: Finanzas · Dev: B · Semanas: S6 (02/06) · Prioridad: 🔵 P1

## Intent

Complete the Payment Out flow (mirror of Payment In, for suppliers) AND introduce standard costing so product margins are meaningful even when the actual purchase price varies.

## Scope (What this should do)

### Payment Out

- Select supplier → list open AP invoices → check ones being paid → enter amount + method → save → invoices update.
- Single payment can settle multiple supplier invoices.
- Generate SEPA XML batch for bank upload (PAIN.001 format) for selected payments.
- Track payment status: scheduled / sent / cleared.

### Standard Cost

- Each product gets a `standardCost` field maintained per product or per organization.
- When a goods receipt enters inventory, valuation uses standard cost (not last purchase price).
- Variance between standard cost and actual purchase price posts to a "Purchase Price Variance" account.
- Period-end revaluation tool: bulk-update standard costs from a CSV or from a period's actual averages.

## Subtareas (How)

1. Extend `payment-out.md` window with bulk invoice selection (mirror payment-in).
2. Implement SEPA PAIN.001 generator as a process action on Payment Out — `GenerateSepaXmlProcess`.
3. Add `standard_cost` and `m_costtype` fields to `m_product` (verify schema; legacy Etendo may already have them).
4. Implement costing engine extension: `StandardCostingHandler` overrides the default cost calculation when `m_costtype = 'STA'`.
5. Add the variance account to chart-of-accounts seed data (template org).
6. Build the standard-cost maintenance window with bulk-edit (XLSX import / export reusing the `xlsx` skill).
7. Add unit tests for the variance posting calculation.

## Dependencies

- [payment-out.md](../../../generated-custom-windows/payment-out.md) — base window
- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md) — settlement source
- [product.md](../../../generated-custom-windows/product.md) — standard-cost field lives here
- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md) — variance account
- Etendo costing engine (do not replace, extend)

## Acceptance criteria

- [ ] Bulk-pay 5 supplier invoices, verify each is marked paid and total batch amount equals the SEPA XML control sum.
- [ ] Generated SEPA XML validates against the PAIN.001.001.03 schema.
- [ ] Goods receipt at €15/unit when standard cost is €12 posts €3 variance per unit.
- [ ] Period-end revaluation updates standard costs and posts the corresponding revaluation entry.
- [ ] Bulk import via XLSX validates rows and reports errors per row.

## Related windows / artifacts

- [payment-out.md](../../../generated-custom-windows/payment-out.md)
- [purchase-invoice.md](../../../generated-custom-windows/purchase-invoice.md)
- [product.md](../../../generated-custom-windows/product.md)
- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md)

## Notes / Risks

- SEPA XML schema is strict — use a real validator (e.g. `xerces` or `xmllint`) in tests, not regex.
- Standard cost changes are retroactive in their effects on margins — communicate clearly when they take effect (period start vs. immediate).
