// @covers packages/etendo-go-core/src/onboarding/steps/SetupProgressStep.jsx
// @covers packages/etendo-go-core/src/onboarding/components/SetupProgressCard.jsx
// @covers packages/etendo-go-core/src/onboarding/components/SetupProgressShell.jsx
// @covers packages/etendo-go-core/src/onboarding/components/OnboardingSessionAction.jsx
// @covers packages/etendo-go-core/src/onboarding/errorMessages.js
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ES_AR_LOCALE from '../../../../../../tools/etendo-go-ar/app-shell/src/locales/es_AR.json';

/**
 * ETP-4446 / ETP-4428 — the provisioning screen's contract, observed through the
 * rendered step against a stubbed onboarding stream.
 *
 * The node --test version of this file asserted the SOURCE TEXT of
 * `SetupProgressStep.jsx` / `SetupProgressCard.jsx` / `SetupProgressShell.jsx`
 * (`readFileSync` + `assert.match`). That passes even when the code path can
 * never run, so every guarantee below is now driven end to end: the stream is a
 * deferred promise the test feeds message by message, timers are fake, and the
 * assertions are on what the user sees (progress %, copy, buttons) and on which
 * api calls happen — never on a regex over the code.
 *
 * The sample-data half of this step (ETP-5426) is covered separately in
 * SetupProgressStepSampleData.vitest.jsx and deliberately not repeated here.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
  // No setLocale → the language selector is skipped entirely.
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: null }),
}));

const api = {
  runOnboardingStream: vi.fn(),
  fetchEnvironments: vi.fn(async () => []),
  loginEnvironment: vi.fn(),
  isSessionLostError: vi.fn(() => false),
};

vi.mock('../../api.js', () => ({
  runOnboardingStream: (...args) => api.runOnboardingStream(...args),
  fetchEnvironments: (...args) => api.fetchEnvironments(...args),
  loginEnvironment: (...args) => api.loginEnvironment(...args),
  isSessionLostError: (...args) => api.isSessionLostError(...args),
}));

const { SetupProgressStep } = await import('../SetupProgressStep.jsx');
const { SetupProgressCard } = await import('../../components/SetupProgressCard.jsx');
const { SetupProgressShell } = await import('../../components/SetupProgressShell.jsx');

// the four in-progress phrases the status line rotates through, in order.
const ROTATION_KEYS = [
  'onboardingPreparingActivatingDescription',
  'onboardingPreparingConfiguringDescription',
  'onboardingPreparingDataDescription',
  'onboardingPreparingSequencesDescription',
];

// es_AR is the single locale bundled in the repo (tools/etendo-go-ar/app-shell).
// The failed branch resolves both of its labels through ui(); if either key is
// dropped from the dictionary the buttons render blank at runtime while a
// component test that only stubs ui() keeps passing. Read as JSON DATA.

let stream = null;

function deferredStream() {
  const state = { onMessage: null, resolve: null };
  state.promise = new Promise((resolve) => { state.resolve = resolve; });
  return state;
}

beforeEach(() => {
  vi.useFakeTimers();
  stream = null;
  api.runOnboardingStream.mockReset();
  api.runOnboardingStream.mockImplementation((fetchImpl, baseUrl, token, form, onMessage) => {
    stream = deferredStream();
    stream.onMessage = onMessage;
    return stream.promise;
  });
  api.fetchEnvironments.mockReset().mockResolvedValue([]);
  api.loginEnvironment.mockReset().mockResolvedValue({ status: 'success' });
  api.isSessionLostError.mockReset().mockReturnValue(false);
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Lets the mount effect's async chain settle without advancing the clock. */
async function flushMicrotasks(times = 30) {
  await act(async () => {
    for (let i = 0; i < times; i += 1) await Promise.resolve();
  });
}

async function renderStep(props = {}) {
  const routeByEnvironments = props.routeByEnvironments || vi.fn(async () => {});
  const onBack = props.onBack || vi.fn();
  const utils = render(
    <SetupProgressStep
      config={{ apiBase: '', brandLabel: 'Etendo' }}
      stepData={{ clientName: 'Core', countryCode: 'ES', language: 'es_ES' }}
      token="csrf"
      routeByEnvironments={routeByEnvironments}
      onBack={onBack}
      {...props}
    />,
  );
  await flushMicrotasks();
  return { ...utils, routeByEnvironments, onBack };
}

/** Feeds one progress/result message into the stubbed stream. */
async function emit(message) {
  await act(async () => { stream.onMessage(message); });
}

