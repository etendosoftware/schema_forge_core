import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src', 'extract-fields.js');

/**
 * Regression guard for ETP-5399. The extractor reads a field's callout class through
 * AD_Model_Object. A callout can carry more than one AD_Model_Object row (core ships a stray
 * Action='P' row for SE_ElementValue_AccountSign next to its real Action='C' one), and an
 * unfiltered join multiplies the field row: C_ElementValue.AccountType came out twice and the
 * copy was renamed `accountType2`, which then closed the real field in ETGO_SF_FIELD.
 *
 * Static assertion on the SQL text — no DB access. Classic's own "Callout Class" tab filters
 * the same way (AD_Model_Object.Action='C').
 */
describe('extract-fields callout join (ETP-5399)', () => {
  it('restricts every AD_Model_Object join to callout rows (Action = C)', async () => {
    const src = await readFile(SRC, 'utf8');
    const joins = src.match(/JOIN\s+AD_Model_Object\b[^\n]*/gi) ?? [];
    assert.ok(joins.length > 0, 'expected at least one AD_Model_Object join');
    for (const join of joins) {
      assert.match(join, /mo\.Action\s*=\s*'C'/i, `unfiltered callout join: ${join.trim()}`);
    }
  });
});
