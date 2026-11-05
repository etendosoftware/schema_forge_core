/**
 * ETP-6082 — the business sectors the register form offers.
 *
 * Each `value` is the internal value of the HubSpot contact property `sector`, which marketing
 * keeps fixed, and is what the backend stores and sends. It must match
 * `HubSpotOutbox.SECTORS` in com.etendoerp.go: a value outside that list is dropped by the
 * backend, because HubSpot would refuse the whole contact. Only the label is translated.
 */
export const BUSINESS_SECTORS = Object.freeze([
  { value: 'industria', labelKey: 'onboardingBusinessSectorIndustry' },
  { value: 'distribución_logística', labelKey: 'onboardingBusinessSectorDistribution' },
  { value: 'servicios', labelKey: 'onboardingBusinessSectorServices' },
  { value: 'startups_tecnología', labelKey: 'onboardingBusinessSectorStartups' },
  { value: 'otro', labelKey: 'onboardingBusinessSectorOther' },
]);

/**
 * Tells whether a value is one of the offered sectors.
 *
 * @param {string} value the selected value
 * @returns {boolean} whether it can be sent
 */
export function isBusinessSector(value) {
  return BUSINESS_SECTORS.some((sector) => sector.value === value);
}