/** Ends the stubbed run: emits the final result and lets the step settle. */
async function finish(message = { type: 'result', success: true }) {
  await act(async () => {
    stream.onMessage(message);
    stream.resolve(message);
    for (let i = 0; i < 30; i += 1) await Promise.resolve();
  });
}

async function advance(ms) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

async function click(element) {
  await act(async () => { fireEvent.click(element); });
}

function shownProgress() {
  return Number(screen.getByText(/^\d+%$/).textContent.replace('%', ''));
}

function cardTitle(container) {
  return container.querySelector('h2').textContent;
}

function cardDescription(container) {
  return container.querySelector('p.mt-2').textContent;
}

describe('SetupProgressStep — trickle engine (ETP-4446)', () => {
  it('creeps forward between events and never drops below the highest milestone', async () => {
    await renderStep();

    const start = shownProgress();
    expect(start).toBeGreaterThan(0);
    await advance(6000);
    const crept = shownProgress();
    expect(crept).toBeGreaterThan(start);

    // A real milestone snaps the shown value up to it.
    await emit({ type: 'progress', step: 'client', status: 'in_progress' });
    expect(shownProgress()).toBeGreaterThanOrEqual(35);

    await advance(30000);
    const after = shownProgress();
    // Monotonic: the bar advances and never retreats between events.
    expect(after).toBeGreaterThanOrEqual(35);
  });

  it('soft-caps the creep just past the milestone and never crosses 95 without a success', async () => {
    const { container } = await renderStep();

    await emit({ type: 'progress', step: 'sequences', status: 'in_progress' });
    expect(shownProgress()).toBeGreaterThanOrEqual(85);

    let highest = 0;
    for (let i = 0; i < 30; i += 1) {
      await advance(4000);
      highest = Math.max(highest, shownProgress());
    }

    // It did creep past the real milestone…
    expect(highest).toBeGreaterThan(85);
    // …but the soft cap (milestone + lookahead, clamped to TRICKLE_MAX) held.
    expect(highest).toBeLessThanOrEqual(95);
    // The status line is still rotating while the bar is capped.
    expect(ROTATION_KEYS).toContain(cardDescription(container));
  });

  it('keeps the milestone monotonic when a step finishes and no step is running', async () => {
    await renderStep();

    await emit({ type: 'progress', step: 'client', status: 'in_progress' });
    expect(shownProgress()).toBeGreaterThanOrEqual(35);

    // client goes done and nothing is running: the fallback branch would reset
    // the milestone to its own low value, but the bar must hold the shown one.
    await emit({ type: 'progress', step: 'client', status: 'done' });
    expect(shownProgress()).toBeGreaterThanOrEqual(35);
  });
});

describe('SetupProgressStep — snap to 100 on success (ETP-4446)', () => {
  it('snaps to 100 even when success is the very first message', async () => {
    const { container } = await renderStep();

    await finish({ type: 'result', success: true });

    expect(shownProgress()).toBe(100);
    expect(cardTitle(container)).toBe('onboardingSuccessTitle');
    expect(cardDescription(container)).toBe('onboardingSuccessDescription');
    expect(screen.getByText('onboardingCompleted')).toBeTruthy();
    expect(screen.getByTestId('Check__79cf84')).toBeTruthy();
  });

  it('forces 100 after partial progress regardless of the trickled value', async () => {
    await renderStep();

    await emit({ type: 'progress', step: 'sequences', status: 'in_progress' });
    await advance(30000);
    const before = shownProgress();
    expect(before).toBeGreaterThan(85);

    await finish({ type: 'result', success: true });

    expect(shownProgress()).toBe(100);
    expect(shownProgress()).toBeGreaterThan(before);
  });

  it('never rotates the status line once the run succeeded', async () => {
    const { container } = await renderStep();

    await finish({ type: 'result', success: true });

    expect(ROTATION_KEYS).not.toContain(cardDescription(container));
  });
});

