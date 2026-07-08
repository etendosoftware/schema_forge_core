const REGIONAL_INDICATOR_OFFSET = 127397;

export function countryFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return '';
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(REGIONAL_INDICATOR_OFFSET + char.charCodeAt(0)));
}

export function toDisplayNamesLocale(locale) {
  return (locale || 'es').replace('_', '-');
}

export function countryDisplayName(countryCode, locale) {
  try {
    return new Intl.DisplayNames([toDisplayNamesLocale(locale)], { type: 'region' }).of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

export function buildCountryOptions(countryCodes, locale) {
  return (countryCodes || []).map((code) => ({
    value: code,
    label: countryDisplayName(code, locale),
    flag: countryFlagEmoji(code),
  }));
}
