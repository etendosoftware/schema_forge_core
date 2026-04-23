# Tax

## Intent

Define reusable tax-rate records that describe the percentage to apply, whether the tax is meant for sales, purchases, or both, and which amount should be treated as the taxable base.

## What this window should allow

Users should be able to create, review, and update tax definitions by setting a tax name, a rate, an applicability scope, an effective date, and the base semantics used later by transactional documents.

From the current generated form and contract, the window should allow a user to:

- name the tax rate record
- enter the rate as a numeric percentage value
- choose whether the tax applies to both flows, sales only, or purchases only
- set a valid-from date
- choose whether document-level or line-level amounts drive tax calculation
- choose the base amount definition, including line net amount, line net amount plus tax, tax amount, alternative base amount, or alternative base plus tax

The list should also let users scan existing definitions quickly by showing the rate as a percentage badge and the applicability as Sales/Purchase pills instead of raw codes.

## Interaction model

- Route: `/tax` for the list and `/tax/:recordId` for record detail
- Visibility: visible from **System > Settings** in `tools/app-shell/src/menu.json`; it is not marked hidden
- Implementation type: generated window loaded through `tools/app-shell/src/windows/registry.js`
- Window shape: single-entity window with no child entities and no declared process endpoints in `artifacts/tax/contract.json`

## Reactive behavior and dependencies

No parent/child behavior is visible in the current evidence. This is a standalone definition window.

The visible dependencies are limited to selector semantics:

- `Applicable To` changes the intended business scope of the tax record between both flows, sales only, and purchases only.
- `Doc Tax Amount` changes whether tax is conceptually based on document-level or line-level amounts.
- `Base Amount` changes which monetary base downstream calculations should use.

No dependent selector behavior, automatic defaulting between these fields, status-driven actions, or visible total/discount/tax recalculation logic is shown in the current window code or contract. Any downstream reaction appears to happen outside this definition screen.

## Gap assessment

- The window clearly captures tax-definition inputs, but the current evidence does not show where or how those choices are enforced in sales or purchase documents. Downstream tax reaction behavior is therefore a gap from this window-level evidence.
- The generated UI exposes coded base options with user-facing labels, but the business meaning of when each option should be used is not documented here or in the visible contract. That leaves open ambiguity around expected accounting behavior for each base mode.
- The rate is rendered in the table as a percentage badge, which supports percentage semantics, but the contract only says `number`; precision, rounding, and whether values are entered as `10` or `0.10` are not explicitly documented in the visible evidence.
- No current evidence shows validation rules that constrain incompatible combinations between applicability, document-tax amount mode, and base amount mode.

## Manual verification

1. Open `/tax` and confirm the list view loads.
2. Confirm the list renders the rate as a percentage badge and `Applicable To` as Sales/Purchase pills.
3. Open `/tax/<recordId>` and confirm the form exposes `Name`, `Rate`, `Applicable To`, `Valid From`, `Doc Tax Amount`, and `Base Amount`.
4. Confirm `Applicable To` offers `Both`, `Sales Tax`, and `Purchase Tax`.
5. Confirm `Doc Tax Amount` offers `Document Amount` and `Line Amount`.
6. Confirm `Base Amount` offers `Line Net Amount`, `Line Net Amount + Tax`, `Tax Amount`, `Alternative Base Amount`, and `Alternative Base + Tax`.
7. Save a change and reopen the record to confirm the updated definition persists.

## Automated evidence

- `tools/app-shell/src/menu.json` exposes the `tax` entry under **System > Settings**.
- `tools/app-shell/src/windows/registry.js` maps `tax` to the generated tax window loader.
- `artifacts/tax/contract.json` defines a single-entity `Tax Rate` window, the editable fields, and CRUD endpoints for `/tax` and `/tax/:id`.
- `artifacts/tax/generated/web/tax/TaxForm.jsx` defines the visible selector options for applicability, document-tax amount, and base amount.
- `artifacts/tax/generated/web/tax/TaxTable.jsx` renders the rate as a percentage badge and applicability as Sales/Purchase pills.
- There is no dedicated automated SPA test in the current evidence for the full tax record flow or for downstream tax-application behavior.