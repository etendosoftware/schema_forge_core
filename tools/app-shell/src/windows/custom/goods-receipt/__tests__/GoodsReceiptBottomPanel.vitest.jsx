// Mock heavy dependencies BEFORE any imports
vi.mock('@/components/contract-ui', () => ({
  LinesBottomSection: ({ children, relatedDocuments, showTotals, ...props }) => (
    <div
      data-testid="lines-bottom-section"
      data-show-totals={String(showTotals)}
      data-has-related-docs={relatedDocuments ? 'true' : 'false'}
    >
      {children}
    </div>
  ),
  LinesEmptyState: ({ description, secondaryAction, data, onAddLine }) => (
    <div data-testid="lines-empty-state">
      <span data-testid="description">{description}</span>
      <div data-testid="secondary-action">{secondaryAction}</div>
    </div>
  ),
}));

vi.mock('../ImportFromPurchaseOrderModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="import-po-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../ImportFromPurchaseInvoiceModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="import-invoice-modal">
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('../RelatedDocuments.jsx', () => ({
  default: () => <div data-testid="related-documents" />,
}));

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

// Make createPortal render inline so portals appear in the RTL tree
vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, createPortal: (node) => node };
});

import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoodsReceiptBottomPanel from '../GoodsReceiptBottomPanel.jsx';

const ReceiptLinesEmptyState = GoodsReceiptBottomPanel.linesEmptyState;
const ReceiptLineActions = GoodsReceiptBottomPanel.detailExtraActions;

