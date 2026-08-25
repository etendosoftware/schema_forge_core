import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// Exercises the REAL shared module — never a copy. These rules existed twice
// (dev plugin + report-server) and the copies drifted, which is the whole
// reason this module exists.
import { applyPlaceholders, stripBlankOptionalClauses } from '../src/report-sql.js';

/** True when every '(' in `sql` has its matching ')'. */
function balanced(sql) {
  let depth = 0;
  for (const ch of sql) {
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth < 0) return false; }
  }
  return depth === 0;
}

describe('stripBlankOptionalClauses', () => {
  it('removes a simple unfilled optional clause', () => {
    const sql = "SELECT 1 FROM t WHERE x = 1 AND ('__ORGID__' = '' OR t.org = '__ORGID__')";
    const out = stripBlankOptionalClauses(sql);
    assert.ok(!out.includes('__ORGID__'));
    assert.ok(balanced(out));
  });

  it('removes a clause whose body contains NESTED subqueries', () => {
    // The regression this module was created for: Balance Sheet and Profit &
    // Loss both wrap a repeated placeholder in two (SELECT MIN/MAX ...)
    // subqueries. A naive /[^)]*\)/ stops at the first inner ')' and leaves a
    // dangling fragment — "syntax error at or near \")\"" on every server.
    const sql = "SELECT 1 FROM t WHERE a = 1 "
      + "AND ('__REFYEAR__' = '' OR t.d BETWEEN (SELECT MIN(x) FROM y WHERE y.id = '__REFYEAR__') "
      + "AND (SELECT MAX(x) FROM y WHERE y.id = '__REFYEAR__')) AND b = 2";
    const out = stripBlankOptionalClauses(sql);
    assert.ok(!out.includes('__REFYEAR__'), 'the clause was not fully removed');
    assert.ok(balanced(out), 'left the SQL with unbalanced parentheses');
    assert.ok(out.includes('a = 1') && out.includes('b = 2'), 'removed more than the clause');
  });

  it('removes several clauses in one query', () => {
    const sql = "SELECT 1 FROM t WHERE a = 1 "
      + "AND ('__P__' = '' OR t.p = '__P__') AND ('__Q__' = '' OR t.q IN (SELECT q FROM z WHERE z.k = '__Q__'))";
    const out = stripBlankOptionalClauses(sql);
    assert.ok(!out.includes('__P__') && !out.includes('__Q__'));
    assert.ok(balanced(out));
  });

  it('leaves a clause whose placeholder was already substituted', () => {
    const sql = "SELECT 1 FROM t WHERE ('X' = '' OR t.org = 'X')";
    assert.equal(stripBlankOptionalClauses(sql), sql);
  });

  it('leaves an unbalanced clause untouched rather than corrupting it', () => {
    const sql = "SELECT 1 FROM t WHERE a = 1 AND ('__P__' = '' OR t.p = '__P__'";
    assert.equal(stripBlankOptionalClauses(sql), sql);
  });
});

describe('applyPlaceholders', () => {
  const base = { clientId: 'C1', params: {}, contract: {} };

  it('substitutes the client id', () => {
    assert.equal(applyPlaceholders("WHERE c = '__CLIENT_ID__'", base), "WHERE c = 'C1'");
  });

  it('substitutes params and escapes single quotes', () => {
    const out = applyPlaceholders("WHERE n = '__NAME__'", { ...base, params: { name: "O'Brien" } });
    assert.equal(out, "WHERE n = 'O''Brien'");
  });

  it('ignores _display_ params — they never reach SQL', () => {
    const out = applyPlaceholders("WHERE n = '__NAME__'", { ...base, params: { _display_name: 'X' } });
    assert.ok(out.includes('__NAME__'), 'a display-only param must not substitute');
  });

  it('falls back to a contract parameter default', () => {
    const out = applyPlaceholders("WHERE lvl = '__LEVEL__'", {
      ...base, contract: { parameters: [{ name: 'level', default: 'S' }] },
    });
    assert.equal(out, "WHERE lvl = 'S'");
  });

  it('rewrites a comma-joined multi-select into IN (...)', () => {
    const out = applyPlaceholders("WHERE id = '__IDS__'", { ...base, params: { ids: 'a,b,c' } });
    assert.equal(out, "WHERE id IN ('a','b','c')");
  });

  it('runs in linear time even when the closing quote never arrives (S5852)', () => {
    // The dev plugin's original comma regex, `[^']*,[^']*`, lets both repeated
    // groups match commas. That's only expensive on a FAILED match — a value
    // whose closing quote is missing forces the engine to retry every comma as
    // the split point before giving up, which is quadratic (measured: 21ms at
    // 5,000 commas, ~2.1s projected at 50,000). This module's
    // `[^',]+(?:,[^',]+)+` excludes the comma from each segment, so there is
    // only one way to parse it — no retrying, linear regardless of outcome.
    // The escaping in this file always closes the quote it opens, so this
    // shape should never occur from a legitimate render request; the test
    // exists to keep it that way even if that invariant is ever broken.
    const unterminated = `x = '${'a,'.repeat(50000)}`;
    const start = process.hrtime.bigint();
    unterminated.replace(/=\s*'([^',]+(?:,[^',]+)+)'/g, (m) => m);
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    assert.ok(ms < 200, `took ${ms}ms on ${unterminated.length} chars — looks superlinear`);
  });

  it('scopes AD_CLIENT_ID and AD_ORG_ID to the caller', () => {
    const out = applyPlaceholders("WHERE AD_CLIENT_ID IN ('0') AND AD_ORG_ID IN ('0')", base);
    assert.ok(out.includes("AD_CLIENT_ID IN ('C1')"));
    assert.ok(out.includes("AD_CLIENT_ID = 'C1'"), 'org subquery must be client-scoped too');
  });

  it('strips unfilled optional clauses with nested subqueries, leaving valid SQL', () => {
    const sql = "SELECT 1 FROM t WHERE AD_CLIENT_ID IN ('0') "
      + "AND ('__REFYEAR__' = '' OR t.d BETWEEN (SELECT MIN(x) FROM y WHERE y.id = '__REFYEAR__') "
      + "AND (SELECT MAX(x) FROM y WHERE y.id = '__REFYEAR__'))";
    const out = applyPlaceholders(sql, base);
    assert.ok(!out.includes('__REFYEAR__'));
    assert.ok(balanced(out), 'unbalanced parentheses would be a 500 at render time');
  });

  it('keeps a filled optional clause', () => {
    const sql = "SELECT 1 FROM t WHERE ('__ORGID__' = '' OR t.org = '__ORGID__')";
    const out = applyPlaceholders(sql, { ...base, params: { orgId: 'O1' } });
    assert.ok(out.includes("t.org = 'O1'"), 'a supplied filter must survive');
    assert.ok(balanced(out));
  });
});
