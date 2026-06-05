import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { extractWindowArguments, findDecisionsFiles } from '../src/migrations/migrate-all.js';

describe('extractWindowArguments', () => {
  it('returns an empty array when no --window flag is present', () => {
    assert.deepEqual(extractWindowArguments([]), []);
    assert.deepEqual(extractWindowArguments(['--dry-run']), []);
  });

  it('extracts a single --window value', () => {
    assert.deepEqual(extractWindowArguments(['--window', 'sales-order']), ['sales-order']);
  });

  it('extracts multiple repeated --window values', () => {
    const args = ['--window', 'sales-order', '--window', 'purchase-order'];
    assert.deepEqual(extractWindowArguments(args), ['sales-order', 'purchase-order']);
  });

  it('mixes --window with other flags and preserves order', () => {
    const args = ['--dry-run', '--window', 'a', '--window', 'b'];
    assert.deepEqual(extractWindowArguments(args), ['a', 'b']);
  });

  it('ignores a trailing --window with no following value', () => {
    assert.deepEqual(extractWindowArguments(['--window']), []);
    assert.deepEqual(extractWindowArguments(['--window', 'a', '--window']), ['a']);
  });
});

describe('findDecisionsFiles (specificWindows branch)', () => {
  it('maps specific windows to decisions.json paths without touching the FS', async () => {
    const files = await findDecisionsFiles(['sales-order', 'purchase-order']);
    assert.equal(files.length, 2);
    assert.equal(files[0].windowName, 'sales-order');
    assert.equal(files[1].windowName, 'purchase-order');
    assert.match(files[0].path, /sales-order[/\\]decisions\.json$/);
    assert.match(files[1].path, /purchase-order[/\\]decisions\.json$/);
    // Paths must point inside the artifacts directory.
    assert.ok(files[0].path.includes(join('artifacts', 'sales-order')));
  });

  it('returns a single entry for a single window', async () => {
    const files = await findDecisionsFiles(['tax']);
    assert.deepEqual(files.map(f => f.windowName), ['tax']);
  });
});
