// @covers packages/etendo-go-core/src/onboarding/steps/ProfileStep.jsx
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4665 — the profile step caps the full name at the size of the AD column it
 * lands in (AD_USER.NAME) and, for a freelancer, at the tighter client-name limit
 * because that same value becomes the invoicing name. Over-limit values surface as
 * an inline error and keep Continue disabled; the input keeps the looser cap so a
 * company user is never truncated.
 *
 * Rendered against the real component; only the i18n catalog is replaced (with
 * real `{max}` interpolation) and the callback props are spies.
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

const { ProfileStep } = await import('../ProfileStep.jsx');
const { ONBOARDING_FIELD_LIMITS } = await import('../../fieldLimits.js');

const CONFIG = {
  apiBase: '',
  brandLabel: 'Etendo',
  defaultForm: { countryCode: 'ES' },
};

function renderProfileStep(stepData = {}) {
  return render(
    <ProfileStep
      config={CONFIG}
      stepData={{ countryCode: 'ES', ...stepData }}
      onNext={vi.fn()}
      onBack={vi.fn()} />,
  );
}

function continueButton() {
  return screen.getByTestId('Button__79cf84');
}

function inlineError() {
  return screen.queryByTestId('SetupField-error__79cf84');
}

afterEach(cleanup);

describe('ProfileStep full-name limits (ETP-4665)', () => {
  it('caps the input at the AD_USER.NAME limit', () => {
    const { container } = renderProfileStep({ fullName: 'Ada Lovelace' });

    expect(container.querySelector('#fullName').maxLength).toBe(ONBOARDING_FIELD_LIMITS.fullName);
  });

  it('flags a freelancer full name past the client-name limit and keeps Continue disabled', () => {
    renderProfileStep({
      businessType: 'freelancer',
      fullName: 'a'.repeat(ONBOARDING_FIELD_LIMITS.clientName + 1),
    });

    expect(inlineError().textContent).toBe(
      `Must not exceed ${ONBOARDING_FIELD_LIMITS.clientName} characters`,
    );
    expect(continueButton().disabled).toBe(true);
  });

  it('accepts a freelancer full name exactly at the client-name limit', () => {
    renderProfileStep({
      businessType: 'freelancer',
      fullName: 'a'.repeat(ONBOARDING_FIELD_LIMITS.clientName),
    });

    expect(inlineError()).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });

  it('treats a space-padded name as its trimmed length, matching the Continue gate', () => {
    // The validators trim; an implementation that measured the raw value would
    // flag this 44-char string even though its trimmed length is exactly 40.
    renderProfileStep({
      businessType: 'freelancer',
      fullName: `  ${'a'.repeat(ONBOARDING_FIELD_LIMITS.clientName)}  `,
    });

    expect(inlineError()).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });

  it('applies the looser profile limit to company and advisory names, and re-derives it on switch', () => {
    renderProfileStep({ businessType: 'company', fullName: 'a'.repeat(41) });
    expect(inlineError()).toBeNull();
    expect(continueButton().disabled).toBe(false);

    // Same 41-char value, stricter freelancer limit: the error must appear.
    fireEvent.click(screen.getByText('onboardingBusinessTypeFreelancer'));
    expect(inlineError().textContent).toBe(
      `Must not exceed ${ONBOARDING_FIELD_LIMITS.clientName} characters`,
    );
    expect(continueButton().disabled).toBe(true);

    fireEvent.click(screen.getByText('onboardingBusinessTypeCompany'));
    expect(inlineError()).toBeNull();
    expect(continueButton().disabled).toBe(false);
  });

  it('flags a company full name past AD_USER.NAME and keeps Continue disabled', () => {
    renderProfileStep({ fullName: 'a'.repeat(ONBOARDING_FIELD_LIMITS.fullName + 1) });

    expect(inlineError().textContent).toBe(
      `Must not exceed ${ONBOARDING_FIELD_LIMITS.fullName} characters`,
    );
    expect(continueButton().disabled).toBe(true);
  });

  it('still gates Continue on the required country and a non-blank name', () => {
    render(<ProfileStep config={{ ...CONFIG, defaultForm: {} }} stepData={{ fullName: 'Ada' }} />);
    expect(continueButton().disabled).toBe(true);
  });
});
