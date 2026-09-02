import readXlsxFile from 'read-excel-file/universal';
import { ImportParseError } from './parseDelimited.js';

/**
 * Parse an `.xlsx` upload into the SAME shape {@link parseDelimited} returns, so the whole
 * import pipeline downstream — `mapColumns`, `validateRows`, `rowValidators`,
 * `resolveForeignKeys`, `dedupeRows`, `buildOperations`, `importEngine`, `ImportReviewQueue`
 * — cannot tell an Excel upload from a CSV one and needs no xlsx awareness at all.
 *
 * That identity is the entire safety argument for xlsx support: the Excel path inherits every
 * behaviour the CSV path has already earned (the coded-value synonym tables, the FK resolvers,
 * the database dedupe, the required-marker stripping) rather than reimplementing any of it.
 * So the contract is deliberately narrow: **produce `{ headers, rows }` of plain strings.**
 * Anything richer that xlsx can express is flattened here, at this one boundary.
 *
 * `read-excel-file`'s `./universal` entry is imported rather than the bare specifier: neither
 * of these packages declares an ESM main, so `read-excel-file` alone fails to resolve under
 * Node with ERR_PACKAGE_PATH_NOT_EXPORTED. `./universal` resolves in the browser and in Node,
 * which is what lets this module be one file shipped to Vite and exercised under `node --test`.
 */

/** A cell Excel considers empty. */
function isBlank(value) {
  return value === null || value === undefined || value === '';
}

/**
 * Renders one cell as the string the CSV path would have carried.
 *
 * <p>The Date branch reads **UTC** getters, and this is not a style choice. An xlsx date cell
 * holds a timezone-less serial number that the reader materializes at UTC midnight — a cell
 * written as 2026-08-31 arrives as `2026-08-31T00:00:00.000Z`. Reading that with local getters
 * on any negative-offset host (`America/Cordoba`, `America/Argentina/Buenos_Aires`, …) yields
 * 30 August: every date in every imported Excel silently one day early. That is the ETP-4031 /
 * ETP-4850 bug class exactly.
 *
 * <p>For the same reason this does NOT go through `formatCalendarDate`/`parseCalendarDate`.
 * Those helpers exist for date-only *strings* and build their `Date` with the local-time
 * constructor to avoid this bug when parsing `"yyyy-MM-dd"`. Handed an instant that is already
 * correct in UTC, they would reintroduce the shift they were written to prevent. The canonical
 * helpers are right for the canonical input; this input is a different thing.
 *
 * <p>The output shape is `dd-MM-yyyy` because that is what the CSV export writes
 * (`NeoCsvExportService.formatDateDayMonthYear`), which keeps export → edit → import closed.
 */
function cellToText(value) {
  if (isBlank(value)) {
    // `parseDelimited` yields '' for a missing cell and nothing downstream has ever received a
    // null. Normalizing here is what keeps the two parsers interchangeable.
    return '';
  }
  if (value instanceof Date) {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    return `${day}-${month}-${value.getUTCFullYear()}`;
  }
  if (typeof value === 'boolean') {
    // Excel's TRUE/FALSE. Lower-cased because that is the spelling NEO serializes an AD Yes/No
    // column as, and therefore the spelling the coded-value synonym tables already accept.
    return value ? 'true' : 'false';
  }
  // A string is returned untouched: `parseDelimited` trims HEADERS but never cell values, and
  // trimming here would make the two parsers disagree on trailing-space data.
  return typeof value === 'string' ? value : String(value);
}

/** Every sheet as `{ sheet, data }`, whatever surface version of the reader answers. */
function normalizeSheets(result) {
  if (!Array.isArray(result)) return [];
  // The reader returns `[{ sheet, data }]` — including when a `sheet` option is passed, which
  // is why this unwraps rather than assuming the documented bare-array form.
  if (result.length > 0 && Array.isArray(result[0])) {
    return [{ sheet: null, data: result }];
  }
  return result.filter((entry) => entry && Array.isArray(entry.data));
}

