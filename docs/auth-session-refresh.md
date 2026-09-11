# Session refresh and asynchronous ownership (ETP-5195)

## Delivery status

The core consumes the **proposed** version-1 metadata extension below. The current
backend `SFRefreshToken` returns only `{ token }`; implementing the extension and
eligibility validation is a separate `com.etendoerp.go` follow-up. This core change
alone does not complete affected-user permission propagation in the functional app.

## Proposed backend response

`GET /sws/neo/refreshtoken` keeps its existing top-level `token` and adds:

```js
{
  token,
  session: {
    version: 1,
    userId,
    clientId,
    selectedRoleId,
    selectedOrgId,
    roleList: [{ id, name, orgList: [{ id, name }] }]
  }
}
```

The server must validate an active caller and an active, eligible assignment in
the intended client, then resolve token and metadata from that same context.
`userId`, `clientId`, `selectedRoleId`, and `selectedOrgId` must match JWT claims
`user`, `client`, `role`, and **`organization`**, respectively. Refresh must not
change user or tenant. Lists contain authoritative names and eligible organizations;
the frontend never manufactures names or transfers an old role's organization rights.
The selected role and organization must occur in those lists. A null fallback role
must not bypass backend eligibility checks.

The existing `/sws/neo/session` supplies currency/branding/account identity, not
role assignments. `/sws/go/login?userId=...` returns role/org lists but requires an
account-linked identity and selects the first assigned role; it is not substituted
for the caller-scoped refresh endpoint.

## Provider contract

### Tenant-local refresh (X/Y are examples, not record IDs)

An account can be linked to separate `AD_User` records in Tenant X and Tenant Y.
Backend evidence: `EtendoGoJwtDalHelper.findEnvironmentUsersByAccountEmail` selects
active users and their clients; `buildEnvironmentJson` includes each user's own
`adminUserId` and `clientId`. The field name `adminUserId` does not imply that a
demoted environment user still holds the administrator role. `demoteFromAdmin`
updates only the targeted user after its caller-client boundary check.

Refresh uses the current JWT, not the platform account token or another environment's
user ID. `NeoAuthenticator` builds context from that JWT's `user` and `client`;
`SFRefreshToken` reads only the context user. Thus demoting the account's user in Y
must affect an active Y session, while an active X session keeps X's effective
identity and permissions. Automatic X probes are allowed; their authorization
revision can revalidate X's template grants. A renewed JWT string or transient
revision is not a tenant switch or an application of Y's permissions to X.

Core reconciliation rejects any refresh that changes user/client, even if response
metadata agrees with that foreign token. Snapshots explicitly bind controller owner,
generation, token user/client, persisted client, API base and stored tuple. A Y
response completing after replacement by X is superseded, including same-token
replacement, because generation is independent of token equality.

**Backend follow-up remains required:** current `SFRefreshToken` passes the user's
default role straight to token generation; it does not validate that role's client
against the incoming JWT client. The extension must scope eligibility and every
returned role/org list to that validated tenant and reject a cross-client default
role. Core cannot infer a role's tenant from its opaque ID alone.

On a later explicit switch to Y, `loginEnvironment` calls `/sws/go/login` for Y's
environment user to obtain fresh destination metadata. `persistEnvironmentSession`
replaces the session synchronously; provider/bootstrap refresh then resolves Y's
current authoritative context. The functional switcher must still adopt this writer.

Existing session fields, storage keys, exports, and `setSession(patch)` remain.
`initialSession` is initialization-only. `login` retains the patch API; use the
additive `replaceSession(session)` for a complete replacement with omitted fields
cleared. All mutations merge/read the synchronous controller rather than a React
render closure. They invalidate old asynchronous work before storage/callbacks.

New `useAuth()` values:

- `isSessionReady`: bootstrap has resolved or a permitted compatibility fallback
  was selected. This is distinct from `isAuthenticated`, which still means token present.
- `isRefreshingSession`, `sessionRefreshStatus`: `idle`, `refreshing`, `ready`,
  `legacy`, `failed`, or `metadata-required`.
- `authRevision`: transient authorization invalidation signal. Consumers must
  refetch role-sensitive state on revision changes, even if the role ID is unchanged.
- `captureSession()` / `isCurrentSession(snapshot)`: opaque async ownership guard;
  check after awaited work before applying a result.
- `apiSessionScope`: pass as the optional fourth argument to `createApiFetch` in
  custom host wrappers. Core `useApiFetch` does this automatically.
- `refreshToken()`: existing imperative API, now resolves `{ status }`. Concurrent
  imperative calls coalesce into a trailing request when background work is pending,
  ensuring a mutation is observed by a request started after it.

`AuthProvider` and runtime `auth` accept `apiBaseUrl`, the server/context prefix
(not a prefix already ending in `/sws/neo`). Changing it or the storage adapter
invalidates the old environment. Generations, revisions and permissions are not persisted.

