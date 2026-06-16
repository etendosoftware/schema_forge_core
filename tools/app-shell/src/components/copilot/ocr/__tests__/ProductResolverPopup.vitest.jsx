/**
 * Integration render test for ProductResolverPopup.
 * Renders the real component with mocked dependencies.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
}));

import ProductResolverPopup from '../ProductResolverPopup.jsx';

describe('ProductResolverPopup', () => {
  const defaultProps = {
    unmatched: [],
    selectorUrl: 'http://localhost/sws/neo/purchase-invoice/lines/selectors/M_Product_ID',
    productSpecUrl: 'http://localhost/sws/neo/product',
    token: 'test-token',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing with empty unmatched list', () => {
    render(<ProductResolverPopup {...defaultProps} />);
    expect(screen.getByText('ocrProductResolverTitle')).toBeInTheDocument();
    expect(screen.getByText('ocrProductResolverHint')).toBeInTheDocument();
  });

  it('renders cancel and continue buttons', () => {
    render(<ProductResolverPopup {...defaultProps} />);
    expect(screen.getByText('cancel')).toBeInTheDocument();
    expect(screen.getByText('continue')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductResolverPopup {...defaultProps} />);
    await user.click(screen.getByText('cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when X button is clicked', async () => {
    const user = userEvent.setup();
    render(<ProductResolverPopup {...defaultProps} />);
    const xButton = screen.getByLabelText('cancel');
    await user.click(xButton);
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('calls onSubmit with empty map when no unmatched rows', async () => {
    const user = userEvent.setup();
    render(<ProductResolverPopup {...defaultProps} />);
    await user.click(screen.getByText('continue'));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith({});
  });

  it('renders product rows for each unmatched item', () => {
    const unmatched = [
      { idx: 0, description: 'Widget A', quantity: 5, unitPrice: 10 },
      { idx: 1, description: 'Gadget B' },
    ];
    render(<ProductResolverPopup {...defaultProps} unmatched={unmatched} />);
    expect(screen.getByText('Widget A')).toBeInTheDocument();
    expect(screen.getByText('Gadget B')).toBeInTheDocument();
  });

  it('shows quantity and unit price when present', () => {
    const unmatched = [
      { idx: 0, description: 'Widget A', quantity: 5, unitPrice: 10 },
    ];
    render(<ProductResolverPopup {...defaultProps} unmatched={unmatched} />);
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('shows extracted label and pick label for each row', () => {
    const unmatched = [
      { idx: 0, description: 'Widget A' },
    ];
    render(<ProductResolverPopup {...defaultProps} unmatched={unmatched} />);
    expect(screen.getByText('ocrProductExtracted')).toBeInTheDocument();
    expect(screen.getByText('ocrProductPick')).toBeInTheDocument();
  });

  it('calls onSubmit with null for unselected rows', async () => {
    const user = userEvent.setup();
    const unmatched = [
      { idx: 0, description: 'Widget A' },
      { idx: 1, description: 'Gadget B' },
    ];
    render(<ProductResolverPopup {...defaultProps} unmatched={unmatched} />);
    await user.click(screen.getByText('continue'));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith({ 0: null, 1: null });
  });

  it('renders skip label in selector buttons when nothing is selected', () => {
    const unmatched = [
      { idx: 0, description: 'Widget A' },
    ];
    render(<ProductResolverPopup {...defaultProps} unmatched={unmatched} />);
    expect(screen.getByText('ocrProductSkip')).toBeInTheDocument();
  });

  it('handles null productSpecUrl gracefully (no create button)', () => {
    const unmatched = [
      { idx: 0, description: 'Widget A' },
    ];
    render(<ProductResolverPopup {...defaultProps} productSpecUrl={null} unmatched={unmatched} />);
    // Should still render without crashing
    expect(screen.getByText('Widget A')).toBeInTheDocument();
  });
});
