const DASHBOARD_NUMBER_LOCALE = 'en-US';

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

  return new Intl.NumberFormat(DASHBOARD_NUMBER_LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
}

export function formatDashboardAmount(value, currencyLabel, locale = 'en-US') {
  const num = Number(value);

  if (!Number.isFinite(num)) return String(value ?? '\u2014');

  const localizedAmount = new Intl.NumberFormat(DASHBOARD_NUMBER_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (!currencyLabel) {
    return num < 0 ? `-${localizedAmount}` : localizedAmount;
  }

  const normalizedLabel = String(currencyLabel).trim();
  const codeMatch = normalizedLabel.toUpperCase().match(/\b[A-Z]{3}\b/);
  const currencyCode = codeMatch ? codeMatch[0] : normalizedLabel.toUpperCase();
  const formatted = `${currencyCode} ${localizedAmount}`;

  return num < 0 ? `-${formatted}` : formatted;
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

export function niceScale(dataMax) {
  if (dataMax <= 0) return { niceMax: 100, ticks: [0, 25, 50, 75, 100] };

  const exp = Math.floor(Math.log10(dataMax));
  const niceFactors = [1, 2, 2.5, 5, 10, 20, 25, 50];

  for (let e = exp - 1; e <= exp + 1; e++) {
    const base = Math.pow(10, e);
    for (const f of niceFactors) {
      const step = f * base;
      const niceMax = Math.ceil(dataMax / step - 1e-10) * step;
      const count = Math.round(niceMax / step) + 1;
      if (count >= 4 && count <= 6) {
        return { niceMax, ticks: Array.from({ length: count }, (_, i) => i * step) };
      }
    }
  }

  const step = Math.pow(10, exp);
  const niceMax = Math.ceil(dataMax / step) * step;
  const count = Math.round(niceMax / step) + 1;
  return { niceMax, ticks: Array.from({ length: count }, (_, i) => i * step) };
}
