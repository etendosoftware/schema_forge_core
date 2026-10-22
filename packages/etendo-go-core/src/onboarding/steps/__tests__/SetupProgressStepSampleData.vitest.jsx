// @covers packages/etendo-go-core/src/onboarding/steps/CompanyStep.jsx
// @covers packages/etendo-go-core/src/onboarding/steps/SetupProgressStep.jsx
// @covers packages/etendo-go-core/src/onboarding/state.js
// @covers packages/etendo-go-core/src/onboarding/api.js
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * ETP-5426 — a signup can optionally provision the tenant with GOClient's sample
 * data. The opt-in only exists where the backend can honour it (Spanish tenants
 * invoicing in euros), is unticked by default, travels to provisioning only when
 * literally true, and a failed load is reported as a warning on the success card
 * rather than as a failed tenant creation.
 */

vi.mock('@etendosoftware/app-shell-core/i18n', () => ({
  useUI: () => (key) => key,
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

const { CompanyStep } = await import('../CompanyStep.jsx');
const { SetupProgressStep } = await import('../SetupProgressStep.jsx');
const {
  initialSetupSteps,
  applyProgressMessage,
  isSampleDataOffered,
  mapBackendStepStatus,
} = await import('../../state.js');

const ES_EUR = { apiBase: '', brandLabel: 'Etendo', defaultForm: { countryCode: 'ES', currency: 'EUR' } };

function streamResponse(messages) {
  const payload = new TextEncoder().encode(`${messages.map(JSON.stringify).join('\n')}\n`);
  let done = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          if (done) return { done: true };
          done = true;
          return { done: false, value: payload };
        },
      }),
    },
  };
}

beforeEach(() => {
  api.runOnboardingStream.mockReset();
  api.fetchEnvironments.mockReset().mockResolvedValue([]);
  api.loginEnvironment.mockReset();
  api.isSessionLostError.mockReset().mockReturnValue(false);
});

afterEach(cleanup);

describe('sample-data offering policy (ETP-5426)', () => {
  it('is offered only to Spanish tenants invoicing in euros', () => {
    const esEur = { defaultForm: { countryCode: 'ES', currency: 'EUR' } };
    expect(isSampleDataOffered({}, esEur)).toBe(true);
    expect(isSampleDataOffered({ countryCode: 'es' }, { defaultForm: { currency: 'eur' } })).toBe(true);
    expect(isSampleDataOffered({ countryCode: 'AR' }, esEur)).toBe(false);
    expect(isSampleDataOffered({}, { defaultForm: { countryCode: 'ES', currency: 'USD' } })).toBe(false);
    expect(isSampleDataOffered(undefined, undefined)).toBe(false);
  });

  it('sends includeSampleData to the backend only when it is literally true', async () => {
    // The real serializer, not the mocked module above.
    const { runOnboardingStream } = await vi.importActual('../../api.js');
    const bodies = [];
    const fetchImpl = async (url, options = {}) => {
      bodies.push(JSON.parse(options.body));
      return streamResponse([{ type: 'result', success: true }]);
    };
    const form = { clientName: 'Core', currency: 'EUR', language: 'es_ES', countryCode: 'ES' };

    await runOnboardingStream(fetchImpl, '', 'csrf', { ...form, includeSampleData: true }, () => {});
    await runOnboardingStream(fetchImpl, '', 'csrf', { ...form, includeSampleData: false }, () => {});
    await runOnboardingStream(fetchImpl, '', 'csrf', { ...form, includeSampleData: 'true' }, () => {});

    expect(bodies[0].includeSampleData).toBe(true);
    expect('includeSampleData' in bodies[1]).toBe(false);
    expect('includeSampleData' in bodies[2]).toBe(false);
  });

  it('keeps a sample-data warning as a warning, never as a failed step', () => {
    expect(mapBackendStepStatus('warning')).toBe('warning');

    const steps = applyProgressMessage(initialSetupSteps(), {
      type: 'progress', step: 'sampleData', status: 'warning', message: 'Sample data could not be loaded',
    });
    const sampleData = steps.find((step) => step.name === 'sampleData');
    expect(sampleData.status).toBe('warning');
    expect(sampleData.error).toBeNull();
  });
});

