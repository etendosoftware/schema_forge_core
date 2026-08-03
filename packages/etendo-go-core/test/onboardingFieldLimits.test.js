import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ONBOARDING_FIELD_LIMITS,
  FULL_NAME_MAX_LENGTH,
  CLIENT_NAME_MAX_LENGTH,
  FREELANCER_FULL_NAME_MAX_LENGTH,
  fullNameLimitFor,
  exceedsLimit,
} from '../src/onboarding/fieldLimits.js';
import { isProfileStepValid, isCompanyStepValid } from '../src/onboarding/state.js';

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
      address: 60,      // C_LOCATION.ADDRESS1
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

  it('caps company name, tax id and address in the company step', () => {
    const step = readStep('CompanyStep.jsx');
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.clientName\}/);
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.fiscalId\}/);
    assert.match(step, /maxLength=\{ONBOARDING_FIELD_LIMITS\.address\}/);
  });

  it('never hardcodes a limit inline — every cap comes from fieldLimits.js', () => {
    for (const name of ['RegisterStep.jsx', 'ProfileStep.jsx', 'CompanyStep.jsx']) {
      assert.doesNotMatch(readStep(name), /maxLength=\{\d+\}/, `${name} hardcodes a maxLength`);
    }
  });
});
