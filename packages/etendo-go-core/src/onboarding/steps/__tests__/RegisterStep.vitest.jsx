// @covers packages/etendo-go-core/src/onboarding/steps/RegisterStep.jsx
// @covers packages/etendo-go-core/src/onboarding/postAuth.js
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4664 — the register form validates the email format live (not only on
 * submit) and gates account creation on it, mirroring the password policy.
 * ETP-4665 — every input is capped at the size of the AD column it lands in,
 * and the password advertises no character counter (its hash is fixed-length).
 * ETP-6081 — the sign-up asks for no password; only an invitation (askPassword) does. The terms
 * dialog holds the consent to promotional mail, ticked by default and sent with the sign-up.
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

// ETP-5806 — kept enabled (not `[]`) so the capabilities-propagation suite below can drive the
// SSO branch of `handleAuthSuccess` the same way `LoginStep.vitest.jsx` does: capture the
// credential callback the component hands to the provider SDK and fire it manually. No
// pre-existing test in this file asserts the SSO button is absent.
let registerSsoHandlers = null;
vi.mock('../../sso.js', () => ({
  getConfiguredSsoProviders: () => ['google'],
  renderSsoProviderButton: vi.fn(async (provider, container, handlers) => {
    registerSsoHandlers = handlers;
  }),
}));

vi.mock('../../api.js', () => ({
  AUTH_ERROR_UI_KEYS: {},
  registerAccount: vi.fn(),
  loginWithSsoProvider: vi.fn(),
  fetchTermsAndConditions: vi.fn(),
  fetchTermsDocumentHtml: vi.fn(),
}));

const api = await import('../../api.js');

const { RegisterStep } = await import('../RegisterStep.jsx');
const { ONBOARDING_FIELD_LIMITS } = await import('../../fieldLimits.js');

const TERMS = { version: '2026-11', language: null, publishedAt: 1000 };
const TERMS_HTML = '<p>First clause.</p><p>Second clause.</p>';
const TERMS_TEXT = 'First clause.Second clause.';
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

/** Drives the SSO branch to a successful credential, mirroring LoginStep.vitest.jsx. */
async function completeRegisterSsoCredential() {
  await waitFor(() => expect(registerSsoHandlers).not.toBeNull());
  registerSsoHandlers.onCredential('google', { credential: 'google-jwt' });
}

beforeEach(() => {
  registerSsoHandlers = null;
  api.fetchTermsAndConditions.mockResolvedValue(TERMS);
  api.fetchTermsDocumentHtml.mockResolvedValue(TERMS_HTML);
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
    // ETP-6082: the business sector is required too.
    expect(submit.disabled).toBe(true);
    fireEvent.change(container.querySelector('#reg-sector'), { target: { value: 'servicios' } });
    // ETP-6363: and so is the country.
    expect(submit.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('country-select'), { target: { value: 'ES' } });
    expect(submit.disabled).toBe(false);
  });
});

describe('RegisterStep business sector (ETP-6082)', () => {
  it('offers the HubSpot sector values with translated labels, none chosen', () => {
    const { container } = renderRegisterStep();
    const select = container.querySelector('#reg-sector');

    expect(select.required).toBe(true);
    expect(select.value).toBe('');
    const values = Array.from(select.options).map((option) => option.value);
    expect(values).toEqual(['', 'industria', 'distribución_logística', 'servicios',
      'startups_tecnología', 'otro']);
  });

  it('sends the chosen sector with the account', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep();

    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);
    fireEvent.change(container.querySelector('#reg-sector'), {
      target: { value: 'startups_tecnología' },
    });
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalled());
    expect(api.registerAccount.mock.calls[0][2].sector).toBe('startups_tecnología');
  });

  it('is not asked of an invitee, who joins a company as it is', () => {
    const { container } = renderRegisterStep({ askPhone: false, askPassword: true });

    expect(container.querySelector('#reg-sector')).toBeNull();
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
    expect(content.textContent).toBe(TERMS_TEXT);
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

    expect((await screen.findByTestId('terms-dialog-content')).textContent).toBe(TERMS_TEXT);
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

  it('shows no dialling code until a country is chosen, then the country\'s', () => {
    renderRegisterStep();

    expect(screen.queryByTestId('reg-phone-leading')).toBeNull();
    fireEvent.change(screen.getByTestId('country-select'), { target: { value: 'AR' } });

    expect(screen.getByTestId('reg-phone-leading').textContent).toBe('+54');
  });

  it('registers without a phone and sends none', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    fillValidForm(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalled());
    expect(api.registerAccount.mock.calls[0][2]).not.toHaveProperty('phone');
  });

  it('sends the phone with the dialling code of the chosen country', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    fillValidForm(container);
    fireEvent.change(screen.getByTestId('country-select'), { target: { value: 'AR' } });
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

  it('does not ask for the phone nor the country when askPhone is off (a company invitation)', () => {
    const { container } = renderRegisterStep({ askPhone: false });

    expect(screen.queryByTestId('country-select')).toBeNull();
    expect(container.querySelector('#reg-phone')).toBeNull();
  });
});

