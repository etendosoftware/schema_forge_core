// @covers packages/etendo-go-core/src/onboarding/steps/RegisterStep.jsx
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4664 — the register form validates the email format live (not only on
 * submit) and gates account creation on it, mirroring the password policy.
 * ETP-4665 — every input is capped at the size of the AD column it lands in,
 * and the password advertises no character counter (its hash is fixed-length).
 * ETP-6081 — the sign-up asks for no password; only an invitation (askPassword) does.
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
  fetchTermsAndConditions: vi.fn(),
}));

const api = await import('../../api.js');

const { RegisterStep } = await import('../RegisterStep.jsx');
const { ONBOARDING_FIELD_LIMITS } = await import('../../fieldLimits.js');

const TERMS = { version: '2026-11', language: 'en_US', content: 'First clause.\nSecond clause.' };
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

beforeEach(() => {
  api.fetchTermsAndConditions.mockResolvedValue(TERMS);
});

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

    typeEmail(container, INVALID_EMAIL);
    expect(submit.disabled).toBe(true);

    typeEmail(container, VALID_EMAIL);
    expect(submit.disabled).toBe(false);
  });
});

describe('RegisterStep field limits (ETP-4665)', () => {
  it('caps the name, email and password at their AD column limits', () => {
    const { container } = renderRegisterStep({ askPassword: true });

    expect(container.querySelector('#reg-name').maxLength).toBe(ONBOARDING_FIELD_LIMITS.accountName);
    expect(container.querySelector('#reg-email').maxLength).toBe(ONBOARDING_FIELD_LIMITS.email);
    expect(container.querySelector('#reg-password').maxLength).toBe(ONBOARDING_FIELD_LIMITS.password);
  });

  it('shows no character counter on the password', () => {
    const { container } = renderRegisterStep({ askPassword: true });
    typePassword(container, 'abc');

    // The only trailing control is the show/hide toggle (an icon button); a
    // counter would put digits next to the input.
    const passwordField = container.querySelector('#reg-password').parentElement;
    expect(passwordField.textContent).not.toMatch(/\d/);
  });
});

describe('RegisterStep trial offer and terms and conditions (ETP-6081)', () => {
  it('shows the trial offer above the email registration', () => {
    renderRegisterStep();
    expect(screen.getByTestId('register-trial-banner').textContent).toContain('onboardingTrialOfferBanner');
  });

  it('loads the terms in force in the UI language', async () => {
    renderRegisterStep();
    await waitFor(() => expect(api.fetchTermsAndConditions).toHaveBeenCalledWith(expect.any(Function), '', 'en_US'));
  });

  it('opens the terms over the form without losing what was typed', async () => {
    const { container } = renderRegisterStep();
    typeEmail(container, VALID_EMAIL);

    fireEvent.click(screen.getByTestId('register-terms-link'));

    const content = await screen.findByTestId('terms-dialog-content');
    expect(content.textContent).toBe(TERMS.content);
    expect(container.querySelector('#reg-email').value).toBe(VALID_EMAIL);
  });

  it('closes the terms with its button', async () => {
    renderRegisterStep();
    fireEvent.click(screen.getByTestId('register-terms-link'));
    await screen.findByTestId('terms-dialog-content');

    fireEvent.click(screen.getByTestId('terms-dialog-close'));

    await waitFor(() => expect(screen.queryByTestId('terms-dialog')).toBeNull());
  });

  it('closes the terms with Escape', async () => {
    renderRegisterStep();
    fireEvent.click(screen.getByTestId('register-terms-link'));
    const dialog = await screen.findByTestId('terms-dialog');

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByTestId('terms-dialog')).toBeNull());
  });

  it('offers a retry when the terms cannot be loaded', async () => {
    api.fetchTermsAndConditions.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(TERMS);
    renderRegisterStep();
    fireEvent.click(screen.getByTestId('register-terms-link'));

    fireEvent.click(await screen.findByTestId('terms-dialog-retry'));

    expect((await screen.findByTestId('terms-dialog-content')).textContent).toBe(TERMS.content);
  });

  it('sends the terms version it showed with the registration', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    await waitFor(() => expect(api.fetchTermsAndConditions).toHaveBeenCalled());
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);
    // The version only travels once the terms arrived: wait until the popup can show them.
    fireEvent.click(screen.getByTestId('register-terms-link'));
    await screen.findByTestId('terms-dialog-content');
    fireEvent.click(screen.getByTestId('terms-dialog-close'));
    await waitFor(() => expect(screen.queryByTestId('terms-dialog')).toBeNull());

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalledWith(
      expect.any(Function), '', expect.objectContaining({ email: VALID_EMAIL, termsVersion: TERMS.version }),
    ));
  });

  it('sends no terms version when the terms could not be loaded', async () => {
    api.fetchTermsAndConditions.mockRejectedValue(new Error('down'));
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    await waitFor(() => expect(api.fetchTermsAndConditions).toHaveBeenCalled());
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalled());
    expect(api.registerAccount.mock.calls[0][2]).not.toHaveProperty('termsVersion');
  });
});

