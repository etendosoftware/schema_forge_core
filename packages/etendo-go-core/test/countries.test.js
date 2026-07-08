import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryFlagEmoji,
  toDisplayNamesLocale,
  countryDisplayName,
  buildCountryOptions,
} from '../src/onboarding/countries.js';

describe('countryFlagEmoji', () => {
  it('converts a known 2-letter code to its flag emoji', () => {
    assert.equal(countryFlagEmoji('AR'), '🇦🇷');
    assert.equal(countryFlagEmoji('ES'), '🇪🇸');
  });

  it('handles lowercase input by upper-casing before conversion', () => {
    assert.equal(countryFlagEmoji('ar'), '🇦🇷');
    assert.equal(countryFlagEmoji('es'), '🇪🇸');
  });

  it('returns empty string for an empty string', () => {
    assert.equal(countryFlagEmoji(''), '');
  });

  it('returns empty string for a 1-character code', () => {
    assert.equal(countryFlagEmoji('A'), '');
  });

  it('returns empty string for a 3-character code', () => {
    assert.equal(countryFlagEmoji('ARG'), '');
  });

  it('returns empty string for null', () => {
    assert.equal(countryFlagEmoji(null), '');
  });

  it('returns empty string for undefined', () => {
    assert.equal(countryFlagEmoji(undefined), '');
  });
});

describe('toDisplayNamesLocale', () => {
  it('converts an underscore locale to a hyphenated BCP47 locale', () => {
    assert.equal(toDisplayNamesLocale('es_ES'), 'es-ES');
    assert.equal(toDisplayNamesLocale('en_US'), 'en-US');
  });

  it('defaults to "es" when locale is undefined', () => {
    assert.equal(toDisplayNamesLocale(undefined), 'es');
  });

  it('defaults to "es" when locale is null', () => {
    assert.equal(toDisplayNamesLocale(null), 'es');
  });
});

describe('countryDisplayName', () => {
  it('returns the localized country name for known codes in Spanish', () => {
    assert.equal(countryDisplayName('ES', 'es_ES'), 'España');
    assert.equal(countryDisplayName('AR', 'es_ES'), 'Argentina');
  });

  it('does not throw for a garbage code and falls back to the raw code', () => {
    // Intl.DisplayNames#of throws a RangeError for malformed region codes
    // (e.g. not matching the alpha-2 / numeric-3 region format); the
    // implementation catches it and returns the original countryCode.
    assert.doesNotThrow(() => countryDisplayName('garbage', 'es_ES'));
    assert.equal(countryDisplayName('garbage', 'es_ES'), 'garbage');
  });
});

describe('buildCountryOptions', () => {
  it('maps country codes to fully populated option objects', () => {
    const options = buildCountryOptions(['ES', 'AR'], 'es_ES');

    assert.equal(options.length, 2);

    assert.equal(options[0].value, 'ES');
    assert.equal(options[0].label, 'España');
    assert.equal(options[0].flag, '🇪🇸');

    assert.equal(options[1].value, 'AR');
    assert.equal(options[1].label, 'Argentina');
    assert.equal(options[1].flag, '🇦🇷');
  });

  it('returns an empty array for an empty array input', () => {
    assert.deepEqual(buildCountryOptions([], 'es_ES'), []);
  });

  it('returns an empty array for undefined input', () => {
    assert.deepEqual(buildCountryOptions(undefined, 'es_ES'), []);
  });
});
