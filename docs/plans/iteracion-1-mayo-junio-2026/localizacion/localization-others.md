# Localization — Other Countries (Foundation)

> Tema: Localización · Dev: B · Semanas: S4 (19/05) → S5 (26/05) · Prioridad: 🔵 P1

## Intent

Lay the foundation for non-Spain localizations (LATAM and EU) so the architecture stays clean as we add Mexico, Argentina, Portugal, France, etc. Goal at end of S5: pluggable localization framework + at least one second country (Portugal recommended — closest to Spain technically).

## Scope (What this should do)

- Define a "Localization Pack" abstraction: chart of accounts seed + tax rates seed + invoice numbering rules + e-invoice integration plug-in + locale strings.
- Refactor the Spain pack (`chart-of-accounts-spain.md` + `sii-spain.md` + `verifactu-tbai.md`) to fit the abstraction so it stops being a special case.
- Add Portugal pack: SAF-T accounting plan, IVA rates (23 / 13 / 6), basic e-invoicing readiness (no real submission yet — placeholder).
- Document the contract a new country pack must satisfy in `docs/etendo-ad/localization-packs.md`.
- Country picker on org creation drives which pack is applied.

## Subtareas (How)

1. Extract a `LocalizationPack` interface with hooks: `seedChartOfAccounts()`, `seedTaxes()`, `registerInvoicePostHook()`, `provideLocaleResources()`.
2. Refactor Spain code into `SpainPack implements LocalizationPack`.
3. Build `PortugalPack`: SAF-T-compatible chart, IVA rates, locale `pt_PT.json`.
4. Build a registry that loads packs by country code at runtime.
5. Document the integration contract — what a third-party developer must implement to add a new country.
6. Update `configuracion/onboarding-roles-email.md` country picker to read the registry.

## Dependencies

- Spain pack must be working first (`chart-of-accounts-spain.md`, `sii-spain.md`, `verifactu-tbai.md`)
- `configuracion/onboarding-roles-email.md` — country picker

## Acceptance criteria

- [ ] Spain functionality unchanged after refactor (regression tests pass).
- [ ] New org with country = Portugal loads SAF-T plan + Portuguese tax rates + `pt_PT` locale.
- [ ] `docs/etendo-ad/localization-packs.md` is complete enough that a developer can build a third country pack without asking questions.
- [ ] Adding a country does NOT require changing `LocalizationPack` core — only adding a new implementation.

## Related windows / artifacts

- `chart-of-accounts-spain.md`
- `sii-spain.md`
- `verifactu-tbai.md`
- `configuracion/onboarding-roles-email.md`

## Notes / Risks

- This is the only "framework" task in P1 — it doesn't ship visible features but unblocks everything that comes after.
- Resist scope creep: do NOT try to ship full LATAM e-invoicing here. Just the abstraction + Portugal as the second example.
- Engage with potential customers about which countries are next so the abstraction reflects real needs.
