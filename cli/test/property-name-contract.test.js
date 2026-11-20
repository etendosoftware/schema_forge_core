import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { toPropertyName } from '../src/utils.js';

/**
 * ETP-5811 — contract test: toPropertyName must give the same property name as
 * NeoButtonActionHelper.propertyNameOf (com.etendoerp.go, ETP-5669) so the SPA and
 * MCP name a button field identically.
 *
 * The expected values are the real DAL property names (taken from the generated
 * entities), NOT toPropertyName's own output, so a divergence fails the test.
 *
 * This fixture is the single source of truth. com.etendoerp.go keeps a vendored
 * copy at src-test/resources/com/etendoerp/go/schemaforge/util/property-name-contract.json,
 * which NeoButtonActionHelperTest runs through propertyNameOf(Column). Edit the table
 * here only and re-copy it there.
 *
 * Rows flagged `knownLimitation` cannot be reproduced statically: they are asserted
 * to DIFFER, so the documented gap is visible and the test fails if it ever closes
 * (then drop the flag).
 */
const { cases } = JSON.parse(
  readFileSync(new URL('./fixtures/property-name-contract.json', import.meta.url), 'utf8'));

describe('toPropertyName contract (ETP-5811)', () => {
  for (const c of cases) {
    const actual = () => toPropertyName(c.name, { isPk: c.isKey, isCoreModule: c.isCoreModule });
    if (c.knownLimitation) {
      it(`[known limitation] ${c.table}.${c.columnName} differs from DAL ${c.expected}`, () => {
        assert.notEqual(actual(), c.expected, c.knownLimitation);
      });
    } else {
      it(`${c.table}.${c.columnName} (${c.name}) -> ${c.expected}`, () => {
        assert.equal(actual(), c.expected);
      });
    }
  }
});
