// Handlebars helpers for jsreport (CommonJS format — jsreport evaluates this as a script)
// These mirror the functions in common.js but in the format jsreport expects.

const LOCALE_MAP = {
  en_US: 'en-US',
  es_ES: 'es-ES',
};

function toIntlLocale(locale) {
  return LOCALE_MAP[locale] || (locale ? locale.replace('_', '-') : 'en-US');
}

function _formatDate(value, locale) {
  if (value == null || value === '') return '';
  // Handle ISO date-only strings (YYYY-MM-DD) in UTC to avoid timezone shift
  const isoDateOnly = /^\d{4}-\d{2}-\d{2}$/;
  let d;
  if (typeof value === 'string' && isoDateOnly.test(value)) {
    const [y, m, day] = value.split('-').map(Number);
    d = new Date(Date.UTC(y, m - 1, day));
  } else {
    d = new Date(value);
  }
  if (isNaN(d.getTime())) return String(value);
  const intlLocale = toIntlLocale(locale);
  const opts = { year: 'numeric', month: '2-digit', day: '2-digit' };
  if (typeof value === 'string' && isoDateOnly.test(value)) {
    opts.timeZone = 'UTC';
  }
  return new Intl.DateTimeFormat(intlLocale, opts).format(d);
}

function _formatCurrency(value, locale) {
  if (value == null) return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  const intlLocale = toIntlLocale(locale);
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function _formatBoolean(value, locale) {
  if (locale && locale.startsWith('es')) {
    return value ? 'Si' : 'No';
  }
  return value ? 'Yes' : 'No';
}

// Register helpers — jsreport passes the Handlebars instance
function formatDate(value, options) {
  const locale = options && options.data && options.data.root && options.data.root.meta
    ? options.data.root.meta.locale
    : 'en_US';
  return _formatDate(value, locale);
}

function formatCurrency(value, options) {
  const locale = options && options.data && options.data.root && options.data.root.meta
    ? options.data.root.meta.locale
    : 'en_US';
  return _formatCurrency(value, locale);
}

function formatBoolean(value, options) {
  const locale = options && options.data && options.data.root && options.data.root.meta
    ? options.data.root.meta.locale
    : 'en_US';
  return _formatBoolean(value, locale);
}

function ifCond(v1, operator, v2, options) {
  switch (operator) {
    case '===': return v1 === v2 ? options.fn(this) : options.inverse(this);
    case '!==': return v1 !== v2 ? options.fn(this) : options.inverse(this);
    case '>': return v1 > v2 ? options.fn(this) : options.inverse(this);
    case '<': return v1 < v2 ? options.fn(this) : options.inverse(this);
    default: return options.inverse(this);
  }
}

function eq(a, b) {
  return a === b;
}
