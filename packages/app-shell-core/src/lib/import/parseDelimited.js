export class ImportParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportParseError';
  }
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
    throw new ImportParseError('The file is empty.');
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map((h) => h.trim());

  const seen = new Set();
  for (const header of headers) {
    if (seen.has(header)) {
      throw new ImportParseError(`Duplicate column header: "${header}"`);
    }
    seen.add(header);
  }

  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line, delimiter);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = cells[i] ?? '';
    });
    return row;
  });

  return { delimiter, headers, rows };
}
