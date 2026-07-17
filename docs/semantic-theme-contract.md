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

Both `:root` and `.dark` implement the complete contract. Use the semantic
Tailwind utilities (`border-border-control`, `border-border-structural`,
`text-text-secondary`, `text-text-disabled`, `text-icon-secondary`, and
`ring-focus-ring`) instead of neutral hex values or opacity-diluted functional
borders.

Products may override tokens only at an application theme boundary such as
`[data-theme="product"]`. The override must define every semantic token and
pass `validateThemeContract`; window schemas and `decisions.json` must not
provide theme colors. A disabled control needs its explicit semantic state,
not a low opacity applied to already-muted content.

The core defaults and consumer themes must be tested against every actual
surface they use, including card and page backgrounds. Brand, status, chart,
and print-only colors are outside this contract unless they provide a
functional boundary or meaningful text/icon state.
