# ETP-4576 — cross-domain plan: one credential scheme, chosen at runtime

This change touches three domains on purpose. It is not a feature that leaked
across boundaries: the thing being introduced *is* a boundary-crossing decision —
which credential authenticates a request — and it only works if exactly one place
decides it.

## Why it cannot be isolated

Before this, every call site decided for itself: some pasted
`Authorization: Bearer <token>`, some hand-appended `X-Go-CSRF`, some gated on a
token the cookie session never provides (a gate that is permanently false, so the
request is never issued — no error, no failed response, an empty screen). That is
why ETP-4576 was reverted once already: the frontend switched to the cookie
session while its backend (ETP-4575) had not landed, and ~170 call sites had each
hard-coded one of the two schemes.

The fix is a single decision point, `app-shell-core`'s `sessionCredentials`, plus
the wiring that lets a host select the scheme. The decision point lives in one
domain; the selection has to reach the consumers. Hence the crossing.

## Domains touched, and what each one gets

| Domain | Change |
|---|---|
| `packages/app-shell-core/src/auth` | `sessionCredentials.js` — the only place that chooses between `bearer` and `cookie`. `buildHeaders`/`buildWriteHeaders` delegate to it. `AuthProvider` is its only writer, via the `credentialMode` prop, and derives whether to restore a server session from that same prop. `clearLocalSession` purges the legacy `sf_auth_*` / `sf_platform_*` keys in both schemes. |
| `packages/app-shell-core/src/runtime` | `AppShellProviders` forwards `credentialMode`, so a host can select the scheme for the provider that publishes it — not only for its own requests. |
| `packages/etendo-go-core/src/onboarding` | Restored by reverting the revert (PR #111). The onboarding flow is where the `__Host-` session cookie is issued, so it is the one consumer that is inseparable from the scheme. |
| `tools/etendo-go-ar/app-shell` | Opts into the cookie scheme explicitly. It used to work by accident, because the cookie fetcher was `AuthProvider`'s unconditional default — which also forced the scheme on every other host, migrated or not. |

The `unknown` scope the boundary checker reports is `packages/etendo-go-core/**`
and `tools/etendo-go-ar/**`. Those are real, owned directories; the classifier's
policy simply has no rule for them yet. Worth a follow-up in the policy rather
than a reason to split this change.

## Tests

- `packages/app-shell-core/src/auth/__tests__/sessionCredentials.test.js` — the
  decision point itself, 14 cases, mutation-validated 5/5 (inverted default, CSRF
  leaking onto reads, an unguarded token producing `Bearer undefined`, a real
  merge instead of a replace, a stale bearer token surviving into cookie mode).
- `packages/app-shell-core/src/auth/__tests__/credentialPublishing.test.jsx` — the
  link that exists only in production: `AuthProvider` publishing to
  `sessionCredentials`. Every host suite replaces the provider with a mock, so the
  host proved the builders honour what is published and nothing proved the
  provider publishes the right thing. Includes the derived-default cases asserted
  on the network in both directions, and the logout purge in both schemes.
- `packages/app-shell-core/src/auth/__tests__/AuthContext.test.jsx` — the restore
  contract, now declaring the cookie scheme instead of assuming it.
- Host side (`etendo_schema_forge`): a dual-mode suite that drives real call sites
  twice, once per scheme, asserting both the header that must be present and the
  one that must be absent — mutation-validated 5/5. Plus three repo-wide ratchets
  (no new file builds a credential header, gates on a client-held token, or issues
  an unsafe request without the write proof).

Suite status when this plan was written: 812/812 node:test in this repo; vitest
clean except four files that fail identically on the epic. Host: 649/649 files,
12261 passing.

## Rollback

This is the strongest part of the design, and the reason it is shaped this way.

**Rolling back is a database change, not a redeploy.** The scheme comes from a
backend preference, `credentialMode` derives from it, and everything else —
whether requests carry a bearer token or the CSRF proof, whether the app restores
a server session on mount — follows from that one value. Flipping the preference
back to `bearer` returns the app to today's shipped behaviour with no code change
and no deploy.

The default is `bearer` precisely so that shipping this is a no-op: a host that
has not opted in behaves exactly as before, which is what the previous attempt got
wrong.

Two things to know if a rollback is ever needed:

1. **The sweep is incomplete, so do not turn the preference on yet.** Roughly 92
   of 133 unsafe request sites in the host still do not carry the CSRF proof; with
   the cookie scheme active they answer 403. The ratchets record that debt so it
   can only shrink. Turning the preference on is a separate, later decision that
   needs those sites migrated first.
2. **The revert-of-the-revert is one commit** (`Re-apply the core cookie session
   reverted by PR #111`), kept mechanically clean for exactly this reason: if the
   whole approach has to come out again, that commit is the unit to revert, and it
   does not carry the opt-in change with it.
