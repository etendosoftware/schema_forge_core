/**
 * THE single definition of a report's `__PLACEHOLDER__` substitution and SQL
 * scoping rules.
 *
 * Why this module exists: reports are built by TWO engines — the Vite dev
 * plugin in the functional repo and the production report-server — and each
 * had its own copy of these rules. They drifted, and the drift was not
 * cosmetic: ETP-4899 fixed optional-clause stripping in the DEV copy only, so
 * every report whose optional clause wraps a nested subquery (Balance Sheet and
 * Profit & Loss both do — their reference-period BETWEEN repeats a placeholder
 * inside two `(SELECT MIN/MAX ...)` subqueries) rendered fine locally and died
 * server-side with `syntax error at or near ")"`. The two copies had also
 * drifted on the comma→IN rewrite regex.
 *
 * Same rule as report-i18n.js and report-grouping.js: code that lives in a
 * shared module reaches production, code written inline in the dev plugin never
 * does. Do not re-add a local copy — extend this module.
 */

/**
 * Deletes every `AND ('__X__' = '' OR ...)` optional-filter clause whose
 * placeholder was left blank (never substituted, so the literal `'__X__' = ''`
 * text still sits in the query).
 *
 * A plain regex cannot do this safely: it has to find the clause's OWN matching
 * close-paren, and once the clause contains a nested subquery or function call
 * a naive `[^)]*\)` stops at the FIRST inner `)` it meets, truncating the match
 * and leaving a dangling fragment behind — which is exactly the
 * `syntax error at or near ")"` above. This walks real paren depth from the
 * clause's own opening `(` to its true matching close, so it is correct however
 * deep the nesting and however often the placeholder repeats inside.
 */
export function stripBlankOptionalClauses(q) {
  const startRe = /AND\s*\(\s*'__(\w+)__'\s*=\s*''\s*OR\s*/gi;
  let result = '';
  let lastEnd = 0;
  let m;
  while ((m = startRe.exec(q))) {
    if (m.index < lastEnd) continue; // already consumed by a previous match
    const clauseStart = m.index;
    const openParenIdx = q.indexOf('(', m.index);
    let depth = 0;
    let closeIdx = -1;
    for (let i = openParenIdx; i < q.length; i++) {
      if (q[i] === '(') depth++;
      else if (q[i] === ')') {
        depth--;
        if (depth === 0) { closeIdx = i; break; }
      }
    }
    if (closeIdx === -1) continue; // unbalanced — leave untouched rather than corrupt it
    result += q.slice(lastEnd, clauseStart);
    lastEnd = closeIdx + 1;
    startRe.lastIndex = lastEnd;
  }
  result += q.slice(lastEnd);
  return result;
}

/**
 * Applies every substitution and scoping rewrite a report's SQL needs: the
 * client id, per-parameter values (with comma→IN rewriting), contract defaults,
 * optional-clause stripping, and the AD_CLIENT_ID / AD_ORG_ID / AD_LANGUAGE
 * scoping rewrites.
 *
 * Used for a report's MAIN query and, identically, for its optional secondary
 * queries (`sql.openingQuery`, `sql.operandsQuery`) — a secondary query scoped
 * to a different client or language than the rows it annotates is the kind of
 * bug nobody spots in a rendered report.
 *
 * `__REPORT_LOCALE__` (ETP-5013) is a SEPARATE, engine-controlled placeholder
 * for report SQL that intentionally joins an Etendo `_trl` table (e.g. Journal
 * Entries → `ad_ref_list_trl`, mirroring the `c_country_trl` join Tax Report
 * does in Java) — it is substituted with the render's locale, but only AFTER
 * the AD_LANGUAGE forced-rewrite below, so it can never be confused with (or
 * weaken) that guard: a literal `AD_LANGUAGE = 'xx_XX'` typed by mistake into
 * a contract's own SQL is still forced back to `'en_US'` exactly as before.
 * `locale` never comes from request `params` — only the engine (`report-api.js`
 * / `server.js`) supplies it — and is validated against a strict `xx_YY`
 * shape before being spliced into SQL text, since this module does raw string
 * substitution, not parameterized binding.
 */
export function applyPlaceholders(rawSql, { clientId, params = {}, contract = {}, locale } = {}) {
  let q = rawSql.replace(/__CLIENT_ID__/g, clientId);

  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('_display_')) continue; // display-only, never reaches SQL
    if (value !== undefined && value !== null && value !== '') {
      const escaped = String(value).replace(/'/g, "''");
      q = q.replace(new RegExp(`__${key.toUpperCase()}__`, 'g'), escaped);
    }
  }

  for (const p of (contract.parameters || [])) {
    if (p.default !== undefined && p.default !== null && p.default !== '') {
      q = q.replace(new RegExp(`__${p.name.toUpperCase()}__`, 'g'), String(p.default));
    }
  }

  // A multi-select param arrives as one comma-joined string, so `= 'a,b'`
  // becomes `IN ('a','b')`. `[^',]+` (not `[^']*`) excludes the comma from each
  // segment, so the two repetitions can never overlap on where to split — no
  // backtracking ambiguity, unlike the dev plugin's original `[^']*,[^']*`
  // (flagged as ReDoS-prone, javascript:S5852, on the value coming straight
  // from the render request body).
  q = q.replace(/=\s*'([^',]+(?:,[^',]+)+)'/g, (_match, ids) => {
    const inList = ids.split(',').map((id) => `'${id.trim()}'`).join(',');
    return `IN (${inList})`;
  });

  q = stripBlankOptionalClauses(q);

  q = q.replace(/AD_CLIENT_ID\s+IN\s*\(\s*'[^']+'\s*\)/gi, `AD_CLIENT_ID IN ('${clientId}')`);
  q = q.replace(/AD_ORG_ID\s+IN\s*\(\s*'[^']+'\s*\)/gi,
    `AD_ORG_ID IN (SELECT AD_ORG_ID FROM AD_ORG WHERE AD_CLIENT_ID = '${clientId}' AND ISACTIVE = 'Y')`);
  // Move '__REPORT_LOCALE__' out of `= '...'` shape BEFORE the AD_LANGUAGE
  // guard below runs — that guard's regex matches ANY quoted content after
  // `ad_language =`, including our OWN unresolved placeholder text. Without
  // this step the guard would clobber `rlt.ad_language = '__REPORT_LOCALE__'`
  // to `'en_US'` first, leaving nothing left for the real substitution to do.
  q = q.replace(/'__REPORT_LOCALE__'/g, '__REPORT_LOCALE_SENTINEL__');

  q = q.replace(/AD_LANGUAGE\s*=\s*'[^']+'/gi, "AD_LANGUAGE = 'en_US'");

  const safeLocale = /^[a-z]{2}_[A-Z]{2}$/.test(locale || '') ? locale : 'en_US';
  q = q.replace(/__REPORT_LOCALE_SENTINEL__/g, `'${safeLocale}'`);

  return q;
}
