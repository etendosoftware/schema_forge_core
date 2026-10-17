// @covers packages/etendo-go-core/src/onboarding/steps/RegisterStep.jsx
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4664 — the register form validates the email format live (not only on
 * submit) and gates account creation on it, mirroring the password policy.
 * ETP-4665 — every input is capped at the size of the AD column it lands in,
 * and the password advertises no character counter (its hash is fixed-length).
 *
 * Rendered against the real component; the mocks only replace the i18n catalog
 * and the network the step would otherwise reach for.
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
  // No setLocale → the component skips the language selector entirely.
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

vi.mock('../../sso.js', () => ({
  getConfiguredSsoProviders: () => [],
  renderSsoProviderButton: vi.fn(),
}));

vi.mock('../../api.js', () => ({
  AUTH_ERROR_UI_KEYS: {},
  registerAccount: vi.fn(),
  loginWithSsoProvider: vi.fn(),
}));

const { RegisterStep } = await import('../RegisterStep.jsx');
const { ONBOARDING_FIELD_LIMITS } = await import('../../fieldLimits.js');

const STRONG_PASSWORD = 'Str0ng!Pass';
const VALID_EMAIL = 'ada@example.com';
const INVALID_EMAIL = 'ada.example.com';

function renderRegisterStep(props = {}) {
  return render(
    <RegisterStep config={{ apiBase: '', brandLabel: 'Etendo' }} stepData={{}} {...props} />,
  );
}

function typeEmail(container, value) {
  fireEvent.change(container.querySelector('#reg-email'), { target: { value } });
}

function typePassword(container, value) {
  fireEvent.change(container.querySelector('#reg-password'), { target: { value } });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('RegisterStep email format validation (ETP-4664)', () => {
  it('shows no validity indicator until the user types', () => {
    renderRegisterStep();
    expect(screen.queryByTestId('RegisterEmailValid__79cf84')).toBeNull();
    expect(screen.queryByTestId('RegisterEmailInvalid__79cf84')).toBeNull();
  });

  it('flags an invalid email and clears the flag once it becomes valid, as the user types', () => {
    const { container } = renderRegisterStep();

    typeEmail(container, INVALID_EMAIL);
    expect(screen.getByTestId('RegisterEmailInvalid__79cf84')).toBeTruthy();
    expect(screen.queryByTestId('RegisterEmailValid__79cf84')).toBeNull();

    // A later keystroke alone flips the indicator: no blur, no submit, no debounce.
    typeEmail(container, VALID_EMAIL);
    expect(screen.getByTestId('RegisterEmailValid__79cf84')).toBeTruthy();
    expect(screen.queryByTestId('RegisterEmailInvalid__79cf84')).toBeNull();
  });

  it('never blocks typing on an invalid email', () => {
    const { container } = renderRegisterStep();
    const emailInput = container.querySelector('#reg-email');

    typeEmail(container, INVALID_EMAIL);

    expect(emailInput.disabled).toBe(false);
    expect(emailInput.value).toBe(INVALID_EMAIL);
  });

  it('keeps account creation disabled while the email format is invalid', () => {
    const { container } = renderRegisterStep();
    const submit = screen.getByTestId('action-register-submit');

    typePassword(container, STRONG_PASSWORD);
    typeEmail(container, INVALID_EMAIL);
    expect(submit.disabled).toBe(true);

    typeEmail(container, VALID_EMAIL);
    expect(submit.disabled).toBe(false);
  });
});

describe('RegisterStep field limits (ETP-4665)', () => {
  it('caps the name, email and password at their AD column limits', () => {
    const { container } = renderRegisterStep();

    expect(container.querySelector('#reg-name').maxLength).toBe(ONBOARDING_FIELD_LIMITS.accountName);
    expect(container.querySelector('#reg-email').maxLength).toBe(ONBOARDING_FIELD_LIMITS.email);
    expect(container.querySelector('#reg-password').maxLength).toBe(ONBOARDING_FIELD_LIMITS.password);
  });

  it('shows no character counter on the password', () => {
    const { container } = renderRegisterStep();
    typePassword(container, 'abc');

    // The only trailing control is the show/hide toggle (an icon button); a
    // counter would put digits next to the input.
    const passwordField = container.querySelector('#reg-password').parentElement;
    expect(passwordField.textContent).not.toMatch(/\d/);
  });
});
