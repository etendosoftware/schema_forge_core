# Onboarding Field Limits

Reference for the maximum lengths accepted by the onboarding wizard, why each one is what it is,
and how a length rejection reaches the user. Introduced by ETP-4665.

**Source of truth:** `packages/etendo-go-core/src/onboarding/fieldLimits.js` (frontend) and
`modules/com.etendoerp.go/src/com/etendoerp/go/rest/OnboardingFieldLimits.java` (backend). Both
files must stay in sync — the tests in `test/onboardingFieldLimits.test.js` and
`src-test/.../OnboardingFieldLimitsTest.java` pin the numbers.

## Why the limits exist

Onboarding does not store the form values directly. The final step (`POST /sws/go/onboarding`)
runs Etendo's `InitialClientSetup` / `InitialOrgSetup`, which write them into AD columns. Openbravo's
DAL validates column sizes **at flush time**, so an over-long value is only detected *halfway
through* tenant creation:

```
ADUser.name: Value too long. Length 255, maximum allowed 60
  at InitialSetupUtility.insertUser(InitialSetupUtility.java:694)
  at EtendoGoJwtServlet.createClient(EtendoGoJwtServlet.java:1343)
```

That exception rolls the whole transaction back and `InitialClientSetup` returns the **unresolved
AD message key** `@CreateClientFailed@`, which nothing downstream translates. Before ETP-4665 the
user saw that literal string on screen with no indication of which field was at fault.

## The limits

| Step | Field | Limit | AD column it lands in |
|------|-------|-------|-----------------------|
| 1 | Name | **60** | `ETGO_ACCOUNT.NAME` is VARCHAR(255) — no storage constraint. Pinned to the step-2 limit, see below |
| 1 | Email | **60** | `AD_USER.USERNAME` and `AD_USER.NAME`, both NVARCHAR(60) — the email is copied into them verbatim |
| 1 | Password | 128 | **No storage constraint** (see below) — defensive bound only |
| 2 | Full name | **60** | `AD_USER.NAME` NVARCHAR(60), set by `applyClientAdminDisplayName` |
| 2 | Full name *(freelancer)* | **40** | `CompanyStep` reuses a freelancer's full name as the client name, so it inherits the client-name limit |
| 3 | Company name | **40** | `AD_CLIENT.VALUE` / `AD_ORG.VALUE` NVARCHAR(40) — `InitialSetupUtility.insertClient` writes the same string to `NAME`(60) *and* `VALUE`(40), so the search key binds first |
| 3 | Tax ID (NIF) | 20 | `C_BPARTNER.TAXID` / `AD_ORGINFO.TAXID` VARCHAR(20) — **preventive**: today the tax id is only persisted in the onboarding draft and never reaches the AD |
| 3 | Address | **60** | `C_LOCATION.ADDRESS1` NVARCHAR(60) |

### Step 1's name is pinned to step 2's, not to its column

`ETGO_ACCOUNT.NAME` could hold 255 characters, but the register field is capped at 60 like the
profile field. `ProfileStep` **pre-fills** "Nombre completo" from the account name, and `maxLength`
only blocks typing — it does not truncate a value assigned by code. With a looser cap in step 1,
a 100-character name sailed through registration and then landed in step 2 already over its own
limit: inline error shown and Continue disabled on a value the user never typed there, fixable only
by manually deleting 40 characters the system had put in.

**Keep `ACCOUNT_NAME` equal to `FULL_NAME`.** Both test suites assert the equality, not just the
number.

Two derived constraints that the numbers above already satisfy:

- `AD_ROLE.NAME`(60) receives `clientName + " Admin"`, so the company name must stay ≤ 54. The 40
  from `AD_CLIENT.VALUE` covers it.
- On a name collision, `EtendoGoJwtSupport.buildClientUsername` appends `+<company>` to the email.
  The suffix is trimmed there so the result still fits `AD_USER.USERNAME`(60).

### There is no bcrypt — the password is not truncated

A widely-cited "bcrypt silently truncates at 72 bytes" does **not** apply here:

- The SaaS account password is hashed with SHA-256 + a 16-byte random salt
  (`EtendoGoJwtServlet.hashPassword`) and stored in `ETGO_ACCOUNT.PASSWORD_HASH` VARCHAR(255). The
  stored value is always `base64(salt):base64(hash)` — a **fixed 69 characters** regardless of how
  long the password is.
