# Cross-Domain Plan — ETP-4332

## Domains

- `generator-change` — `cli/src/generate-frontend.js`, `cli/src/resolve-curated.js`: new `confirmModal` process override
- `platform-change` — `packages/app-shell-core/src/lib/statusBadge.js`: RPR/RDNC/PWNC join the "deposited" (green) status bucket

## Why mixed

Both changes are pieces of a single feature — payment-in/payment-out confirm/reactivate flow — whose window-level half (`artifacts/payment-*`, shared custom components, `DetailView.jsx`) lives in the sibling repo `etendo_schema_forge` (PR `feature/ETP-4332-split` → `epic/ETP-3504`), split there because that repo owns window artifacts and app-shell UI, while this repo owns the generator and shared design-system package.

- `generate-frontend.js`/`resolve-curated.js`: the only way to make a process button open a confirm dialog (via `DetailView`'s `processConfirmModal` gate) without forcing `style: 'ghost-danger'` (red border + undo icon) is a new `processOverrides.<name>.confirmModal: true` flag, read at generation time. This is generator-owned logic — window authors only set the flag in `decisions.json`.
- `statusBadge.js`: RDNC/PWNC are the de-facto terminal "deposited" state for this business (the formal Etendo Reconcile Payment step — RPPC — is never run), so they must render with the same green tone as RPPC/PPM everywhere `StatusTag`/badge/pill helpers are used. This is shared design-system code, not window-scoped, so it belongs here rather than in a window artifact.

Both changes are required for the sibling PR's feature to work end-to-end; neither is independently useful without it, which is why they ship together rather than as two separate core PRs.

## Tests

- `cli/test/generate-frontend.confirmmodal.test.js` — 6 tests (confirmModal override across backend processes, button-field processes, decisions-only "add" processes; confirms it never implies ghost-danger styling)
- `cli/test/resolve-curated-coverage.test.js` — confirmModal override propagation from decisions.json through to the resolved contract
- `packages/app-shell-core/src/components/ui/__tests__/status-tag.test.js` — RPR/RDNC/PWNC classified as the deposited/success tone across all 5 status-badge helper functions

## Rollback

- `generate-frontend.js`/`resolve-curated.js`: revert `buildProcessesArray`'s export and the `confirmModal` fragment in all three branches (processes, button fields, decisions-only "add" processes), and drop the propagation in `resolve-curated.js`. `confirmModal: true` in a window's `decisions.json` becomes a silent no-op on next regen — no generated-output breakage.
- `statusBadge.js`: revert RPR/RDNC/PWNC back to their prior tone in all 5 classifier functions. Client-side only, no server restart needed.
