const LOCALE_MAP = {
  en_US: 'en-US',
  es_ES: 'es-ES',
};

function toIntlLocale(locale) {
  return LOCALE_MAP[locale] ?? locale?.replace('_', '-') ?? 'en-US';
}

export function formatDate(value, locale) {
  if (value == null || value === '') return '';
  // Parse ISO date strings (YYYY-MM-DD) as UTC to avoid timezone day-shift.
  // Falls back to standard Date parsing for non-ISO formats.
  let d;
  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  if (isoDate) {
    const [y, m, day] = String(value).split('-').map(Number);
    d = new Date(Date.UTC(y, m - 1, day));
  } else {
    d = new Date(value);
  }
  if (isNaN(d.getTime())) return String(value);
  const intlLocale = toIntlLocale(locale);
  return new Intl.DateTimeFormat(intlLocale, {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC',
  }).format(d);
}

export function formatCurrency(value, locale) {
  if (value == null) return '';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  const intlLocale = toIntlLocale(locale);
  return new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatBoolean(value, locale) {
  if (locale?.startsWith('es')) {
    return value ? 'Si' : 'No';
  }
  return value ? 'Yes' : 'No';
}

export function truncate(value, maxLength) {
  if (value == null) return '';
  const str = String(value);
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

/**
 * Register all helpers with a Handlebars instance.
 * Used by jsreport at template load time.
 */
export function registerAll(handlebars) {
  handlebars.registerHelper('formatDate', (val, opts) => formatDate(val, opts.data?.root?.meta?.locale));
  handlebars.registerHelper('formatCurrency', (val, opts) => formatCurrency(val, opts.data?.root?.meta?.locale));
  handlebars.registerHelper('formatBoolean', (val, opts) => formatBoolean(val, opts.data?.root?.meta?.locale));
  handlebars.registerHelper('truncate', (val, max) => truncate(val, max));
  handlebars.registerHelper('eq', (a, b) => a === b);
  handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
    switch (operator) {
      case '===': return v1 === v2 ? options.fn(this) : options.inverse(this);
      case '!==': return v1 !== v2 ? options.fn(this) : options.inverse(this);
      case '>': return v1 > v2 ? options.fn(this) : options.inverse(this);
      case '<': return v1 < v2 ? options.fn(this) : options.inverse(this);
      default: return options.inverse(this);
    }
  });
}