- The tenant admin's `AD_USER.PASSWORD` never holds the user's password at all: onboarding
  generates a random 12-character UUID slice and hashes that through `PasswordHash.generateHash`
  (SHA-512 + salt).

So the 128 cap exists purely so an abusive client cannot make the server hash an unbounded payload.
**Do not add a character counter to the password field** — it would advertise a limit that does not
exist.

## How a rejection surfaces

Three layers, in order:

1. **`maxLength` on the input** — a silent hard block in the browser. This is the normal path: the
   user simply cannot type or paste past the limit, with no error message.
2. **Inline error** — only where `maxLength` cannot express the rule. The single case today is the
   freelancer full name: `maxLength` stays at the looser 60 so a company user is never truncated,
   and the stricter 40 shows as an inline error under the field (`SetupField`'s `error` prop) with
   Continue disabled.
3. **Server-side guard** — `POST /sws/go/register` and `POST /sws/go/onboarding` validate before
   doing any work and return HTTP 400 with a machine-readable envelope:

   ```json
   { "error": { "code": "FIELD_TOO_LONG", "field": "clientName", "max": 40,
                "message": "Field clientName must not exceed 40 characters" } }
   ```

   This protects non-browser clients, and — crucially for onboarding — runs **before the NDJSON
   stream opens**, so a length problem can no longer roll a half-created tenant back.

## Error message resolution

`packages/etendo-go-core/src/onboarding/errorMessages.js` is the single place that turns a backend
failure into user-facing text. `resolveOnboardingErrorMessage(ui, source, fallbackKey)`:

1. Maps a stable code (`FIELD_TOO_LONG`, `CLIENT_CREATION_FAILED`, `ORG_CREATION_FAILED`,
   `WEAK_PASSWORD`) to an i18n key.
2. Intercepts **any** value shaped like `@SomeKey@` — a known key maps to its message, an unknown
   one falls back to the generic error. A raw AD key can never reach the DOM.
3. Passes an ordinary backend sentence through unchanged (e.g. "Email already registered"), which
   is more useful than a generic banner.

Provisioning failures keep their original AD key in the NDJSON `message` for logs and non-UI
callers, and carry the stable code alongside it. The real exception text is only in the server log
(`EtendoGoJwtServlet.createClient` / `createOrganization` log it before streaming).

### i18n keys

Defined in `genericLabels` of all three locale files in the functional repo
(`tools/app-shell/src/locales/{en_US,es_ES,es_AR}.json`):

| Key | Used for |
|-----|----------|
| `onboardingFieldTooLong` | Length rejection — must keep the `{max}` placeholder |
| `onboardingCreateClientFailed` | `@CreateClientFailed@` / `CLIENT_CREATION_FAILED` |
| `onboardingCreateOrgFailed` | `@CreateOrgFailed@` / `ORG_CREATION_FAILED` |
| `onboardingDuplicateClient` | `@DuplicateClient@`, `@DuplicateOrgName@` and friends |

`useUI()` echoes the key when it is missing, so an absent key reproduces exactly the
raw-identifier-on-screen bug this ticket fixed. `etp4665-onboarding-length-keys.vitest.js` guards
all three locales.

## Changing a limit

1. Update the constant in **both** `fieldLimits.js` and `OnboardingFieldLimits.java`.
2. Update the table above and the AD column comment next to the constant.
3. Update the expectations in `test/onboardingFieldLimits.test.js`,
   `OnboardingFieldLimitsTest.java` and `e2e/tests/flows/onboarding-length-limits.mocked.spec.js`.

Never relax a limit past its AD column: doing so puts the rollback and the raw
`@CreateClientFailed@` straight back on the user's screen.

## Related tests

| File | Repo | Covers |
|------|------|--------|
| `test/onboardingFieldLimits.test.js` | core | Limit values, `exceedsLimit`, step validation gates, inputs wired to the constants |
| `test/onboardingErrorMessages.test.js` | core | AD key interception, code mapping, no `undefined` interpolation |
| `src-test/.../OnboardingFieldLimitsTest.java` | com.etendoerp.go | Limits, `firstViolation`, the reported 255-char email |
| `src-test/.../EtendoGoJwtSupportTest.java` | com.etendoerp.go | `buildClientUsername` suffix trimming |
| `locales/__tests__/etp4665-onboarding-length-keys.vitest.js` | functional | i18n key coverage across the three locales |
| `e2e/tests/flows/onboarding-length-limits.mocked.spec.js` | functional | All three steps end to end, plus the `@CreateClientFailed@` replacement |
