// @covers packages/etendo-go-core/src/onboarding/fieldLimits.js
// @covers packages/etendo-go-core/src/onboarding/state.js
// @covers packages/etendo-go-core/src/onboarding/steps/CompanyStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/RegisterStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/ProfileStep.jsx
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ONBOARDING_FIELD_LIMITS,
  FULL_NAME_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  CLIENT_NAME_INPUT_MAX_LENGTH,
  FREELANCER_FULL_NAME_MAX_LENGTH,
  fullNameLimitFor,
  exceedsLimit,
} from '../src/onboarding/fieldLimits.js';
import { isProfileStepValid, isCompanyStepValid, isAddressBlockStarted } from '../src/onboarding/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const stepsDir = join(__dirname, '..', 'src', 'onboarding', 'steps');
const readStep = name => readFileSync(join(stepsDir, name), 'utf8');

// ETP-4665 — onboarding inputs had no length cap, so an over-long value was only
// rejected by the DAL halfway through tenant provisioning (rolling the whole
// transaction back and surfacing a raw "@CreateClientFailed@"). Each limit below
// is the size of the AD column the value lands in.
describe('onboarding field limits (ETP-4665)', () => {
  it('caps every field at the size of the AD column it is written to', () => {
    assert.deepEqual(ONBOARDING_FIELD_LIMITS, {
      accountName: 60,  // ETGO_ACCOUNT.NAME is 255 — pinned to fullName, see below
      email: 60,        // AD_USER.USERNAME / AD_USER.NAME
      password: 128,    // no storage constraint; defensive bound only
      fullName: 60,     // AD_USER.NAME
      clientName: 40,   // AD_CLIENT.VALUE / AD_ORG.VALUE (tighter than NAME's 60)
      fiscalId: 20,     // C_BPARTNER.TAXID / AD_ORGINFO.TAXID
      address: 60,      // C_LOCATION.ADDRESS1 (legacy free text, superseded below)
      // ETP-5806 — structured address fields, EM_OBSEPA_StrtNm/BldgNb/BldgNm
      streetName: 70,
      buildingNumber: 16,
      buildingName: 35,
      // ETP-5806 — City, C_LOCATION.CITY (plain AD column, not a SEPA field)
      city: 60,
    });
  });

  it('caps the register name at the profile limit, because the profile step pre-fills it', () => {
    // ProfileStep seeds "Nombre completo" from the account name, and maxLength does
    // not truncate a programmatically assigned value. A looser cap in step 1 hands
    // the user a pre-filled field already in error, with Continue disabled until
    // they delete characters the system put there.
    assert.equal(ONBOARDING_FIELD_LIMITS.accountName, ONBOARDING_FIELD_LIMITS.fullName);
  });

  it('keeps the client name under AD_CLIENT.VALUE(40), not AD_CLIENT.NAME(60)', () => {
    // The same string is written to both columns by InitialSetupUtility.insertClient,
    // so the search key is what binds. Relaxing this to 60 reintroduces the bug.
    assert.equal(CLIENT_NAME_MAX_LENGTH, 40);
  });

  it('gives the company-name input headroom over the limit, within AD_CLIENT.NAME', () => {
    // ETP-5638: a cap at the limit would truncate a paste silently instead of showing the error.
    assert.ok(CLIENT_NAME_INPUT_MAX_LENGTH > CLIENT_NAME_MAX_LENGTH);
    assert.equal(CLIENT_NAME_INPUT_MAX_LENGTH, 60);
  });

  it('applies the stricter client-name limit to a freelancer full name', () => {
    // CompanyStep reuses a freelancer's full name as the invoicing name.
    assert.equal(FREELANCER_FULL_NAME_MAX_LENGTH, CLIENT_NAME_MAX_LENGTH);
    assert.equal(fullNameLimitFor('freelancer'), CLIENT_NAME_MAX_LENGTH);
    assert.equal(fullNameLimitFor('company'), FULL_NAME_MAX_LENGTH);
    assert.equal(fullNameLimitFor('advisory'), FULL_NAME_MAX_LENGTH);
    assert.equal(fullNameLimitFor(undefined), FULL_NAME_MAX_LENGTH);
  });
});

describe('exceedsLimit', () => {
  it('is inclusive of the limit itself', () => {
    assert.equal(exceedsLimit('a'.repeat(40), 40), false);
    assert.equal(exceedsLimit('a'.repeat(41), 40), true);
  });

  it('counts code points, so an emoji is one character', () => {
    // '🙂' is two UTF-16 units; counting String.length would reject a legal value.
    assert.equal('🙂'.length, 2);
    assert.equal(exceedsLimit('🙂', 1), false);
    assert.equal(exceedsLimit('🙂🙂', 1), true);
  });

  it('never reports a violation for a missing value or a missing limit', () => {
    assert.equal(exceedsLimit(undefined, 40), false);
    assert.equal(exceedsLimit(null, 40), false);
    assert.equal(exceedsLimit('', 40), false);
    assert.equal(exceedsLimit('anything', undefined), false);
  });
});

