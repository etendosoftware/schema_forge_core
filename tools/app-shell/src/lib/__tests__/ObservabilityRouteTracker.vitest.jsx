import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';

import { ObservabilityRouteTracker } from '../observability/RouteTracker.jsx';

function TestPage({ target }) {
  return <Link to={target}>go</Link>;
}

function renderTracker(initialEntries, events) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ObservabilityRouteTracker trackPage={(path) => events.push(path)} />
      <Routes>
        <Route path="/sales-order/:recordId" element={<TestPage target="/dashboard?token=secret#hash" />} />
        <Route path="/dashboard" element={<TestPage target="/dashboard?token=changed#other" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ObservabilityRouteTracker', () => {
  it('tracks initial route and subsequent pathname changes once', async () => {
    const events = [];
    renderTracker(['/sales-order/ABC123?token=secret#hash'], events);

    expect(events).toEqual(['/sales-order/ABC123']);

    await userEvent.click(screen.getByText('go'));
    expect(events).toEqual(['/sales-order/ABC123', '/dashboard']);
  });

  it('does not duplicate events for query or hash changes on the same pathname', async () => {
    const events = [];
    renderTracker(['/dashboard?token=secret#hash'], events);

    expect(events).toEqual(['/dashboard']);

    await userEvent.click(screen.getByText('go'));
    expect(events).toEqual(['/dashboard']);
  });
});