describe('SetupProgressStep — no snap-back on failure (ETP-4446, CRITICAL)', () => {
  it('freezes the bar at the value the user saw instead of collapsing to the milestone', async () => {
    await renderStep();

    await emit({ type: 'progress', step: 'sequences', status: 'in_progress' });
    await advance(30000);
    const before = shownProgress();
    // The trickle already shows more than the 85 the backend reported.
    expect(before).toBeGreaterThan(85);

    await emit({ type: 'result', success: false, message: '@CreateClientFailed@' });

    expect(shownProgress()).toBe(before);
  });

  it('does not keep climbing after a failure', async () => {
    await renderStep();

    await emit({ type: 'progress', step: 'dataset', status: 'in_progress' });
    await advance(20000);
    await emit({ type: 'result', success: false, message: 'boom' });
    const atFailure = shownProgress();

    await advance(60000);

    expect(shownProgress()).toBe(atFailure);
  });

  it('resolves the backend failure through the real error resolver, never a raw AD key', async () => {
    const { container } = await renderStep();

    await emit({ type: 'result', success: false, message: '@CreateClientFailed@' });

    expect(cardDescription(container)).toBe('onboardingCreateClientFailed');
    expect(document.body.textContent).not.toContain('@CreateClientFailed@');
    expect(cardTitle(container)).toBe('onboardingGenericError');
    expect(screen.getByText('failed')).toBeTruthy();
  });

  it('maps a stable backend error code to its localized label too', async () => {
    const { container } = await renderStep();

    await emit({ type: 'result', success: false, code: 'CLIENT_CREATION_FAILED' });

    expect(cardDescription(container)).toBe('onboardingCreateClientFailed');
  });

  it('never rotates the status line once the run failed', async () => {
    const { container } = await renderStep();

    await emit({ type: 'result', success: false, message: 'boom' });

    expect(ROTATION_KEYS).not.toContain(cardDescription(container));
  });
});

describe('SetupProgressStep — prefers-reduced-motion (ETP-4446)', () => {
  function stubReducedMotion(matches) {
    const listeners = new Set();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches,
      addEventListener: (type, listener) => { if (type === 'change') listeners.add(listener); },
      removeEventListener: (type, listener) => { if (type === 'change') listeners.delete(listener); },
    })));
    return listeners;
  }

  it('reflects only real milestones, with no intermediate creep', async () => {
    stubReducedMotion(true);
    await renderStep();

    await advance(20000);
    const start = shownProgress();

    await emit({ type: 'progress', step: 'client', status: 'in_progress' });
    expect(shownProgress()).toBeGreaterThanOrEqual(35);

    await advance(20000);
    // No easing: the value stays exactly on the milestone.
    expect(shownProgress()).toBe(35);

    await emit({ type: 'result', success: false, message: 'boom' });
    expect(shownProgress()).toBe(35);
    expect(start).toBeLessThan(35);
  });

  it('subscribes to the media query and unsubscribes on unmount', async () => {
    const listeners = stubReducedMotion(false);
    const { unmount } = await renderStep();

    expect(listeners.size).toBe(1);

    unmount();

    expect(listeners.size).toBe(0);
  });
});

describe('SetupProgressStep — rotating status text (ETP-4446)', () => {
  it('rotates through exactly the four in-progress phrases and wraps around', async () => {
    const { container } = await renderStep();

    const observed = [cardDescription(container)];
    for (let i = 0; i < 4; i += 1) {
      await advance(7500);
      observed.push(cardDescription(container));
    }

    // First four are the four keys, in order; the fifth wraps back to the first.
    expect(observed.slice(0, 4)).toEqual(ROTATION_KEYS);
    expect(observed[4]).toBe(ROTATION_KEYS[0]);
    // The deliberately-excluded "finishing" phrase never appears.
    expect(observed.some((text) => /Finishing/.test(text))).toBe(false);
  });
});

describe('SetupProgressStep — interval cleanup on unmount (ETP-4446)', () => {
  it('clears every interval it created', async () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

    const { unmount } = await renderStep();
    const ids = setIntervalSpy.mock.results.map((result) => result.value);

    expect(ids.length).toBe(2); // rotation + trickle
    unmount();

    const cleared = clearIntervalSpy.mock.calls.map((call) => call[0]);
    ids.forEach((id) => expect(cleared).toContain(id));
  });
});

