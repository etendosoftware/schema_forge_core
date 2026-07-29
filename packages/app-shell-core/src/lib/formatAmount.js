/**
 * Format a numeric amount using the ISO currency code from the record data.
 *
 * Uses Intl.NumberFormat with the provided ISO code (e.g. "USD", "EUR") to get
 * the native browser symbol. Falls back to plain toLocaleString() when no currency
 * code is available.
 *
 * NOTE: Locale is intentionally left as browser default (undefined) to avoid
 * inconsistent symbol rendering across browsers (e.g. 'es-AR' shows "US$" vs "$").
 * Pending team decision: prefer symbol ($), ISO code (USD), or browser-default locale.
 *
 * @param {number} value - The numeric amount to format.
 * @param {string|null|undefined} isoCode - ISO 4217 currency code (e.g. "USD").
 * @returns {string}
 */
export function formatAmount(value, isoCode) {
  if (value == null) return '\u2014';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  const numberLocale = 'en-US';
  if (isoCode) {
    try {
      const currencyFormatter = new Intl.NumberFormat(numberLocale, {
        style: 'currency',
        currency: isoCode,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const amountFormatter = new Intl.NumberFormat(numberLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const currencySymbol = currencyFormatter
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value;

      if (!currencySymbol) {
        return currencyFormatter.format(num);
      }

      const absFormatted = amountFormatter.format(Math.abs(num));
      const sign = num < 0 ? '-' : '';

      if (isoCode === 'EUR') {
        return `${sign}${absFormatted} ${currencySymbol}`;
      }

      return `${sign}${currencySymbol}${absFormatted}`;
    } catch {
      // Unknown ISO code — fall through to plain format
    }
  }
  return num.toLocaleString(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