describe('CompanyStep sample-data checkbox (ETP-5426)', () => {
  function renderCompanyStep(stepData = {}, config = ES_EUR) {
    return render(
      <CompanyStep
        config={config}
        stepData={{ businessType: 'company', ...stepData }}
        onChange={vi.fn()}
        onNext={vi.fn()}
        onBack={vi.fn()} />,
    );
  }

  it('renders the checkbox unticked when offered, and restores a ticked draft', () => {
    const { unmount } = renderCompanyStep({});
    expect(screen.getByTestId('includeSampleData__checkbox').checked).toBe(false);
    unmount();

    renderCompanyStep({ includeSampleData: true });
    expect(screen.getByTestId('includeSampleData__checkbox').checked).toBe(true);
  });

  it('hides the checkbox when the tenant cannot receive sample data', () => {
    renderCompanyStep({ countryCode: 'AR' });
    expect(screen.queryByTestId('includeSampleData__checkbox')).toBeNull();

    cleanup();
    renderCompanyStep({}, { ...ES_EUR, defaultForm: { countryCode: 'ES', currency: 'USD' } });
    expect(screen.queryByTestId('includeSampleData__checkbox')).toBeNull();
  });

  it('toggles exactly once when its sibling label is clicked', () => {
    // A wrapping <label> re-dispatches the click to the input and toggles twice,
    // leaving the box unticked.
    renderCompanyStep({});

    fireEvent.click(screen.getByText('onboardingSampleDataLabel'));

    expect(screen.getByTestId('includeSampleData__checkbox').checked).toBe(true);
  });
});

describe('SetupProgressStep sample-data outcome (ETP-5426)', () => {
  function renderProgress(stepData, onMessageSequence) {
    api.runOnboardingStream.mockImplementation(async (fetchImpl, base, token, form, onMessage) => {
      onMessageSequence.forEach((message) => onMessage?.(message));
      return { type: 'result', success: true };
    });
    return render(
      <SetupProgressStep
        config={ES_EUR}
        stepData={stepData}
        token="csrf"
        routeByEnvironments={vi.fn()}
        onBack={vi.fn()} />,
    );
  }

  it('forwards the opt-in to provisioning and reports a failed sample-data load on the success card', async () => {
    renderProgress(
      { clientName: 'Core', countryCode: 'ES', language: 'es_ES', includeSampleData: true },
      [
        { type: 'progress', step: 'sampleData', status: 'warning', message: 'Sample data could not be loaded' },
        { type: 'result', success: true },
      ],
    );

    await waitFor(() => expect(api.runOnboardingStream).toHaveBeenCalled());
    const [, , token, payload] = api.runOnboardingStream.mock.calls[0];
    expect(payload.includeSampleData).toBe(true);
    expect(token).toBe('csrf');

    expect(await screen.findByText('onboardingSampleDataWarning')).toBeTruthy();
  });

  it('keeps the success card up longer before auto-login when the sample data failed', async () => {
    // The normal auto-login wait is 2s; the notice needs more room to be read.
    vi.useFakeTimers();
    try {
      api.runOnboardingStream.mockImplementation(async (fetchImpl, base, token, form, onMessage) => {
        onMessage?.({ type: 'progress', step: 'sampleData', status: 'warning' });
        onMessage?.({ type: 'result', success: true });
        return { type: 'result', success: true };
      });
      render(
        <SetupProgressStep
          config={ES_EUR}
          stepData={{ clientName: 'Core', countryCode: 'ES', language: 'es_ES', includeSampleData: true }}
          token="csrf"
          routeByEnvironments={vi.fn()}
          onBack={vi.fn()} />,
      );

      // Flush the mount effect's async chain (clock stays at 0) so the auto-login
      // timer is scheduled before any time is advanced.
      await act(async () => {
        for (let i = 0; i < 12; i += 1) await Promise.resolve();
      });
      expect(api.fetchEnvironments).not.toHaveBeenCalled();

      // A normal run would already be logging in at 2s; the warning path is not.
      await act(async () => { await vi.advanceTimersByTimeAsync(5999); });
      expect(api.fetchEnvironments).not.toHaveBeenCalled();

      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(api.fetchEnvironments).toHaveBeenCalled();
    } finally {
      cleanup();
      vi.useRealTimers();
    }
  });

  it('keeps the plain success copy when the sample data loaded or was never requested', async () => {
    renderProgress(
      { clientName: 'Core', countryCode: 'ES', language: 'es_ES', includeSampleData: false },
      [{ type: 'result', success: true }],
    );

    await waitFor(() => expect(api.runOnboardingStream).toHaveBeenCalled());
    const [, , , payload] = api.runOnboardingStream.mock.calls[0];
    expect(payload.includeSampleData).toBe(false);

    expect(await screen.findByText('onboardingSuccessDescription')).toBeTruthy();
    expect(screen.queryByText('onboardingSampleDataWarning')).toBeNull();
  });
});