describe('RegisterStep required country (ETP-6363)', () => {
  function fillValidForm(container) {
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);
    fireEvent.change(container.querySelector('#reg-sector'), { target: { value: 'servicios' } });
  }

  it('starts empty and keeps account creation disabled until a country is chosen', () => {
    const { container } = renderRegisterStep();
    fillValidForm(container);
    const select = screen.getByTestId('country-select');
    const submit = screen.getByTestId('action-register-submit');

    expect(select.value).toBe('');
    expect(select.required).toBe(true);
    expect(submit.disabled).toBe(true);

    fireEvent.change(select, { target: { value: 'AR' } });
    expect(submit.disabled).toBe(false);
  });

  it('lists every country by its full name, sorted by it, and shows only flag and code once chosen', () => {
    renderRegisterStep();
    const select = screen.getByTestId('country-select');
    const display = screen.getByTestId('country-select-display');
    const names = [...select.querySelectorAll('option:not([value=""])')]
      .map(option => option.textContent.replace(/^\S+ /, ''));

    expect(select.querySelector('option[value="ES"]').textContent).toContain('Spain');
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en-US')));
    expect(display.textContent).toBe('onboardingCountryPlaceholder');

    fireEvent.change(select, { target: { value: 'ES' } });
    expect(display.textContent).toMatch(/ ES$/);
    expect(display.textContent).not.toContain('Spain');
  });

  it('sends the chosen country with the registration, even without a phone', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    fillValidForm(container);
    fireEvent.change(screen.getByTestId('country-select'), { target: { value: 'MX' } });

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalled());
    expect(api.registerAccount.mock.calls[0][2]).toMatchObject({ countryCode: 'MX' });
    expect(api.registerAccount.mock.calls[0][2]).not.toHaveProperty('phone');
  });

  it('sends no country to a host register handler (a company invitation)', async () => {
    const registerHandler = vi.fn().mockResolvedValue({ token: 'bearer', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ askPhone: false, registerHandler, onRegistered: vi.fn() });
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(registerHandler).toHaveBeenCalled());
    expect(registerHandler.mock.calls[0][0]).not.toHaveProperty('countryCode');
  });
});

describe('RegisterStep consent to promotional mail (ETP-6081)', () => {
  function fillValidForm(container) {
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);
  }

  async function openTerms() {
    fireEvent.click(screen.getByTestId('register-terms-link'));
    await screen.findByTestId('terms-dialog');
  }

  it('shows the consent inside the terms dialog, ticked by default', async () => {
    renderRegisterStep();
    await openTerms();

    const checkbox = screen.getByTestId('terms-marketing-consent');
    expect(checkbox.checked).toBe(true);
    expect(screen.getByTestId('terms-marketing-consent-label').textContent)
      .toContain('onboardingMarketingConsent');
  });

  it('sends the consent with a registration that never opened the terms', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    fillValidForm(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalledWith(
      expect.any(Function), '', expect.objectContaining({ marketingConsent: true }),
    ));
  });

  it('keeps an untick after the dialog closes and sends it', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({ handleRegisterSuccess: vi.fn() });
    fillValidForm(container);
    await openTerms();
    fireEvent.click(screen.getByTestId('terms-marketing-consent'));
    fireEvent.click(screen.getByTestId('terms-dialog-close'));
    await waitFor(() => expect(screen.queryByTestId('terms-dialog')).toBeNull());

    await openTerms();
    expect(screen.getByTestId('terms-marketing-consent').checked).toBe(false);
    fireEvent.click(screen.getByTestId('terms-dialog-close'));
    await waitFor(() => expect(screen.queryByTestId('terms-dialog')).toBeNull());
    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(api.registerAccount).toHaveBeenCalledWith(
      expect.any(Function), '', expect.objectContaining({ marketingConsent: false }),
    ));
  });

  it('toggles once per click on the label text', async () => {
    renderRegisterStep();
    await openTerms();

    fireEvent.click(screen.getByText('onboardingMarketingConsent'));

    expect(screen.getByTestId('terms-marketing-consent').checked).toBe(false);
  });

  it('neither asks nor sends the consent for a company invitation', async () => {
    const registerHandler = vi.fn().mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const { container } = renderRegisterStep({
      askPhone: false, registerHandler, handleRegisterSuccess: vi.fn(),
    });
    await openTerms();
    expect(screen.queryByTestId('terms-marketing-consent')).toBeNull();
    fireEvent.click(screen.getByTestId('terms-dialog-close'));
    await waitFor(() => expect(screen.queryByTestId('terms-dialog')).toBeNull());
    fillValidForm(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(registerHandler).toHaveBeenCalled());
    expect(registerHandler.mock.calls[0][0]).not.toHaveProperty('marketingConsent');
  });
});

