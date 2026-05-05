# Spain — Preconfigured Chart of Accounts

> Tema: Localización · Dev: B · Semanas: S1 (01/05) · Prioridad: 🔵 P1

## Intent

Ship a ready-to-use Spanish General Accounting Plan (PGC 2007 / PGC PYMES) so a new SME can start posting on day one without mapping accounts manually. The plan must include the right hierarchies, account types, and tax mappings so SII / Verifactu / Tax reports work out of the box.

## Scope (What this should do)

- Seed dataset: full PGC PYMES (groups 1–7) with parent/child hierarchy, account type (Asset / Liability / Income / Expense / Equity), and Spanish + English names.
- Tax-relevant accounts pre-mapped to the corresponding tax rates (e.g. 477 / 472 mapped to IVA Repercutido / Soportado at 21 / 10 / 4 / 0).
- Template applied automatically on org creation (organization template flow).
- Ability to switch between PGC PYMES and PGC General (full plan) at org creation time.
- Account codes follow the standard Spanish 3-to-5-digit convention (1000, 1010, 1011, etc.).

## Subtareas (How)

1. Source the plan from the BOE 2007 PGC publication; package as a CSV under `tools/seed-data/spain/pgc-pymes.csv`.
2. Build a Java importer `SpainChartOfAccountsImporter` that reads the CSV and populates `c_elementvalue` + `c_element` for the target organization.
3. Wire the importer into the organization-creation wizard (`configuracion/onboarding-roles-email.md`): "Country = Spain" → preselect "PGC PYMES".
4. Generate the tax-rate seeds (21% / 10% / 4% / 0%) with their default accounts in `c_tax`.
5. Add an i18n table for account names: ES (canonical) and EN translations.
6. Add a sanity check job that verifies the imported plan is balanced (every parent has children that sum correctly per type).

## Dependencies

- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md) — the window where the plan will display
- `configuracion/onboarding-roles-email.md` — onboarding triggers the import
- Etendo `c_elementvalue`, `c_element`, `c_tax` tables

## Acceptance criteria

- [ ] New org with country = Spain auto-loads PGC PYMES (~150 active accounts).
- [ ] All accounts visible in the chart-of-accounts window with correct hierarchy and Spanish + English names.
- [ ] Tax accounts (472 / 477) are mapped to IVA tax rates and a sample sales invoice posts correctly.
- [ ] Switching to PGC General loads the full plan (~450 accounts) without breaking existing data.
- [ ] Importer is idempotent — re-running on a populated org updates only changed rows.

## Related windows / artifacts

- [chart-of-accounts.md](../../../generated-custom-windows/chart-of-accounts.md)
- [tax.md](../../../generated-custom-windows/tax.md)
- `../finanzas/financial-reports.md` — Balance / P&L use the imported hierarchy

## Notes / Risks

- The PGC is a legal artifact — copying account names verbatim from the BOE is OK; account codes are mandatory and must not be remapped.
- Some clients will need a custom plan that extends the standard one — preserve their additions on re-import (do not overwrite).
