// @covers packages/etendo-go-core/src/onboarding/steps/LoginStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/RegisterStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/SetupProgressStep.jsx
// @covers packages/etendo-go-core/src/onboarding/api.js
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4664 / ETP-4665 / ETP-5258 — how the login, register and reset screens turn a failed
 * backend call into user-visible text.
 *
 * The contract these screens must hold: the sentence the user reads is the one the UI locale
 * translates for the backend's stable SCREAMING_SNAKE `error.code`, and never the backend's raw
 * English `userMessage`/`message`, an unresolved `@AdMessageKey@`, or the literal "undefined"
 * (a length violation whose `max` is missing).
 *
 * The real steps are rendered and the real `api.js` tables (`AUTH_ERROR_UI_KEYS`,
 * `resolveAuthErrorMessage`) are used; only the network entry points the steps call are replaced,
 * so a step dropping the table lookup is what these tests observe.
 */

// The i18n catalog only needs the sentences these paths are expected to show. Every other key
// falls back to itself, which is what makes "the raw English text was rendered" observable.
const CATALOG = {
  onboardingWeakPassword: 'La contraseña es demasiado débil.',
  onboardingInvalidCredentials: 'El correo o la contraseña no son correctos.',
  onboardingConnectionError: 'No pudimos conectar con el servidor.',
  onboardingFieldTooLong: 'Este campo no debe superar {max} caracteres.',
  onboardingCredentialResetFailed: 'El enlace no es válido o ya se usó.',
  onboardingCreateClientFailed: 'No pudimos crear tu entorno.',
  onboardingGenericError: 'Algo salió mal durante la puesta en marcha.',
};

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key, params = {}) => {
    let text = CATALOG[key] ?? key;
    Object.entries(params).forEach(([name, value]) => {
      text = text.replace(`{${name}}`, value);
    });
    return text;
  },
  // No setLocale → the steps skip the language selector entirely.
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

vi.mock('../../sso.js', () => ({
  getConfiguredSsoProviders: () => [],
  renderSsoProviderButton: vi.fn(),
}));

// Keep the real AUTH_ERROR_UI_KEYS / resolveAuthErrorMessage and replace only the network calls.
vi.mock('../../api.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    registerAccount: vi.fn(),
    loginAccount: vi.fn(),
    loginWithSsoProvider: vi.fn(),
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
    fetchAccount: vi.fn(),
    fetchEnvironments: vi.fn(),
    runOnboardingStream: vi.fn(),
  };
});

const { LoginStep } = await import('../LoginStep.jsx');
const { RegisterStep } = await import('../RegisterStep.jsx');
const { SetupProgressStep } = await import('../SetupProgressStep.jsx');
const api = await import('../../api.js');

const STRONG_PASSWORD = 'Str0ng!Pass';
const VALID_EMAIL = 'ada@example.com';

/** A backend failure shaped exactly as `buildApiError` shapes one. */
function backendError({ code, userMessage, field, max } = {}) {
  const err = new Error(userMessage || code);
  if (code !== undefined) err.code = code;
  if (userMessage !== undefined) err.userMessage = userMessage;
  if (field !== undefined) err.field = field;
  if (max !== undefined) err.max = max;
  return err;
}

function renderLoginStep(props = {}) {
  return render(
    <LoginStep config={{ apiBase: '', brandLabel: 'Etendo' }} stepData={{}} {...props} />,
  );
}

function renderRegisterStep(props = {}) {
  return render(
    <RegisterStep config={{ apiBase: '', brandLabel: 'Etendo' }} stepData={{}} {...props} />,
  );
}

function submit(container, testId) {
  fireEvent.submit(screen.getByTestId(testId).closest('form'));
}

function typeInto(container, selector, value) {
  fireEvent.change(container.querySelector(selector), { target: { value } });
}

/**
 * The whole guarantee: the localized sentence is shown, and none of the things that must never
 * reach a user do.
 */
function expectLocalizedInsteadOfRaw(container, expectedSentence, rawEnglish) {
  expect(screen.getByText(expectedSentence)).toBeTruthy();
  if (rawEnglish) expect(container.textContent).not.toContain(rawEnglish);
  expect(container.textContent).not.toMatch(/@[A-Za-z0-9_]+@/);
  expect(container.textContent).not.toContain('undefined');
}

async function driveLoginFailure(container, err) {
  api.loginAccount.mockRejectedValueOnce(err);
  typeInto(container, '#login-email', VALID_EMAIL);
  typeInto(container, '#login-password', STRONG_PASSWORD);
  submit(container, 'action-login-submit');
  await waitFor(() => expect(api.loginAccount).toHaveBeenCalledTimes(1));
}