describe('step validation gates on length (ETP-4665)', () => {
  const profile = over => ({ fullName: 'Ada Lovelace', countryCode: 'ES', ...over });

  it('accepts a normal profile', () => {
    assert.equal(isProfileStepValid(profile()), true);
  });

  it('rejects a full name past AD_USER.NAME(60)', () => {
    assert.equal(isProfileStepValid(profile({ fullName: 'a'.repeat(61) })), false);
    assert.equal(isProfileStepValid(profile({ fullName: 'a'.repeat(60) })), true);
  });

  it('rejects a freelancer full name past the client-name limit of 40', () => {
    const freelancer = over => profile({ businessType: 'freelancer', ...over });
    assert.equal(isProfileStepValid(freelancer({ fullName: 'a'.repeat(41) })), false);
    assert.equal(isProfileStepValid(freelancer({ fullName: 'a'.repeat(40) })), true);
    // The very same name is fine for a company: only freelancers inherit the cap.
    assert.equal(isProfileStepValid(profile({ businessType: 'company', fullName: 'a'.repeat(41) })), true);
  });

  it('still requires a country and a non-blank name', () => {
    assert.equal(isProfileStepValid(profile({ countryCode: '' })), false);
    assert.equal(isProfileStepValid(profile({ fullName: '   ' })), false);
  });

  it('rejects a company name past 40 or an address past 60', () => {
    assert.equal(isCompanyStepValid({ clientName: 'Acme' }), true);
    assert.equal(isCompanyStepValid({ clientName: 'a'.repeat(41) }), false);
    assert.equal(isCompanyStepValid({ clientName: 'Acme', address: 'a'.repeat(61) }), false);
    assert.equal(isCompanyStepValid({ clientName: 'Acme', address: 'a'.repeat(60) }), true);
  });

  it('keeps the address optional', () => {
    assert.equal(isCompanyStepValid({ clientName: 'Acme', address: '' }), true);
    assert.equal(isCompanyStepValid({ clientName: 'Acme', address: undefined }), true);
  });
});

// ETP-5806 — the free-text `address` field was replaced by a structured Street/Number/
// Building Name/City block, fully optional until the user starts typing into it; from
// then on Street+Number+City become mandatory together (Country is not asked here).
describe('isAddressBlockStarted / isCompanyStepValid — structured address block (ETP-5806)', () => {
  it('reports not started when every address field is empty or blank', () => {
    assert.equal(isAddressBlockStarted({}), false);
    assert.equal(isAddressBlockStarted({ streetName: '', buildingNumber: '  ', buildingName: null, city: undefined }), false);
  });

  it('reports started as soon as ANY of the 4 fields carries non-blank text', () => {
    assert.equal(isAddressBlockStarted({ streetName: 'Av. Corrientes' }), true);
    assert.equal(isAddressBlockStarted({ buildingNumber: '1234' }), true);
    assert.equal(isAddressBlockStarted({ buildingName: 'Torre Norte' }), true);
    assert.equal(isAddressBlockStarted({ city: 'Madrid' }), true);
  });

  it('keeps the step valid with the address block untouched (fully optional)', () => {
    assert.equal(isCompanyStepValid({ clientName: 'Acme' }), true);
    assert.equal(isCompanyStepValid({ clientName: 'Acme', streetName: '', buildingNumber: '', city: '' }), true);
  });

  it('requires Street, Number and City together once the block is started, but not Building Name', () => {
    const base = { clientName: 'Acme' };
    // Only City typed in — Street/Number still missing: invalid.
    assert.equal(isCompanyStepValid({ ...base, city: 'Madrid' }), false);
    // Street + Number but no City: still invalid.
    assert.equal(isCompanyStepValid({ ...base, streetName: 'Av. Corrientes', buildingNumber: '1234' }), false);
    // All three mandatory fields present, Building Name omitted: valid.
    assert.equal(isCompanyStepValid({ ...base, streetName: 'Av. Corrientes', buildingNumber: '1234', city: 'Madrid' }), true);
    // Whitespace-only does not count as filled.
    assert.equal(isCompanyStepValid({ ...base, streetName: '   ', buildingNumber: '1234', city: 'Madrid' }), false);
  });

  it('rejects a structured field past its AD column length', () => {
    const base = { clientName: 'Acme', streetName: 'Av. Corrientes', buildingNumber: '1234', city: 'Madrid' };
    assert.equal(isCompanyStepValid({ ...base, streetName: 'a'.repeat(71) }), false);
    assert.equal(isCompanyStepValid({ ...base, buildingNumber: 'a'.repeat(17) }), false);
    assert.equal(isCompanyStepValid({ ...base, buildingName: 'a'.repeat(36) }), false);
    assert.equal(isCompanyStepValid({ ...base, city: 'a'.repeat(61) }), false);
  });
});

