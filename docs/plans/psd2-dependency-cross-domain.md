# Cross-domain plan — Align baseline with the PSD2 dependency

**Ticket:** ETP-4121 (branch) · **Type:** cross-domain (multi-window) baseline alignment
**Scope label:** `cross-domain-approved`

## Why this is cross-domain
`com.etendoerp.go` now declares the **PSD2** module as a dependency (`build.gradle`). The PSD2
module adds the extension-model column `EM_Psd2_Generate_Bank_Payment` (a "Generate Bank Payment"
process button) to the shared `C_Order` / `C_Invoice` / `FIN_Payment` tables. Because Schema Forge
extracts windows from AD, that column now appears in **every window whose entity sits on those
tables** — so re-generating their contracts touches 10 windows at once. This is a single,
mechanical dependency-rollout change, not 10 independent feature changes.

## Domains touched
- **schema_forge** (10 window contracts + offline cache):
  `payment-in`, `payment-out`, `purchase-invoice`, `purchase-order`, `return-from-customer`,
  `return-to-vendor`, `sales-invoice`, `sales-order`, `sales-quotation`, `sii-monitor` —
  `contract.json` / `contract.mcp.json` / `generated/web/*` regenerated, plus
  `cli/cache/ad-snapshot.json` refreshed so the offline regen check sees PSD2.
- **com.etendoerp.go** (runtime config + dependency):
  `build.gradle` (PSD2 dependency), `ETGO_SF_FIELD.xml` + `ETGO_SF_ENTITY.xml` (the new field rows
  + cascaded SEQNO renumbering, via `export.database`).

## What it does NOT change
- No UI/behavior change: `EM_Psd2_Generate_Bank_Payment` is classified `discarded` where it's an
  orphan (sales/purchase order & invoice headers) and only `included` where the PSD2 module placed
  a real AD_Field (payment-in/out, returns, sii-monitor). No new screens, no contract semantics
  beyond surfacing the dependency's field.
- No financial-account contract-driven changes (those shipped separately on this branch).

## Tests / verification
- `make regen-check FROM_CACHE=1 REGEN_CHECK_PREV_XML_DIR=../modules/com.etendoerp.go/src-db/database/sourcedata`
  → **32 OK / 0 FAIL** (predicted ETGO_SF XML matches the committed go sourcedata).
- DB verification: the `EM_Psd2*` `ETGO_SF_FIELD` rows exist after `PUSH_TO_NEO=1` (13 rows across
  the 10 specs, `isincluded` Y/N matching classification).
- The Offline Regeneration Check (CI) passes with the refreshed cache + exported XML committed
  together.

## Rollback
- Revert the schema_forge commit (10 contracts + `ad-snapshot.json` + new `BankPayments*` files)
  and the com.etendoerp.go commit (`build.gradle` + `ETGO_SF_*.xml`). Both repos revert in lockstep
  on `feature/ETP-4121`. Removing the PSD2 dependency from `build.gradle` and restoring the prior
  cache returns the baseline to its pre-PSD2 state; no DB migration is involved (config-only).
