# Feedback Log

Append-only log of errors, bugs, and improvement opportunities discovered during development.
Each entry should include: date, context, what happened, and suggested fix or status.

---

## 2026-03-13 — push-to-neo entity matching fails for curated names

**Context:** Pushing Sales Order to NEO Headless via `push-to-neo.js`.
**Problem:** Step 3 (field visibility update) failed for all 63 fields with "no entity" error. The contract uses curated entity names (`order`, `orderLine`) but `PopulateSpec` creates entities with AD tab names (`Header`, `Lines`). The matching logic only tried `tabId` (null in contract) and `entityName` (no match).
**Fix:** Added tableName-based fallback in `push-to-neo.js`. Three-level matching: tabId -> name -> tableName. Commit `1343db6`.
**Status:** Fixed.

## 2026-05-29 — ETP-4083: Tailwind purged core-package classes (transparent calendar background)

**Context:** In Sales Order, opening the calendar of the "Order Date" field showed the popover with a **transparent background** (the form fields behind it bled through). Reported visually on the `DateField`.

**Problem:** `DateField` and `PopoverContent` live in `packages/app-shell-core/src` and paint the background with the semantic class `bg-popover` (→ `hsl(var(--popover))`). The Tailwind `content` globs in `tools/app-shell/tailwind.config.js` only scanned `./src` and `artifacts/**/generated`, **not** the core package source. Since `bg-popover` appeared in no scanned file, Tailwind **purged** it from the final CSS → the popover ended up with no `background-color`. Verified: the built CSS (`dist/assets/*.css`) had **0** `.bg-popover` rules.

**Root cause:** UI components were moved to `packages/app-shell-core/src` (a previous task) without updating the Tailwind `content` globs to include that new path. It affected ALL classes used only in the core, not just `bg-popover` (also `dropdown-menu`, `command`, `select`, etc. with semantic tokens like `text-popover-foreground`).

**Fix:** Add a generic glob for the workspace package sources to the Tailwind `content` (not a single package, so any future package under `packages/` is covered automatically):
```js
content: [
  './index.html',
  './src/**/*.{js,jsx}',
  '../../artifacts/**/generated/**/*.{js,jsx}',
  '../../packages/*/src/**/*.{js,jsx}', // ← recovers classes from any workspace package
],
```

**Scope verified:** Of the 6 packages in `packages/`, only `app-shell-core` renders Tailwind UI (39 files with `className`, all under `src/`) and is imported by the app (46 files). The other 5 (`apps-sdk`, `apps-sdk-bff`, `schema-forge-core`, `schema-forge-stack`, `schema-forge-agent-context`) have no `className` and are not imported by the app. `app-shell-core` does not import UI from other packages, so there is no pending cascade scan. A single glob covers the whole problem.

**Prevention:** Any future move of components with Tailwind classes to a new package under `packages/` is already covered by the generic glob `../../packages/*/src/**`. A regression guard test was also added (`tools/app-shell/src/__tests__/tailwind-purge-guard.vitest.js`) that builds the real CSS and fails in CI if the semantic classes that exist only in the core (`bg-popover`, `text-popover-foreground`) get purge again — previously the build did not fail and the style silently disappeared. Verified: removing the glob makes the test fail 3/4; restoring it passes 4/4.

**Status:** Fixed.