describe('RegisterStep without a password (ETP-6081)', () => {
  function fillNameAndEmail(container) {
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);
    // ETP-6082 / ETP-6363: the business sector and the country are required too.
    fireEvent.change(container.querySelector('#reg-sector'), { target: { value: 'servicios' } });
    fireEvent.change(screen.getByTestId('country-select'), { target: { value: 'ES' } });
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

// ---------------------------------------------------------------------------
// ETP-5806 — `setCapabilities` refresh after a successful register/SSO sign-up.
// Previously `capabilities` was only ever populated by OnboardingFlow's mount-time
// session fetch (which 401s for a brand-new visitor), so a visitor who just
// registered kept seeing the pre-session `{}` default for the rest of onboarding
// (e.g. CompanyStep's structured-address decision). Now both `handleAuthSuccess`
// call sites (password register, SSO sign-up) pass the backend's `capabilities`
// through, and `handleAuthSuccess` forwards it to `setCapabilities`, defaulting to
// `{}` when the response omits it.
// ---------------------------------------------------------------------------
describe('RegisterStep capabilities propagation (ETP-5806)', () => {
  function fillValidForm(container) {
    fireEvent.change(container.querySelector('#reg-name'), { target: { value: 'Ada' } });
    typeEmail(container, VALID_EMAIL);
    fireEvent.change(container.querySelector('#reg-sector'), { target: { value: 'servicios' } });
  }

  it('forwards the capabilities the backend returned after a password registration', async () => {
    api.registerAccount.mockResolvedValue({
      csrfToken: 'csrf',
      account: { name: 'Ada' },
      capabilities: { structuredAddressForSepa: true },
    });
    const setCapabilities = vi.fn();
    const { container } = renderRegisterStep({ setCapabilities, handleRegisterSuccess: vi.fn() });
    fillValidForm(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith({ structuredAddressForSepa: true }));
  });

  it('forwards the capabilities the backend returned after an SSO sign-up', async () => {
    api.loginWithSsoProvider.mockResolvedValue({
      csrfToken: 'csrf',
      account: { name: 'Ada' },
      capabilities: { structuredAddressForSepa: true },
    });
    const setCapabilities = vi.fn();
    renderRegisterStep({ setCapabilities });

    await completeRegisterSsoCredential();

    await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith({ structuredAddressForSepa: true }));
  });

  it('defaults to an empty object when the register response omits capabilities', async () => {
    api.registerAccount.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const setCapabilities = vi.fn();
    const { container } = renderRegisterStep({ setCapabilities, handleRegisterSuccess: vi.fn() });
    fillValidForm(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith({}));
  });

  it('defaults to an empty object when the SSO response omits capabilities', async () => {
    api.loginWithSsoProvider.mockResolvedValue({ csrfToken: 'csrf', account: { name: 'Ada' } });
    const setCapabilities = vi.fn();
    renderRegisterStep({ setCapabilities });

    await completeRegisterSsoCredential();

    await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith({}));
  });

  // An explicit `{}` is distinct from an omitted field (`undefined`): both must
  // reach `setCapabilities` as `{}`, but only the omitted case exercises the
  // `??` operator's short-circuit — this one proves the non-nullish branch is
  // passed through rather than being overwritten.
  it('passes an explicit empty capabilities object through unchanged after a password registration', async () => {
    api.registerAccount.mockResolvedValue({
      csrfToken: 'csrf',
      account: { name: 'Ada' },
      capabilities: {},
    });
    const setCapabilities = vi.fn();
    const { container } = renderRegisterStep({ setCapabilities, handleRegisterSuccess: vi.fn() });
    fillValidForm(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith({}));
  });

  it('passes an explicit empty capabilities object through unchanged after an SSO sign-up', async () => {
    api.loginWithSsoProvider.mockResolvedValue({
      csrfToken: 'csrf',
      account: { name: 'Ada' },
      capabilities: {},
    });
    const setCapabilities = vi.fn();
    renderRegisterStep({ setCapabilities });

    await completeRegisterSsoCredential();

    await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith({}));
  });

  // `null` is nullish (unlike `{}`), so the `??` operator must catch it exactly
  // like `undefined` does and default to `{}` — this is the other half of the
  // `capabilities ?? {}` contract the omitted-field tests above don't exercise.
  it('defaults an explicit null capabilities to an empty object after a password registration', async () => {
    api.registerAccount.mockResolvedValue({
      csrfToken: 'csrf',
      account: { name: 'Ada' },
      capabilities: null,
    });
    const setCapabilities = vi.fn();
    const { container } = renderRegisterStep({ setCapabilities, handleRegisterSuccess: vi.fn() });
    fillValidForm(container);

    fireEvent.submit(container.querySelector('form'));

    await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith({}));
  });

  it('defaults an explicit null capabilities to an empty object after an SSO sign-up', async () => {
    api.loginWithSsoProvider.mockResolvedValue({
      csrfToken: 'csrf',
      account: { name: 'Ada' },
      capabilities: null,
    });
    const setCapabilities = vi.fn();
    renderRegisterStep({ setCapabilities });

    await completeRegisterSsoCredential();

    await waitFor(() => expect(setCapabilities).toHaveBeenCalledWith({}));
  });
});
