import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_IMPORT_FORMATS,
  acceptAttribute,
  formatNames,
  inputFormats,
  isXlsxFileName,
  outputFormats,
} from '../importFormats.js';

describe('inputFormats', () => {
  it('falls back to what every window accepted before `formats` was read', () => {
    assert.deepEqual(inputFormats(undefined), DEFAULT_IMPORT_FORMATS);
    assert.deepEqual(inputFormats([]), DEFAULT_IMPORT_FORMATS);
  });

  it('lower-cases, de-duplicates and strips a leading dot', () => {
    assert.deepEqual(inputFormats(['CSV', '.xlsx', 'csv', ' txt ']), ['csv', 'xlsx', 'txt']);
  });

  it('ignores blank and non-string entries', () => {
    assert.deepEqual(inputFormats(['csv', '', null, 42, 'xlsx']), ['csv', 'xlsx']);
  });
});

describe('outputFormats', () => {
  /**
   * The asymmetry the module exists for. `txt` is input-only — it is there because Spanish
   * Excel saves tab-delimited text — and handing a user a `.txt` template would be absurd.
   */
  it('never offers txt, even when the import accepts it', () => {
    assert.deepEqual(outputFormats(['csv', 'txt', 'xlsx']), ['csv', 'xlsx']);
    assert.deepEqual(outputFormats(['txt']), []);
  });

  it('is always a subset of the declared input formats', () => {
    // Structurally prevents an export offering a format the import cannot read back.
    assert.deepEqual(outputFormats(['csv', 'txt']), ['csv']);
    assert.deepEqual(outputFormats(['xlsx']), ['xlsx']);
  });

  it('offers csv before xlsx regardless of declaration order', () => {
    assert.deepEqual(outputFormats(['xlsx', 'csv']), ['csv', 'xlsx']);
  });

  it('offers csv alone for a window that has not opted into xlsx', () => {
    assert.deepEqual(outputFormats(undefined), ['csv']);
  });
});

describe('acceptAttribute', () => {
  it('builds the file input accept list', () => {
    assert.equal(acceptAttribute(['csv', 'txt', 'xlsx']), '.csv,.txt,.xlsx');
  });

  it('matches the previously hardcoded value for a window that declares nothing', () => {
    assert.equal(acceptAttribute(undefined), '.csv,.txt');
  });
});

describe('formatNames', () => {
  it('upper-cases the names for the dropzone hint', () => {
    assert.deepEqual(formatNames(['csv', 'xlsx']), ['CSV', 'XLSX']);
  });
});

describe('isXlsxFileName', () => {
  it('recognizes an xlsx upload whatever the case', () => {
    assert.ok(isXlsxFileName('contactos.xlsx'));
    assert.ok(isXlsxFileName('CONTACTOS.XLSX'));
  });

  it('does not claim the delimited formats', () => {
    assert.ok(!isXlsxFileName('contactos.csv'));
    assert.ok(!isXlsxFileName('contactos.txt'));
    // Legacy BIFF is explicitly out of scope, so it must not be routed to the OOXML reader.
    assert.ok(!isXlsxFileName('contactos.xls'));
  });

  it('survives a missing name', () => {
    assert.ok(!isXlsxFileName(undefined));
    assert.ok(!isXlsxFileName(null));
  });
});
