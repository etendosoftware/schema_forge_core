import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * ETP-5395 — `routeByEnvironments` (OnboardingFlow.jsx) refuses to auto-enter an
 * environment when `GET /sws/go/login` answers with an explicitly empty
 * `roleList`. That endpoint never fails in that case (it calls
 * generateToken(user, null) and still returns 200 with a truthy token), so the
 * only signal available is the empty array — and the guard must fire on that
 * signal alone, never on a merely-missing `roleList` (older backends, and the
 * common non-empty case, must keep auto-logging in exactly as before).
 *
 * These tests mount the real OnboardingFlow and drive it through its normal
 * mount bootstrap (a stored platform token -> fetchAccount -> routeByEnvironments)
 * with `../api.js` and `../state.js` mocked, so the guard's actual control flow
 * is exercised rather than just its source shape.
 */

const mocks = vi.hoisted(() => ({
  fetchAccount: vi.fn(),
  fetchEnvironments: vi.fn(),
  loginEnvironment: vi.fn(),
  persistEnvironmentSession: vi.fn(),
  clearEnvironmentSession: vi.fn(),
}));

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
}));

vi.mock('../api.js', () => ({
  fetchAccount: mocks.fetchAccount,
  fetchEnvironments: mocks.fetchEnvironments,
  loginEnvironment: mocks.loginEnvironment,
  fetchOnboardingDraft: vi.fn(async () => ({})),
  saveOnboardingDraft: vi.fn(async () => ({})),
  verifyEmail: vi.fn(async () => ({})),
}));

vi.mock('../state.js', () => ({
  persistEnvironmentSession: mocks.persistEnvironmentSession,
  clearEnvironmentSession: mocks.clearEnvironmentSession,
}));

const { OnboardingFlow } = await import('../OnboardingFlow.jsx');

const stubStep = (id) => {
  function Step() {
    return <div data-testid={`step-${id}`} />;
  }
  Step.displayName = `Stub(${id})`;
  return Step;
};

const steps = [
  { id: 'login', component: stubStep('login') },
  { id: 'verify-email', component: stubStep('verify-email') },
  { id: 'env-select', component: stubStep('env-select') },
  { id: 'profile', component: stubStep('profile') },
];

const ACCOUNT = { email: 'ada@example.com' };
const ENV = { clientId: 'env-1', adminUserId: 'user-1' };

/**
 * jsdom's `Location#href` setter is not configurable in place, so it cannot be spied on
 * directly. Replace `window.location` itself with a plain object carrying the same
 * pathname/search the component reads, and record every write to `href` (a real
 * navigation would otherwise make jsdom log a "Not implemented" error).
 */
function spyOnLocationHref() {
  const sets = [];
  const original = window.location;
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      pathname: original.pathname,
      search: original.search,
      hash: original.hash,
      get href() {
        return '';
      },
      set href(value) {
        sets.push(value);
      },
    },
  });
  return sets;
}

describe('routeByEnvironments roleList guard (ETP-5395)', () => {
  let hrefSets;
  let alertSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('sf_platform_token', 'platform-token');
    mocks.fetchAccount.mockReset().mockResolvedValue(ACCOUNT);
    mocks.fetchEnvironments.mockReset().mockResolvedValue([ENV]);
    mocks.loginEnvironment.mockReset();
    mocks.persistEnvironmentSession.mockReset();
    mocks.clearEnvironmentSession.mockReset();
    hrefSets = spyOnLocationHref();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses to enter and routes to env-select when the login response has an explicitly empty roleList', async () => {
    mocks.loginEnvironment.mockResolvedValue({ token: 'env-token', roleList: [] });
    const track = vi.fn();

    render(<OnboardingFlow steps={steps} config={{ apiBase: '', track }} />);

    await waitFor(() => expect(screen.getByTestId('step-env-select')).toBeInTheDocument());

    expect(mocks.persistEnvironmentSession).not.toHaveBeenCalled();
    expect(hrefSets).toEqual([]);
    expect(alertSpy).toHaveBeenCalledWith('onboardingEnvironmentLoginFailed');
    expect(track).toHaveBeenCalledWith('onboarding_environment_enter_failed', expect.objectContaining({
      action: 'enter_environment',
      status: 'failed',
    }));
  });

  it.each([
    ['missing entirely (backward compatibility)', { token: 'env-token' }],
    ['non-empty', { token: 'env-token', roleList: ['role-1'] }],
  ])('proceeds with normal auto-login when roleList is %s', async (_label, loginResponse) => {
    mocks.loginEnvironment.mockResolvedValue(loginResponse);
    const track = vi.fn();

    render(<OnboardingFlow steps={steps} config={{ apiBase: '', track }} />);

    await waitFor(() => expect(mocks.persistEnvironmentSession).toHaveBeenCalledTimes(1));

    expect(mocks.persistEnvironmentSession).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: 'env-1' }),
      loginResponse,
    );
    await waitFor(() => expect(hrefSets).toHaveLength(1));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('onboarding_environment_enter_succeeded', expect.objectContaining({
      action: 'enter_environment',
      status: 'success',
    }));
  });
});
