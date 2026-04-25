# User Onboarding Runtime QA — 2026-04-24

## Scope

This report captures runtime validation of the real onboarding surfaces after Classic, DB, NEO Headless, and the app shell were available.

This run intentionally avoided creating a new environment because `POST /sws/go/onboarding` creates or validates an Etendo client/organization and imports onboarding data. That is a state-changing boundary requiring explicit approval and an agreed test tenant/client name.

## Runtime Availability

| Component | Evidence | Result |
|-----------|----------|--------|
| Docker DB | `etendo_sf2-db-1` running and healthy | Pass |
| Docker Tomcat | `etendo_sf2-tomcat-1` running and healthy | Pass |
| Classic context | `GET /etendo_sf2/` redirects to `/security/Login` | Pass |
| Direct NEO auth boundary | `GET /etendo_sf2/sws/neo/session` returns `401` without auth | Pass |
| App shell proxy | `GET /sws/neo/session` through `localhost:3100` works with auth | Pass |
| Dashboard NEO endpoints | Dashboard widget/defaults endpoints returned `200` | Pass |
| Sales Order list | `GET /sws/neo/sales-order/header?...` returned `200` | Pass |
| Sales Order new form | `/sales-order/new` loaded defaults and callouts with `200` | Pass |
| Favorites endpoint | `/sws/neo/favorites` returned `404` | Non-blocking gap |
| jsreport ping | `/jsreport/api/ping` returned `500` | Non-blocking for onboarding/Sales Order |

## Onboarding API State

Using the existing platform token in browser local storage:

| Endpoint | Result | Observed body summary |
|----------|--------|-----------------------|
| `GET /sws/go/me` | `200` | Account exists for `sbarrozo+25@gmail.com`, display name `Seba`. |
| `GET /sws/go/environments` | `200` | One environment exists: client/org `La Carla`, admin user `sbarrozo+25@gmail.com`. |
| `GET /sws/go/login?userId=<adminUserId>` | `200` | Returned an Etendo JWT for the existing environment. |

Conclusion: the account is already onboarded. Visiting `/onboarding` with the platform token auto-enters the first environment and redirects to `/dashboard`.

## Onboarding UI Checks

To test the unauthenticated onboarding UI without changing backend state, local browser auth tokens were temporarily cleared, `/onboarding` was loaded, and then the existing session was restored through the existing environment login.

| Check | Evidence | Result |
|-------|----------|--------|
| Register screen renders | `/onboarding` shows `Crea tu cuenta gratis`, required `Nombre`, `Correo electrónico`, `Contraseña`, and preview panel. | Pass |
| Empty register validation reaches backend | Clicking `Crear cuenta` empty returns visible message `Fields email, password, and name must not be empty`. Network: `POST /sws/go/register` `400`. | Pass, with UX copy note |
| Login screen renders | `Iniciar sesión` view shows required email/password fields. | Pass |
| Empty login failure surfaces | Clicking login empty shows `Invalid credentials`. Network: `POST /sws/go/login` `401`. | Pass, with UX copy note |
| Existing environment auto-login | Restored platform token, called environment login, stored Etendo JWT, returned to dashboard. | Pass |
| `/first-steps` page | Renders a static guided checklist with disabled action buttons. | Pass as informational page; not the environment creation flow |

## Sales Order Runtime Bridge

| Check | Evidence | Result |
|-------|----------|--------|
| Dashboard with environment auth | Dashboard loaded with NEO widget requests returning `200`. | Pass |
| Sales Order list | `/sales-order` rendered list shell and `GET /sws/neo/sales-order/header` returned `200`. | Pass |
| Sales Order new form | `/sales-order/new` rendered `Contact*`, `Partner Address*`, `Price List*`, `Payment Terms*`, lines table, totals, notes. | Pass |
| Defaults and callouts | `GET /sws/neo/sales-order/header/defaults` returned `200`; two `POST /callout` requests returned `200`. | Pass |
| Partner Address initial dependency | `Partner Address*` rendered disabled before Contact selection. | Pass |
| Contact selector request | Typing in `Contact*` triggered `GET /sws/neo/sales-order/header/selectors/C_BPartner_ID?isSOTrx=Y&isCustomer=Y` and returned `200` with one result (`123`). | Pass |
| Contact selection callouts | Selecting `123` populated `Contact*`, kept the form in Draft status, and triggered dependent selector/callout requests returning `200`. | Pass |
| Partner Address dependency after contact | `Partner Address*` changed from disabled to enabled after contact selection. The dependent address selector returned `200` but `items: []`, so no address was available for the selected contact. | Pass for dependency wiring; data gap for end-to-end order readiness |

## State-Changing Boundary

`POST /sws/go/onboarding` is not a read-only validation. It can:

1. Resolve or create an Etendo client.
2. Resolve or create an organization.
3. Generate/use an admin user.
4. Import the onboarding dataset.
5. Commit DAL changes.

Do not run it casually against the current account/environment because `GET /sws/go/environments` already shows an existing environment (`La Carla`).

## Recommended Next Runtime Tests

### P0: Existing environment deep check

Use the existing `La Carla` environment and validate:

1. `/dashboard` widget requests return `200`.
2. `/sales-order` list request returns `200`.
3. `/sales-order/new` defaults and callouts return `200`.
4. Type in `Contact*` and validate the `C_BPartner_ID` selector request returns `200`. Completed: the selector returned one result (`123`).
5. Select a contact and validate `Partner Address*` becomes enabled or populated. Completed: the field became enabled; the dependent address selector returned `200` with no address rows for the selected contact.
6. Do not save unless explicit record creation is approved. Completed: no save was performed.

