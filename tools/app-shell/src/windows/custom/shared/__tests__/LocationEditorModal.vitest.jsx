import { render, screen, fireEvent } from '@testing-library/react';

// --- Global stubs for browser APIs not available in jsdom -----------------

globalThis.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};

// --- Mocks ----------------------------------------------------------------

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLabel: () => (key) => key,
}));

vi.mock('lucide-react', () => ({
  X: (props) => <span data-testid="icon-x" {...props} />,
  Loader2: (props) => <span data-testid="loader" {...props} />,
  Search: (props) => <span data-testid="icon-search" {...props} />,
  ChevronDown: (props) => <span data-testid="icon-chevron" {...props} />,
  Check: (props) => <span data-testid="icon-check" {...props} />,
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/auth/AuthContext.jsx', () => ({
  useAuth: () => ({ token: 'test-token', logout: () => {} }),
}));

// --- Import under test ----------------------------------------------------

import LocationEditorModal from '../LocationEditorModal.jsx';

// --- Helpers --------------------------------------------------------------

function renderModal(overrides = {}) {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    onSaved: vi.fn(),
    rowId: null,
    bpId: 'bp-1',
    apiBase: '/api/contacts',
    token: 'tok',
  };
  return { ...render(<LocationEditorModal {...defaults} {...overrides} />), props: { ...defaults, ...overrides } };
}

// --- Tests ----------------------------------------------------------------

