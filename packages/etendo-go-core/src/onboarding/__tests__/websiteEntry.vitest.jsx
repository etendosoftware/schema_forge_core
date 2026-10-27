// @covers packages/etendo-go-core/src/onboarding/OnboardingFlow.jsx
// @covers packages/etendo-go-core/src/onboarding/components/AuthBrand.jsx
// @covers packages/etendo-go-core/src/onboarding/components/PageHeader.jsx
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-5847 — the two ways the public website and the onboarding meet.
 *
 * The website's "Start for free" opens the onboarding on the account creation view through
 * ?view=register: it is another origin, so the one-shot localStorage flag the app itself uses is
 * out of its reach. And the onboarding's logo and name lead back to the website when the build
 * configures one (config.brandHref), staying plain when it does not.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

const { OnboardingFlow } = await import('../OnboardingFlow.jsx');
const { AuthBrand } = await import('../components/AuthBrand.jsx');
const { PageHeader } = await import('../components/PageHeader.jsx');

const STEPS = [
  { id: 'login', component: () => <p data-testid="login-step">login</p> },
  { id: 'register', component: () => <p data-testid="register-step">register</p> },
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  // No session: the visitor comes from the website.
  vi.stubGlobal('fetch', vi.fn(async () => json({ error: { message: 'No session' } }, 401)));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState({}, '', '/');
});

function openOnboarding(search) {
  window.history.replaceState({}, '', `/onboarding${search}`);
  render(<OnboardingFlow steps={STEPS} config={{ apiBase: '' }} />);
}

describe('OnboardingFlow — entering from the website', () => {
  it('opens the account creation view for ?view=register', async () => {
    openOnboarding('?view=register');

    expect(await screen.findByTestId('register-step')).toBeTruthy();
  });

  it('takes the view off the address bar and keeps the rest of the query', async () => {
    openOnboarding('?utm_source=web&view=register');

    await screen.findByTestId('register-step');
    expect(window.location.search).toBe('?utm_source=web');
  });

  it('still opens the login view without it', async () => {
    openOnboarding('');

    expect(await screen.findByTestId('login-step')).toBeTruthy();
  });

  it('lets the address win over the stored one-shot flag', async () => {
    localStorage.setItem('sf_onboarding_initial_view', 'login');
    openOnboarding('?view=register');

    expect(await screen.findByTestId('register-step')).toBeTruthy();
    expect(localStorage.getItem('sf_onboarding_initial_view')).toBeNull();
  });
});

describe('Onboarding brand — the link back to the website', () => {
  it('links the logo and the name when a website is configured', () => {
    render(<AuthBrand label="Etendo GO" href="https://etendo.example" />);

    const link = screen.getByTestId('auth-brand-link');
    expect(link.getAttribute('href')).toBe('https://etendo.example');
    expect(link.textContent).toContain('Etendo GO');
    expect(link.querySelector('img')).toBeTruthy();
  });

  it('is not a link without one', () => {
    render(<AuthBrand label="Etendo GO" />);

    expect(screen.queryByTestId('auth-brand-link')).toBeNull();
    expect(screen.getByText('Etendo GO')).toBeTruthy();
  });

  it('links the environment chooser header too', () => {
    render(<PageHeader brandLabel="Etendo GO" brandHref="https://etendo.example" isAuthenticated={false} />);

    expect(screen.getByTestId('page-header-brand-link').getAttribute('href')).toBe('https://etendo.example');
  });

  it('keeps the environment chooser header plain without one', () => {
    render(<PageHeader brandLabel="Etendo GO" isAuthenticated={false} />);

    expect(screen.queryByTestId('page-header-brand-link')).toBeNull();
  });
});