### P0: New onboarding creation test, only with approval

If a full creation test is desired, use a unique disposable client name such as:

```text
QA Onboarding 2026-04-24 <short-random-suffix>
```

Required approval should specify:

- account to use or whether to create a throwaway account,
- client name,
- whether dataset import is expected,
- whether cleanup is required after the test.

### P1: UX copy improvements

Observed backend messages are technically correct but not polished for Spanish onboarding UX:

- `Fields email, password, and name must not be empty`
- `Invalid credentials`

Consider mapping these to localized user-facing copy.

## Disposable Onboarding-to-Invoice E2E Attempt

> Run identifier: `sbarrozo+onboarding-e2e-20260424-1515@gmail.com` / `QA Onboarding E2E 20260424 1515`.
> This run intentionally created disposable local QA data.

| Step | Evidence | Result |
|------|----------|--------|
| Account registration | `/onboarding` register flow accepted name, email, and password and advanced to profile/company setup. | Pass |
| Profile/company setup | Profile step accepted country/business type; company step accepted company name, tax ID, address, and sector. | Pass |
| Environment creation | The onboarding progress screen completed and redirected to `/dashboard` authenticated as the new account. Dashboard NEO requests returned `200`; `/sws/neo/session` returned `200`. | Pass |
| Sales Invoice form load | `/sales-invoice/new` loaded defaults, payment plan request, and header callouts with `200`. | Pass |
| Customer selector from fresh onboarded environment | `C_BPartner_ID` selector initially returned no usable customer rows, so the invoice form could not proceed with sample data alone. | Blocker: onboarding sample data gap |
| Inline contact creation | The UI modal posted `contacts/businessPartner` without `searchKey`, and NEO returned `500`: `null value in column "value" of relation "c_bpartner" violates not-null constraint`. | Blocker: Contact creation bug |
| Contact workaround for test continuation | A customer was created through the same NEO endpoint with an explicit `searchKey`, then an address was created through `contacts/locationAddress?parentId=<businessPartnerId>`. | Workaround applied |
| Payment terms | Sales Invoice payment-term selector initially returned no options. A disposable payment term was created through `/sws/neo/payment-term/header`; after reloading the invoice form it defaulted as `QA Immediate E2E`. | Blocker: onboarding/reference data gap; workaround applied |
| Invoice header save | `POST /sws/neo/sales-invoice/header` returned `500` with `Index 0 out of bounds for length 0`. Request body showed `documentType: "0"`. | Blocker: invoice cannot be created from fresh onboarded environment |
| Invoice persistence check | `GET /sws/neo/sales-invoice/header?_startRow=0&_endRow=10` returned `200` with `totalRows: 0`. | Confirmed no invoice was created |

### E2E Finding

The disposable onboarding flow reaches an authenticated dashboard, but a fresh onboarded environment is not currently invoice-ready. The first hard failure is missing customer/address/payment-term readiness; after controlled workarounds, invoice save still fails because the generated invoice payload carries `documentType: "0"` and the backend returns `Index 0 out of bounds for length 0`.

This is not a strict coverage gap; it is a product-readiness gap for the onboarding promise "create an invoice after setup".

## Goadmin Login E2E Attempt

> Requested credentials: `goadmin@etendo.software` / provided password.

| Step | Evidence | Result |
|------|----------|--------|
| Session reset | Browser `localStorage` and `sessionStorage` were cleared before opening `/onboarding`. | Pass |
| Login form | `/onboarding` login mode rendered and accepted the requested email/password. | Pass |
| Login submit | `POST /sws/go/login` returned `500` with response `Login failed due to a server error`. | Blocker |
| Server log | Tomcat logged `OBSecurityException: Entity ETGO_Account may only have instances with client 0` during `EtendoGoJwtDalHelper.updateSessionToken`. | Root-cause evidence |
| Account row check | Database row for `goadmin@etendo.software` exists, but `etgo_account.ad_client_id` is non-zero while `ETGO_Account` requires client `0`. | Data integrity blocker |
| Invoice E2E | Not attempted under `goadmin@etendo.software` because platform login did not issue a token/session. | Blocked before environment selection |

### Goadmin Finding

The requested `goadmin@etendo.software` onboarding login is blocked before dashboard/environment selection. This is not an invoice-flow failure yet; it is an account metadata integrity failure. The account must be repaired or recreated with `ad_client_id = 0` before the same onboarding-to-invoice E2E can proceed for this identity.

## Current Result

Runtime onboarding is now validated through a disposable creation attempt and a separate `goadmin` login attempt:

- Existing account/environment path: pass.
- Register/login rendering and backend error surfacing: pass.
- Disposable account/environment creation via `/onboarding`: pass through dashboard redirect.
- Sales Order bridge after onboarding: pass through defaults/callouts and Contact selector selection. Partner Address dependency is wired, but sample data remains thin.
- Disposable Sales Invoice creation from a fresh onboarded environment: blocked. Missing usable customer/payment-term seed data, broken inline contact creation without `searchKey`, and invoice header save fails with `500` / `Index 0 out of bounds for length 0` when `documentType` remains `0`.
- `goadmin@etendo.software` run: blocked at `POST /sws/go/login` because the account row has a non-zero client even though `ETGO_Account` is system-client-only.
