// @covers packages/etendo-go-core/src/onboarding/steps/CompanyStep.jsx
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4673 — a freelancer has no company: the "Company name" field is hidden and
 * their profile full name becomes the invoicing name, pushed upstream on mount.
 * A stale clientName from a previous Company/Advisory selection must never leak
 * into it.
 * ETP-4665 / ETP-5638 — the company name, tax id and address are capped at their
 * AD columns; the company-name input keeps typing headroom so a pasted over-long
 * value is shown as an inline error instead of being silently truncated.
 * ETP-5806 — the structured Street/Number/Building Name/City block only renders when
 * `capabilities.structuredAddressForSepa` is `true`; otherwise (false, undefined or missing —
 * the default, pre-launch state) the legacy single-line `address` field renders instead, exactly
 * as it did before this flag existed. The frontend never evaluates the flag itself, only the
 * boolean it is handed.
 * ETP-6082 — the business sector (the register form's list) is asked here only of an account that
 * has none, an SSO sign-up; then it is required. Everyone else never sees it.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key, params = {}) => {
    const dictionary = { onboardingFieldTooLong: 'Must not exceed {max} characters' };
    let text = dictionary[key] ?? key;
    Object.entries(params).forEach(([name, value]) => {
      text = text.replace(`{${name}}`, value);
    });
    return text;
  },
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

const { CompanyStep } = await import('../CompanyStep.jsx');
const {
  ONBOARDING_FIELD_LIMITS,
  CLIENT_NAME_INPUT_MAX_LENGTH,
} = await import('../../fieldLimits.js');

const CONFIG = { apiBase: '', brandLabel: 'Etendo', defaultForm: {} };

function renderCompanyStep(stepData = {}, capabilities, askSector = false) {
  const onChange = vi.fn();
  const utils = render(
    <CompanyStep
      config={CONFIG}
      stepData={stepData}
      capabilities={capabilities}
      accountSectorMissing={askSector}
      onChange={onChange}
      onNext={vi.fn()}
      onBack={vi.fn()} />,
  );
  return { ...utils, onChange };
}

function startButton() {
  return screen.getByTestId('Button__79cf84');
}

function inlineError() {
  return screen.queryByTestId('SetupField-error__79cf84');
}

/** Only the mount-time auto-fill broadcasts clientName. */
function clientNamePushes(onChange) {
  return onChange.mock.calls.filter(([payload]) => payload && 'clientName' in payload);
}

afterEach(cleanup);

describe('CompanyStep freelancer clientName handling (ETP-4673)', () => {
  it('hides the company-name field and pushes the profile full name upstream', () => {
    const { container, onChange } = renderCompanyStep({
      businessType: 'freelancer',
      fullName: 'Ada Lovelace',
    });

    expect(container.querySelector('#clientName')).toBeNull();
    expect(onChange).toHaveBeenCalledWith({ clientName: 'Ada Lovelace' });
  });

  it('ignores a stale stepData.clientName left by a previous business type', () => {
    const { onChange } = renderCompanyStep({
      businessType: 'freelancer',
      fullName: 'Ada Lovelace',
      clientName: 'Stale Inc',
    });

    expect(clientNamePushes(onChange)).toEqual([[{ clientName: 'Ada Lovelace' }]]);
    expect(onChange).not.toHaveBeenCalledWith({ clientName: 'Stale Inc' });
  });

  it('falls back to an empty string when a freelancer has no full name yet', () => {
    const { onChange } = renderCompanyStep({ businessType: 'freelancer' });

    expect(onChange).toHaveBeenCalledWith({ clientName: '' });
  });

  it('pushes the auto-filled name only on mount, not on every keystroke', () => {
    const { container, onChange } = renderCompanyStep({
      businessType: 'freelancer',
      fullName: 'Ada Lovelace',
    });

    // Any other field works for this assertion; fiscalIdValue renders regardless of the
    // structured-address-for-sepa flag (ETP-5806), unlike streetName.
    fireEvent.change(container.querySelector('#fiscalIdValue'), { target: { value: 'B12345678' } });

    expect(clientNamePushes(onChange)).toHaveLength(1);
  });

  it.each(['company', 'advisory'])('keeps the company-name field for %s businesses', (businessType) => {
    const { container, onChange } = renderCompanyStep({ businessType, clientName: 'Acme' });

    const input = container.querySelector('#clientName');
    expect(input).toBeTruthy();
    // Only freelancers auto-fill on mount; a company keeps whatever the draft holds.
    expect(clientNamePushes(onChange)).toHaveLength(0);

    // Empty is required-invalid: Start stays disabled until a name is typed.
    fireEvent.change(input, { target: { value: '' } });
    expect(startButton().disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'Analytical Engines Ltd.' } });
    expect(input.value).toBe('Analytical Engines Ltd.');
    expect(startButton().disabled).toBe(false);
  });
});