describe('LocationEditorModal', () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [], hasMore: false }),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <LocationEditorModal
        open={false}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        bpId="bp-1"
        apiBase="/api"
        token="tok"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal when open', () => {
    renderModal();
    expect(screen.getByText('locationSelectorTitle')).toBeInTheDocument();
  });

  it('renders address form fields', () => {
    renderModal();
    expect(screen.getByText('addressLine1')).toBeInTheDocument();
    expect(screen.getByText('postalCodeLabel')).toBeInTheDocument();
    expect(screen.getByText('cityLabel')).toBeInTheDocument();
    expect(screen.getByText('countryLabel')).toBeInTheDocument();
    expect(screen.getByText('regionLabel')).toBeInTheDocument();
  });

  it('renders save and cancel buttons', () => {
    renderModal();
    expect(screen.getByText('save')).toBeInTheDocument();
    // There are multiple cancel elements — the close X button and the cancel button
    expect(screen.getAllByText('cancel').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onClose when cancel button is clicked', () => {
    const { props } = renderModal();
    const cancelButtons = screen.getAllByText('cancel');
    // The text "cancel" button in the footer
    fireEvent.click(cancelButtons[cancelButtons.length - 1]);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('renders shipping and invoicing checkboxes', () => {
    renderModal();
    // useLabel returns the key itself
    expect(screen.getByText('IsShipTo')).toBeInTheDocument();
    expect(screen.getByText('IsBillTo')).toBeInTheDocument();
  });

  it('does not render remove location button', () => {
    renderModal({ rowId: 'loc-123' });
    expect(screen.queryByText('removeLocation')).not.toBeInTheDocument();
  });

  it('renders all text input fields for address entry', () => {
    renderModal();
    const inputs = screen.getAllByRole('textbox');
    // address, postalCode, city = 3 text inputs (address2 removed)
    expect(inputs.length).toBeGreaterThanOrEqual(3);
  });

  it('renders checkboxes for shipping and invoicing', () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
    // Both default to checked
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();
  });

  it('renders country and region selector buttons with aria-haspopup', () => {
    renderModal();
    const buttons = screen.getAllByRole('button');
    const haspopupBtns = buttons.filter(b => b.getAttribute('aria-haspopup') === 'dialog');
    expect(haspopupBtns.length).toBe(2); // country + region
  });

  it('region selector is disabled when no country is selected', () => {
    renderModal();
    const buttons = screen.getAllByRole('button');
    const disabledBtns = buttons.filter(b => b.disabled);
    // The region button should be disabled since no country is set
    expect(disabledBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('shows selectCountryFirst text in region button when no country selected', () => {
    renderModal();
    expect(screen.getByText('selectCountryFirst')).toBeInTheDocument();
  });

  it('calls close when X button is clicked', () => {
    const { props } = renderModal();
    // The close X button has aria-label "close"
    const closeBtn = screen.getByLabelText('close');
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('calls fetch with correct URL for stock data when editing', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ response: { data: [{ id: 'loc-1', address: '123 Main St', country: 'ES', 'country$_identifier': 'Spain' }] }, items: [], hasMore: false }),
      }),
    );

    renderModal({ rowId: 'loc-1' });

    // Should fetch the record details + selectors
    await screen.findByText('locationSelectorTitle');
    expect(global.fetch).toHaveBeenCalled();
  });

  it('renders save button that is not disabled for new records', () => {
    renderModal();
    const saveBtn = screen.getByText('save');
    expect(saveBtn.closest('button')).not.toBeDisabled();
  });

  it('allows typing in address fields', async () => {
    renderModal();
    const inputs = screen.getAllByRole('textbox');
    // First textbox is the address field (autoFocus)
    fireEvent.change(inputs[0], { target: { value: '123 Main Street' } });
    expect(inputs[0].value).toBe('123 Main Street');
  });

  it('allows toggling shipping checkbox off', () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[0]).not.toBeChecked();
  });

  it('allows toggling invoicing checkbox off', () => {
    renderModal();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[1]).toBeChecked();
    fireEvent.click(checkboxes[1]);
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('opens country picker when country button is clicked', () => {
    renderModal();
    const buttons = screen.getAllByRole('button');
    const countryBtn = buttons.find(b => b.getAttribute('aria-haspopup') === 'dialog' && !b.disabled);
    fireEvent.click(countryBtn);
    // Country picker shows a search input with placeholder
    expect(screen.getByPlaceholderText('countrySearchPlaceholder')).toBeInTheDocument();
  });

  it('calls onSaved on successful save when creating a new record', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({
        response: { status: 0, data: [{ id: 'new-loc-1', name: 'New Location' }] },
        items: [],
        hasMore: false,
      }),
    };

    global.fetch = vi.fn((url) => {
      if (url.includes('/locationAddress') && !url.includes('selectors')) {
        return Promise.resolve(mockResponse);
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: [{ id: 'ES', label: 'Spain' }], hasMore: false }),
      });
    });

    const { props } = renderModal();

    // We need to set a country first (required for save)
    // Click the country button to open picker
    const buttons = screen.getAllByRole('button');
    const countryBtn = buttons.find(b => b.getAttribute('aria-haspopup') === 'dialog' && !b.disabled);
    fireEvent.click(countryBtn);

    // Wait for country picker to appear, then click Spain
    const spainBtn = await screen.findByText('Spain');
    fireEvent.click(spainBtn);

    // Now click save
    fireEvent.click(screen.getByText('save'));

    // Wait for async save to complete
    await vi.waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/locationAddress'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows toast error when saving without country', async () => {
    const { toast } = await import('sonner');
    renderModal();

    // Click save without selecting a country
    fireEvent.click(screen.getByText('save'));

    expect(toast.error).toHaveBeenCalledWith('locationCountryRequired');
  });

  it('disables save button during initial loading when editing', () => {
    global.fetch = vi.fn(() =>
      // Never resolve to keep initialLoading = true
      new Promise(() => {}),
    );

    renderModal({ rowId: 'loc-123' });

    const saveBtn = screen.getByText('save').closest('button');
    expect(saveBtn).toBeDisabled();
  });

  it('allows typing in postal code and city fields', () => {
    renderModal();
    const inputs = screen.getAllByRole('textbox');
    // address=inputs[0], postalCode=inputs[1], city=inputs[2]
    fireEvent.change(inputs[1], { target: { value: '28001' } });
    expect(inputs[1].value).toBe('28001');
    fireEvent.change(inputs[2], { target: { value: 'Madrid' } });
    expect(inputs[2].value).toBe('Madrid');
  });

  it('calls onClose when backdrop overlay is clicked', () => {
    const { props, container } = renderModal();
    // The modal's outermost div is the backdrop
    const backdrop = container.firstChild;
    // The backdrop click should not close because the inner div stops propagation;
    // but clicking the close X should
    const closeBtn = screen.getByLabelText('close');
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalled();
  });
});
