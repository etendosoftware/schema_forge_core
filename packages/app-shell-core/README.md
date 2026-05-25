# @schema-forge/app-shell-core

Reusable runtime package for Schema Forge apps.

It contains the app shell pieces that can run without generated artifacts:
auth/session helpers, i18n, shared UI primitives, currency context, shell layout
primitives, styles, and a report viewer frame.

It intentionally does not include generated contracts, generated windows,
`@generated` imports, app-specific registries, or custom business windows.

```json
{
  "dependencies": {
    "@schema-forge/app-shell-core": "0.1.0"
  }
}
```

```jsx
import '@schema-forge/app-shell-core/styles.css';
import { AuthProvider, LocaleProvider, ShellLayout } from '@schema-forge/app-shell-core';
```
