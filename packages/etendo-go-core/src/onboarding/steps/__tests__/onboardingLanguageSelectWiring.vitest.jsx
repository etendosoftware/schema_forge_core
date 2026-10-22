// @covers packages/etendo-go-core/src/onboarding/steps/LoginStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/RegisterStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/ProfileStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/CompanyStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/EnvSelectStep.jsx
// @covers packages/app-shell-core/src/i18n/useLocaleState.js
import React from 'react';
import { render, screen, within, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCountryOptions } from '../../countries.js';

/**
 * ETP-4444 (scope) + ETP-4663 (Register override) — WHERE the onboarding
 * language selector is wired, and that choosing a language actually moves the
 * application locale.
 *
 * Scope history this file pins: the selector belongs to the two screens where a
 * user picks a language *before* they have an account (Login — all three of its
 * views — and Register). The three setup steps (Profile, Company, EnvSelect)
 * must never show it. It also must not render at all when the host provides no
 * `setLocale`: a dropdown that cannot change anything is worse than no dropdown.
 *
 * The persistence guarantee ("the switch survives a reload") used to be asserted
 * by reading app-shell-core's useLocaleState.js source. Here the mocked
 * `useLocaleSwitch` is backed by that REAL hook, so the choice made through the
 * rendered Radix listbox travels the production path all the way to
 * localStorage['schema-forge-locale'].
 */

const LOCALES = ['es_ES', 'en_US'];
const SELECTOR_TESTID = 'OnboardingLanguageSelect__79cf84';

// Radix's Select trigger needs pointer-capture APIs jsdom does not implement.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};

// `enabled: false` models a host that mounts onboarding without a locale
// switcher (no LocaleProvider setLocale) — the "no dead control" case.
const localeHost = vi.hoisted(() => ({ enabled: true }));

vi.mock('@etendosoftware/app-shell-core/i18n', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useUI: () => (key) => key,
    useLocaleSwitch: () => {
      // Whatever the flag says, the hook itself is the real one.
      const [locale, setLocale] = actual.useLocaleState();
      return { locale, setLocale: localeHost.enabled ? setLocale : null };
    },
  };
});

vi.mock('../../api.js', () => ({
  AUTH_ERROR_UI_KEYS: {},
  resolveAuthErrorMessage: (ui, err, fallback) => fallback,
  loginAccount: vi.fn(),
  loginWithSsoProvider: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  fetchAccount: vi.fn(),
  fetchEnvironments: vi.fn(async () => []),
  loginEnvironment: vi.fn(),
}));

vi.mock('../../sso.js', () => ({
  getConfiguredSsoProviders: () => [],
  renderSsoProviderButton: vi.fn(),
}));

const { LoginStep } = await import('../LoginStep.jsx');
const { RegisterStep } = await import('../RegisterStep.jsx');
const { ProfileStep } = await import('../ProfileStep.jsx');
const { CompanyStep } = await import('../CompanyStep.jsx');
const { EnvSelectStep } = await import('../EnvSelectStep.jsx');

const CONFIG = { apiBase: '', brandLabel: 'Etendo', localeCodes: LOCALES, countryCodes: ['ES'] };

/** The UI keys the mocked useUI returns unchanged; the label prop is ui('language'). */
const LANGUAGE_LABEL = 'language';

