/**
 * Canonical Handlebars helpers for LOCAL HTML rendering of reports.
 *
 * These mirror — verbatim — the generated `artifacts/<id>/helpers.js` functions
 * that the report HTML render path historically registered (the fixed whitelist:
 * isGroupBreak, resetGroupTracking, formatDate, formatCurrency, formatBoolean,
 * formatNumber, ifCond, eq, sumField, formatDateDisplay, sumRowsByCategory).
 *
 * Keeping them as a trusted in-repo module lets the report server and the Vite
 * dev plugin register the helpers WITHOUT dynamically executing the per-report
 * artifact file (no `new Function` / `eval`, which Sonar flags as S1523).
 *
 * jsreport (PDF/XLSX) is intentionally unchanged: it still consumes the per-report
 * `helpers.js` string directly, which is where report-specific helpers such as
 * `qrCode` live. Those are never part of the local HTML whitelist.
 *
 * `createReportHelpers()` returns a fresh set with isolated group-break state,
 * matching the previous per-render isolation that `new Function` provided.
 *
 * The only helper that historically diverged between reports is `formatNumber`
 * (most reports format integers with no decimals; the tax report keeps 2 so tax
 * rates render as "21.00%"). That difference is expressed as data via the
 * `numberFormat` option (Intl.NumberFormat options) instead of per-report code,
 * and `extractNumberFormatOptions()` recovers it from a report's `helpers.js`
 * without executing it.
 *
 * @param {object} [options]
 * @param {Intl.NumberFormatOptions} [options.numberFormat] Options applied by
 *        `formatNumber`. Defaults to the canonical generator behaviour (no
 *        fixed fraction digits).
 */