### Fallback policy

- Network failure, unavailable endpoint or malformed non-metadata response retains
  the old session and releases initial bootstrap using the existing best-effort policy.
- Token-only responses with unchanged identity retain the tuple and revalidate access.
- An explicitly changed identity without metadata, or invalid supplied metadata,
  leaves the stored tuple untouched and sets `metadata-required`, nonready, with
  empty permissions. Subsequent network failures do not reopen this blocked state.
- Only valid authoritative metadata recovers a metadata-required session.

Bootstrap permission fetching waits for refresh. Every accepted authoritative tuple,
including same-role token renewal, is published before invoking the host permission
fetcher. Ambient and session-bound transports therefore use the same renewed JWT.
Acceptance advances the generation; the access request captures that new generation
and can only publish its result while it remains current.

Valid context changes withdraw previous permissions before loading new access.
Same-context refresh retains only the already-settled access map until the replacement
map is ready, then publishes permissions atomically; failure resolves to empty grants.
No new grants are inferred from metadata. This avoids a temporary access-denied branch
that would discard an otherwise authorized form. Initial bootstrap and recovery from
`metadata-required` remain nonready until the permission request settles.

`AuthGate` waits while a token-bearing session is nonready instead of redirecting to
login. No subtree key or forced remount is used. Genuine loss of window access still
uses the existing access-denied behavior; this change adds no draft-retention UX.

Automatic triggers are bootstrap, visible `visibilitychange`, and visible-window
`focus`. A 50 ms event coalescing window plus in-flight deduplication avoids duplicate
focus/visibility requests. StrictMode's replayed bootstrap setup is cancelled before I/O.

## Requests, caches and environment writers

`createApiFetch(base, getToken, onUnauthorized, scope?)` preserves its three-argument
API. With an ambient provider, legacy callers inherit request ownership. An explicit
`null` scope is reserved for bootstrap refresh, which checks its own ownership.
Superseded responses reject with `AbortError` and do not invoke logout or harvest
record versions. Body-reader promises (`json`, `text`, `blob`, etc.) are checked too;
raw stream consumption and state already handed to a caller require caller guards.
Explicit foreign-token 401s cannot log out the ambient session. Writes are never replayed.
An existing ambient owner's `null` token is authoritative logout state, not a missing
owner. A legacy three-argument client carrying a captured old token is rejected before
transport after logout; it cannot read a body or harvest a record version. Only the
absence of an owner permits the caller's token getter to supply the current token.

`DataProvider` keys include authorization revision; `useQuery` hides prior-key data
and rejects stale results. Cache `clear()` invalidates outstanding cache writes and
protects replacement in-flight entries. Currency loading waits for session readiness
and checks session ownership after parsing.

Core onboarding uses `persistEnvironmentSession(env, loginResponse)` from
`@etendosoftware/etendo-go-core/onboarding/state`. It replaces the ambient provider
synchronously, clears omitted environment fields, then persists the legacy keys before
any async cleanup/navigation. `buildEnvironmentSessionStorage` remains available.
Custom storage adapters must support the existing `read/write/clear` contract.
Snapshots also detect externally changed stored tuples before accepting late work.
Direct same-tab storage writes do not notify React; hosts must use the canonical writer
or `replaceSession` rather than relying on a browser storage event.

## Required functional/backend follow-ups

1. Implement and verify the metadata extension and refresh eligibility in the backend.
2. Update functional `useRoleMenu` and `useViewerRole` to wait for readiness, depend
   on `authRevision`, hide stale results and check snapshot ownership after awaits.
3. Update the functional request/logout wrapper to forward `apiSessionScope`, and
   migrate `useEnvironmentSwitch` to `persistEnvironmentSession`.
4. Verify two independent sessions: A promotes/demotes B; B reloads once or regains
   focus; JWT, role/org lists, menu, viewer identity, access and capabilities agree.
5. Correct the functional User guide and complete fresh REVIEW/QA evidence. Backend
   delete-ID protection and Java test compilation remain separate ticket findings.

## Verification requirements

Tester owns test changes. Required behavioral coverage includes same-batch logout,
same-token replacement, stale 401/body reads, metadata validation/recovery, bootstrap
ordering, same-role access changes, focus/StrictMode/trailing refresh, unchanged form
state, environment persistence and late cache/currency/query results. Run focused
Node/Vitest suites, `make test`, and package consumer smoke checks. Core unit tests
do not substitute for the backend/functional two-session acceptance flow.

Pending validation by QA: Matías Bernal / Emilio Polliotti.

### Current verification checkpoint — 2026-09-10 (not delivery approval)

**REVIEW rejection #1 correction:** `api.js` used nullish fallback for the ambient
token, accidentally treating a logged-out owner like an absent owner. Developer
reproduced Tester's two regressions with
`node --test packages/app-shell-core/src/auth/__tests__/apiOwnership.test.js`:
15 passed, 2 failed. Both failures performed one transport, one body read and one
clone read, and harvested `obsolete-version` after logout.