/** A sheet holding at least one cell with content. */
function hasContent(sheet) {
  return sheet.data.some((row) => Array.isArray(row) && row.some((cell) => !isBlank(cell)));
}

/**
 * Header row, with trailing empty columns dropped.
 *
 * <p>This is a deliberate divergence from the CSV path, and the only one. A CSV header row of
 * `a,b,,` genuinely means four columns, two of them unnamed, and `parseDelimited` rightly
 * rejects it for duplicate (empty) headers. In a spreadsheet those trailing blanks are an
 * artifact of the sheet's used range — Excel widens it when a user types in a cell and then
 * clears it — so rejecting them would refuse files that are, to their author, obviously fine.
 * Interior blanks are NOT dropped: a gap between two named columns is real structure, and it
 * still hits the duplicate-header check below.
 */
function readHeaders(rows) {
  const raw = Array.isArray(rows[0]) ? rows[0] : [];
  let end = raw.length;
  while (end > 0 && isBlank(raw[end - 1])) end -= 1;
  return raw.slice(0, end).map((cell) => cellToText(cell).trim());
}

/**
 * @param {Blob|File} file - the uploaded workbook.
 * @returns {Promise<{ headers: string[], rows: Array<Record<string, string>> }>} the same shape
 *   `parseDelimited` returns.
 * @throws {ImportParseError} empty file, no content, more than one non-empty sheet, or a
 *   duplicate column header.
 */
export async function parseXlsx(file) {
  let sheets;
  try {
    // `trim: false` is load-bearing, not a preference. The reader trims every string value by
    // default; `parseDelimited` trims headers only and never touches a cell. Left on, the same
    // visible data would import differently depending on whether the user saved as .csv or
    // .xlsx — silently cleaning one and not the other. If trimming cells is desirable it is a
    // deliberate change to BOTH parsers, not a side effect of the file format.
    sheets = normalizeSheets(await readXlsxFile(file, { trim: false }));
  } catch (error) {
    // A corrupt or non-OOXML file surfaces as the reader's own low-level complaint ("Can't find
    // ...xl/workbook.xml", a zip error). Re-thrown as ImportParseError so ImportDialog routes it
    // to the file-error step like every other unreadable upload, instead of the generic catch.
    throw new ImportParseError(`Unable to read the Excel file — ${error.message}`);
  }

  const withContent = sheets.filter(hasContent);
  if (withContent.length === 0) {
    // Same wording as parseDelimited's empty-file case, so the dialog says one thing.
    throw new ImportParseError('The file is empty.');
  }
  if (withContent.length > 1) {
    // Taking the first and discarding the rest would import part of a file and report success.
    // Naming the sheets is what makes the error actionable — the user has to know which ones.
    const names = withContent.map((s) => s.sheet).filter(Boolean).join(', ');
    throw new ImportParseError(
      `The file has more than one sheet with data${names ? ` (${names})` : ''}. `
      + 'Leave only the sheet you want to import.',
    );
  }

  const data = withContent[0].data;
  const headers = readHeaders(data);
  if (headers.length === 0) {
    throw new ImportParseError('The file is empty.');
  }

  const seen = new Set();
  for (const header of headers) {
    if (seen.has(header)) {
      // Same rejection and same message as parseDelimited: a duplicate header makes the column
      // mapping ambiguous, and the template writer's collision fallback exists precisely so a
      // downloaded template can never produce one.
      throw new ImportParseError(`Duplicate column header: "${header}"`);
    }
    seen.add(header);
  }

  const rows = [];
  for (const row of data.slice(1)) {
    const cells = Array.isArray(row) ? row : [];
    // parseDelimited drops blank lines; a spreadsheet's equivalent is an all-empty row, which
    // Excel leaves behind freely. Without this an exported-then-edited file would arrive with
    // trailing rows of empty required fields and fail validation on rows the user never wrote.
    if (cells.every((cell) => isBlank(cell))) continue;
    const record = {};
    headers.forEach((header, i) => {
      record[header] = cellToText(cells[i]);
    });
    rows.push(record);
  }

  return { headers, rows };
}
