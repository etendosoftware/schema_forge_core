function pickFirst(...values) {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (value != null && value !== '') return String(value);
  }
  return '';
}

export function buildLocationAddressLines(location, fallbackSummary = null) {
  const addressLine1 = pickFirst(location?.address, location?.addressLine1);
  const addressLine2 = pickFirst(location?.address2, location?.addressLine2);
  const postalCode = pickFirst(location?.postalCode);
  const city = pickFirst(location?.city, location?.cityName);
  const region = pickFirst(location?.['region$_identifier'], location?.regionLabel, location?.region);
  const country = pickFirst(location?.['country$_identifier'], location?.countryLabel, location?.country);

  const localityLine = [postalCode, city].filter(Boolean).join(' ');
  const regionCountryLine = [region, country].filter(Boolean).join(', ');

  const lines = [addressLine1, addressLine2, localityLine, regionCountryLine].filter(Boolean);
  if (lines.length > 0) return lines;

  const fallbackLine = pickFirst(fallbackSummary, location?.name, location?._identifier);
  return fallbackLine ? [fallbackLine] : [];
}
