// @covers packages/etendo-go-core/src/onboarding/OnboardingFlow.jsx
// @covers packages/etendo-go-core/src/onboarding/components/DraftSaveWarning.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/LoginStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/index.js
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-4584 — a draft save that fails while the user logs out must not disappear
 * silently: the login step is told about the failure so the user knows their last
 * edit never reached the server.
 *
 * Observed here through the real OnboardingFlow (real LoginStep rendering the real
 * DraftSaveWarning), driven by a stubbed fetch. The persistence policy itself
 * (debounce/flush/401/409/429/500) is covered by
 * test/onboardingDraftPersistence.test.js; this suite covers the user-visible half.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

const { OnboardingFlow } = await import('../OnboardingFlow.jsx');
const { LoginStep } = await import('../steps/LoginStep.jsx');
const { coreSteps } = await import('../steps/index.js');
const { bindOnboardingAccount } = await import('../api.js');

const ACCOUNT = { id: 'acc-A', email: 'ada@example.test', name: 'Ada Lovelace' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let draftSaveStatus;
let requests;

beforeEach(() => {
  draftSaveStatus = 200;
  requests = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const path = String(url);
    const method = (init.method || 'GET').toUpperCase();
    requests.push({ path, method, body: init.body });
    if (path.endsWith('/sws/go/session') && method === 'GET') {
      return json({ status: 'success', account: ACCOUNT, csrfToken: 'csrf-A' });
    }
    if (path.endsWith('/sws/go/session') && method === 'DELETE') return new Response(null, { status: 204 });
    if (path.endsWith('/sws/go/me')) return json(ACCOUNT);
    if (path.endsWith('/sws/go/environments')) return json({ environments: [] });
    if (path.endsWith('/sws/go/onboarding/draft') && method === 'POST') {
      return draftSaveStatus === 200
        ? json({ ok: true })
        : json({ error: { message: 'save failed', status: draftSaveStatus } }, draftSaveStatus);
    }
    if (path.endsWith('/sws/go/onboarding/draft')) return json({ draft: null });
    return json({});
  }));
  vi.stubGlobal('BroadcastChannel', class {
    constructor(name) { this.name = name; this.closed = false; }

    postMessage() {}

    close() { this.closed = true; }
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  bindOnboardingAccount(null);
  localStorage.clear();
});

/** A setup step stand-in: publishes an edit so the draft has something to save. */
function ProfileStandIn({ onChange, onLogout }) {
  React.useEffect(() => {
    onChange({ fullName: 'Bea B' });
  }, []);
  return (
    <div data-testid="profile-step">
      <button type="button" onClick={onLogout} data-testid="profile-logout">logout</button>
    </div>
  );
}

describe('onboarding draft-save warning (ETP-4584)', () => {
  it('marks the two setup steps as persistable with their draft step numbers', () => {
    const byId = Object.fromEntries(coreSteps.map((step) => [step.id, step]));

    expect(byId.profile).toMatchObject({ persistable: true, draftStep: 1 });
    expect(byId.company).toMatchObject({ persistable: true, draftStep: 2 });
    // Login has no form worth resuming; opting it in would resurrect the login form.
    expect(byId.login.persistable).toBeUndefined();
  });

  it('persists a changed persistable step after the debounce, without navigating', async () => {
    const steps = [
      { id: 'login', component: LoginStep },
      { id: 'profile', component: ProfileStandIn, persistable: true, draftStep: 1 },
    ];

    render(<OnboardingFlow steps={steps} config={{ apiBase: '' }} />);
    await screen.findByTestId('profile-step');

    await waitFor(() => {
      expect(requests.some((r) => r.path.endsWith('/sws/go/onboarding/draft') && r.method === 'POST')).toBe(true);
    }, { timeout: 4000 });

    const saves = requests.filter((r) => r.path.endsWith('/sws/go/onboarding/draft') && r.method === 'POST');
    expect(JSON.parse(saves[0].body).draft).toEqual({ step: 1, form: { fullName: 'Bea B' } });
    // It scheduled the save; it did not move the user off the step.
    expect(screen.getByTestId('profile-step')).toBeTruthy();
  });

  it('surfaces a failed logout draft save as a warning on the login step', async () => {
    draftSaveStatus = 500;
    const steps = [
      { id: 'login', component: LoginStep },
      { id: 'profile', component: ProfileStandIn, persistable: true, draftStep: 1 },
    ];

    render(<OnboardingFlow steps={steps} config={{ apiBase: '' }} />);
    await screen.findByTestId('profile-step');

    fireEvent.click(screen.getByTestId('profile-logout'));

    const warning = await screen.findByTestId('draft-save-warning');
    expect(warning.textContent).toContain('onboardingDraftSaveWarning');
  });

  it('stays on the login step with the warning gone once the draft saves cleanly', async () => {
    const steps = [
      { id: 'login', component: LoginStep },
      { id: 'profile', component: ProfileStandIn, persistable: true, draftStep: 1 },
    ];

    render(<OnboardingFlow steps={steps} config={{ apiBase: '' }} />);
    await screen.findByTestId('profile-step');

    fireEvent.click(screen.getByTestId('profile-logout'));

    await screen.findByTestId('action-login-submit');
    expect(screen.queryByTestId('draft-save-warning')).toBeNull();
  });

  it('shows the localized warning when the login step carries one, and hides it otherwise', () => {
    const { unmount } = render(
      <LoginStep config={{ apiBase: '' }} stepData={{}} draftSaveWarning />,
    );
    expect(screen.getByTestId('draft-save-warning').textContent).toBe('onboardingDraftSaveWarning');
    unmount();

    render(<LoginStep config={{ apiBase: '' }} stepData={{}} draftSaveWarning={false} />);
    expect(screen.queryByTestId('draft-save-warning')).toBeNull();
  });
});
