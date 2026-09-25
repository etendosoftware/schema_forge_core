import { renderHook } from '@testing-library/react';

const apiFetchFn = vi.fn();
vi.mock('../../auth/useApiFetch.js', () => ({
  useApiFetch: () => apiFetchFn,
}));

import { ObservabilityProvider } from '../../observability/ObservabilityContext.jsx';
import { useUsage } from '../usage/useUsage.js';
import { resetUsageClientForTests } from '../usage/usageClient.js';

function fakeClient() {
  return { setRequest: vi.fn(), setMixpanel: vi.fn(), track: vi.fn() };
}

describe('useUsage', () => {
  afterEach(() => {
    resetUsageClientForTests();
  });

  it('hands the context trackUsageEvent and useApiFetch function to the injected client', () => {
    const client = fakeClient();
    const trackUsageEvent = vi.fn();
    const wrapper = ({ children }) => (
      <ObservabilityProvider value={{ trackUsageEvent }}>{children}</ObservabilityProvider>
    );
    const { result } = renderHook(() => useUsage({ client }), { wrapper });

    const fields = { target: 'btn', properties: { a: 1 } };
    expect(result.current.trackUsage('ui.test', fields)).toBeUndefined();

    expect(client.setRequest).toHaveBeenCalledWith(apiFetchFn);
    expect(client.setMixpanel).toHaveBeenCalledWith(trackUsageEvent);
    expect(client.track).toHaveBeenCalledWith('ui.test', fields);
  });

  it('passes null as the sink when the host value predates trackUsageEvent', () => {
    const client = fakeClient();
    const wrapper = ({ children }) => (
      <ObservabilityProvider value={{ trackMcpConnectTabSelected: vi.fn() }}>{children}</ObservabilityProvider>
    );
    const { result } = renderHook(() => useUsage({ client }), { wrapper });
    result.current.trackUsage('ui.test');
    expect(client.setMixpanel).toHaveBeenCalledWith(null);
  });

  it('works without any provider (default no-op sink)', () => {
    const client = fakeClient();
    const { result } = renderHook(() => useUsage({ client }));
    expect(() => result.current.trackUsage('ui.test')).not.toThrow();
    expect(client.setRequest).toHaveBeenCalledWith(apiFetchFn);
    expect(typeof client.setMixpanel.mock.calls[0][0]).toBe('function');
    expect(client.track).toHaveBeenCalledWith('ui.test', undefined);
  });

  it('falls back to the shared client and never throws on an unknown type', () => {
    const { result } = renderHook(() => useUsage());
    expect(() => result.current.trackUsage('ui.not.in.catalog', { target: 'x' })).not.toThrow();
    expect(apiFetchFn).not.toHaveBeenCalled();
  });

  it('keeps a stable trackUsage across re-renders', () => {
    const client = fakeClient();
    const { result, rerender } = renderHook(() => useUsage({ client }));
    const first = result.current.trackUsage;
    rerender();
    expect(result.current.trackUsage).toBe(first);
  });
});