async function driveRegisterFailure(container, err) {
  api.registerAccount.mockRejectedValueOnce(err);
  typeInto(container, '#reg-name', 'Ada Lovelace');
  typeInto(container, '#reg-email', VALID_EMAIL);
  typeInto(container, '#reg-password', STRONG_PASSWORD);
  submit(container, 'action-register-submit');
  await waitFor(() => expect(api.registerAccount).toHaveBeenCalledTimes(1));
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  globalThis.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the login screen resolves the failure by code (ETP-4664)', () => {
  it('shows the localized sentence for the backend code, not its English userMessage', async () => {
    const { container } = renderLoginStep();

    await driveLoginFailure(container, backendError({
      code: 'INVALID_CREDENTIALS',
      userMessage: 'Invalid credentials. Please check your email and password.',
    }));

    await waitFor(() => expect(
      screen.getByText(CATALOG.onboardingInvalidCredentials),
    ).toBeTruthy());
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingInvalidCredentials,
      'Invalid credentials. Please check your email and password.',
    );
  });

  it('falls back to the generic connection sentence for a code the table does not know', async () => {
    const { container } = renderLoginStep();

    await driveLoginFailure(container, backendError({
      code: 'SOMETHING_NEW',
      userMessage: 'Backend exploded in English',
    }));

    await waitFor(() => expect(screen.getByText(CATALOG.onboardingConnectionError)).toBeTruthy());
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingConnectionError,
      'Backend exploded in English',
    );
  });
});

describe('the register screen resolves the failure by code (ETP-4664 / ETP-4665)', () => {
  it('shows the localized sentence for the backend code, not its English userMessage', async () => {
    const { container } = renderRegisterStep();

    await driveRegisterFailure(container, backendError({
      code: 'WEAK_PASSWORD',
      userMessage: 'Password does not meet the policy',
    }));

    await waitFor(() => expect(screen.getByText(CATALOG.onboardingWeakPassword)).toBeTruthy());
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingWeakPassword,
      'Password does not meet the policy',
    );
  });

  it('falls back to the generic connection sentence for a code the table does not know', async () => {
    const { container } = renderRegisterStep();

    await driveRegisterFailure(container, backendError({
      code: 'BRAND_NEW_FAILURE',
      userMessage: 'Register endpoint said no',
    }));

    await waitFor(() => expect(screen.getByText(CATALOG.onboardingConnectionError)).toBeTruthy());
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingConnectionError,
      'Register endpoint said no',
    );
  });

  it('localizes a length violation with the limit the backend reported', async () => {
    const { container } = renderRegisterStep();

    await driveRegisterFailure(container, backendError({
      code: 'FIELD_TOO_LONG',
      field: 'clientName',
      max: 40,
      userMessage: 'Field clientName must not exceed 40 characters',
    }));

    const expected = CATALOG.onboardingFieldTooLong.replace('{max}', '40');
    await waitFor(() => expect(screen.getByText(expected)).toBeTruthy());
    expect(container.textContent).toContain('40');
    expectLocalizedInsteadOfRaw(
      container,
      expected,
      'Field clientName must not exceed 40 characters',
    );
  });

  it('never renders "undefined" when the length violation arrives without its limit', async () => {
    const { container } = renderRegisterStep();

    await driveRegisterFailure(container, backendError({
      code: 'FIELD_TOO_LONG',
      field: 'email',
      userMessage: 'Field email must not exceed the limit',
    }));

    await waitFor(() => expect(screen.getByText(CATALOG.onboardingConnectionError)).toBeTruthy());
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingConnectionError,
      'Field email must not exceed the limit',
    );
  });
});

describe('the forgot-password view resolves through resolveAuthErrorMessage (ETP-5258)', () => {
  async function openForgotView(container, err) {
    api.requestPasswordReset.mockRejectedValueOnce(err);
    fireEvent.click(screen.getByText('onboardingForgotPasswordAction'));
    typeInto(container, '#forgot-email', VALID_EMAIL);
    submit(container, 'action-forgot-password-submit');
    await waitFor(() => expect(api.requestPasswordReset).toHaveBeenCalledTimes(1));
  }

  it('shows the reset-link sentence for PASSWORD_RESET_INVALID, not the backend English text', async () => {
    const { container } = renderLoginStep();

    await openForgotView(container, backendError({
      code: 'PASSWORD_RESET_INVALID',
      userMessage: 'Invalid or expired password reset token',
    }));

    await waitFor(() => expect(
      screen.getByText(CATALOG.onboardingCredentialResetFailed),
    ).toBeTruthy());
    // The fallback for this view is the reset-link sentence, not the generic connection one.
    expect(container.textContent).not.toContain(CATALOG.onboardingConnectionError);
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingCredentialResetFailed,
      'Invalid or expired password reset token',
    );
  });

  it('still consults the shared code table for a code it does know', async () => {
    const { container } = renderLoginStep();

    await openForgotView(container, backendError({
      code: 'WEAK_PASSWORD',
      userMessage: 'Password does not meet the policy',
    }));

    await waitFor(() => expect(screen.getByText(CATALOG.onboardingWeakPassword)).toBeTruthy());
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingWeakPassword,
      'Password does not meet the policy',
    );
  });
});

