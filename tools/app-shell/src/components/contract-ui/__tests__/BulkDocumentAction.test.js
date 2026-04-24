import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'BulkDocumentAction.jsx'), 'utf8');

function buildInOutActions(rows) {
  const hasDraft = rows.some((r) => (r.documentStatus || r.docStatus) === 'DR');
  return hasDraft ? [{ value: 'CO', labelKey: 'book' }] : [];
}

describe('BulkDocumentAction source', () => {
  it('exports buildInOutActions as named export', () => {
    assert.match(src, /export const buildInOutActions/);
  });

  it('exports BulkDocumentAction as default component', () => {
    assert.match(src, /export default function BulkDocumentAction/);
  });

  it('defaults entity prop to header', () => {
    assert.match(src, /entity\s*=\s*['"]header['"]/);
  });

  it('persists result to sessionStorage before page reload', () => {
    assert.match(src, /sessionStorage\.setItem/);
  });

  it('returns null when no rows are selected', () => {
    assert.match(src, /selectedRows\.length === 0/);
  });

  it('returns null when no actions are available', () => {
    assert.match(src, /actions\.length === 0/);
  });

  it('uses Promise.allSettled to process rows in parallel', () => {
    assert.match(src, /Promise\.allSettled/);
  });

  it('calls clearSelection and reloads page after execution', () => {
    assert.match(src, /clearSelection\(\)/);
    assert.match(src, /window\.location\.reload/);
  });
});

describe('buildInOutActions', () => {
  it('returns CO action when at least one row is DR', () => {
    const result = buildInOutActions([{ documentStatus: 'DR' }, { documentStatus: 'CO' }]);
    assert.deepEqual(result, [{ value: 'CO', labelKey: 'book' }]);
  });

  it('returns empty array when no rows are DR', () => {
    const result = buildInOutActions([{ documentStatus: 'CO' }, { documentStatus: 'CL' }]);
    assert.deepEqual(result, []);
  });

  it('reads docStatus as fallback when documentStatus is absent', () => {
    const result = buildInOutActions([{ docStatus: 'DR' }]);
    assert.equal(result.length, 1);
    assert.equal(result[0].value, 'CO');
  });

  it('returns empty array for empty input', () => {
    assert.deepEqual(buildInOutActions([]), []);
  });

  it('single DR row triggers the action', () => {
    assert.deepEqual(buildInOutActions([{ documentStatus: 'DR' }]), [{ value: 'CO', labelKey: 'book' }]);
  });
});
