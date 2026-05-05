# Complete Onboarding + Roles + Email Config

> Tema: Configuración · Dev: D · Semanas: S5 (26/05) → S6 (02/06) · Prioridad: 🟠 P3

## Intent

Take a brand-new customer from "I just signed up" to "I can post my first invoice" in <30 minutes via a guided onboarding wizard. Today the partial onboarding (April 2026) covers org + first user; this task completes the picture: country pack, chart of accounts, fiscal year, roles, email config, and a getting-started checklist.

## Scope (What this should do)

- Multi-step wizard launched on first login of an org admin:
  1. Country + language → drives localization pack (`../localizacion/localization-others.md`).
  2. Tax id (NIF/CIF) + legal name + fiscal year start.
  3. Logo + invoice header text (used by all PDF templates).
  4. Email config: SMTP / Gmail / O365 OAuth, sender name + reply-to.
  5. Invitations: add team members with roles (Admin, F&A, Sales, Warehouse, Read-only).
  6. Optional: connect first bank (PSD2 — `../finanzas/psd2-bank-connection.md`), import suppliers/customers/products from XLSX.
- Roles: pre-baked role set with sensible permissions per persona; org admin can clone + tweak.
- Email config tested at the end of the wizard (sends a "Test email" before letting the user finish).
- Getting-started checklist on the dashboard for the next 14 days: "Create your first invoice", "Reconcile a bank account", etc. — items can be dismissed.
- Re-runnable wizard accessible from Settings (in case a step needs revisit).

## Subtareas (How)

1. Build the wizard as a `wizard` layout type window (coordinate with the Schema Forge Developer task for `year-end-close.md` — same layout).
2. Step components are stateful and remember progress server-side (`etgo_onboarding_state` table).
3. Country selector reads the localization pack registry; selection triggers the import (chart of accounts, taxes, locale).
4. Email config: separate forms for SMTP / Gmail / O365 OAuth; backend service `EmailConfigService` validates by sending a test email.
5. Role seeding: define the canonical roles in `tools/seed-data/roles/` and load on org creation; allow per-org clone + edit.
6. Bulk import drivers (suppliers, customers, products) reuse the `xlsx` skill — they live as separate optional steps.
7. Getting-started checklist on the dashboard: items resolve themselves automatically when conditions are met (e.g. "first invoice" auto-checks when the first invoice is posted).

## Dependencies

- `../localizacion/localization-others.md` — country pack mechanism
- `../localizacion/chart-of-accounts-spain.md` — Spain default
- `../finanzas/psd2-bank-connection.md` — optional bank step
- `../ventas/sales-payment-collection.md` — uses email engine
- `../compras/email-invoice-ingestion.md` — uses email engine

## Acceptance criteria

- [ ] A new org admin completes onboarding in <30 min including bulk-import of 100 customers + 100 products.
- [ ] After onboarding, the user can immediately create + send a sales quotation by email.
- [ ] Each pre-baked role grants the right windows (verify by logging in as each role).
- [ ] Email test send succeeds before allowing the user to finish step 4.
- [ ] Re-entering the wizard from Settings preserves progress.
- [ ] Getting-started checklist auto-resolves the "first invoice" item when one is posted.

## Related windows / artifacts

- [user.md](../../../generated-custom-windows/user.md)
- `../localizacion/chart-of-accounts-spain.md`, `../localizacion/localization-others.md`
- `../finanzas/accounting-dashboard.md` — checklist surface
- `../ventas/sales-payment-collection.md`, `../compras/email-invoice-ingestion.md` — share email config

## Notes / Risks

- This is the first impression — UX investment pays back forever.
- Don't block the user on optional steps; allow "skip for now" for everything except country, tax id, fiscal year.
- Email config is the most failure-prone — invest extra error messaging (SPF/DKIM hints, port issues, OAuth scope problems).
- Re-running the wizard must NOT wipe data the user has already added (idempotency).
