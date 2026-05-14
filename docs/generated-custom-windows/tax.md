# Tax

## Intent
Define reusable tax-rate records that describe the percentage to apply, whether the tax is meant for sales, purchases, or both, and which amount should be treated as the taxable base.

On `origin/develop`, the merged tax regeneration keeps this as a simple standalone maintenance window, but the list now has clearer visual semantics: the rate is rendered as a green percentage tag and the sales/purchase scope is rendered as colored tags instead of raw database codes.

## What this window should allow
Users should be able to create, review, and update tax definitions by setting a tax name, a rate, an applicability scope, an effective date, and the base semantics used later by transactional documents.

From the current generated form and decisions, the visible window allows a user to:
- name the tax rate record
- enter the rate as a numeric percentage value
- choose whether the tax applies to both flows, sales only, or purchases only
- set a valid-from date
- choose whether document-level or line-level amounts drive tax calculation
- choose the base amount definition, including line net amount, line net amount plus tax, tax amount, alternative base amount, or alternative base plus tax

The list also lets users scan existing definitions quickly by showing the rate as a green `+<rate> %` tag and the applicability as `Sales` / `Purchase` tags. When the tax applies to both flows, the list shows both tags side by side rather than a single `Both` badge.

## Interaction model
- **Route:** `/tax` and `/tax/:recordId`.
- **Visibility:** visible from the `System` section in `tools/app-shell/src/menu.json`.
- **Implementation type:** generated window loaded through `tools/app-shell/src/windows/registry.js`.
- **Window shape:** single-entity window with no child entities and no declared process endpoints in the generated index.
- **Screen chrome:** the generated detail view hides print and the generic More menu.
- An **Attachments** tab is available in the detail tab strip, allowing files to be attached to the current record.

## Reactive behavior and dependencies
This is a standalone definition window. No parent/child behavior is visible in the current evidence.

The visible dependencies are limited to selector semantics and list rendering:
- `Applicable To` changes the intended business scope of the tax record between `Both`, `Sales Tax`, and `Purchase Tax`.
- `Doc Tax Amount` changes whether tax is conceptually based on document-level or line-level amounts.
- `Base Amount` changes which monetary base downstream calculations should use.
- The merged decisions intentionally keep `Description` discarded and `Active` hidden from the visible form, so the current user-facing form is limited to the six main fields above.

No dependent selector behavior, automatic defaulting between these fields, status-driven actions, or visible total/discount/tax recalculation logic is shown in the current window code. Any downstream reaction happens outside this definition screen.

## Gap assessment
- The window captures tax-definition inputs, but the current evidence does not show where or how those choices are enforced in sales or purchase documents.
- The list now gives friendlier visual cues for rate and scope, but the current evidence still does not document the business meaning of when each base-amount mode should be chosen.
- The visible rate field is a numeric input and the list renders `+<rate> %`, but the inspected code still does not explain rounding rules or whether business users are expected to enter `10` vs `0.10`.
- No current evidence shows validation rules that constrain incompatible combinations between applicability, document-tax amount mode, and base-amount mode.

## Manual verification
1. Open `/tax` from the `System` menu and confirm the list view loads.
2. Confirm the list renders the rate as a green percentage tag and `Applicable To` as `Sales` / `Purchase` tags.
3. For a tax whose applicability is `Both`, confirm the list shows both tags together instead of a raw code.
4. Open `/tax/<recordId>` and confirm the form exposes `Name`, `Rate`, `Applicable To`, `Valid From`, `Doc Tax Amount`, and `Base Amount`.
5. Confirm `Applicable To` offers `Both`, `Sales Tax`, and `Purchase Tax`.
6. Confirm `Doc Tax Amount` offers `Document Amount` and `Line Amount`.
7. Confirm `Base Amount` offers `Line Net Amount`, `Line Net Amount + Tax`, `Tax Amount`, `Alternative Base Amount`, and `Alternative Base + Tax`.
8. Confirm the visible form does not show `Description`, and that print / generic More actions are not present.
9. Save a change and reopen the record to confirm the updated definition persists.
10. Open a saved record and confirm the **Attachments** tab is visible in the tab strip. Upload a file and verify it appears in the table. Download it and delete it. When multiple files exist, confirm 'Download all (ZIP)' and 'Delete all' appear in the table header and that 'Delete all' shows a confirmation dialog before removing all files.

## Automated evidence
- `origin/develop` commit `15a2288a` added the tax-table cell helpers that drive the current badge/tag rendering.
- `origin/develop:artifacts/tax/decisions.json` marks `rate` with `cellType: taxRate`, `applicableTo` with `cellType: taxScope`, discards `description`, and hides `isActive` from the visible form.
- `origin/develop:artifacts/tax/generated/web/tax/TaxTable.jsx` renders the rate as a green `+<rate> %` tag and renders scope as `Sales` / `Purchase` tags.
- `origin/develop:artifacts/tax/generated/web/tax/TaxForm.jsx` defines the six visible form fields and the selector options for applicability, document-tax amount, and base amount.
- `origin/develop:artifacts/tax/generated/web/tax/index.jsx` confirms the route, standalone generated layout, breadcrumb, and the hidden print/More controls.
- The generated `TaxPage.jsx` includes `AttachmentsTab` in its `customTabs` prop, wired to the `C_Tax` AD table.
## Pipeline regeneration — ETP-3908

Regenerated on 2026-05-12 as part of the feature/ETP-3908 epic merge. No functional changes to this window.

- `linesLayout: "classic"` is now written explicitly to `contract.json`; previously the classic layout was the implicit default.
- `requiredHeaderFields` is now emitted in the page component; this window has no required header fields so the array is empty and there is no behavioral change.
- LinesTable template updated in ETP-3908 to include the inline-editable add-row alignment fix. This window uses `linesLayout: "classic"` so the new template branch is dead code here — no behavioral change.
