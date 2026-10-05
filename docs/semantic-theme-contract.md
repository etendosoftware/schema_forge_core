# Semantic Accessibility Theme Contract

`@etendosoftware/app-shell-core` owns version 1 of the semantic theme
contract. Its CSS defaults are in `src/styles.css`, the public Tailwind mapping
is `@etendosoftware/app-shell-core/tailwind-preset`, and validation helpers are
available from `@etendosoftware/app-shell-core/theme`.

| Token | Purpose | Minimum contrast |
| --- | --- | --- |
| `--border-control` | Interactive control boundaries | 3:1 |
| `--border-structural` | Meaningful layout and table boundaries | 3:1 |
| `--border-subtle` | Decorative-only separators | Not a control boundary |
| `--text-primary`, `--text-secondary`, `--text-disabled` | Readable text states | 4.5:1 |
| `--icon-secondary` | Meaningful secondary icons | 3:1 |
| `--focus-ring` | Keyboard focus indicator | 3:1 |
| `--inverse-*` | Intentionally inverted developer surfaces | 3:1 |
| `--status-{success,warning,info,neutral}-*` | Status background, text, and boundary | Status-specific |

Both `:root` and `.dark` implement the complete contract. Use the semantic
Tailwind utilities (`border-border-control`, `border-border-structural`,
`text-text-secondary`, `text-text-disabled`, `text-icon-secondary`, and
`ring-focus-ring`) instead of neutral hex values or opacity-diluted functional
borders. Use `bg-inverse` only for an intentionally inverted surface, and
`bg-status-success`, `text-status-success-foreground`, and
`border-status-success-border` (or the corresponding warning, info, or neutral
roles) for business status presentation.

Products may override tokens only at an application theme boundary such as
`[data-theme="product"]`. The override must define every semantic token and
pass `validateThemeContract`; window schemas and `decisions.json` must not
provide theme colors. A disabled control needs its explicit semantic state,
not a low opacity applied to already-muted content.

## Field state tokens

Form fields (`Input`, `SelectTrigger`, `DateField` and the functional repo's
selector/picker shells) share one set of state styles so no field reads
differently from its neighbour:

| Token | Purpose | Light | Dark |
| --- | --- | --- | --- |
| `--field-hover` | Hover fill of an enabled field; also the disabled fill | `#F5F7F9` | `var(--muted)` |
| `--field-disabled-border` | Border of a disabled field | `#D1D4DB` | `var(--border-subtle)` |

- **Resting:** `border-[hsl(var(--border-control))]` over a card fill.
- **Hover:** `hover:bg-[hsl(var(--field-hover))]` — a fill, never a darker border.
- **Disabled:** `bg-[hsl(var(--field-hover))]`, `border-[hsl(var(--field-disabled-border))]`
  and `text-text-disabled` — no opacity, no hover.
- **Focus:** a 2px ring on focus (`focus-within` for composite fields).

These are not part of the contrast-audited `SEMANTIC_THEME_TOKENS` list: they
are fills layered under text that is already audited.

The core defaults and consumer themes must be tested against every actual
surface they use, including card and page backgrounds. Brand, chart, and
print-only colors remain outside this contract; status presentation must use
the status roles above whenever it provides a meaningful text, icon, or
functional boundary.

## Font families

| Tailwind class | Face | Use |
| --- | --- | --- |
| `font-sans` (body default) | Inter | All UI text. |
| `font-code` | Space Mono (`styles.css` loads 400/700) | Codes shown for occasional uses, e.g. account codes in the chart-of-accounts tree (ETP-5593). |
| `font-mono` | Tailwind's system monospace stack | Unchanged; already used by input fields such as `AccountCodeField`. |

`font-code` is a separate token on purpose: redefining `font-mono` would change
every existing monospace surface at once.
