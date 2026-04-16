import { formatAmount } from '@/lib/formatAmount.js';

export function localeFromUi(locale) {
  return locale === 'es_ES' ? 'es-ES' : 'en-US';
}

export function formatDashboardNumber(value, locale = 'en-US', options = {}) {
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value ?? '—');

  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 0,
  } = options;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
}

export function formatDashboardAmount(value, currencyLabel, locale = 'en-US') {
  const raw = formatAmount(value, currencyLabel);
  const num = Number(value);

  if (!Number.isFinite(num)) return raw;

  const localizedAmount = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (!currencyLabel) {
    return num < 0 ? `-${localizedAmount}` : localizedAmount;
  }

  const match = raw.match(/[0-9][0-9,.-]*/);
  if (!match) return raw;

  return raw.replace(match[0], localizedAmount);
}

export function formatDashboardCompact(value, { locale = 'en-US', currencyLabel = '', maxDecimals = 1 } = {}) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);

  const formatCompact = (divisor, suffix) => {
    const compact = num / divisor;
    const hasFraction = Math.abs(compact) < 100 && Math.abs(compact % 1) >= 0.05;

    if (currencyLabel) {
      return `${formatDashboardAmount(compact, currencyLabel, locale)}${suffix}`;
    }

    return `${formatDashboardNumber(compact, locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: hasFraction ? maxDecimals : 0,
    })}${suffix}`;
  };

  if (abs >= 1_000_000_000) return formatCompact(1_000_000_000, 'B');
  if (abs >= 1_000_000) return formatCompact(1_000_000, 'M');
  if (abs >= 1_000) return formatCompact(1_000, 'K');

  if (currencyLabel) return formatDashboardAmount(num, currencyLabel, locale);
  return formatDashboardNumber(num, locale);
}

export function formatDashboardAxisTick(value, locale = 'en-US') {
  return formatDashboardCompact(value, { locale, maxDecimals: 1 });
}
