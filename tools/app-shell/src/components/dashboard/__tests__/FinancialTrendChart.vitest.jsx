import { render, screen } from '@testing-library/react';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock i18n
vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

// Mock dashboardNumberFormat
vi.mock('@/lib/dashboardNumberFormat.js', () => ({
  formatDashboardAmount: (val, currency, locale) => `${val} ${currency}`,
  formatDashboardAxisTick: (val) => String(val),
  localeFromUi: (locale) => locale === 'es_ES' ? 'es-ES' : 'en-US',
  niceScale: (max) => ({
    niceMax: Math.max(max, 1),
    ticks: [0, Math.max(max, 1) / 2, Math.max(max, 1)],
  }),
}));

// Mock ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = MockResizeObserver;

import { FinancialTrendChart } from '../FinancialTrendChart.jsx';

const SAMPLE_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const SAMPLE_VALUES = [1000, 1500, 1200, 1800, 2200, 2500];
const SAMPLE_EXPENSES = [800, 900, 1000, 1100, 1300, 1400];

describe('FinancialTrendChart', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders without crashing with sample data', () => {
    const { container } = render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={SAMPLE_VALUES}
        currencyLabel="EUR"
      />
    );
    expect(container).toBeTruthy();
  });

  it('renders the chart title', () => {
    render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={SAMPLE_VALUES}
        currencyLabel="EUR"
      />
    );
    expect(screen.getByText('financialTrendTitle')).toBeInTheDocument();
  });

  it('renders an SVG chart element', () => {
    const { container } = render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={SAMPLE_VALUES}
        currencyLabel="EUR"
      />
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders chart type toggle buttons', () => {
    const { container } = render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={SAMPLE_VALUES}
        currencyLabel="EUR"
      />
    );
    // Two toggle buttons (line and bar)
    const toggleButtons = container.querySelectorAll('button');
    expect(toggleButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('shows growth status line', () => {
    render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={SAMPLE_VALUES}
        currencyLabel="EUR"
      />
    );
    // Growth is (2500-1000)/1000 = 150% — ui mock returns key as-is
    expect(screen.getByText('financialTrendGrowthUp')).toBeInTheDocument();
  });

  it('shows empty state when all values are zero', () => {
    render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={[0, 0, 0, 0, 0, 0]}
        currencyLabel="EUR"
      />
    );
    expect(screen.getByText('financialTrendEmptyTitle')).toBeInTheDocument();
    expect(screen.getByText('financialTrendEmptySubtitle')).toBeInTheDocument();
  });

  it('shows expense legend when expense values are provided', () => {
    render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={SAMPLE_VALUES}
        expenseValues={SAMPLE_EXPENSES}
        currencyLabel="EUR"
      />
    );
    expect(screen.getByText('financialTrendIncomeLegend')).toBeInTheDocument();
    expect(screen.getByText('financialTrendExpensesLegend')).toBeInTheDocument();
  });

  it('does not show expense legend when no expense values', () => {
    render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={SAMPLE_VALUES}
        currencyLabel="EUR"
      />
    );
    expect(screen.queryByText('financialTrendExpensesLegend')).not.toBeInTheDocument();
  });

  it('shows action buttons in empty state', () => {
    render(
      <FinancialTrendChart
        labels={SAMPLE_LABELS}
        values={[0, 0, 0, 0, 0, 0]}
        currencyLabel="EUR"
      />
    );
    expect(screen.getByText('newPurchase')).toBeInTheDocument();
    expect(screen.getByText('newSale')).toBeInTheDocument();
  });
});
