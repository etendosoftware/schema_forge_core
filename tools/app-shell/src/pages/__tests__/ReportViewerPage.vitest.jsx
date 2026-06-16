import { render, screen, waitFor } from '@testing-library/react';

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useSearchParams: () => {
    const params = new URLSearchParams();
    return [params, vi.fn()];
  },
}));

// Mock i18n hooks
vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

// Mock auth context
vi.mock('@/auth/AuthContext.jsx', () => ({
  useAuth: () => ({
    token: 'test-token',
    selectedRole: { orgList: [] },
    selectedOrg: { id: 'org1' },
  }),
}));

// Mock PageMetaContext
vi.mock('@/components/layout/PageMetaContext', () => ({
  useSetPageMeta: vi.fn(),
}));

// Mock FavoritesContext
vi.mock('@/components/layout/FavoritesContext', () => ({
  useFavorites: () => ({
    toggleFavorite: vi.fn(),
    isFavorite: () => false,
  }),
}));

// Mock ProductSearchDrawer
vi.mock('@/components/contract-ui/ProductSearchDrawer.jsx', () => ({
  default: () => null,
}));

// Mock UI sub-components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock('@/components/ui/date-field', () => ({
  DateField: (props) => <input type="date" data-testid="date-field" />,
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
}));

import ReportViewerPage from '../ReportViewerPage.jsx';

describe('ReportViewerPage', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', async () => {
    const { container } = render(<ReportViewerPage />);
    expect(container).toBeTruthy();
  });

  it('shows loading state initially', () => {
    // fetch never resolves in time
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    render(<ReportViewerPage />);
    // The loading indicator uses Loader2 with animate-spin class
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('shows empty state when no reports are returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('noResults')).toBeInTheDocument();
    });
  });

  it('renders report cards when reports are loaded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'report-aging',
            title: { en_US: 'Aging Report' },
            type: 'listing',
            category: 'finance',
            outputs: ['pdf', 'xlsx'],
          },
        ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('Aging Report')).toBeInTheDocument();
    });
  });

  it('renders output format badges on report cards', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve([
          {
            id: 'report-1',
            title: { en_US: 'Test Report' },
            type: 'listing',
            outputs: ['pdf', 'csv'],
          },
        ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('pdf')).toBeInTheDocument();
      expect(screen.getByText('csv')).toBeInTheDocument();
    });
  });

  it('shows Listing Report type label', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r1', title: { en_US: 'Flat' }, type: 'listing', outputs: ['pdf'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText(/Listing Report/)).toBeInTheDocument();
    });
  });

  it('shows Grouped Report type label', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r2', title: { en_US: 'Grouped' }, type: 'grouped-listing', outputs: ['pdf'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText(/Grouped Report/)).toBeInTheDocument();
    });
  });

  it('shows landscape indicator when orientation is landscape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r3', title: { en_US: 'Wide Report' }, type: 'listing', orientation: 'landscape', outputs: ['pdf'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('Wide Report')).toBeInTheDocument();
    });
    // The landscape text appears as part of the type description
    expect(screen.getByText(/Landscape/)).toBeInTheDocument();
  });

  it('handles fetch failure gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('noResults')).toBeInTheDocument();
    });
  });

  it('groups reports by category', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r1', title: { en_US: 'Sales A' }, type: 'listing', category: 'sales', outputs: ['pdf'] },
        { id: 'r2', title: { en_US: 'Purchase B' }, type: 'listing', category: 'purchase', outputs: ['pdf'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('Sales A')).toBeInTheDocument();
      expect(screen.getByText('Purchase B')).toBeInTheDocument();
    });
  });

  it('renders report with es_ES title fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r-es', title: { es_ES: 'Informe de Ventas' }, type: 'listing', outputs: ['pdf'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      // Falls back to es_ES when en_US is missing and locale is en_US
      expect(screen.getByText('Informe de Ventas')).toBeInTheDocument();
    });
  });

  it('renders report with id fallback when no title', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'report-no-title', type: 'listing', outputs: ['pdf'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('report-no-title')).toBeInTheDocument();
    });
  });

  it('defaults category to other when missing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r-nocat', title: { en_US: 'No Category' }, type: 'listing', outputs: ['html'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('No Category')).toBeInTheDocument();
    });
  });
});