describe('the reset-password view resolves through resolveAuthErrorMessage (ETP-5258)', () => {
  async function driveResetSubmit(err) {
    window.history.replaceState({}, '', '/?resetToken=rtok-123');
    const utils = renderLoginStep();
    const { container } = utils;
    api.confirmPasswordReset.mockRejectedValueOnce(err);
    typeInto(container, '#reset-password', STRONG_PASSWORD);
    typeInto(container, '#reset-password-confirm', STRONG_PASSWORD);
    submit(container, 'action-reset-password-submit');
    await waitFor(() => expect(api.confirmPasswordReset).toHaveBeenCalledTimes(1));
    return utils;
  }

  it('shows the reset-link sentence for PASSWORD_RESET_INVALID, not the backend English text', async () => {
    const { container } = await driveResetSubmit(backendError({
      code: 'PASSWORD_RESET_INVALID',
      userMessage: 'Invalid or expired password reset token',
    }));

    await waitFor(() => expect(
      screen.getByText(CATALOG.onboardingCredentialResetFailed),
    ).toBeTruthy());
    expect(container.textContent).not.toContain(CATALOG.onboardingConnectionError);
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingCredentialResetFailed,
      'Invalid or expired password reset token',
    );
  });

  it('still consults the shared code table for a code it does know', async () => {
    const { container } = await driveResetSubmit(backendError({
      code: 'WEAK_PASSWORD',
      userMessage: 'Password does not meet the policy',
    }));

    await waitFor(() => expect(screen.getByText(CATALOG.onboardingWeakPassword)).toBeTruthy());
    expectLocalizedInsteadOfRaw(
      container,
      CATALOG.onboardingWeakPassword,
      'Password does not meet the policy',
    );
  });
});

describe('every new-password screen shares the strength checklist (ETP-5258)', () => {
  it('shows the register checklist as the user types, and gates the register submit on it', () => {
    const { container } = renderRegisterStep();
    const submitButton = screen.getByTestId('action-register-submit');

    // Nothing typed yet: the checklist is not even present.
    expect(screen.queryByTestId('register-password-requirements')).toBeNull();

    typeInto(container, '#reg-email', VALID_EMAIL);
    typeInto(container, '#reg-password', 'abc');
    expect(screen.getByTestId('register-password-requirements')).toBeTruthy();
    expect(screen.getByTestId('register-password-rule-minLength').dataset.met).toBe('false');
    expect(submitButton.disabled).toBe(true);

    typeInto(container, '#reg-password', STRONG_PASSWORD);
    ['minLength', 'uppercase', 'lowercase', 'number', 'special'].forEach((rule) => {
      expect(screen.getByTestId(`register-password-rule-${rule}`).dataset.met).toBe('true');
    });
    expect(submitButton.disabled).toBe(false);

    // Each screen keeps its own addressable ids, so the two checklists cannot be confused.
    expect(screen.queryByTestId('reset-password-requirements')).toBeNull();
  });

  it('shows the reset checklist, and gates the reset submit on a strong password', () => {
    window.history.replaceState({}, '', '/?resetToken=rtok-123');
    const { container } = renderLoginStep();
    const submitButton = screen.getByTestId('action-reset-password-submit');

    // The link brought the token, but no password is typed yet.
    expect(screen.queryByTestId('reset-password-requirements')).toBeNull();
    expect(submitButton.disabled).toBe(true);

    typeInto(container, '#reset-password', 'abc');
    typeInto(container, '#reset-password-confirm', 'abc');
    expect(screen.getByTestId('reset-password-requirements')).toBeTruthy();
    expect(screen.getByTestId('reset-password-rule-minLength').dataset.met).toBe('false');
    expect(submitButton.disabled).toBe(true);

    typeInto(container, '#reset-password', STRONG_PASSWORD);
    typeInto(container, '#reset-password-confirm', STRONG_PASSWORD);
    ['minLength', 'uppercase', 'lowercase', 'number', 'special'].forEach((rule) => {
      expect(screen.getByTestId(`reset-password-rule-${rule}`).dataset.met).toBe('true');
    });
    expect(submitButton.disabled).toBe(false);

    expect(screen.queryByTestId('register-password-requirements')).toBeNull();
  });
});

describe('a failed provisioning stream reaches the user localized (ETP-4665)', () => {
  it('resolves the stream result instead of rendering its raw message', async () => {
    // Provisioning reports failures as unresolved Etendo AD message keys; before the resolver the
    // final onboarding screen literally showed "@CreateClientFailed@".
    api.runOnboardingStream.mockImplementation(async (fetchImpl, baseUrl, token, form, onMessage) => {
      const result = { type: 'result', success: false, message: '@CreateClientFailed@' };
      onMessage?.(result);
      return result;
    });

    const { container } = render(
      <SetupProgressStep
        config={{ apiBase: '', defaultForm: {} }}
        stepData={{ clientName: 'ACME', fullName: 'Ada Lovelace' }}
        token="csrf-proof" />,
    );

    await waitFor(() => expect(
      screen.getByText(CATALOG.onboardingCreateClientFailed),
    ).toBeTruthy());
    expect(container.textContent).not.toContain('@CreateClientFailed@');
  });
});