describe('CompanyStep field limits (ETP-4665 / ETP-5638)', () => {
  it('gives the company-name input headroom over the real AD_CLIENT.VALUE limit', () => {
    const { container } = renderCompanyStep({ businessType: 'company', clientName: 'Acme' });

    const input = container.querySelector('#clientName');
    expect(input.maxLength).toBe(CLIENT_NAME_INPUT_MAX_LENGTH);
    expect(input.maxLength).toBeGreaterThan(ONBOARDING_FIELD_LIMITS.clientName);
  });

  it('surfaces an over-long company name inline without truncating what was typed', () => {
    const tooLong = 'a'.repeat(ONBOARDING_FIELD_LIMITS.clientName + 1);
    const { container } = renderCompanyStep({ businessType: 'company', clientName: tooLong });

    expect(container.querySelector('#clientName').value).toBe(tooLong);
    expect(inlineError().textContent).toBe(
      `Must not exceed ${ONBOARDING_FIELD_LIMITS.clientName} characters`,
    );
    expect(startButton().disabled).toBe(true);
  });

  it('treats a space-padded company name as its trimmed length, matching the Start gate', () => {
    renderCompanyStep({
      businessType: 'company',
      clientName: `  ${'a'.repeat(ONBOARDING_FIELD_LIMITS.clientName)}  `,
    });

    expect(inlineError()).toBeNull();
    expect(startButton().disabled).toBe(false);
  });

  it('caps the tax id and structured address fields at their AD column limits', () => {
    // ETP-5806 — the structured fields only exist on the DOM when the flag is on.
    const { container } = renderCompanyStep(
      { businessType: 'company', clientName: 'Acme' },
      { structuredAddressForSepa: true },
    );

    expect(container.querySelector('#fiscalIdValue').maxLength).toBe(ONBOARDING_FIELD_LIMITS.fiscalId);
    expect(container.querySelector('#streetName').maxLength).toBe(ONBOARDING_FIELD_LIMITS.streetName);
    expect(container.querySelector('#buildingNumber').maxLength).toBe(ONBOARDING_FIELD_LIMITS.buildingNumber);
    expect(container.querySelector('#buildingName').maxLength).toBe(ONBOARDING_FIELD_LIMITS.buildingName);
    expect(container.querySelector('#city').maxLength).toBe(ONBOARDING_FIELD_LIMITS.city);
  });
});

