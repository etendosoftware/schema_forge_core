import writeXlsxFile from 'write-excel-file/universal';
import { resolveTemplateHeaders } from './buildTemplateCsv.js';

/**
 * Builds the `.xlsx` template a user downloads from the import dialog, fills in, and uploads
 * back through the same auto-mapping (`mapColumns`) a real file goes through — the Excel twin
 * of {@link buildTemplateCsv}.
 *
 * <p>**The headers come from `resolveTemplateHeaders`, not from anything local.** That is the
 * one thing this module must not reimplement. That resolver carries three behaviours that are
 * easy to lose and expensive to lose: the session-language label, the required-column marker,
 * and — the load-bearing one — a two-pass collision fallback that guarantees every header maps
 * back to the field it was written for. A composite import splits one row across entities whose
 * AD labels genuinely collide (Contacts carries both the company's and the contact person's
 * email), and `parseDelimited`/`parseXlsx` both REJECT a file with duplicate headers. A
 * hand-rolled header pass here would produce a template that cannot be uploaded at all —
 * which is exactly the blocker that resolver was written to fix.
 *
 * <p>Sharing it also means the CSV template, the XLSX template and the CSV/XLSX export all
 * carry byte-identical headers in whatever language the session runs, which is what closes
 * export → edit → import regardless of which format the user picked at either end.
 *
 * @param {Array<object>} fields `window.import.fields`.
 * @param {object} [options]
 * @param {(field: object) => string} [options.headerFor] Session-language header resolver, the
 *   same one `ImportDialog` passes to `buildTemplateCsv` as `fieldLabelFn`.
 * @param {boolean} [options.includeExampleRow=true] Set false to get the header row alone.
 * @param {string} [options.sheetName='Import'] Sheet name. A single sheet, always: `parseXlsx`
 *   rejects a workbook with more than one sheet holding data.
 * @returns {Promise<Blob>} the workbook, ready to hand to a download.
 */
export async function buildTemplateXlsx(fields, options = {}) {
  const { includeExampleRow = true, sheetName = 'Import' } = options;
  const headers = resolveTemplateHeaders(fields, options);

  const rows = [headers.map((header) => ({ value: header, type: String, fontWeight: 'bold' }))];

  // Same rule as the CSV template: a sample row only when some field actually declares an
  // example. A row of empty cells is noise, and worse, reads as a data row to anyone who did
  // not count the lines.
  if (includeExampleRow && fields.some((f) => f.example != null && f.example !== '')) {
    rows.push(fields.map((field) => ({ value: toCellText(field.example), type: String })));
  }

  const { toBlob } = await writeXlsxFile(rows, {
    sheet: sheetName,
    // Every column formatted as text ('@'), which is the only lever available against Excel's
    // silent coercion. A user typing 08018 into a General-formatted cell gets the NUMBER 8018,
    // and the leading zero is gone before any of our code sees the file — unrecoverable. A
    // text-formatted column keeps it a string. This protects rows typed into OUR template; a
    // workbook the user builds from scratch is still Excel's to coerce.
    columns: headers.map(() => ({ format: '@' })),
    // The header row stays visible while scrolling a long file — the whole point of the
    // template is that a human fills it in by hand, and 20 columns of Contacts data is
    // unreadable once the header scrolls away.
    stickyRowsCount: 1,
  });
  return toBlob();
}

/**
 * The example value as a string. Written as text rather than typed for the same reason every
 * export cell is text: a typed example would teach Excel to treat the whole column as numeric
 * or as a date, re-coercing whatever the user types underneath it and defeating the `'@'`
 * format above.
 */
function toCellText(example) {
  return example == null ? '' : String(example);
}
