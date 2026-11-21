# Output sink inventory (ETP-4561, SECURITY 7/7)

Covers `schema_forge_core`, `schema_forge` and `modules/com.etendoerp.go`. Result legend:
**Vulnerable (fixed)**, **Safe** (characterized, test kept as regression), **Safe by inspection** (no test, reason given), **Unverified** (follow-up).

Follow-up tickets are opened under epic ETP-3504 by the delivery owner. **Before merge, the PR author must replace these placeholders with the real ETP keys (and say so in the PR description):** `FU-PDF`, `FU-EMAIL`, `FU-CLASSIC`, `FU-INSPECT` (below).

## schema_forge_core

| # | Source | Untrusted origin | Sink | Context | Defense | Test | Result |
|---|--------|------------------|------|---------|---------|------|--------|
| 1 | app-shell-core React views (e.g. `DistinctValuesList`) | API/DB record text | JSX text / attributes | HTML text, attribute | React default escaping | `components/contract-ui/__tests__/outputEscaping.vitest.jsx`; grid cell, form field and record title in schema_forge: `contract-ui/__tests__/output-escaping.vitest.jsx` | Safe; no `dangerouslySetInnerHTML`, `innerHTML`, `document.write` in this repo |
| 2 | `pages/AuthorizePage.jsx` Deny | `redirect_uri` query param | `location.href` | URL | `parseSafeUrl` + URLSearchParams for `error`/`state` | `AuthorizePage.vitest.jsx` (ETP-4561 block) | **Vulnerable (fixed)**: `javascript:` ran on Deny; unsafe URI now shows "Invalid redirect URL received" |
| 3 | `pages/AuthorizePage.jsx` Authorize | `redirect_url` API response | `location.href` | URL | `parseSafeUrl` | same | Defense in depth (fixed) |
| 4 | `AuthorizePage` InstallButton | literals from `lib/mcpClients.js` | `location.href` | URL | trusted constants | mcpClients tests | Safe |
| 5 | `reports/ReportViewerFrame.jsx` | `report.baseUrl` / `params` from `createReportDescriptor` (app-author config via `AppShellRuntime`, no end-user input) | `<iframe src>` | URL | `encodeURIComponent` + `URLSearchParams` | `reports/__tests__/ReportViewerFrame.vitest.js` | Safe: reportId/params cannot change scheme, host or path; only `baseUrl` (trusted config) can. Not wrapped in `parseSafeUrl` because no caller passes untrusted input |
| 6 | `etendo-go-core` onboarding `location.href = buildAppReturnToHref(...)` (OnboardingFlow, EnvSelectStep, SetupProgressStep) | `returnTo` query param | `location.href` | URL (relative) | `isSafeLocalReturnTo`: must start `/`, no `//`, no `\`, not `/login`/`/onboarding` | existing `etendo-go-core/test` for `oauthReturnTo` | Safe (same-origin path only) |
| 7 | `templates/reports/document-branding.hbs` | `org_name`, `meta.title` | `alt="{{ }}"` | HTML attribute | Handlebars escaping | `tools/report-server/__tests__/output-sinks-escaping.test.js` | Safe |
| 8 | report templates `{{{css}}}` | server-built CSS | `<style>` | CSS | trusted value | - | Safe by contract: never put user data in `{{{ }}}` |
| 9 | `components/import/ImportDialog.jsx` `a.href` | in-memory Blob | download link | URL | `URL.createObjectURL` | - | Safe by inspection |

## schema_forge

| # | Source | Untrusted origin | Sink | Context | Defense | Test | Result |
|---|--------|------------------|------|---------|---------|------|--------|
| 10 | `contract-ui/ReportDrawer.jsx` local fallback preview | record values, filter values, column labels, title | `iframe.document.write` and print `window.open` + `document.write` | HTML text (same-origin document) | **was none** → `escapeHtml` (`lib/escapeHtml.js`) | `ReportDrawer.escaping.vitest.jsx` (fails on the old code), `lib/__tests__/escapeHtml.test.js` | **Vulnerable (fixed)**: a record value like `<img onerror>` executed in the app origin when jsreport was down. The jsreport path renders through Handlebars `{{ }}` (see 7) |
| 11 | `support/helpDocs.js` `stripHtml` | help-docs search index text | `div.innerHTML` on a detached node | HTML parse | **was** `innerHTML` (loads `<img>`, fires `onerror`) → inert `DOMParser` | `helpDocs.vitest.js` (fails on the old code: asserts no `innerHTML` assignment) | Hardened (source is the Etendo help site, i.e. semi-trusted) |
| 12 | `reports/reportDocumentUrl.js` → `DynamicDrillPanel` `window.open` | `docWindow`, `recordId`, query key/value from report SQL | `window.open(url)` | URL | fixed `location.origin` prefix, query encoded | `reports/dynamic/__tests__/drillDown.vitest.js` | Safe: scheme/host cannot change (path only) |
| 13 | `contract-ui/DocumentPrintDrawer.jsx` `window.open` | `clientUrlRef` (app-created blob URL) / `URL.createObjectURL(pdf)` | `window.open` | URL | app-created blob URLs | - | Safe by inspection |
| 14 | `contract-ui/DocumentPreview.jsx` `<object data>`/`<iframe src>` | `pdfUrl` (blob URL from the app's own PDF fetch) | iframe/object | URL | app-created blob URL | - | Safe by inspection |
| 15 | `artifacts/sales-quotation/custom/QuotationConfirmModal.jsx` `location.href` | `route` built in code from record id | `location.href` | URL (path) | `basePath` from `location.pathname`; prefix is same-origin | - | Safe by inspection |

## modules/com.etendoerp.go

| # | Source | Untrusted origin | Sink | Context | Defense | Test | Result |
|---|--------|------------------|------|---------|---------|------|--------|
| 16 | `PisReturnCallbackServlet` `FALLBACK_BODY` inline `<script>` | none: static constant, no interpolation | HTTP response HTML | HTML/JS | constant string; `postMessage` target `'*'` carries only `{type:'pis-completed'}` | - | Safe by inspection (no untrusted data); the `'*'` target is data-free |
| 17 | `SupportAccessMessages.link` / `openInNewTabScript` | support-access URL | `<a href>` and `window.open(JSONObject.quote(url))` | HTML attribute, JS string | `isSafeHttpUrl` allowlist, `escapeHtml`, JSON quoting, `noopener,noreferrer` | `SupportAccessMessagesTest.java` | Safe |

## Out of scope / follow-up
- Rich text: **not supported**. No field renders sanitized rich HTML in the repos searched; no sanitizer is needed or added.
- PDF generation (jsreport/Chrome): out of scope here; owner follow-up `FU-PDF` (must test untrusted fields interpolated into PDF templates).
- Email templates: out of scope; owner follow-up `FU-EMAIL`.
- Classic administration and other integrations: `FU-CLASSIC`.
- Rows marked "Safe by inspection" (9, 13-16) get tests under `FU-INSPECT`.
- CSP / Trusted Types: defense in depth only; not added.
- QA/security review: pending.

## Rules
- `lib/safeUrl.js` (`parseSafeUrl`) is the only navigation URL policy: https by default; rejects `javascript:`, `data:`, `vbscript:`, `file:`, `blob:`, `about:`, `filesystem:`, credentials, malformed hosts and protocol-relative URLs; canonicalizes the output.
- Compatibility with ETP-4556 `allowedSchemes` (`lib/validation`): `lib/__tests__/safeUrl-parity.test.js` runs one table through both. Intentional differences: the sink rejects embedded credentials (the validator ignores them), hard-blocks dangerous schemes even with custom schemes, and never accepts protocol-relative URLs. Relative paths are opt-in.
- `http:` is accepted for OAuth `redirect_uri` only for RFC 8252 loopback clients; app deep links use custom schemes.
- No storage-time sanitization; encode at each sink for its own context (`escapeHtml` for HTML text, `URLSearchParams` for query strings, `parseSafeUrl` for URLs). Never use one for another context.
- New report/generated windows: any `{{{x}}}`, `innerHTML`, `document.write` or data-bound `href`/`src` must be added to this table with a test.

## Commands and results
Run from the worktree on branch `feature/ETP-4561`.

| Command (cwd) | Result |
|---------------|--------|
| `npm test` (`schema_forge_core/packages/app-shell-core`) | 2187 tests, 2187 pass, 0 fail |
| `npx vitest run` (same) | 65 files, 1351 tests pass |
| `npm test` (`schema_forge_core` root, cli) | 4007 tests, 4007 pass, 0 fail |
| `node --test tools/report-server/__tests__/*.test.js` (`schema_forge_core`) | 138 tests, 133 pass, 5 fail. The same command on `origin/develop` (detached worktree): 133 tests, 128 pass, the same 5 fail (helper whitelist, i18n groupBy, company-logo, branding partial) — pre-existing, not caused by this change; `output-sinks-escaping.test.js` passes 5/5 |
| `node --test src/lib/__tests__/escapeHtml.test.js` (`schema_forge/tools/app-shell`) | 4 pass |
| `npx vitest run src/components/support/__tests__/helpDocs.vitest.js src/components/contract-ui/__tests__/ReportDrawer src/components/contract-ui/__tests__/output-escaping.vitest.jsx` (same) | all pass (helpDocs 20, output-escaping 16, ReportDrawer suites) |