describe('SetupProgressStep — logout & abort guard (ETP-4598)', () => {
  it('offers the logout action only while a session exists, and reports the click', async () => {
    const onLogout = vi.fn();
    await renderStep({ onLogout });

    const logout = screen.getByTestId('onboarding-logout');
    expect(logout.textContent).toBe('logout');

    await click(logout);
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('renders no logout action without a session token', async () => {
    await renderStep({ token: null });

    expect(screen.queryByTestId('onboarding-logout')).toBeNull();
  });

  it('creates no new environment session once the user logged out mid-provisioning', async () => {
    await renderStep({ onLogout: vi.fn() });

    await click(screen.getByTestId('onboarding-logout'));
    await finish({ type: 'result', success: true });
    await advance(60000);

    expect(api.fetchEnvironments).not.toHaveBeenCalled();
    expect(api.loginEnvironment).not.toHaveBeenCalled();
  });

  it('aborts the same way when it unmounts mid-provisioning', async () => {
    const { unmount, routeByEnvironments } = await renderStep();

    unmount();
    await finish({ type: 'result', success: true });
    await advance(60000);

    expect(api.fetchEnvironments).not.toHaveBeenCalled();
    expect(routeByEnvironments).not.toHaveBeenCalled();
  });
});

describe('SetupProgressStep — auto-login & retry timing (ETP-4598)', () => {
  it('waits two seconds before looking for the new environment, then retries and falls back', async () => {
    const { routeByEnvironments } = await renderStep();

    await finish({ type: 'result', success: true });
    expect(api.fetchEnvironments).not.toHaveBeenCalled();

    await advance(1999);
    expect(api.fetchEnvironments).not.toHaveBeenCalled();

    await advance(1);
    expect(api.fetchEnvironments).toHaveBeenCalledTimes(1);

    // The lookup found nothing, so it retries twice more and then routes.
    await advance(4000);
    await flushMicrotasks();
    expect(api.fetchEnvironments).toHaveBeenCalledTimes(3);
    expect(routeByEnvironments).toHaveBeenCalledTimes(1);
    expect(routeByEnvironments).toHaveBeenCalledWith('csrf');
  });

  it('enters the first environment and checks readiness with the cookie-era signature', async () => {
    const environment = { clientId: 'client-1', adminUserId: 'user-1' };
    api.fetchEnvironments.mockResolvedValue([environment]);
    const checkReadiness = vi.fn(async () => ({
      ready: false,
      failures: [{ key: 'onboardingReadinessFailure' }],
    }));
    const { container, routeByEnvironments } = await renderStep({
      config: { apiBase: '', brandLabel: 'Etendo', checkReadiness },
    });

    await finish({ type: 'result', success: true });
    await advance(2000);
    await flushMicrotasks();

    expect(api.loginEnvironment).toHaveBeenCalledTimes(1);
    const [, baseUrl, tokenArg, envArg] = api.loginEnvironment.mock.calls[0];
    expect(baseUrl).toBe('');
    expect(tokenArg).toBe('csrf');
    expect(envArg).toBe(environment);

    // checkReadiness(fetch, apiBase) — no bearer token argument.
    expect(checkReadiness).toHaveBeenCalledTimes(1);
    const [fetchArg, readinessBase] = checkReadiness.mock.calls[0];
    expect(typeof fetchArg).toBe('function');
    expect(readinessBase).toBe('');
    expect(routeByEnvironments).not.toHaveBeenCalled();

    expect(cardDescription(container)).toBe('onboardingReadinessFailed');
  });
});

describe('SetupProgressStep — failure Retry action (ETP-4428)', () => {
  it('offers Retry and Back together after a failed run and reports Back', async () => {
    const onBack = vi.fn();
    await renderStep({ onBack });

    await emit({ type: 'result', success: false, message: 'boom' });

    expect(screen.getByTestId('Button__retry').textContent).toBe('onboardingRetry');
    expect(screen.getByTestId('Button__c76d30').textContent).toBe('back');

    await click(screen.getByTestId('Button__c76d30'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('re-runs the idempotent onboarding chain when Retry is clicked', async () => {
    await renderStep();

    // The stream ends first: Retry is disabled while a run is still in flight.
    await finish({ type: 'result', success: false, message: 'boom' });
    expect(api.runOnboardingStream).toHaveBeenCalledTimes(1);

    await click(screen.getByTestId('Button__retry'));
    await flushMicrotasks();

    expect(api.runOnboardingStream).toHaveBeenCalledTimes(2);
    // The failure state is reset while the retry runs.
    expect(screen.queryByTestId('Button__retry')).toBeNull();
  });

  it('offers Retry only in the failed state — never while running or after success', async () => {
    await renderStep();
    expect(screen.queryByTestId('Button__retry')).toBeNull();
    expect(screen.queryByTestId('Button__c76d30')).toBeNull();

    await finish({ type: 'result', success: true });
    expect(screen.queryByTestId('Button__retry')).toBeNull();
    expect(screen.queryByTestId('Button__c76d30')).toBeNull();
  });

  it('keeps the onboardingRetry and back labels defined in the es_AR locale', () => {
    const labels = ES_AR_LOCALE.genericLabels || {};

    expect(typeof labels.onboardingRetry).toBe('string');
    expect(labels.onboardingRetry.trim().length).toBeGreaterThan(0);
    expect(typeof labels.back).toBe('string');
    expect(labels.back.trim().length).toBeGreaterThan(0);
  });
});

describe('SetupProgressCard — presentational ring & bar (ETP-4446)', () => {
  const RING_RADIUS = 36;
  const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

  function renderCard(props) {
    return render(
      <SetupProgressCard
        title="title"
        description="description"
        leading={null}
        statusLabel="status"
        {...props} />,
    );
  }

  function circles(container) {
    const svgs = container.querySelectorAll('svg');
    return {
      arc: svgs[1],
      arcCircle: svgs[1].querySelector('circle'),
      trackCircle: svgs[0].querySelector('circle'),
    };
  }

  function normalizedColor(value) {
    return value.replace(/\s/g, '');
  }

  it('clamps out-of-range progress in the ring dash offset', () => {
    const high = renderCard({ progress: 150 });
    const highCircle = circles(high.container).arcCircle;
    expect(Number(highCircle.getAttribute('r'))).toBe(RING_RADIUS);
    expect(Number(highCircle.getAttribute('stroke-dashoffset'))).toBeCloseTo(0, 5);
    high.unmount();

    const low = renderCard({ progress: -20 });
    expect(Number(circles(low.container).arcCircle.getAttribute('stroke-dashoffset')))
      .toBeCloseTo(CIRCUMFERENCE, 5);
    low.unmount();

    const half = renderCard({ progress: 50 });
    expect(Number(circles(half.container).arcCircle.getAttribute('stroke-dashoffset')))
      .toBeCloseTo(CIRCUMFERENCE / 2, 5);
  });

  it('spins the arc while loading and stops the spin on success', () => {
    const loading = renderCard({ progress: 40, success: false });
    const loadingArc = circles(loading.container).arc;
    expect(loadingArc.getAttribute('class')).toContain('animate-spin');
    expect(loadingArc.getAttribute('class')).toContain('motion-reduce:animate-none');
    loading.unmount();

    const done = renderCard({ progress: 100, success: true });
    const doneArc = circles(done.container).arc;
    expect(doneArc.getAttribute('class')).toContain('-rotate-90');
    expect(doneArc.getAttribute('class')).not.toContain('animate-spin');
  });

  it('drives the bar width from the progress and disables its transition under reduced motion', () => {
    const { container } = renderCard({ progress: 50 });
    const bar = container.querySelector('.transition-all');

    expect(bar.style.width).toBe('50%');
    expect(bar.className).toContain('motion-reduce:transition-none');
  });

  it('switches the ring, track and bar to the success palette', () => {
    const running = renderCard({ progress: 30, success: false });
    const runningPaint = circles(running.container);
    expect(runningPaint.arcCircle.getAttribute('stroke')).toBe('#171923');
    expect(runningPaint.trackCircle.getAttribute('stroke')).toBe('#e6eaf2');
    expect(normalizedColor(running.container.querySelector('.transition-all').style.backgroundColor))
      .toMatch(/#171923|rgb\(23,25,35\)/);
    running.unmount();

    const success = renderCard({ progress: 100, success: true });
    const successPaint = circles(success.container);
    expect(successPaint.arcCircle.getAttribute('stroke')).toBe('#54b56a');
    expect(successPaint.trackCircle.getAttribute('stroke')).toBe('#d9f2df');
    expect(normalizedColor(success.container.querySelector('.transition-all').style.backgroundColor))
      .toMatch(/#54b56a|rgb\(84,181,106\)/);
  });
});

describe('SetupProgressShell — background slot (ETP-4446)', () => {
  it('renders the background as a decorative layer with the content above it', () => {
    render(
      <SetupProgressShell
        background={<span data-testid="backdrop" />}
        headerContent={<button type="button" data-testid="header">h</button>}>
        <p data-testid="content">content</p>
      </SetupProgressShell>,
    );

    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop.parentElement.className).toContain('absolute inset-0');
    expect(screen.getByTestId('header')).toBeTruthy();
    expect(screen.getByTestId('content').parentElement.className).toContain('relative z-10');
  });

  it('renders no decorative layer when no background is given', () => {
    render(<SetupProgressShell><p data-testid="content">content</p></SetupProgressShell>);

    expect(screen.queryByTestId('backdrop')).toBeNull();
    expect(screen.getByTestId('content')).toBeTruthy();
  });

  it('wires the backdrop from config.background into the shell', async () => {
    await renderStep({
      config: {
        apiBase: '',
        brandLabel: 'Etendo',
        background: <span data-testid="config-backdrop" />,
      },
    });

    expect(screen.getByTestId('config-backdrop')).toBeTruthy();
  });
});
