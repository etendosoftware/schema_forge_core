# @etendoerp/apps-sdk

Internal browser-side SDK for Etendo embedded apps (internal use only).

See `docs/proposals/etendo-apps-sdk.md` for the full design and API reference.

## Styling

To make an app inherit the Etendo shell look (colors, radius, typography):

```js
// main.jsx / main.ts
import '@etendoerp/apps-sdk/styles.css';
```

This ships CSS tokens (`:root` custom properties: `--background`, `--foreground`,
`--primary`, `--border`, `--radius`, ...) plus minimal element defaults
(`body`, headings, `button`, `input`, `select`, `textarea`, `table`).

If you only want the tokens (and keep your own reset):

```js
import '@etendoerp/apps-sdk/tokens.css';
```

See `docs/proposals/apps-sdk-styling.md` for the full token inventory.
