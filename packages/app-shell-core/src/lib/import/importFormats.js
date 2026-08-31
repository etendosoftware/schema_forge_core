/**
 * The file formats a window's import accepts and its export/template writes, derived from one
 * declaration: `window.import.formats` in `decisions.json`.
 *
 * <p>That key existed before any of this and nothing read it — `ImportDropzone` hardcoded
 * `accept='.csv,.txt'` and hardcoded its hint text — so it could say anything without
 * consequence. Making it govern is what stops it from lying, and it is the reason xlsx needs no
 * second per-window flag: a window that has an import declares what that import eats, and the
 * export writes whichever of those it can write.
 *
 * <p>**Input formats and output formats are not the same set, and that asymmetry is deliberate.**
 * `txt` is input-only: it exists because Spanish Excel's *Guardar como → Texto (delimitado por
 * tabulaciones)* produces one, which is why `parseDelimited` detects tabs. There is no reason to
 * ever hand a user a `.txt` template or a `.txt` export. So outputs are derived from inputs
 * rather than declared separately — one declaration per window, and it is structurally
 * impossible for the export to offer a format the import cannot read back.
 */

/** Formats assumed when a window declares none — what every window accepted before `formats` was read. */
export const DEFAULT_IMPORT_FORMATS = ['csv', 'txt'];

/** Formats the app can WRITE, in the order they should be offered. `txt` is deliberately absent. */
const WRITABLE_FORMATS = ['csv', 'xlsx'];

/** Normalized, de-duplicated, lower-cased format list. */
function normalize(formats) {
  const list = Array.isArray(formats) && formats.length > 0 ? formats : DEFAULT_IMPORT_FORMATS;
  const seen = new Set();
  for (const format of list) {
    if (typeof format === 'string' && format.trim()) seen.add(format.trim().toLowerCase().replace(/^\./, ''));
  }
  return [...seen];
}

/** The formats an upload may be in. */
export function inputFormats(formats) {
  return normalize(formats);
}

/**
 * The formats the app offers to WRITE — templates and export. Always a subset of the declared
 * input formats, so anything handed to the user can be handed back.
 */
export function outputFormats(formats) {
  const declared = new Set(normalize(formats));
  return WRITABLE_FORMATS.filter((format) => declared.has(format));
}

/** The `accept` attribute for the file input, e.g. `'.csv,.txt,.xlsx'`. */
export function acceptAttribute(formats) {
  return normalize(formats).map((format) => `.${format}`).join(',');
}

/**
 * Uppercase format names for the dropzone hint, e.g. `'CSV, TXT o XLSX'`. The conjunction is
 * passed in rather than hardcoded so the hint stays translatable — an English "or" welded in
 * here would be invisible to the locale files.
 */
export function formatNames(formats) {
  return normalize(formats).map((format) => format.toUpperCase());
}

/** Whether an uploaded file name is an xlsx, and therefore goes to `parseXlsx` rather than `parseDelimited`. */
export function isXlsxFileName(name) {
  return /\.xlsx$/i.test(String(name ?? ''));
}