// ---------------------------------------------------------------------------
// GoodsReceiptBottomPanel — default export
// ---------------------------------------------------------------------------
describe('GoodsReceiptBottomPanel (default export)', () => {
  it('renders LinesBottomSection', () => {
    render(<GoodsReceiptBottomPanel />);
    expect(screen.getByTestId('lines-bottom-section')).toBeInTheDocument();
  });

  it('passes showTotals={false} to LinesBottomSection', () => {
    render(<GoodsReceiptBottomPanel />);
    expect(screen.getByTestId('lines-bottom-section')).toHaveAttribute('data-show-totals', 'false');
  });

  it('passes relatedDocuments prop to LinesBottomSection', () => {
    render(<GoodsReceiptBottomPanel />);
    expect(screen.getByTestId('lines-bottom-section')).toHaveAttribute('data-has-related-docs', 'true');
  });

  it('static prop showLineTotals is false', () => {
    expect(GoodsReceiptBottomPanel.showLineTotals).toBe(false);
  });

  it('static slot linesEmptyState is assigned', () => {
    expect(GoodsReceiptBottomPanel.linesEmptyState).toBeDefined();
    expect(typeof GoodsReceiptBottomPanel.linesEmptyState).toBe('function');
  });

  it('static slot detailExtraActions is assigned', () => {
    expect(GoodsReceiptBottomPanel.detailExtraActions).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// lineMenuActions
// ---------------------------------------------------------------------------
describe('lineMenuActions', () => {
  const importRef = { current: { openImportModal: vi.fn(), openImportInvoiceModal: vi.fn() } };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when documentStatus is not DR', () => {
    const result = GoodsReceiptBottomPanel.lineMenuActions({
      data: { documentStatus: 'CO', businessPartner: 'bp-1' },
      importRef,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when bpId is null', () => {
    const result = GoodsReceiptBottomPanel.lineMenuActions({
      data: { documentStatus: 'DR', businessPartner: null },
      importRef,
    });
    expect(result).toEqual([]);
  });

  it('returns empty array when data is null', () => {
    const result = GoodsReceiptBottomPanel.lineMenuActions({ data: null, importRef });
    expect(result).toEqual([]);
  });

  it('returns 2 items when isDraft and bpId exist', () => {
    const result = GoodsReceiptBottomPanel.lineMenuActions({
      data: { documentStatus: 'DR', businessPartner: 'bp-1' },
      importRef,
    });
    expect(result).toHaveLength(2);
  });

  it('first item has key=import-purchase-order', () => {
    const result = GoodsReceiptBottomPanel.lineMenuActions({
      data: { documentStatus: 'DR', businessPartner: 'bp-1' },
      importRef,
    });
    expect(result[0].key).toBe('import-purchase-order');
  });

  it('first item onClick calls importRef.current.openImportModal', () => {
    const result = GoodsReceiptBottomPanel.lineMenuActions({
      data: { documentStatus: 'DR', businessPartner: 'bp-1' },
      importRef,
    });
    result[0].onClick();
    expect(importRef.current.openImportModal).toHaveBeenCalledTimes(1);
  });

  it('second item has key=import-purchase-invoice', () => {
    const result = GoodsReceiptBottomPanel.lineMenuActions({
      data: { documentStatus: 'DR', businessPartner: 'bp-1' },
      importRef,
    });
    expect(result[1].key).toBe('import-purchase-invoice');
  });

  it('second item onClick calls importRef.current.openImportInvoiceModal', () => {
    const result = GoodsReceiptBottomPanel.lineMenuActions({
      data: { documentStatus: 'DR', businessPartner: 'bp-1' },
      importRef,
    });
    result[1].onClick();
    expect(importRef.current.openImportInvoiceModal).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// ReceiptLinesEmptyState
// ---------------------------------------------------------------------------
describe('ReceiptLinesEmptyState', () => {
  const baseProps = {
    data: { businessPartner: 'bp-1' },
    onAddLine: vi.fn(),
    recordId: 'rec-1',
    token: 'tok',
    apiBaseUrl: '/sws/neo/goods-receipt',
    onRefresh: vi.fn(),
  };

  it('renders LinesEmptyState', () => {
    render(<ReceiptLinesEmptyState {...baseProps} />);
    expect(screen.getByTestId('lines-empty-state')).toBeInTheDocument();
  });

  it('passes i18n description key to LinesEmptyState', () => {
    render(<ReceiptLinesEmptyState {...baseProps} />);
    expect(screen.getByTestId('description')).toHaveTextContent(
      'addLinesManuallyOrImportFromPurchaseOrderOrInvoice',
    );
  });

  it('does NOT render import buttons when bpId is null', () => {
    render(<ReceiptLinesEmptyState {...baseProps} data={{ businessPartner: null }} />);
    expect(screen.queryByTestId('action-import-purchase-order-empty-state')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-import-purchase-invoice-empty-state')).not.toBeInTheDocument();
  });

  it('renders both import buttons when bpId is set', () => {
    render(<ReceiptLinesEmptyState {...baseProps} />);
    expect(screen.getByTestId('action-import-purchase-order-empty-state')).toBeInTheDocument();
    expect(screen.getByTestId('action-import-purchase-invoice-empty-state')).toBeInTheDocument();
  });

  it('shows ImportFromPurchaseOrderModal when import PO button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReceiptLinesEmptyState {...baseProps} />);
    expect(screen.queryByTestId('import-po-modal')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('action-import-purchase-order-empty-state'));
    expect(screen.getByTestId('import-po-modal')).toBeInTheDocument();
  });

  it('shows ImportFromPurchaseInvoiceModal when import invoice button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReceiptLinesEmptyState {...baseProps} />);
    expect(screen.queryByTestId('import-invoice-modal')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('action-import-purchase-invoice-empty-state'));
    expect(screen.getByTestId('import-invoice-modal')).toBeInTheDocument();
  });

  it('closes PO modal when onClose is called', async () => {
    const user = userEvent.setup();
    render(<ReceiptLinesEmptyState {...baseProps} />);
    await user.click(screen.getByTestId('action-import-purchase-order-empty-state'));
    expect(screen.getByTestId('import-po-modal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('import-po-modal')).not.toBeInTheDocument();
  });

  it('closes invoice modal when onClose is called', async () => {
    const user = userEvent.setup();
    render(<ReceiptLinesEmptyState {...baseProps} />);
    await user.click(screen.getByTestId('action-import-purchase-invoice-empty-state'));
    expect(screen.getByTestId('import-invoice-modal')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('import-invoice-modal')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ReceiptLineActions
// ---------------------------------------------------------------------------
describe('ReceiptLineActions', () => {
  const baseProps = {
    data: { documentStatus: 'DR', businessPartner: 'bp-1' },
    recordId: 'rec-1',
    token: 'tok',
    apiBaseUrl: '/sws/neo/goods-receipt',
    onRefresh: vi.fn(),
  };

  it('returns null when documentStatus is not DR', () => {
    const { container } = render(
      <ReceiptLineActions {...baseProps} data={{ documentStatus: 'CO', businessPartner: 'bp-1' }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when bpId is null', () => {
    const { container } = render(
      <ReceiptLineActions {...baseProps} data={{ documentStatus: 'DR', businessPartner: null }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders both import buttons when isDraft and bpId are present', () => {
    render(<ReceiptLineActions {...baseProps} />);
    // Two inline buttons (no data-testid on these, check by type/text)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('with hideTrigger=true renders no visible buttons', () => {
    render(<ReceiptLineActions {...baseProps} hideTrigger={true} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('exposes openImportModal via imperative handle', async () => {
    const ref = React.createRef();
    render(<ReceiptLineActions {...baseProps} ref={ref} />);
    expect(typeof ref.current?.openImportModal).toBe('function');
    await act(async () => {
      ref.current.openImportModal();
    });
    expect(screen.getByTestId('import-po-modal')).toBeInTheDocument();
  });

  it('exposes openImportInvoiceModal via imperative handle', async () => {
    const ref = React.createRef();
    render(<ReceiptLineActions {...baseProps} ref={ref} />);
    expect(typeof ref.current?.openImportInvoiceModal).toBe('function');
    await act(async () => {
      ref.current.openImportInvoiceModal();
    });
    expect(screen.getByTestId('import-invoice-modal')).toBeInTheDocument();
  });

  it('with hideTrigger=true: portals render modals when triggered imperatively', async () => {
    const ref = React.createRef();
    render(<ReceiptLineActions {...baseProps} hideTrigger={true} ref={ref} />);
    // No buttons visible
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    // But imperative handle opens the modal
    await act(async () => {
      ref.current.openImportModal();
    });
    expect(screen.getByTestId('import-po-modal')).toBeInTheDocument();
  });

  it('shows import PO modal when inline PO button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReceiptLineActions {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[0]);
    expect(screen.getByTestId('import-po-modal')).toBeInTheDocument();
  });

  it('shows import invoice modal when inline invoice button is clicked', async () => {
    const user = userEvent.setup();
    render(<ReceiptLineActions {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[1]);
    expect(screen.getByTestId('import-invoice-modal')).toBeInTheDocument();
  });
});
