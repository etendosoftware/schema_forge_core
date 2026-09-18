import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_IMPORT_FORMATS,
  acceptAttribute,
  formatNames,
  inputFormats,
  isAcceptedFileName,
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

/**
 * ETP-5348. `accept` on the file input only filters the OS picker's default view — drag-and-drop
 * ignores it and every chooser offers "All files" — so this is the only real gate an upload
 * passes before a parser sees it.
 */
describe('isAcceptedFileName', () => {
  const FORMATS = ['csv', 'txt', 'xlsx'];

  it('accepts a declared extension regardless of case', () => {
    assert.equal(isAcceptedFileName('productos.csv', FORMATS), true);
    assert.equal(isAcceptedFileName('PRODUCTOS.CSV', FORMATS), true);
    assert.equal(isAcceptedFileName('productos.XlsX', FORMATS), true);
  });

  it('rejects the formats the reported bug actually used', () => {
    // The QA run uploaded a Word document and landed on an empty mapping screen with no message,
    // because `decodeCsvBuffer`'s Windows-1252 fallback decodes any byte sequence without error.
    assert.equal(isAcceptedFileName('products-invalid-format.docx', FORMATS), false);
    assert.equal(isAcceptedFileName('catalogo.pdf', FORMATS), false);
  });

  it('rejects a file with no extension at all', () => {
    // The parser is chosen by extension, so a format we cannot name is one we cannot promise
    // to read.
    assert.equal(isAcceptedFileName('productos', FORMATS), false);
    assert.equal(isAcceptedFileName('', FORMATS), false);
    assert.equal(isAcceptedFileName(undefined, FORMATS), false);
  });

  it('judges against the window\'s own declaration, not a hardcoded list', () => {
    // A window that never declared xlsx must not silently accept one just because another
    // window does.
    assert.equal(isAcceptedFileName('productos.xlsx', ['csv', 'txt']), false);
    assert.equal(isAcceptedFileName('productos.csv', ['csv', 'txt']), true);
  });

  it('falls back to the default formats when the window declares none', () => {
    assert.equal(isAcceptedFileName('productos.csv', undefined), true);
    assert.equal(isAcceptedFileName('productos.xlsx', undefined), false);
  });

  it('is not fooled by an accepted extension appearing mid-name', () => {
    assert.equal(isAcceptedFileName('lista.csv.docx', FORMATS), false);
    assert.equal(isAcceptedFileName('informe-csv-final.pdf', FORMATS), false);
  });
});
