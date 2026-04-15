const DEFAULT_LOCALE = 'en-US';

/**
 * Format a numeric value as a currency string using an ISO 4217 currency code.
 *
 * This is the canonical shared currency formatting utility for the app shell.
 * Use this function for all new money formatting — it is designed as the stable
 * base for future locale-aware formatting without requiring call site changes.
 *
 * Symbol placement rules:
 *   - EUR → symbol after amount with a space: "1,234.56 €"
 *   - All other currencies → symbol before amount: "$1,234.56"
 *
 * @param {string} currencyCode - ISO 4217 currency code (e.g. "USD", "EUR", "ARS").
 * @param {number|string|null|undefined} value - The numeric amount to format.
 * @returns {string} Formatted currency string, or '—' for invalid/missing values.
 *
 * @example
 * formatCurrency('USD', 1234.5)   // '$1,234.50'
 * formatCurrency('EUR', 1234.5)   // '1,234.50 €'
 * formatCurrency('EUR', -99.9)    // '-99.90 €'
 * formatCurrency('XYZ', 99)       // '99.00'  (unknown code falls back to numeric)
 * formatCurrency('USD', null)     // '—'
 */
export function formatCurrency(currencyCode, value) {
  if (value == null || !Number.isFinite(Number(value))) return '\u2014';

  const amount = Number(value);

  try {
    const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // EUR convention: amount first, then symbol with a space ("1,234.56 €")
    if (currencyCode === 'EUR') {
      const symbol = formatter.formatToParts(0).find((p) => p.type === 'currency')?.value ?? '€';
      const numFormatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const sign = amount < 0 ? '-' : '';
      return `${sign}${numFormatter.format(Math.abs(amount))} ${symbol}`;
    }

    // All other currencies: symbol before amount ("$1,234.56")
    return formatter.format(amount);
  } catch {
    return amount.toLocaleString(DEFAULT_LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