describe('CompanyStep structured-address-for-sepa flag gating (ETP-5806)', () => {
  it.each([
    ['capabilities is undefined', undefined],
    ['capabilities.structuredAddressForSepa is false', { structuredAddressForSepa: false }],
    ['capabilities.structuredAddressForSepa is missing', {}],
  ])('renders the legacy single-line address field, not the structured block, when %s', (_label, capabilities) => {
    const { container } = renderCompanyStep({ businessType: 'company', clientName: 'Acme' }, capabilities);

    expect(container.querySelector('#address')).toBeTruthy();
    expect(container.querySelector('#streetName')).toBeNull();
    expect(container.querySelector('#buildingNumber')).toBeNull();
    expect(container.querySelector('#buildingName')).toBeNull();
    expect(container.querySelector('#city')).toBeNull();
  });

  it('renders the structured Street/Number/Building Name/City block, not the legacy address field, when the flag is on', () => {
    const { container } = renderCompanyStep(
      { businessType: 'company', clientName: 'Acme' },
      { structuredAddressForSepa: true },
    );

    expect(container.querySelector('#address')).toBeNull();
    expect(container.querySelector('#streetName')).toBeTruthy();
    expect(container.querySelector('#buildingNumber')).toBeTruthy();
    expect(container.querySelector('#buildingName')).toBeTruthy();
    expect(container.querySelector('#city')).toBeTruthy();
  });

  it('keeps Start disabled once the structured block is started until Street and City are filled, Number not required (ETP-5806 follow-up)', () => {
    const { container } = renderCompanyStep(
      { businessType: 'company', clientName: 'Acme' },
      { structuredAddressForSepa: true },
    );

    fireEvent.change(container.querySelector('#streetName'), { target: { value: 'Main St' } });

    // Street alone started the block; City is still missing.
    expect(startButton().disabled).toBe(true);

    fireEvent.change(container.querySelector('#city'), { target: { value: 'Madrid' } });

    // Street + City filled, Number left empty: Start is enabled anyway.
    expect(startButton().disabled).toBe(false);
    expect(container.querySelector('#buildingNumber').value).toBe('');
  });

  it('never marks Number as required or shows an inline error for it, unlike Street and City (ETP-5806 follow-up)', () => {
    const { container } = renderCompanyStep(
      { businessType: 'company', clientName: 'Acme' },
      { structuredAddressForSepa: true },
    );

    // Start the address block via Street, leaving Number and City blank.
    fireEvent.change(container.querySelector('#streetName'), { target: { value: 'Main St' } });

    const numberCell = container.querySelector('label[for="buildingNumber"]').closest('div');
    const cityCell = container.querySelector('label[for="city"]').closest('div');

    // Street and City show the required-field asterisk once the block is started; Number never does.
    expect(cityCell.textContent).toContain('*');
    expect(numberCell.textContent).not.toContain('*');

    // City is blank and the block is started, so its inline "required" error is showing;
    // Number carries no such error regardless of being blank too.
    expect(cityCell.querySelector('[data-testid="AddressCell-error__79cf84"]')?.textContent).toBe('fieldRequiredMessage');
    expect(numberCell.querySelector('[data-testid="AddressCell-error__79cf84"]')).toBeNull();
  });

  it('uses the "empty" placeholder key for Number instead of the pre-ETP-5806-follow-up key', () => {
    const { container } = renderCompanyStep(
      { businessType: 'company', clientName: 'Acme' },
      { structuredAddressForSepa: true },
    );

    // The i18n mock returns the key itself, so the rendered placeholder IS the key name.
    expect(container.querySelector('#buildingNumber').placeholder).toBe('buildingNumberEmptyPlaceholder');
  });

  describe('business sector', () => {
    it('is not asked of an account that chose it at sign-up', () => {
      const { container } = renderCompanyStep({ businessType: 'company', clientName: 'Acme' });

      expect(container.querySelector('#sector')).toBeNull();
      expect(startButton().disabled).toBe(false);
    });

    it('is required of an account that has none, from the register form list', () => {
      const { container, onChange } = renderCompanyStep(
        { businessType: 'company', clientName: 'Acme' }, undefined, true);
      const select = container.querySelector('#sector');

      expect([...select.options].map((option) => option.value))
        .toEqual(['', 'industria', 'distribución_logística', 'servicios', 'startups_tecnología', 'otro']);
      expect(startButton().disabled).toBe(true);

      fireEvent.change(select, { target: { value: 'servicios' } });

      expect(onChange).toHaveBeenCalledWith({ sector: 'servicios' });
      expect(startButton().disabled).toBe(false);
    });

    it('drops a draft value from the retired list', () => {
      const { container } = renderCompanyStep(
        { businessType: 'company', clientName: 'Acme', sector: 'technology' }, undefined, true);

      expect(container.querySelector('#sector').value).toBe('');
      expect(startButton().disabled).toBe(true);
    });
  });
});
