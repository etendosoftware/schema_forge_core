# @etendoerp/apps-sdk — Styling proposal (Option A: shared CSS tokens)

## Context

External apps (e.g. `tools/quick-order-app/`) are loaded inside an iframe by the
app-shell and talk to it through `@etendoerp/apps-sdk`. Functionally the bridge
works (JWT, `/api/me`, `/api/etendo/*`), but visually the apps feel foreign:

- The shell uses Tailwind + shadcn with a well-defined token set
  (`tools/app-shell/src/index.css`): background, foreground, primary, muted,
  border, ring, `--radius`, Inter font at 15px.
- External apps today rely on ad-hoc inline styles
  (`tools/quick-order-app/src/App.jsx` uses `fontFamily: 'system-ui'` and
  hex colors like `#b91c1c`, `#6b7280`).
- Result: a user opening “Quick Order — Sales (SDK)” jumps from shell styling
  to an unstyled-looking Vite app, even though the business logic is correct.

The gap is purely presentational: iframe apps have no way to pick up the
shell’s design tokens or typography. Each consumer reinvents them, poorly.

## Objective

Ship a minimal shared stylesheet from the SDK that:

1. Makes every iframe app inherit the shell’s core visual language
   (colors, radius, font, spacing baseline) with one import.
2. Keeps the SDK framework-agnostic (no Tailwind runtime, no React
   component library bundled — that’s a separate, later decision).
3. Stays small and opt-in: apps that want to break the visual
   contract can skip the import.

Non-goals (v1):

- Shipping a Tailwind preset (evaluated as Option B — deferred).
- Shipping a component library / design system (Option C — deferred).
- Dark-mode parity (the shell has dark mode tokens, but no consumer
  needs it yet; we keep the tokens exposed so future apps can opt in).

## Proposal

### File layout

```
packages/apps-sdk/
  styles/
    tokens.css      # CSS custom properties — source of truth
    base.css        # element defaults (body, headings, form controls, buttons)
    index.css       # @import "tokens.css"; @import "base.css";
```

`package.json` exposes the stylesheet through `exports`:

```json
{
  "exports": {
    ".": "./src/index.js",
    "./styles.css": "./styles/index.css",
    "./tokens.css": "./styles/tokens.css"
  }
}
```

### Consumer API

```js
// main.jsx
import '@etendoerp/apps-sdk/styles.css';
```

One line. No build-tool configuration. Vite resolves the CSS through the
package `exports` field. Apps that only want tokens (e.g. because they
already have their own reset) can import `@etendoerp/apps-sdk/tokens.css`.

### Token inventory (v1)

Extracted from `tools/app-shell/src/index.css` `:root`:

| Token                  | Value (HSL)   | Purpose                       |
|------------------------|---------------|-------------------------------|
| `--background`         | `220 14% 96%` | Page background               |
| `--foreground`         | `222 47% 11%` | Primary text                  |
| `--card`               | `0 0% 100%`   | Card surface                  |
| `--card-foreground`    | `222 47% 11%` | Text on cards                 |
| `--primary`            | `222 47% 11%` | Primary action background     |
| `--primary-foreground` | `210 40% 98%` | Primary action text           |
| `--muted`              | `210 40% 96%` | Muted surface                 |
| `--muted-foreground`   | `215 16% 47%` | Secondary / helper text       |
| `--border`             | `214 32% 91%` | Borders, separators           |
| `--input`              | `214 32% 91%` | Input borders                 |
| `--ring`               | `222 47% 11%` | Focus ring                    |
| `--destructive`        | `0 84% 60%`   | Error background              |
| `--destructive-foreground` | `210 40% 98%` | Error text                |
| `--radius`             | `0.5rem`      | Default corner radius         |

Typography and spacing defaults (in `base.css`):

- `font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`
- `font-size: 15px;` on `body` (matches shell).
- `-webkit-font-smoothing: antialiased;`
- `box-sizing: border-box` reset.
- Minimal form-control styling (`input`, `select`, `textarea`, `button`)
  that consumes the tokens above.

### What `base.css` styles

Just enough that an app with raw HTML looks at home in the shell:

- `body`: font, color, background from tokens.
- `h1..h6`: sizes aligned with shell hierarchy (h1=20px/600, h2=18px/600, ...).
- `button`: token-driven background, hover, focus-ring, radius.
- `input`, `select`, `textarea`: border from `--input`, radius `--radius`,
  padding aligned with shell inputs.
- `a`: primary color, underline-on-hover.
- `table`: minimal reset (border-collapse, header cell weight).

No utility classes, no component classes. Apps stay free to build their
own UI on top.

### Migration path

1. `tools/spike-hello-app/`: add the import, remove inline color overrides.
2. `tools/quick-order-app/`:
   - Add `import '@etendoerp/apps-sdk/styles.css'` in `src/main.jsx`.
   - Remove hardcoded `fontFamily`, `color: '#6b7280'`, `color: '#b91c1c'`
     from `App.jsx` — rely on token-driven defaults.
   - Replace hex colors in `OrderForm.jsx` / `LinesGrid.jsx` with
     `hsl(var(--foreground))` etc., or wrap in semantic classes
     (e.g. `.error-text { color: hsl(var(--destructive)); }`).
3. Document the import in `tools/quick-order-app/INDEX.md` and in
   the SDK README.

### Why Option A and not B/C

- **Option B (Tailwind preset):** would require every consumer to adopt
  Tailwind and maintain a compatible version. Too heavy for v1.
- **Option C (component library):** premature — we have one real
  consumer. Build tokens first, extract components when the second
  consumer duplicates a pattern.
- **Option A (shared CSS tokens):** smallest possible surface, zero
  build-tool coupling, works today. Can evolve into B or C later
  without breaking apps that already consume A.

## Doubts

- **Dark mode.** Shell has `.dark` tokens. Do we ship both now or defer?
  Recommendation: ship both (cost is trivial, parity is cheap), but
  document that no shell control currently toggles it from inside the
  iframe. Consumers wire it up when needed.
- **Namespacing.** CSS variables land in `:root` — same names as the
  shell. That’s intentional (tokens travel across iframes is not a
  concern because each iframe has its own document), but worth calling
  out so app authors don’t assume the shell is leaking them in.
- **Versioning.** Breaking changes to tokens will hit all apps on SDK
  upgrade. Treat `styles.css` as part of the public API — semver it.

## Next steps

1. Review and approve this proposal (user).
2. Implement `packages/apps-sdk/styles/{tokens,base,index}.css` and
   wire up `package.json` `exports`. (Task #33)
3. Apply in `tools/quick-order-app/src/main.jsx` and clean up inline
   styles. Verify visually in the iframe host. (Task #34)
4. Update `packages/apps-sdk/README.md` and
   `tools/quick-order-app/INDEX.md` with the one-line import.
5. Later (separate ticket): evaluate extracting a Tailwind preset
   (Option B) once a second consumer exists.
