import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const telemetryMocks = vi.hoisted(() => ({
  trackDashboardKpi: vi.fn(),
}));

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

vi.mock('@/lib/dashboardNavigation.js', () => ({
  resolveDashboardNavigation: () => '/sales-invoice',
}));

vi.mock('@/lib/dashboardKpiTelemetry.js', () => ({
  DASHBOARD_KPI_IDS: {
    pendingTasks: 'kpi_adopt_dashboard_pending_tasks',
  },
  trackDashboardKpi: telemetryMocks.trackDashboardKpi,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...rest }) => (
    <a href={typeof to === 'string' ? to : '#'} {...rest}>{children}</a>
  ),
}));

import { PendingTasksRail } from '../PendingTasksRail.jsx';

describe('PendingTasksRail KPI telemetry', () => {
  beforeEach(() => {
    telemetryMocks.trackDashboardKpi.mockReset();
  });

  it('tracks pending task opening with category only', async () => {
    const user = userEvent.setup();

    render(
      <PendingTasksRail
        tasks={[
          {
            taskKey: 'overdueInvoices',
            count: 3,
            navigation: { window: 'sales-invoice' },
          },
        ]}
      />,
    );

    await user.click(screen.getByTestId('Link__7e1000'));

    expect(telemetryMocks.trackDashboardKpi).toHaveBeenCalledWith('pending_task_opened', {
      kpiId: 'kpi_adopt_dashboard_pending_tasks',
      action: 'open_pending_task',
      source: 'dashboard_pending_tasks',
      type: 'sales',
    });
  });
});