describe('RegisterStep optional phone (ETP-6081)', () => {
  function fillValidForm(container) {
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);
  }

  it('preselects the Spanish prefix and shows each option as code and dialling code', () => {
    renderRegisterStep();
    const select = screen.getByTestId('phone-prefix-select');

    expect(select.value).toBe('ES');
    expect(select.querySelector('option[value="ES"]').textContent).toContain('ES +34');
  });

  it('registers without a phone and sends none', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    fillValidForm(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalled());
    expect(api.registerAccount.mock.calls[0][2]).not.toHaveProperty('phone');
  });

  it('sends the phone with the prefix of the chosen country', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    fillValidForm(container);
    fireEvent.change(screen.getByTestId('phone-prefix-select'), { target: { value: 'AR' } });
    fireEvent.change(container.querySelector('#reg-phone'), { target: { value: '11 4567 8901' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalledWith(
      expect.any(Function), '', expect.objectContaining({ phone: '+54 11 4567 8901' }),
    ));
  });

  it('flags a number that is not a phone and keeps account creation disabled', () => {
    const { container } = renderRegisterStep();
    fillValidForm(container);
    fireEvent.change(container.querySelector('#reg-phone'), { target: { value: 'call me' } });

    expect(screen.getByTestId('reg-phone-error').textContent).toBe('onboardingPhoneInvalid');
    expect(screen.getByTestId('action-register-submit').disabled).toBe(true);
  });

  it('does not ask for the phone when askPhone is off (a company invitation)', () => {
    const { container } = renderRegisterStep({ askPhone: false });

    expect(screen.queryByTestId('phone-prefix-select')).toBeNull();
    expect(container.querySelector('#reg-phone')).toBeNull();
  });
});

describe('RegisterStep without a password (ETP-6081)', () => {
  function fillNameAndEmail(container) {
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);
  }

  it('asks for no password and lets the account be created with name and email alone', () => {
    const { container } = renderRegisterStep();
    fillNameAndEmail(container);

    expect(container.querySelector('#reg-password')).toBeNull();
    expect(screen.queryByTestId('register-password-requirements')).toBeNull();
    expect(screen.getByTestId('action-register-submit').disabled).toBe(false);
  });

  it('sends no password with the registration', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    fillNameAndEmail(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalled());
    expect(api.registerAccount.mock.calls[0][2]).not.toHaveProperty('password');
  });

  it('still asks for a strong password when askPassword is on (a company invitation)', async () => {
    const registerHandler = vi.fn().mockResolvedValue({ token: 'bearer', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ askPassword: true, registerHandler, onRegistered: vi.fn() });
    fillNameAndEmail(container);
    const submit = screen.getByTestId('action-register-submit');

    expect(submit.disabled).toBe(true);
    typePassword(container, STRONG_PASSWORD);
    expect(submit.disabled).toBe(false);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(registerHandler).toHaveBeenCalledWith(
      expect.objectContaining({ email: VALID_EMAIL, password: STRONG_PASSWORD }),
    ));
  });
});
