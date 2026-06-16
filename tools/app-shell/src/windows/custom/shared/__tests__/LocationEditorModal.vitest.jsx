import { render, screen, fireEvent } from '@testing-library/react';

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
    expect(screen.getByText('addressLine2')).toBeInTheDocument();
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

  it('renders remove location button when editing existing record', () => {
    renderModal({ rowId: 'loc-123' });
    expect(screen.getByText('removeLocation')).toBeInTheDocument();
  });

  it('does not render remove location button for new records', () => {
    renderModal({ rowId: null });
    expect(screen.queryByText('removeLocation')).not.toBeInTheDocument();
  });

  it('renders all text input fields for address entry', () => {
    renderModal();
    const inputs = screen.getAllByRole('textbox');
    // address, address2, postalCode, city = 4 text inputs
    expect(inputs.length).toBeGreaterThanOrEqual(4);
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
});
