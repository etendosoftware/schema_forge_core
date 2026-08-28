/**
 * ETP-5013 — company-logo lookup for LISTING reports (report-general-ledger,
 * balance-sheet, tax-report, etc.). Unlike document (print-*) reports, a
 * listing report has no `header` object at all — `server.js` resolves the
 * org's logo id via the shared `resolveCompanyLogoDataUrl(pool, { clientId,
 * orgId, authToken, etendoBase })` helper (`../../cli/src/report-branding.js`),
 * which itself prefers the report's own `orgId` filter and falls back to any
 * org of the same client that has a logo configured (covers Inventory Stock
 * Report / Order Not Shipped, which have no `orgId` parameter at all).
 *
 * This lookup runs in TWO places in `fetchReportData`: the NEO branch (opens
 * its own short-lived pool via `getDbConfig()`, since NEO-sourced reports
 * otherwise never touch Postgres) and the SQL/Jasper branch (reuses the pool
 * already open for the main query). The document branch resolves branding via
 * `hydrateDocumentBranding` directly on the header row, not through this
 * helper — see `server-render.test.js` for that guard.
 *
 * `server.js` starts an HTTP listener on import, and its DB access goes
 * through a dynamically imported `pg` Pool (`await import('pg')`), so — same
 * as `server-render.test.js` and `server-neo-accept-language.test.js` — this
 * suite verifies the wiring against the REAL server.js source rather than
 * driving the branches end-to-end (which would require a real database).
 * Mirrors the functional repo's `tools/app-shell/test/report-api-branding-org-lookup.test.js`
 * (`report-api.js` is a hand-maintained copy of this same fetchReportData
 * shape — see that file's docstring). The exhaustive behavioral coverage of
 * `resolveCompanyLogoDataUrl` itself lives in `cli/test/report-branding.test.js`.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SERVER_SRC = readFileSync(fileURLToPath(new URL('../server.js', import.meta.url)), 'utf8');

describe('server.js — listing report company-logo lookup (ETP-5013)', () => {
  it('imports resolveCompanyLogoDataUrl alongside hydrateDocumentBranding from the shared module', () => {
    assert.match(
      SERVER_SRC,
      /import \{ hydrateDocumentBranding, resolveCompanyLogoDataUrl \} from '\.\.\/\.\.\/cli\/src\/report-branding\.js'/,
    );
  });

  it('resolves the logo for the SQL/Jasper listing branch via the shared helper, scoped by clientId and the report\'s own orgId param', () => {
    assert.match(
      SERVER_SRC,
      /const companyLogoDataUrl = await resolveCompanyLogoDataUrl\(pool, \{\s*\n\s*clientId, orgId: params\.orgId, authToken,/,
    );
  });

  it('resolves the logo for the NEO listing branch too — this branch has no DB access otherwise', () => {
    // Historically the first pass only wired resolveCompanyLogoDataUrl into
    // the SQL/Jasper branch, so every NEO-sourced listing report (Aging of
    // Payables/Receivables, Tax Report, Inventory Stock Report) silently
    // never got a logo through the production server either. Guard both
    // branches independently so that regression cannot come back unnoticed
    // in just one of them.
    assert.match(
      SERVER_SRC,
      /companyLogoDataUrl = await resolveCompanyLogoDataUrl\(logoPool, \{\s*\n\s*clientId, orgId: params\.orgId, authToken, etendoBase: ETENDO_URL,/,
    );
  });

  it('opens its own short-lived pool for the NEO branch lookup and always closes it', () => {
    const neoBranchStart = SERVER_SRC.indexOf('Company logo (ETP-5013) — missed in the first pass');
    assert.ok(neoBranchStart >= 0, 'could not locate the NEO-branch company logo comment');
    const neoBranchSlice = SERVER_SRC.slice(neoBranchStart, neoBranchStart + 1000);
    assert.match(neoBranchSlice, /const logoPool = new pg\.default\.Pool\(getDbConfig\(\)\)/);
    assert.match(neoBranchSlice, /finally \{\s*\n\s*await logoPool\.end\(\);/);
  });

  it('returns companyLogoDataUrl out of fetchReportData for both the NEO and SQL/listing branches', () => {
    assert.match(SERVER_SRC, /return \{ rows, contract, neoMeta, companyLogoDataUrl \}/, 'NEO branch return');
    assert.match(
      SERVER_SRC,
      /return \{ rows, contract, openingRows, operandRows, companyLogoDataUrl \}/,
      'SQL/listing branch return',
    );
  });

  it('falls back to an org_logo_id subquery for document reports when the header SQL does not already expose one', () => {
    assert.match(SERVER_SRC, /headerSql\.includes\('org_logo_id'\)/);
    assert.match(SERVER_SRC, /FROM ad_orginfo oi WHERE oi\.ad_org_id = org\.ad_org_id/);
  });

  it('resolves document-branch branding via hydrateDocumentBranding directly on the header row, not resolveCompanyLogoDataUrl', () => {
    assert.match(SERVER_SRC, /const header = await hydrateDocumentBranding\(headerResult\.rows\[0\] \|\| \{\}/);
  });
});
