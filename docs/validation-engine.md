# Validation Engine (`@etendosoftware/app-shell-core/lib/validation`)

**Ticket:** ETP-4556 (SECURITY 2/7)

A pure, reusable, presentation-free declarative validation engine. It takes the
same per-field `validation` object that flows through the Schema Forge pipeline
(`decisions.json → resolve-curated → generate-contract`, canonical builder:
`cli/src/lib/field-validation.js`) and evaluates record values against it,
returning **machine-readable error codes** — no i18n, no DOM, no field-name
inference.

This module **only builds the engine**. Wiring it into forms / grids / import is
ETP-4557 (3/7).

## Location & import

```
packages/app-shell-core/src/lib/validation/
  validateRecord.js      public API
  constraints/           one pure evaluator per constraint
  formats.js             email + phone + URL-scheme validators
  normalize.js           coercion/trim boundary (presence, code-point length, number coercion)
  errorCodes.js          stable machine-readable codes
  compatAdapter.js       TEMPORARY name-based email/web/phone inference
  index.js
  __tests__/             Node test runner
```

```js
import { validateRecord, ERROR_CODES } from '@etendosoftware/app-shell-core/lib/validation';
```

(The subpath `./lib/*` already resolves; an explicit `./lib/validation` export is
also declared.)

## Public API

```js
validateRecord({ fields, values, operation, options }) → { valid, errors }
```

- **`fields`** — array of field descriptors. Each carries its `validation` object
  (as in `contract.json`) plus `name` (the values/errors key), and optionally
  `key`, `column`, `type`, `visibility`, `readOnly`, `hidden`.
- **`values`** — `{ [fieldName]: value }`.
- **`operation`** — `'create' | 'update' | 'partial-update'` (default `'create'`).
  On `partial-update`, only fields **present in `values`** are validated.
- **`options`** — caller-boundary knobs (see *Unchanged legacy-invalid policy*).

Result:

```js
{ valid: boolean, errors: { [fieldName]: [{ code, ...params }] } }
```

`errors` only contains failing fields; `valid` is `true` iff `errors` is empty.
Multiple failing fields, and multiple failures on one field, are all reported.

## Error codes & params

Codes are stable — never renamed, only added. Params live alongside `code`.

| Code | Params | Meaning |
|------|--------|---------|
| `REQUIRED` | — | Required field absent |
| `MIN_LENGTH` | `min`, `actual` | String shorter than `minLength` (code points) |
| `MAX_LENGTH` | `max`, `actual` | String longer than `maxLength` (code points) |
| `MINIMUM` | `min`, `actual` | Number below `minimum` |
| `MAXIMUM` | `max`, `actual` | Number above `maximum` |
| `INVALID_FORMAT` | `format` | Value fails a known format (`email`/`url`/`phone`, or synthetic `number` for a non-numeric value against a numeric bound) |
| `NOT_IN_ENUM` | `allowed` | Value not in the `enum` allowlist |
| `DISALLOWED_SCHEME` | `scheme`, `allowed` | URL scheme not in `allowedSchemes` |
| `INVALID_CONSTRAINT` | `constraint`, `reason?` | Malformed/unknown constraint definition (fail safe) |

## Semantics

- **Presence, not truthiness.** `0` and `false` are **present**; `null`,
  `undefined` and whitespace-only strings are **absent**. Mirrors the intent of
  `isPresent()` in `cli/src/lib/field-validation.js` (canonical), applied to
  field *values*.
- **Optional empty ⇒ valid.** An absent, non-required value skips every other
  constraint — the only rule that applies to an absent value is `required`.
- **String length = Unicode code points** (`[...str].length`), not UTF-16 code
  units. `maxLength: 1` accepts a single emoji; `'😀😀'` reports `actual: 2`.
- **Numeric coercion.** `string → Number` with a NaN/Infinity guard. `NaN`/
  `±Infinity` and non-numeric strings against a numeric bound → `INVALID_FORMAT`
  `{ format: 'number' }`. Localized number strings (`"1.234,56"`) are **not**
  accepted — normalize upstream.
- **URL** (`allowedSchemes` and `format: 'url'`): parsed with the WHATWG `URL`,
  surrounding whitespace trimmed, scheme lowercased, compared against the
  allowlist. Never prefix-regex, never denylist. Embedded credentials
  (`user:pass@host`) **PASS**. Unparseable → `INVALID_FORMAT` `{ format: 'url' }`.
- **Read-only / hidden / system / discarded fields are skipped**
  (`field.readOnly === true`, `field.hidden === true`, or `field.visibility ∈
  {readOnly, system, discarded}`).
- **The engine never destructively sanitizes** caller data — normalization
  produces derived values used only to make a decision.

### Constraint definition policies (contract errors)

- **Unknown `format` value** → `INVALID_CONSTRAINT` (`constraint: 'format'`,
  `reason: 'unknown-format'`). Known formats: `email`, `url`, `phone`.
- **`allowedSchemes` empty or not a non-empty array of non-blank strings** →
  `INVALID_CONSTRAINT` (fail safe — never silently pass).
- **`enum` not a non-empty array** → `INVALID_CONSTRAINT`.
- **`minLength`/`maxLength`/`minimum`/`maximum` not a finite number** (length
  bounds also reject negatives) → `INVALID_CONSTRAINT` naming the constraint.
- **Unknown constraint KEYS are ignored** (forward-compatible) — a future rule
  the engine does not yet implement does not break validation.

A malformed constraint is reported per-constraint and does not suppress the other
constraints on the same field.

### Create / update / partial-update

| Operation | Fields validated |
|-----------|------------------|
| `create` | all non-skipped fields |
| `update` | all non-skipped fields (missing `required` is flagged) |
| `partial-update` | only non-skipped fields present in `values` |

### Unchanged legacy-invalid policy

Decision: **do not block untouched data**. `options`:

- `previousValues` — prior `{ [fieldName]: value }`.
- `skipUnchangedInvalid` (default **`true`**) — when enabled, a field whose value
  is identical (`Object.is`) to its `previousValues` entry is **not validated**,
  letting a record with legacy-invalid but untouched data still save. This only
  takes effect when `previousValues` is supplied — with no previous values there
  is nothing to compare, so **everything is validated** (the default is safe on
  create and on updates that don't pass a baseline). A **changed** value is always
  validated. Set `skipUnchangedInvalid: false` to force full validation even of
  unchanged values.

## Compatibility adapter (TEMPORARY)

`email` / `web` / `phone` do not arrive as a `format` constraint today — they are
inferred from the field name. `compatAdapter.js` ports that heuristic (canonical,
still-live original: functional repo
`tools/app-shell/src/components/contract-ui/recipientEdits.js`) so consumers keep
validating those formats until the pipeline emits real constraints. **The engine
core has zero field-name inference.** When the pipeline emits `format` /
`allowedSchemes` for these, delete the adapter.

```js
import { applyCompatFormats } from '@etendosoftware/app-shell-core/lib/validation';
const fieldsWithFormats = applyCompatFormats(fields); // explicit validation always wins
```

Mapping: email → `{ format: 'email' }`; website → `{ format: 'url',
allowedSchemes: ['https'] }`; phone → `{ format: 'phone' }`. SMTP credential
fields (`EmailUser`, `EmailUserPW`, …) and non-text-like fields are excluded.

## Tests

Node test runner:

```bash
cd packages/app-shell-core
node --test src/lib/validation/__tests__/*.test.js
```

Also included in `npm test` for the package.
