import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Every extractor that reads a callout class through AD_Model_Object.
const SOURCES = ['extract-fields.js', 'extract-from-db.js', 'extract-rules.js']
  .map((file) => join(__dirname, '..', 'src', file));

/**
 * Regression guard for ETP-5399. The extractor reads a field's callout class through
 * AD_Model_Object. A callout can carry more than one AD_Model_Object row (core ships a stray
 * Action='P' row for SE_ElementValue_AccountSign next to its real Action='C' one), and an
 * unfiltered join multiplies the field row: C_ElementValue.AccountType came out twice and the
 * copy was renamed `accountType2`, which then closed the real field in ETGO_SF_FIELD. The same
 * unfiltered join in extract-rules / extract-from-db listed that callout twice in rules-raw.json.
 *
 * Static assertion on the SQL text — no DB access. Classic's own "Callout Class" tab filters
 * the same way (AD_Model_Object.Action='C').
 */
describe('extract-fields callout join (ETP-5399)', () => {
  for (const file of SOURCES) {
    it(`restricts every AD_Model_Object join to callout rows (Action = C) in ${file.split('/').pop()}`, async () => {
      const src = await readFile(file, 'utf8');
      const joins = src.match(/JOIN\s+AD_Model_Object\b[^\n]*/gi) ?? [];
      assert.ok(joins.length > 0, 'expected at least one AD_Model_Object join');
      for (const join of joins) {
        assert.match(join, /mo\.Action\s*=\s*'C'/i, `unfiltered callout join: ${join.trim()}`);
      }
    });
  }
});
