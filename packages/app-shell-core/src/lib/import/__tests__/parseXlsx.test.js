import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import writeXlsxFile from 'write-excel-file/universal';
import { ImportParseError, parseDelimited } from '../parseDelimited.js';
import { parseXlsx } from '../parseXlsx.js';

/** One text cell. */
const t = (value) => ({ value, type: String });

/** Build a workbook Blob from rows of already-shaped cells. */
async function workbook(rows, options) {
  const { toBlob } = await writeXlsxFile(rows, options);
  return toBlob();
}

/** Build a single-sheet workbook whose every cell is a text cell. */
const textWorkbook = (rows) => workbook(rows.map((row) => row.map(t)));

async function rejects(promise, messageMatch) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ImportParseError,
      `expected ImportParseError, got ${error.constructor.name}: ${error.message}`);
    assert.match(error.message, messageMatch);
    return true;
  });
}

describe('parseXlsx — equivalence with the CSV path', () => {
  /**
   * The property the whole feature rests on. Everything downstream of the parser is shared, so
   * xlsx is only as safe as its output is indistinguishable from the CSV parser's. Asserted
   * against `parseDelimited` itself rather than against a hand-written expectation, so the two
   * cannot drift apart when either one changes.
   */
  it('produces byte-identical headers and rows to parseDelimited for the same table', async () => {
    const table = [
      ['Razón Social *', 'Código Postal', 'Fecha', 'Importe'],
      ['Distribuciones García S.L.', '08018', '31-08-2026', '1.234,56'],
      ['Talleres Molina e Hijos', '41002', '01-01-2026', '9,99'],
    ];
    const csv = table.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\r\n');

    const fromCsv = parseDelimited(csv);
    const fromXlsx = await parseXlsx(await textWorkbook(table));

    assert.deepEqual(fromXlsx.headers, fromCsv.headers);
    assert.deepEqual(fromXlsx.rows, fromCsv.rows);
  });

  it('keeps a leading zero, which is what makes the export round trip', async () => {
    const { rows } = await parseXlsx(await textWorkbook([['CP'], ['08018']]));
    assert.equal(rows[0].CP, '08018');
  });

  it('reads a text cell holding a formula-looking string as that literal string', async () => {
    // A text cell in xlsx is inert — it is not a formula. So the CSV apostrophe neutralization
    // must not be applied on the way out, and nothing needs stripping on the way in.
    const { rows } = await parseXlsx(await textWorkbook([['Nombre'], ['=SUM(A1)']]));
    assert.equal(rows[0].Nombre, '=SUM(A1)');
  });

  it('does not trim cell values, matching parseDelimited', async () => {
    const { rows } = await parseXlsx(await textWorkbook([['Nombre'], ['  Ana  ']]));
    assert.equal(rows[0].Nombre, '  Ana  ');
  });

  it('trims headers, matching parseDelimited', async () => {
    const { headers } = await parseXlsx(await textWorkbook([['  Nombre  '], ['Ana']]));
    assert.deepEqual(headers, ['Nombre']);
  });
});

