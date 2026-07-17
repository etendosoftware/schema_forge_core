import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { ObservabilityProvider, useObservability } from '../ObservabilityContext.jsx';

function Consumer({ payload }) {
  const { trackMcpConnectTabSelected } = useObservability();
  useEffect(() => {
    trackMcpConnectTabSelected(payload);
  }, [trackMcpConnectTabSelected, payload]);
  return <div>consumer</div>;
}

describe('ObservabilityContext', () => {
  it('uses a no-op default when no provider is present', () => {
    expect(() =>
      render(<Consumer payload={{ client: 'x' }} />)
    ).not.toThrow();
  });

  it('passes calls through to the injected telemetry wrapper', () => {
    const spy = vi.fn();
    render(
      <ObservabilityProvider value={{ trackMcpConnectTabSelected: spy }}>
        <Consumer payload={{ client: 'production' }} />
      </ObservabilityProvider>
    );
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ client: 'production' });
  });
});