export function createReportHelpers({ numberFormat } = {}) {
  // Group-break detection: tracks previous values per group field
  let _prevGroupValues = {};

  function isGroupBreak(field, currentValue) {
    var prev = _prevGroupValues[field];
    _prevGroupValues[field] = currentValue;
    return prev !== currentValue;
  }

  function resetGroupTracking() {
    _prevGroupValues = {};
  }

  function formatDate(value) {
    if (value == null || value === '') return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }

  function formatCurrency(value) {
    if (value == null) return '';
    var num = Number(value);
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  }

  function formatBoolean(value) {
    return value ? 'Yes' : 'No';
  }

  function formatNumber(value) {
    if (value == null) return '';
    var num = Number(value);
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('en-US', numberFormat || undefined).format(num);
  }

  function ifCond(v1, operator, v2, options) {
    switch (operator) {
      case '===': return v1 === v2 ? options.fn(this) : options.inverse(this);
      case '!==': return v1 !== v2 ? options.fn(this) : options.inverse(this);
      default: return options.inverse(this);
    }
  }

  function eq(a, b) { return a === b; }

  function sumField(rows, field) {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce(function(acc, row) {
      var val = Number(row[field]);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }

  function formatDateDisplay(value) {
    if (value == null || value === '') return '';
    // Accepts YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      var parts = value.split('-');
      return parts[2] + '-' + parts[1] + '-' + parts[0];
    }
    return String(value);
  }

  function sumRowsByCategory(rows, categoryPrefix, field) {
    if (!Array.isArray(rows)) return 0;
    return rows
      .filter(function(r) { return (r.category || '').startsWith(categoryPrefix); })
      .reduce(function(sum, r) { return sum + (Number(r[field]) || 0); }, 0);
  }

  return {
    isGroupBreak,
    resetGroupTracking,
    formatDate,
    formatCurrency,
    formatBoolean,
    formatNumber,
    ifCond,
    eq,
    sumField,
    formatDateDisplay,
    sumRowsByCategory,
  };
}

/**
 * Build the text encoded in a document report's QR code.
 *
 * Exact port of the text-building logic of the historical per-report `qrCode`
 * Handlebars helpers (artifacts/print-*\/helpers.js). All 8 document reports
 * shared the same structure and segment order; only the date field varied by
 * document type (invoices: dateinvoiced, orders/quotations: dateordered,
 * shipments/receipts: movementdate, payments: paymentdate) and the amount
 * field (invoices/orders: grandtotal, payments: amount, shipments: none) —
 * expressed here as fallback chains. Kept pure so it can be tested without
 * generating an actual QR image.
 *
 * @param {object} [header] Document header row.
 * @returns {string} Pipe-joined field string, 'empty' when the header has no
 *          known fields, or 'no data' when there is no header object at all.
 */
export function buildDocumentQrText(header) {
  if (!header || typeof header !== 'object') return 'no data';
  const docDate = header.dateinvoiced || header.dateordered || header.movementdate || header.paymentdate;
  const docAmount = header.grandtotal || header.amount;
  const parts = [];
  if (header.doc_type) parts.push('T:' + header.doc_type);
  if (header.documentno) parts.push('N:' + header.documentno);
  if (docDate) parts.push('D:' + String(docDate).substring(0, 10));
  if (header.bp_name) parts.push('BP:' + header.bp_name);
  if (docAmount) parts.push('$:' + docAmount);
  if (header.currency) parts.push('C:' + header.currency);
  if (header.org_taxid) parts.push('TID:' + header.org_taxid);
  if (header.status) parts.push('S:' + header.status);
  return parts.length > 0 ? parts.join('|') : 'empty';
}

/**
 * Precompute a document's QR code as a PNG data URL (`header.qrDataUrl`).
 *
 * This replaces the per-report async `qrCode` Handlebars helper: Handlebars
 * compiles synchronously on the local HTML path, so the QR must be resolved
 * BEFORE compile and injected as plain data. Templates reference it as
 * `<img src="{{header.qrDataUrl}}">` on both the HTML and jsreport paths.
 *
 * NOT a Handlebars helper — deliberately excluded from `createReportHelpers()`.
 *
 * @param {object} [header] Document header row.
 * @param {object} [options]
 * @param {object} [options.qrcode] Pre-resolved `qrcode` module. The report
 *        server passes its own (its Docker image installs node_modules only
 *        under tools/report-server, unreachable from this module's path);
 *        other consumers can omit it and rely on the lazy dynamic import.
 * @returns {Promise<string>} PNG data URL.
 */
export async function computeDocumentQrDataUrl(header, { qrcode } = {}) {
  const QRCode = qrcode || (await import('qrcode')).default;
  return QRCode.toDataURL(buildDocumentQrText(header), { width: 120, margin: 1 });
}

/**
 * Statically recover the `formatNumber` Intl options from a report's
 * `helpers.js` source WITHOUT executing it. Returns the options object the
 * artifact's `formatNumber` passed to `Intl.NumberFormat`, or `undefined` when
 * the report uses the canonical (no-options) behaviour.
 *
 * This keeps the registration generic — any report whose generated helpers
 * declare fixed fraction digits keeps them — without special-casing a report
 * name in this shared module.
 *
 * @param {string} helpersCode Raw contents of `artifacts/<id>/helpers.js`.
 * @returns {Intl.NumberFormatOptions | undefined}
 */
export function extractNumberFormatOptions(helpersCode) {
  if (!helpersCode) return undefined;
  // Capture the options literal of the Intl.NumberFormat call inside formatNumber.
  const body = /function\s+formatNumber\b[\s\S]*?Intl\.NumberFormat\(\s*['"][^'"]*['"]\s*,\s*(\{[\s\S]*?\})\s*\)/.exec(helpersCode);
  if (!body) return undefined;
  const opts = {};
  const min = /minimumFractionDigits\s*:\s*(\d+)/.exec(body[1]);
  const max = /maximumFractionDigits\s*:\s*(\d+)/.exec(body[1]);
  if (min) opts.minimumFractionDigits = Number(min[1]);
  if (max) opts.maximumFractionDigits = Number(max[1]);
  return Object.keys(opts).length ? opts : undefined;
}

/**
 * Register the canonical HTML helper set on a Handlebars instance.
 * Resets group-break tracking first, matching the previous render behaviour.
 *
 * @param {object} handlebars Handlebars instance.
 * @param {string} [helpersCode] Raw `helpers.js` of the report being rendered.
 *        Used only to preserve a report's `formatNumber` decimal formatting; no
 *        code from it is executed.
 */
export function registerReportHelpers(handlebars, helpersCode) {
  const helpers = createReportHelpers({ numberFormat: extractNumberFormatOptions(helpersCode) });
  helpers.resetGroupTracking();
  Object.entries(helpers).forEach(([name, fn]) => {
    if (typeof fn === 'function') handlebars.registerHelper(name, fn);
  });
  return helpers;
}
