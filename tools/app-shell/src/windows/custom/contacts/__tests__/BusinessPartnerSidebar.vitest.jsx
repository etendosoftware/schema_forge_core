// --- Mocks (before imports) ---

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => 'USD',
}));

vi.mock('@/lib/formatCurrency', () => ({
  formatCurrency: (curr, val) => `${curr} ${val}`,
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <div>{children}</div>,
}));

vi.mock('../BPChartSVGContent', () => ({
  BPChartSVGContent: () => <svg data-testid="chart-svg" />,
}));

vi.mock('lucide-react', () => ({
  ArrowUpRight: (props) => <span data-testid="icon-arrow" {...props} />,
  ChevronDown: (props) => <span data-testid="icon-chevron" {...props} />,
  Calendar: (props) => <span data-testid="icon-calendar" {...props} />,
}));

// --- Import under test ---

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ContactsSidebar from '../BusinessPartnerSidebar.jsx';

// --- Helpers ---

const defaultProps = {
  recordId: 'bp-1',
  token: 'test-token',
  apiBaseUrl: '/sws/neo/contacts',
};

function mockFetch({ stats = [], trend = null } = {}) {
  globalThis.fetch = vi.fn((url) => {
    if (url.includes('/bp-stats')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: stats } }),
      });
    }
    if (url.includes('/bp-trend')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          response: { data: trend ?? { labels: [], revenue: [], expenses: [] } },
        }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// --- Tests ---

describe('ContactsSidebar (BusinessPartnerSidebar)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    mockFetch();
    render(<ContactsSidebar {...defaultProps} />);
    expect(screen.getByText('bpLast3Months')).toBeInTheDocument();
  });

  it('does not fetch when recordId is missing', () => {
    mockFetch();
    render(<ContactsSidebar {...defaultProps} recordId={null} />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does not fetch when token is missing', () => {
    mockFetch();
    render(<ContactsSidebar {...defaultProps} token={null} />);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('fetches stats and trend on mount', async () => {
    mockFetch();
    render(<ContactsSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
    const urls = globalThis.fetch.mock.calls.map(c => c[0]);
    expect(urls.some(u => u.includes('/bp-stats'))).toBe(true);
    expect(urls.some(u => u.includes('/bp-trend'))).toBe(true);
  });

  it('shows loading skeleton while kpis are null', () => {
    mockFetch();
    const { container } = render(<ContactsSidebar {...defaultProps} />);
    // Pulse skeleton divs
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders KPI cards after data loads', async () => {
    const stats = [
      { key: 'revenueThisMonth', label: 'Revenue', value: 1000, format: 'currency' },
      { key: 'expensesThisMonth', label: 'Expenses', value: 500, format: 'currency' },
    ];
    mockFetch({ stats });
    render(<ContactsSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('bpRevenueThisMonth')).toBeInTheDocument();
    });
    expect(screen.getByText('bpExpensesThisMonth')).toBeInTheDocument();
  });

  it('renders chart after trend loads', async () => {
    mockFetch({
      stats: [],
      trend: { labels: ['Jan', 'Feb', 'Mar'], revenue: [100, 200, 300], expenses: [50, 100, 150] },
    });
    render(<ContactsSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('chart-svg')).toBeInTheDocument();
    });
  });

  it('switches period on click', async () => {
    mockFetch({ stats: [] });
    render(<ContactsSidebar {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('bpLast3Months')).toBeInTheDocument();
    });

    // Open period dropdown
    fireEvent.click(screen.getByText('bpLast3Months'));

    // Select 6M
    const options = screen.getAllByText('bpLast6Months');
    fireEvent.click(options[options.length - 1]);
  });

  it('handles fetch error gracefully', async () => {
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('fail')));
    render(<ContactsSidebar {...defaultProps} />);
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });
    // Should not crash
  });
});
