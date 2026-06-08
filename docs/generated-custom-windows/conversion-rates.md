# Conversion Rates

## Intent
Maintain the general currency conversion rates the system uses when a document currency differs from the organization's base currency. Each record defines, for a `Currency → To Currency` pair over a validity window, the multiply rate and its inverse divide rate. These are the same rates the invoice completion guard (ETP-4030) looks up before allowing a foreign-currency invoice to be completed — see `purchase-invoice.md` and `sales-invoice.md`.

Rates can arrive two ways: created manually by a user, or downloaded automatically by the conversion-rate downloader job (`com.smf.currency.conversionrate`). Auto-downloaded rates are flagged `Synced` and are locked from manual edits so a scheduled refresh and a human edit cannot silently fight over the same pair. The audit trail for the downloader runs lives in the companion window — see `conversion-rate-downloader-log.md`.

## What this window should allow
Users should be able to create, review, and update the general conversion-rate catalog by setting the source currency, the target currency, the validity dates, and the multiply/divide factors.

From the current generated form and decisions, the visible window allows a user to:
- choose the source **Currency** (defaults to the client's base currency)
- choose the **To Currency** (defaults to the client's base currency)
- set **Valid From Date** (required) and an optional **Valid To Date**
- enter **Multiple Rate By** (the factor that converts source → target) and **Divide Rate By** (its inverse)
- read the **Synced** flag, which is display-only and indicates whether the record was produced by the automatic downloader

When **Synced** is `true`, every editable field becomes read-only (`readOnlyLogic: record['sMFCRSynced'] === true`), so an auto-downloaded rate can be viewed but not hand-edited. Manually created rates have `Synced = false` and remain fully editable.

## Interaction model
- **Route:** `/conversion-rates` and `/conversion-rates/:recordId`.
- **Visibility:** visible from the **Finance** group in `tools/app-shell/src/menu.json` (`windowId: "116"`), alongside Fiscal Monitor and Fiscal Models.
- **Implementation type:** generated window loaded through `tools/app-shell/src/windows/registry.js`; `category: finance`.
- **Window shape:** single-entity window (`conversionRate`) with no child entities and no declared process endpoints in the generated index.
- **List columns:** Currency, To Currency, Valid From Date, Valid To Date, Multiple Rate By, Divide Rate By, and Synced.
- **Form sections:** the `principal` section holds Currency, To Currency, Valid From/To, and the read-only Synced flag; Multiple Rate By and Divide Rate By sit in the `other` section.

## Reactive behavior and dependencies
- **Synced lock:** the single reactive behavior in the window is the `sMFCRSynced`-driven read-only cascade described above. There is no automatic computation of the divide rate from the multiply rate (or vice versa) in the generated form — both factors are entered/imported independently, mirroring the classic AD `C_Conversion_Rate` behavior.
- **Currency defaults:** both Currency and To Currency default to the client base currency via `@SQL=SELECT C_CURRENCY_ID FROM AD_CLIENT WHERE AD_CLIENT_ID = @AD_CLIENT_ID@`, so a new manual record starts from the organization's own currency and the user changes one side.
- **Downstream consumer:** these records are read at invoice completion by `InvoiceExchangeRateValidator.checkRateForCompletion()` (`com.etendoerp.go`) through the AD general-rate lookup. A missing rate for the needed pair is what triggers the `SMFCR_NoRateOnComplete` block on the invoice windows.

## Gap assessment
- The window captures the rate definition, but the business rules around overlapping validity windows for the same currency pair are enforced by the AD layer, not surfaced in the window UI.
- `Multiple Rate By` and `Divide Rate By` are independent inputs; the UI does not validate that one is the reciprocal of the other, so a manually entered pair can be internally inconsistent.
- The `Synced` flag is read-only in the UI but is set by the downloader job; there is no in-window action to "unlock" or re-sync a record — that lifecycle is owned by `com.smf.currency.conversionrate`.

## Manual verification
1. Open `/conversion-rates` from the **Finance** menu group and confirm the list loads with the Currency / To Currency / validity / rate columns and the Synced column.
2. Create a new record: confirm Currency and To Currency both default to the base currency, set To Currency to a different currency, enter Valid From, Multiple Rate By, and Divide Rate By, and save.
3. Reopen the saved manual record and confirm `Synced` is unchecked and all fields are editable.
4. Locate (or trigger via the downloader) a record with `Synced = true` and confirm every field is read-only — the form shows the values but blocks edits.
5. Confirm the validator behavior end-to-end: with no rate for a given pair, completing a foreign-currency invoice is blocked (`SMFCR_NoRateOnComplete USD → EUR`); after adding the matching conversion rate here, completion succeeds.

## Automated evidence
- `artifacts/conversion-rates/decisions.json` declares the `conversionRate` header entity, marks `sMFCRSynced` as `readOnly`, and sets `readOnlyLogic: "@sMFCRSynced@='Y'"` on every editable field.
- `artifacts/conversion-rates/generated/web/conversion-rates/ConversionRateForm.jsx` defines the seven visible fields, the base-currency `@SQL` defaults for Currency/To Currency, and the `record['sMFCRSynced'] === true` read-only cascade.
- `artifacts/conversion-rates/generated/web/conversion-rates/ConversionRateTable.jsx` and `index.jsx` confirm the list columns, the `finance` category, and the standalone generated layout.
- `tools/app-shell/src/menu.json` places the window in the Finance group with `windowId: "116"`.
- Backend: `com.etendoerp.go` `InvoiceExchangeRateValidator` consumes these rates at completion; `com.smf.currency.conversionrate` owns the downloader that writes `Synced` records and the `conversion-rate-downloader-log` audit rows.