describe('parseXlsx — cell normalization', () => {
  it('turns a blank cell into an empty string, never null', async () => {
    // Nothing downstream (mapColumns, validateRows, rowValidators) has ever received a null.
    const blob = await workbook([[t('Nombre'), t('CP')], [t('Solo nombre'), { value: null, type: String }]]);
    const { rows } = await parseXlsx(blob);
    assert.equal(rows[0].CP, '');
  });

  it('renders a numeric cell as a string', async () => {
    const blob = await workbook([[t('Importe')], [{ value: 1234.56, type: Number }]]);
    const { rows } = await parseXlsx(blob);
    assert.equal(rows[0].Importe, '1234.56');
  });

  it('renders a boolean cell as the spelling the coded-value tables accept', async () => {
    const blob = await workbook([[t('Es Persona')], [{ value: true, type: Boolean }]]);
    const { rows } = await parseXlsx(blob);
    assert.equal(rows[0]['Es Persona'], 'true');
  });

  /**
   * The regression this feature came closest to shipping. A date cell arrives as UTC midnight;
   * read with LOCAL getters on a negative-offset host it yields the previous day. This asserts
   * the calendar day, so it fails on any host whose offset would have shifted it — which is the
   * only way to catch it, since a date one day early is not an error, just wrong.
   */
  it('reads a date cell with UTC getters, so the calendar day never shifts', async () => {
    const blob = await workbook([
      [t('Fecha')],
      [{ value: new Date(Date.UTC(2026, 7, 31)), type: Date, format: 'dd-mm-yyyy' }],
    ]);
    const { rows } = await parseXlsx(blob);
    assert.equal(rows[0].Fecha, '31-08-2026');
  });

  it('formats a single-digit day and month with a leading zero', async () => {
    const blob = await workbook([
      [t('Fecha')],
      [{ value: new Date(Date.UTC(2026, 0, 5)), type: Date, format: 'dd-mm-yyyy' }],
    ]);
    const { rows } = await parseXlsx(blob);
    assert.equal(rows[0].Fecha, '05-01-2026');
  });
});

describe('parseXlsx — structure', () => {
  it('skips an all-blank row instead of emitting a row of empty required fields', async () => {
    const blob = await workbook([
      [t('Nombre')],
      [t('Ana')],
      [{ value: null, type: String }],
      [t('Beatriz')],
    ]);
    const { rows } = await parseXlsx(blob);
    assert.deepEqual(rows.map((r) => r.Nombre), ['Ana', 'Beatriz']);
  });

  it('drops trailing empty header columns left behind by the sheet used range', async () => {
    const blob = await workbook([
      [t('Nombre'), t('CP'), { value: null, type: String }, { value: null, type: String }],
      [t('Ana'), t('41002'), { value: null, type: String }, { value: null, type: String }],
    ]);
    const { headers, rows } = await parseXlsx(blob);
    assert.deepEqual(headers, ['Nombre', 'CP']);
    assert.deepEqual(rows, [{ Nombre: 'Ana', CP: '41002' }]);
  });

  it('rejects a duplicate column header, exactly as parseDelimited does', async () => {
    await rejects(
      parseXlsx(await textWorkbook([['Email', 'Email'], ['a@b.c', 'd@e.f']])),
      /Duplicate column header: "Email"/,
    );
  });

  it('rejects a workbook with more than one sheet holding data, naming the sheets', async () => {
    // Importing the first and discarding the rest would report success on a partial import.
    const blob = await workbook([
      { sheet: 'Contactos', data: [[t('Nombre')], [t('Ana')]] },
      { sheet: 'Notas', data: [[t('Comentario')], [t('revisar')]] },
    ]);
    await rejects(parseXlsx(blob), /more than one sheet with data.*Contactos, Notas/s);
  });

  it('accepts a workbook whose extra sheets are empty', async () => {
    const blob = await workbook([
      { sheet: 'Contactos', data: [[t('Nombre')], [t('Ana')]] },
      { sheet: 'Hoja2', data: [[{ value: null, type: String }]] },
    ]);
    const { headers, rows } = await parseXlsx(blob);
    assert.deepEqual(headers, ['Nombre']);
    assert.deepEqual(rows, [{ Nombre: 'Ana' }]);
  });

  it('rejects a workbook with no content, wording it like the CSV empty-file case', async () => {
    const blob = await workbook([[{ value: null, type: String }]]);
    await rejects(parseXlsx(blob), /The file is empty\./);
  });

  it('rejects a file that is not a workbook at all as an ImportParseError', async () => {
    // Routed to the dialog's file-error step like any other unreadable upload, rather than
    // escaping as the reader's own low-level zip complaint.
    await rejects(parseXlsx(new Blob(['this is not a spreadsheet'])), /Unable to read the Excel file/);
  });
});
