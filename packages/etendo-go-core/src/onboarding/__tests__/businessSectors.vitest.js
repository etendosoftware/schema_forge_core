// @covers packages/etendo-go-core/src/onboarding/businessSectors.js
import { describe, expect, it } from 'vitest';

import { BUSINESS_SECTORS, isBusinessSector } from '../businessSectors.js';

/**
 * ETP-6082 — the business sectors the register form and the company step offer. The values are
 * HubSpot's internal ones and must match `HubSpotOutbox.SECTORS` in com.etendoerp.go: anything else
 * is dropped by the backend, so a renamed value would silently stop reaching HubSpot.
 */
describe('business sectors', () => {
  it('offers exactly the values of the HubSpot property, in order', () => {
    expect(BUSINESS_SECTORS.map((sector) => sector.value)).toEqual([
      'industria',
      'distribución_logística',
      'servicios',
      'startups_tecnología',
      'otro',
    ]);
  });

  it('gives each sector its own translated label', () => {
    const keys = BUSINESS_SECTORS.map((sector) => sector.labelKey);

    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((key) => expect(key).toMatch(/^onboardingBusinessSector[A-Z]/));
  });

  it('cannot be changed at runtime', () => {
    expect(Object.isFrozen(BUSINESS_SECTORS)).toBe(true);
  });

  it('accepts only an offered value', () => {
    expect(isBusinessSector('servicios')).toBe(true);
    expect(isBusinessSector('distribución_logística')).toBe(true);
  });

  it('rejects the retired company step values, a label and an empty choice', () => {
    expect(isBusinessSector('technology')).toBe(false);
    expect(isBusinessSector('Servicios')).toBe(false);
    expect(isBusinessSector('')).toBe(false);
    expect(isBusinessSector(undefined)).toBe(false);
    expect(isBusinessSector(null)).toBe(false);
  });
});
