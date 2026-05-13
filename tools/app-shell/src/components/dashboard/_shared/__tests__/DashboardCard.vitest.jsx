import { render, screen } from '@testing-library/react';

import { DashboardCard } from '../DashboardCard.jsx';

describe('DashboardCard', () => {
  it('renders the given title', () => {
    render(<DashboardCard title="My Title">child</DashboardCard>);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <DashboardCard title="t">
        <div data-testid="child-node">hello</div>
      </DashboardCard>,
    );
    expect(screen.getByTestId('child-node')).toBeInTheDocument();
  });

  it('renders headerExtra when provided', () => {
    render(
      <DashboardCard
        title="t"
        headerExtra={<span data-testid="header-extra">extra</span>}
      >
        body
      </DashboardCard>,
    );
    expect(screen.getByTestId('header-extra')).toBeInTheDocument();
  });

  it('omits headerExtra when null/absent', () => {
    render(<DashboardCard title="t">body</DashboardCard>);
    expect(screen.queryByTestId('header-extra')).not.toBeInTheDocument();
  });

  it('applies testId as data-testid on the outer element', () => {
    render(
      <DashboardCard title="t" testId="my-card">
        body
      </DashboardCard>,
    );
    expect(screen.getByTestId('my-card')).toBeInTheDocument();
  });
});