beforeEach(() => {
  localStorage.clear();
  localeHost.enabled = true;
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

function renderLogin(props = {}) {
  return render(
    <LoginStep
      config={CONFIG}
      stepData={{}}
      routeByEnvironments={vi.fn(async () => {})}
      setToken={vi.fn()}
      {...props}
    />,
  );
}

function renderRegister(props = {}) {
  return render(<RegisterStep config={CONFIG} stepData={{}} {...props} />);
}

function renderProfile(props = {}) {
  return render(
    <ProfileStep
      config={CONFIG}
      stepData={{ fullName: 'Ada Lovelace', countryCode: 'ES' }}
      onNext={vi.fn()}
      onBack={vi.fn()}
      goToStep={vi.fn()}
      onChange={vi.fn()}
      setDraftNotice={vi.fn()}
      {...props}
    />,
  );
}

function renderCompany(props = {}) {
  return render(
    <CompanyStep
      config={CONFIG}
      stepData={{ businessType: 'company', clientName: 'Acme', fullName: 'Ada Lovelace' }}
      onNext={vi.fn()}
      onBack={vi.fn()}
      goToStep={vi.fn()}
      onChange={vi.fn()}
      setDraftNotice={vi.fn()}
      {...props}
    />,
  );
}

function renderEnvSelect(props = {}) {
  return render(
    <EnvSelectStep
      config={CONFIG}
      stepData={{}}
      token="platform-token"
      environments={[]}
      onLogout={vi.fn()}
      {...props}
    />,
  );
}

async function chooseLocale(label) {
  const trigger = screen.getByRole('combobox', { name: LANGUAGE_LABEL });
  const user = userEvent.setup();
  await user.click(trigger);
  await screen.findByRole('listbox');
  await user.click(screen.getByRole('option', { name: label }));
  return trigger;
}

describe('onboarding language selector wiring', () => {
  it('renders the selector in the Login header of all three login views', () => {
    const login = renderLogin();
    expect(screen.getByTestId(SELECTOR_TESTID)).toBeTruthy();
    // Header, not the form body: it precedes the view's own title.
    expect(
      screen.getByTestId(SELECTOR_TESTID).compareDocumentPosition(screen.getByText('onboardingLoginTitle'))
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByText('onboardingForgotPasswordAction'));
    expect(screen.getByText('onboardingForgotPasswordTitle')).toBeTruthy();
    expect(screen.getByTestId(SELECTOR_TESTID)).toBeTruthy();
    login.unmount();

    // The reset-password view is the one the e-mailed link opens.
    window.history.replaceState({}, '', '/?resetToken=reset-token');
    renderLogin();
    expect(screen.getByText('onboardingResetPasswordTitle')).toBeTruthy();
    expect(screen.getByTestId(SELECTOR_TESTID)).toBeTruthy();
  });

  it('renders the selector in the Register header (ETP-4663)', () => {
    renderRegister();

    const selector = screen.getByTestId(SELECTOR_TESTID);
    expect(selector).toBeTruthy();
    expect(
      selector.compareDocumentPosition(screen.getByText('onboardingRegisterTitle'))
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('combobox', { name: LANGUAGE_LABEL })).toBeTruthy();
  });

  it('renders no selector when the host provides no setLocale (no dead control)', () => {
    localeHost.enabled = false;

    const login = renderLogin();
    expect(screen.queryByTestId(SELECTOR_TESTID)).toBeNull();
    expect(screen.queryByRole('combobox', { name: LANGUAGE_LABEL })).toBeNull();
    login.unmount();

    renderRegister();
    expect(screen.queryByTestId(SELECTOR_TESTID)).toBeNull();
    expect(screen.queryByRole('combobox', { name: LANGUAGE_LABEL })).toBeNull();
  });

  it('never renders the selector in the setup steps', () => {
    const expectedAbsence = () => {
      expect(screen.queryByTestId(SELECTOR_TESTID)).toBeNull();
      expect(screen.queryByRole('combobox', { name: LANGUAGE_LABEL })).toBeNull();
    };

    const profile = renderProfile();
    expectedAbsence();
    profile.unmount();

    const company = renderCompany();
    expectedAbsence();
    company.unmount();

    renderEnvSelect();
    expectedAbsence();
  });

  it('persists the chosen locale through app-shell-core locale state', async () => {
    expect(localStorage.getItem('schema-forge-locale')).toBeNull();
    renderLogin();

    await chooseLocale('onboardingLanguageEnglish');

    // The exact key is app-shell-core's STORAGE_KEY: a private copy would fail here.
    expect(localStorage.getItem('schema-forge-locale')).toBe('en_US');
    // ...and the real locale state moved, so the closed control now shows English.
    expect(
      screen.getByRole('combobox', { name: LANGUAGE_LABEL }).firstElementChild.textContent.trim(),
    ).toBe('onboardingLanguageEnglish');
  });

  it('does not write a locale when the host provides no setLocale', () => {
    localeHost.enabled = false;
    renderLogin();

    expect(localStorage.getItem('schema-forge-locale')).toBeNull();
  });

  it('keeps the Profile country field fixed: one static label, no control', () => {
    renderProfile({ config: { ...CONFIG, countryCodes: ['ES', 'US'] } });

    const field = screen.getByTestId('CountryField__79cf84');
    const [spain, unitedStates] = buildCountryOptions(['ES', 'US'], 'es_ES');

    // Data-driven from countries.js, not a hardcoded literal.
    expect(field.textContent).toContain(spain.label);
    expect(field.textContent).toContain(spain.flag);
    // Only the first configured country is shown — there is no country choice.
    expect(field.textContent).not.toContain(unitedStates.label);
    expect(field.textContent).not.toContain(unitedStates.flag);

    // Nothing to type in, open or toggle: it is a label, not a form control.
    expect(field.querySelector('input, select, textarea, button')).toBeNull();
    expect(within(field).queryByRole('combobox')).toBeNull();
    expect(within(field).queryByRole('textbox')).toBeNull();
    expect(within(field).queryByRole('button')).toBeNull();
  });
});