The source now selects the token by owner presence (`owner ? owner.getToken() :
getToken()`), preserving authoritative null. After the correction:

| Command | Result |
| --- | --- |
| `node --test packages/app-shell-core/src/auth/__tests__/*.test.js` | 148 passed, including all 17 ownership cases; both logout regressions reject with AbortError before transport/body/clone reads and leave the version cache empty |
| `NODE_OPTIONS=--no-experimental-webstorage npm run test:vitest --workspace=packages/app-shell-core -- src/auth src/data src/runtime` | 9 files, 114 tests passed |
| `git diff --check` | Passed |

This correction changes only API source and this evidence document; Tester-owned
tests were not edited. Re-review and human QA remain pending.

#### Earlier same-role transport correction

Tester completed task `ses_f744c606effebNX2SEmgKwAMww` and supplied behavioral tests
in this checkout, superseding the external-terminal blocker recorded below. The
coordinator reported 75 new cases, with two same-role transport failures. Developer
independently reproduced both failures before the source correction: ambient requests
used the old JWT, while session-bound requests were rejected before transport.

The correction accepts the coherent tuple before loading access for both changed and
unchanged contexts. It preserves settled same-context grants while staging their
replacement, keeps initial bootstrap nonready, and guards results with the accepted
generation. No test files were edited during this correction.

Fresh commands run from `schema_forge_core`, branch `feature/ETP-5195`:

| Command | Result |
| --- | --- |
| `NODE_OPTIONS=--no-experimental-webstorage npm run test:vitest --workspace=packages/app-shell-core -- src/auth/__tests__/sessionRefresh.vitest.jsx -t "uses the renewed JWT"` | Before fix: both transport regressions failed; 23 cases deselected |
| `NODE_OPTIONS=--no-experimental-webstorage npm run test:vitest --workspace=packages/app-shell-core -- src/auth src/data src/runtime` | After fix: 9 files, 114 tests passed, including both transport regressions, form preservation, StrictMode, same-batch logout and stale consumer results |
| `node --test packages/app-shell-core/src/auth/__tests__/*.test.js` | After fix: 146 tests passed, including metadata and API ownership regressions |

The full-suite/dependency blockers below remain historical observations, not new
full-suite results after this correction. Backend/functional integration and human QA
remain pending; these core tests are not live two-session acceptance proof.

### Earlier implementation checkpoint — 2026-09-10 (historical)

Repository: `schema_forge_core`, branch `feature/ETP-5195`. Source changes are
uncommitted. At this earlier checkpoint, external Tester task `task_778eeee1cb6c`
was blocked before execution by the Claude Code workspace-trust prompt; new
regressions had not yet been produced. This was not REVIEW/QA approval.

Commands executed from the repository root:

| Command | Result |
| --- | --- |
| `node --test packages/app-shell-core/src/auth/__tests__/session.test.js packages/app-shell-core/src/auth/__tests__/api.test.js` | 92 passed |
| `NODE_OPTIONS=--no-experimental-webstorage npm run test:vitest --workspace=packages/app-shell-core -- src/auth/__tests__/AuthContext.test.jsx src/auth/__tests__/WindowAccessGuard.test.jsx src/auth/__tests__/useWindowAccess.test.jsx src/data` | 69 passed, 2 failed: old token-only role-swap expectations require Tester migration to the authoritative contract |
| `npm test --workspace=packages/app-shell-core` | 1106 passed, 2 failed suites: missing installed `write-excel-file` |
| `NODE_OPTIONS=--no-experimental-webstorage npm run test:vitest --workspace=packages/app-shell-core` | 830 passed, 6 failed tests, 5 import-failed suites; four test failures concern changed refresh/bootstrap expectations; the remaining failures concern unchanged add-line test IDs, missing UI files and missing XLSX dependencies |
| `npm test --workspace=packages/etendo-go-core` | 214 passed |
| `NODE_OPTIONS=--no-experimental-webstorage npm run test:vitest --workspace=packages/etendo-go-core` | 6 passed |
| `make test` | Stops in CLI suite: 3248 passed, 4 failed, 5 skipped; missing installed `qrcode` |
| `npm run test:consumer --workspace=packages/app-shell-core` | Consumer package build passed; the smoke script installs dependencies in its disposable temporary consumer |
| `git diff --check` | Passed |

The initial unadjusted focused Vitest run also failed 15 data tests in setup under
Node 26 experimental web storage; disabling that Node feature made all 31 existing
data tests pass. The missing-dependency/UI files and their failing tests are unchanged
from HEAD, checked with `git diff --exit-code HEAD -- ...`; no checkout rollback or
dependency/lockfile repair was performed. A full clean-baseline execution was not run.
