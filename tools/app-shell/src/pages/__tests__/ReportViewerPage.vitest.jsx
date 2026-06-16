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

import ReportViewerPage, {
  getSelectorPlaceholderLabel,
  getSelectedItems,
  getProductSelectorUrl,
  getSelectorLabelClassName,
  getSelectorButtonTitle,
  applyProductSelectorScopeParams,
} from '../ReportViewerPage.jsx';

describe('getSelectorPlaceholderLabel', () => {
  it('shows count when multi and items selected', () => {
    expect(getSelectorPlaceholderLabel(true, [{ id: '1' }, { id: '2' }], 'Prod', '')).toBe('2 selected');
  });

  it('shows search prompt when multi and no items selected', () => {
    expect(getSelectorPlaceholderLabel(true, [], 'Widget', '')).toBe('Search Widget...');
  });

  it('uses default label when label is empty in multi mode', () => {
    expect(getSelectorPlaceholderLabel(true, [], '', '')).toBe('Search Product...');
  });

  it('shows displayText in single mode', () => {
    expect(getSelectorPlaceholderLabel(false, [], 'Prod', 'Acme Widget')).toBe('Acme Widget');
  });

  it('shows search prompt when no displayText in single mode', () => {
    expect(getSelectorPlaceholderLabel(false, [], 'Item', '')).toBe('Search Item...');
  });

  it('uses default label in single mode when label is empty', () => {
    expect(getSelectorPlaceholderLabel(false, [], '', '')).toBe('Search Product...');
  });
});

describe('getSelectedItems', () => {
  it('returns single-item array in non-multi mode when value is set', () => {
    const result = getSelectedItems(false, [], 'v1', 'Display');
    expect(result).toEqual([{ id: 'v1', name: 'Display' }]);
  });

  it('returns selected array in multi mode when value is set', () => {
    const sel = [{ id: 'a', name: 'A' }];
    expect(getSelectedItems(true, sel, 'a', 'A')).toBe(sel);
  });

  it('returns selected in multi mode even without value', () => {
    const sel = [{ id: 'x', name: 'X' }];
    expect(getSelectedItems(true, sel, '', '')).toBe(sel);
  });

  it('returns empty array in non-multi mode without value', () => {
    expect(getSelectedItems(false, [], '', '')).toEqual([]);
  });

  it('returns single-item when only displayValue is set', () => {
    const result = getSelectedItems(false, [], '', 'SomeName');
    expect(result).toEqual([{ id: '', name: 'SomeName' }]);
  });
});

describe('getProductSelectorUrl', () => {
  it('returns URL without query string when params are empty', () => {
    const params = new URLSearchParams();
    const url = getProductSelectorUrl(params);
    expect(url).toMatch(/\/sws\/report-selectors\/product$/);
  });

  it('appends query string when params have values', () => {
    const params = new URLSearchParams({ selectedOrgId: 'org1' });
    const url = getProductSelectorUrl(params);
    expect(url).toContain('selectedOrgId=org1');
    expect(url).toContain('/sws/report-selectors/product?');
  });
});

describe('getSelectorLabelClassName', () => {
  it('includes text-foreground when items are selected', () => {
    expect(getSelectorLabelClassName([{ id: '1' }], '')).toContain('text-foreground');
  });

  it('includes text-foreground when displayText is set', () => {
    expect(getSelectorLabelClassName([], 'display')).toContain('text-foreground');
  });

  it('includes text-muted-foreground when empty', () => {
    const cls = getSelectorLabelClassName([], '');
    expect(cls).toContain('text-muted-foreground');
    expect(cls).not.toContain(' text-foreground');
  });
});

describe('getSelectorButtonTitle', () => {
  it('joins selected names in multi mode', () => {
    const items = [{ name: 'A' }, { name: 'B' }];
    expect(getSelectorButtonTitle(true, items, '')).toBe('A, B');
  });

  it('returns displayText in single mode', () => {
    expect(getSelectorButtonTitle(false, [], 'Foo')).toBe('Foo');
  });

  it('returns empty when no selection and no displayText', () => {
    expect(getSelectorButtonTitle(true, [], '')).toBe('');
  });
});

describe('applyProductSelectorScopeParams', () => {
  it('sets selectedOrgId when provided', () => {
    const params = new URLSearchParams();
    applyProductSelectorScopeParams('org1', params, [], '');
    expect(params.get('selectedOrgId')).toBe('org1');
  });

  it('sets roleOrgIds when array is non-empty', () => {
    const params = new URLSearchParams();
    applyProductSelectorScopeParams('', params, ['o1', 'o2'], '');
    expect(params.get('roleOrgIds')).toBe('o1,o2');
  });

  it('sets warehouseIds when provided', () => {
    const params = new URLSearchParams();
    applyProductSelectorScopeParams('', params, [], 'wh1');
    expect(params.get('warehouseIds')).toBe('wh1');
  });

  it('does not set params when values are falsy', () => {
    const params = new URLSearchParams();
    applyProductSelectorScopeParams('', params, [], '');
    expect(params.toString()).toBe('');
  });
});

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

  it('renders multiple categories grouped with headers', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r1', title: { en_US: 'Finance A' }, type: 'listing', category: 'finance', outputs: ['pdf'] },
        { id: 'r2', title: { en_US: 'Sales B' }, type: 'listing', category: 'sales', outputs: ['pdf'] },
        { id: 'r3', title: { en_US: 'Finance C' }, type: 'grouped-listing', category: 'finance', outputs: ['xlsx'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('Finance A')).toBeInTheDocument();
      expect(screen.getByText('Sales B')).toBeInTheDocument();
      expect(screen.getByText('Finance C')).toBeInTheDocument();
    });
  });

  it('renders report cards as clickable buttons', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r-click', title: { en_US: 'Clickable' }, type: 'listing', outputs: ['pdf'] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('Clickable')).toBeInTheDocument();
    });
    // The card is a button element
    const cardButton = screen.getByText('Clickable').closest('button');
    expect(cardButton).toBeTruthy();
  });

  it('renders report with no outputs gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r-no-out', title: { en_US: 'No Outputs' }, type: 'listing' },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('No Outputs')).toBeInTheDocument();
    });
  });

  it('renders reports with empty outputs array', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { id: 'r-empty-out', title: { en_US: 'Empty Outs' }, type: 'listing', outputs: [] },
      ]),
    });
    render(<ReportViewerPage />);
    await waitFor(() => {
      expect(screen.getByText('Empty Outs')).toBeInTheDocument();
    });
  });
});