describe('the forms wire the limits to the inputs (ETP-4665)', () => {
  it('caps name, email and password in the register step', () => {
    const step = readStep('RegisterStep.jsx');
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.accountName\}/);
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.email\}/);
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.password\}/);
  });

  it('does not show a character counter on the password', () => {
    // There is no bcrypt in the stack and the stored hash is fixed-length, so a
    // counter would advertise a limit that does not exist.
    const step = readStep('RegisterStep.jsx');
    assert.doesNotMatch(step, /\/\s*\{?\s*(72|ONBOARDING_FIELD_LIMITS\.password)\s*\}?\s*</);
  });

  it('caps the full name and surfaces the freelancer overflow inline', () => {
    const step = readStep('ProfileStep.jsx');
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.fullName\}/);
    assert.match(step, /error=\{fullNameTooLong \? ui\('onboardingFieldTooLong', \{ max: fullNameLimit \}\) : null\}/);
    assert.match(step, /const fullNameLimit = fullNameLimitFor\(form\.businessType\)/);
    // Trimmed, so the inline error and the Continue button agree on padded input.
    assert.match(step, /exceedsLimit\(form\.fullName\?\.trim\(\), fullNameLimit\)/);
  });

  it('caps company name, tax id and the structured address fields in the company step', () => {
    const step = readStep('CompanyStep.jsx');
    // ETP-5638: the company name keeps typing headroom so a pasted over-long name is not
    // silently truncated; the real limit surfaces as an inline error, trimmed like the validator.
    assert.match(step, /maxLength=\{CLIENT_NAME_INPUT_MAX_LENGTH\}/);
    assert.match(step, /exceedsLimit\(form\.clientName\?\.trim\(\), ONBOARDING_FIELD_LIMITS\.clientName\)/);
    assert.match(step, /ui\('onboardingFieldTooLong', \{ max: ONBOARDING_FIELD_LIMITS\.clientName \}\)/);
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.fiscalId\}/);
    // ETP-5806: the free-text address field was replaced by Street/Number/Building Name.
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.streetName\}/);
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.buildingNumber\}/);
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.buildingName\}/);
  });

  it('wires the Street/Number placeholders and autoComplete tokens through i18n, not hardcoded strings (ETP-5806)', () => {
    const step = readStep('CompanyStep.jsx');
    assert.match(step, /placeholder=\{ui\('streetNamePlaceholder'\)\}/);
    assert.match(step, /placeholder=\{ui\('buildingNumberPlaceholder'\)\}/);
    // Standard autocomplete tokens per field: street -> address-line1, building name ->
    // address-line2 (the closest standard fit for "additional address line"), city ->
    // address-level2. Building number has no dedicated WHATWG token, so it opts out.
    assert.match(step, /id="streetName"[\s\S]*?autoComplete="address-line1"/);
    assert.match(step, /id="buildingNumber"[\s\S]*?autoComplete="off"/);
    assert.match(step, /id="buildingName"[\s\S]*?autoComplete="address-line2"/);
    assert.match(step, /id="city"[\s\S]*?autoComplete="address-level2"/);
  });

  it('renders the address block as a single compound field: one AddressCell row for Street/Number, another for Building name/City (ETP-5806 design follow-up)', () => {
    const step = readStep('CompanyStep.jsx');
    assert.match(step, /import \{ AddressCell \} from '\.\.\/components\/AddressCell\.jsx'/);
    // Street + Number share one grid row with a divider, Building name + City share the next —
    // not four independently-bordered inputs.
    const addressBlockMatch = step.match(/<div className="overflow-hidden rounded-lg border[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
    assert.ok(addressBlockMatch, 'expected a single bordered compound-field container for the address block');
    const addressBlock = addressBlockMatch[0];
    assert.match(addressBlock, /grid-cols-\[2fr_1fr\]/);
    assert.match(addressBlock, /divide-x/);
    assert.match(addressBlock, /id="streetName"/);
    assert.match(addressBlock, /id="buildingNumber"/);
    assert.match(addressBlock, /id="buildingName"/);
    assert.match(addressBlock, /id="city"/);
  });

  it('never hardcodes a limit inline — every cap comes from fieldLimits.js', () => {
    for (const name of ['RegisterStep.jsx', 'ProfileStep.jsx', 'CompanyStep.jsx']) {
      assert.doesNotMatch(readStep(name), /maxLength=\{\d+\}/, `${name} hardcodes a maxLength`);
    }
  });
});
