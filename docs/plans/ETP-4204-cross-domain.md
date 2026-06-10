# ETP-4204 Cross-Domain Plan: Move Change Password to the logout menu

**Feature:** Relocate "Change Password" from the onboarding create-environment
view into the user/logout menu via a new `ChangePasswordDialog`. On success the
user is logged out and, thanks to a one-shot flag, lands on the onboarding
**Sign In** panel to re-authenticate with the new password.

This PR is approved as cross-domain because a single self-contained UI feature
unavoidably touches two shared areas: the shared i18n catalog and the app-shell
frontend. The change is small and the two parts are inseparable — the dialog
cannot compile or render without its translation keys.

## Domains

- `app-shell-core`: shared i18n catalog — adds the `changePasswordLogoutNotice`
  key (en/es parity) in `packages/app-shell-core/src/locales/en_US.json` and
  `packages/app-shell-core/src/locales/es_ES.json`. There is no per-window/per-
  component locale file; all app strings live in the shared catalog by design,
  so any UI string addition touches this domain.
- `platform-change`: app-shell frontend under `tools/app-shell` —
  - `components/ChangePasswordDialog.jsx` (new) — modal reusing the existing
    `changePassword()` API; on success discards the rotated platform token and
    calls `onSuccess` (logout).
  - `components/UserAvatarButton.jsx` — adds the "Change Password" menu item
    above Logout (guarded by `sf_platform_token`) and sets a one-shot
    `sf_onboarding_initial_view='login'` flag before logout.
  - `pages/OnboardingPage.jsx` — removes the old change-password entry from the
    create view and consumes the one-shot flag so the post-logout landing is the
    Sign In panel instead of the Create panel.
  - `components/__tests__/ChangePasswordDialog.vitest.jsx` (new) and
    `pages/__tests__/OnboardingPage.vitest.jsx` — coverage for the dialog and the
    flag-driven login landing.

## Why This Cannot Be Split Cleanly

The dialog (`platform-change`) references the new `changePasswordLogoutNotice`
locale key (`app-shell-core`) at render time. Splitting the i18n key into a
separate PR would leave the component rendering an untranslated key, and merging
the component without the key would ship a visible English fallback. The two
parts compile, render and test together as one inseparable unit.

## Review Order

1. `ChangePasswordDialog.jsx` — fields, validation, API call, logout-on-success.
2. `UserAvatarButton.jsx` — menu item placement, token guard, one-shot flag.
3. `OnboardingPage.jsx` — old entry removal + flag consumption (Sign In landing).
4. Locale keys — `en_US.json` / `es_ES.json` parity for `changePasswordLogoutNotice`.
5. Review this plan.

## Tests

- **Frontend (Vitest):**
  - `ChangePasswordDialog.vitest.jsx` — success → onSuccess(logout), password
    mismatch blocks submit, server error keeps the user signed in (3/3).
  - `OnboardingPage.vitest.jsx` — lands on the login view consuming the one-shot
    flag, flag is cleared after use; existing suite green (38/38 total).
- `npm run build` — production build passes (no import/resolution errors).

## Rollback

The feature is purely additive and behaviour-preserving elsewhere; no DB schema
change is involved.

- **Frontend:** revert the `feature/ETP-4204` change-password commits. The
  user/logout menu falls back to just Logout; the onboarding create view no
  longer needs the old entry (already removed); the one-shot flag is only read in
  a guarded branch and is harmless if unused.
- **i18n:** the `changePasswordLogoutNotice` key becomes unused (harmless) and is
  dropped with the revert.
