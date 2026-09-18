import { normalizeHeader } from './mapColumns.js';

/**
 * A file the user uploaded cannot be parsed.
 *
 * ETP-5223: the `message` is the ENGLISH fallback, not the string to show. These errors are
 * thrown from plain modules that have no access to the app's translator, so each one also
 * carries the locale `messageKey` and its `params`; `ImportDialog` — the one boundary that
 * does hold `translate` — resolves them before the text reaches the screen. Keeping the
 * English text on `message` means every existing caller (and every test asserting on it)
 * keeps working, and a missing locale entry degrades to English instead of a raw key.
 */
export class ImportParseError extends Error {
  constructor(message, { messageKey = null, params = {} } = {}) {
    super(message);
    this.name = 'ImportParseError';
    this.messageKey = messageKey;
    this.params = params;
  }
}

/**
 * Reject a header row the rest of the pipeline cannot represent. Shared by both parsers so the
 * CSV and the xlsx paths cannot drift apart — the whole safety argument for xlsx support is that
 * it inherits the CSV path's rules rather than restating them.
 *
 * ETP-5348 closes two holes in what this used to be:
 *
 * - **The duplicate check compared RAW header text.** `mapColumns` matches on `normalizeHeader`
 *   (lower-cased, accent-stripped, whitespace-collapsed), so `nombre,Nombre` and `codigo,código`
 *   sailed past a guard written to stop exactly them. Downstream the two columns then fight over
 *   one field: `mapColumns` lets the first claimant keep it and leaves the second unmapped, so
 *   one of the user's columns was silently discarded. Comparing normalized headers here is what
 *   makes the guard agree with the matcher it exists to protect.
 * - **A blank header was only caught when a SECOND blank appeared**, as a duplicate of `""`. One
 *   blank — `codigo,nombre,,precio` — went through and became a row key of `''`, which is what
 *   broke the "Editar correspondencia" grid.
 *
 * The reported `header` is the text as the user typed it, never the normalized form: the point of
 * the message is to help them find the column in their own file.
 *
 * @param {string[]} headers trimmed header cells, in file order.
 * @throws {ImportParseError} on a blank header or a duplicate one.
 */
export function validateHeaders(headers) {
  const seen = new Set();
  headers.forEach((header, index) => {
    if (header === '') {
      throw new ImportParseError(`Column ${index + 1} has no header.`, {
        messageKey: 'importErrorEmptyHeader',
        params: { position: index + 1 },
      });
    }
    const normalized = normalizeHeader(header);
    if (seen.has(normalized)) {
      throw new ImportParseError(`Duplicate column header: "${header}"`, {
        messageKey: 'importErrorDuplicateHeader',
        params: { header },
      });
    }
    seen.add(normalized);
  });
}

const REPLACEMENT_CHAR = '\uFFFD';

/**
 * Decode a CSV/TXT file's raw bytes to text. Spanish-locale Excel exports
 * commonly save as Windows-1252, not UTF-8 — decoding those as UTF-8 corrupts
 * exactly the accented characters (á, é, í, ó, ú, ñ) the import's matching and
 * validation logic most needs to read correctly. Try UTF-8 first (the common
 * case), fall back to Windows-1252 only if UTF-8 produced replacement chars.
 */
export function decodeCsvBuffer(arrayBuffer) {
  const utf8 = new TextDecoder('utf-8').decode(arrayBuffer);
  if (!utf8.includes(REPLACEMENT_CHAR)) return utf8;
  const win1252 = new TextDecoder('windows-1252').decode(arrayBuffer);
  if (!win1252.includes(REPLACEMENT_CHAR)) return win1252;
  throw new ImportParseError('Unable to decode file — unrecognized text encoding.');
}

const DELIMITER_CANDIDATES = [',', ';', '\t'];

/**
 * Count occurrences of `char` in `line` outside of quoted spans (a delimiter
 * inside quotes, e.g. "Doe, John", must not count toward delimiter detection).
 */
function countOutsideQuotes(line, char) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === char && !inQuotes) count += 1;
  }
  return count;
}

export function detectDelimiter(firstLine) {
  let best = ',';
  let bestCount = 0;
  for (const candidate of DELIMITER_CANDIDATES) {
    const count = countOutsideQuotes(firstLine, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Split one line into raw cell strings for the given delimiter, honoring
 * double-quoted fields (with "" as an escaped quote inside a quoted field).
 * Assumes no cell spans multiple lines (line-splitting happens before this).
 */
function splitLine(line, delimiter) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  cells.push(current);
  return cells;
}

export function parseDelimited(text) {
  const lines = text.split(/\r\n|\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    throw new ImportParseError('The file is empty.', { messageKey: 'importErrorFileEmpty' });
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map((h) => h.trim());

  validateHeaders(headers);

  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    return row;
  });

  // ETP-5348: a file carrying only its header row is not "empty" — `lines.length` is 1, so the
  // empty-file guard above never fired — but there is nothing to import either. The dialog used
  // to walk on to a review screen with zero rows and simply refuse to advance, with no message
  // explaining why. Distinct key from `importErrorFileEmpty` so the wording can say what is
  // actually wrong: the columns are fine, the data is missing.
  if (rows.length === 0) {
    throw new ImportParseError('The file has no data rows — only the column headers.', {
      messageKey: 'importErrorNoDataRows',
    });
  }

  return { delimiter, headers, rows };
}
