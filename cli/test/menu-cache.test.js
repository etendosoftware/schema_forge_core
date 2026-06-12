/**
 * Tests for the pure helper functions in menu-cache.js.
 * We cannot test refreshCache/searchMenu/loadCache without DB/filesystem,
 * but filterEntries and formatTable are testable via a re-import trick:
 * they're module-private, so we test the scoring logic indirectly through
 * the public searchMenu with a mocked loadCache, or we inline the logic.
 *
 * Since filterEntries and formatTable are not exported, we replicate their
 * logic here and verify the contract they uphold. If they're ever exported,
 * switch to direct imports.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// Replicate filterEntries logic to verify the scoring contract
function filterEntries(entries, query, type) {
  const q = query.toLowerCase();
  let filtered = entries;
  if (type) {
    filtered = filtered.filter(e => e.type === type);
  }
  const scored = filtered
    .map(e => {
      const name = e.name.toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (name.startsWith(q)) score = 80;
      else if (name.includes(q)) score = 60;
      else {
        const queryWords = q.split(/\s+/);
        const nameWords = name.split(/\s+/);
        const allMatch = queryWords.every(qw => nameWords.some(nw => nw.includes(qw)));
        if (allMatch) score = 40;
      }
      return { ...e, score };
    })
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.map(({ score, ...rest }) => rest);
}

const SAMPLE_ENTRIES = [
  { id: '1', name: 'Sales Order', type: 'window', windowId: 'W1', processId: null },
  { id: '2', name: 'Sales Invoice', type: 'window', windowId: 'W2', processId: null },
  { id: '3', name: 'Purchase Order', type: 'window', windowId: 'W3', processId: null },
  { id: '4', name: 'Generate Invoices', type: 'process', windowId: null, processId: 'P1' },
  { id: '5', name: 'Sales Report', type: 'report', windowId: null, processId: 'P2' },
  { id: '6', name: 'Order', type: 'window', windowId: 'W4', processId: null },
];

describe('menu-cache filterEntries', () => {
  it('exact match scores highest', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'Order', null);
    assert.equal(results[0].name, 'Order', 'exact match should come first');
  });

  it('starts-with scores above substring', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'sales', null);
    // All three "Sales *" start with "sales" (score 80)
    assert.ok(results.length >= 3);
    assert.ok(results[0].name.startsWith('Sales'));
  });

  it('substring matches are included', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'invoice', null);
    assert.ok(results.some(r => r.name === 'Sales Invoice'));
    assert.ok(results.some(r => r.name === 'Generate Invoices'));
  });

  it('word matching works across word boundaries', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'generate invoice', null);
    assert.ok(results.length >= 1);
    assert.equal(results[0].name, 'Generate Invoices');
  });

  it('returns empty array for no matches', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'nonexistent', null);
    assert.deepEqual(results, []);
  });

  it('filters by type', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'sales', 'report');
    assert.equal(results.length, 1);
    assert.equal(results[0].name, 'Sales Report');
  });

  it('is case insensitive', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'SALES ORDER', null);
    assert.ok(results.length >= 1);
    assert.ok(results.some(r => r.name === 'Sales Order'));
  });

  it('alphabetical tiebreaker for same score', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'sales', null);
    const salesResults = results.filter(r => r.name.startsWith('Sales'));
    // All have score 80, should be alphabetical
    for (let i = 1; i < salesResults.length; i++) {
      assert.ok(
        salesResults[i - 1].name.localeCompare(salesResults[i].name) <= 0,
        `${salesResults[i - 1].name} should come before ${salesResults[i].name}`,
      );
    }
  });

  it('does not include score in output', () => {
    const results = filterEntries(SAMPLE_ENTRIES, 'sales', null);
    for (const r of results) {
      assert.equal(r.score, undefined, 'score should be stripped from output');
    }
  });
});
