# React Doctor Report

- **Date**: 2026-07-06T15:52:46.254Z
- **Average score**: 67/100
- **Workspaces scanned**: 7
- **Total errors**: 2
- **Total warnings**: 137

## Per workspace

| Workspace | Score | Label | Files | Errors | Warnings |
|---|---:|---|---:|---:|---:|
| @schema-forge/ui-preview | 47 | Critical | 3 | 1 | 6 |
| @etendosoftware/etendo-go-core | 50 | Critical | 31 | 0 | 58 |
| @etendosoftware/app-shell-core | 61 | Needs work | 95 | 1 | 47 |
| @schema-forge/quick-order-app | 67 | Needs work | 13 | 0 | 11 |
| @schema-forge/decision-panel | 69 | Needs work | 6 | 0 | 13 |
| @etendosoftware/schema-forge-stack | 82 | Needs work | 3 | 0 | 1 |
| @schema-forge/spike-hello-app | 96 | Great | 7 | 0 | 1 |

## Issues by category

| Category | Count |
|---|---:|
| Bugs | 53 |
| Performance | 35 |
| Maintainability | 32 |
| Accessibility | 15 |
| Security | 4 |

## Top 15 rules

| Rule | Count |
|---|---:|
| deslop/unused-export | 21 |
| react-doctor/exhaustive-deps | 10 |
| react-doctor/control-has-associated-label | 9 |
| react-doctor/rendering-svg-precision | 8 |
| react-doctor/no-event-handler | 8 |
| react-doctor/no-derived-state | 8 |
| react-doctor/prefer-useReducer | 6 |
| react-doctor/button-has-type | 6 |
| react-doctor/no-initialize-state | 5 |
| react-doctor/rerender-lazy-state-init | 4 |
| react-doctor/no-barrel-import | 4 |
| react-doctor/rerender-memo-with-default-value | 4 |
| react-doctor/no-pass-data-to-parent | 4 |
| react-doctor/async-await-in-loop | 3 |
| react-doctor/only-export-components | 3 |

## Errors (must fix)

| File | Rule | Line | Message |
|---|---|---:|---|
| src/App.jsx | react-doctor/no-eval | 79 | new Function() is a code-injection vulnerability: it builds & runs code from a string. |
| src/hooks/useCurrency.jsx | react-doctor/no-adjust-state-on-prop-change | 45 | This effect adjusts state after a prop changes, so users briefly see the stale value. |
