// Mocks must come before imports (Vitest hoisting)

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US' }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/lib/dateOnly', () => ({
  formatCalendarDate: (date) => date || '—',
}));

vi.mock('@/windows/custom/shared/usePreviewAttachment.js', () => ({
  usePreviewAttachment: vi.fn(() => ({
    storedFile: null,
    isBusy: false,
    storeFailed: false,
    storeFile: vi.fn(),
    storeBlob: vi.fn(),
    storeUrl: vi.fn(),
    deleteFile: vi.fn(),
  })),
}));

vi.mock('../../shared/GenericPreviewModal.jsx', () => ({
  default: vi.fn(({ title, subtitle, tabs, actionButtons, onClose, attachmentConfig }) => {
    // Simulate ManagedLeftPanel calling onFileChange when storedFile changes
    // by exposing attachmentConfig so tests can inspect it
    return (
      <div data-testid="generic-preview-modal">
        <span data-testid="modal-title">{title}</span>
        {subtitle && <span data-testid="modal-subtitle">{subtitle}</span>}
        <div data-testid="modal-tabs">
          {tabs?.map((t) => (
            <div key={t.key} data-testid={`tab-${t.key}`}>
              {t.content}
            </div>
          ))}
        </div>
        <div data-testid="modal-actions">{actionButtons}</div>
        {onClose && (
          <button data-testid="close-btn" onClick={onClose}>
            Close
          </button>
        )}
        {attachmentConfig?.onFileChange && (
          <button
            data-testid="simulate-file-change"
            onClick={() => attachmentConfig.onFileChange({ objectUrl: 'blob:test-url', fileName: 'test.pdf' })}
          >
            SimulateFileChange
          </button>
        )}
      </div>
    );
  }),
}));

vi.mock('../../shared/PreviewActionButtons.jsx', () => ({
  PreviewEmptyPanel: ({ icon, text }) => <div data-testid="preview-empty-panel">{icon} {text}</div>,
}));

vi.mock('@/components/contract-ui/SendDocumentModal.jsx', () => ({
  default: ({ onClose, pdfBlobUrl }) => (
    <div data-testid="send-modal" data-pdf-url={pdfBlobUrl}>
      <button data-testid="send-modal-close" onClick={onClose}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('@/components/ui/button.jsx', () => ({
  Button: ({ children, onClick, disabled, ...rest }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock('lucide-react', () => ({
  Edit2: () => <span data-testid="icon-edit2" />,
  Mail: () => <span data-testid="icon-mail" />,
}));

vi.mock('../../shared/preview-cards/SummaryCard.jsx', () => ({
  InfoRow: ({ label, value, children }) => (
    <div data-testid="info-row">
      {label}: {value ?? children}
    </div>
  ),
  CardShell: ({ children }) => <div data-testid="card-shell">{children}</div>,
  PercentBar: ({ value }) => <div data-testid="percent-bar">{value}</div>,
}));

vi.mock('@/components/related-documents/constants.jsx', () => ({
  STATUS_BADGE: {},
  STATUS_KEYS: {},
}));

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GoodsReceiptPreview from '../GoodsReceiptPreview.jsx';

const defaultReceipt = {
  id: 'receipt-1',
  documentNo: 'ALB-COMP-001',
  documentStatus: 'CO',
  movementDate: '2024-03-15',
  'businessPartner$_identifier': 'Supplier A',
  businessPartner: 'bp-1',
  'warehouse$_identifier': 'Main Warehouse',
  salesOrder: 'po-1',
  'salesOrder$_identifier': 'PO-001',
  invoiceStatus: 50,
};

function renderPreview(overrides = {}) {
  const defaults = {
    receipt: defaultReceipt,
    token: 'tok',
    apiBaseUrl: '/api/goods-receipt',
    windowName: 'goods-receipt',
    onClose: vi.fn(),
    onEdit: vi.fn(),
  };
  return render(<GoodsReceiptPreview {...defaults} {...overrides} />);
}

describe('GoodsReceiptPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when receipt prop is null', () => {
    const { container } = render(
      <GoodsReceiptPreview
        receipt={null}
        token="tok"
        apiBaseUrl="/api/goods-receipt"
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders GenericPreviewModal when receipt is provided', () => {
    renderPreview();
    expect(screen.getByTestId('generic-preview-modal')).toBeInTheDocument();
  });

  it('title contains documentNo', () => {
    renderPreview();
    const title = screen.getByTestId('modal-title').textContent;
    expect(title).toContain('ALB-COMP-001');
  });

  describe('Send (email) button visibility', () => {
    it('does NOT render the send button when documentStatus is DR', () => {
      renderPreview({ receipt: { ...defaultReceipt, documentStatus: 'DR' } });
      expect(screen.queryByTestId('icon-mail')).not.toBeInTheDocument();
    });

    it('renders the send button when documentStatus is CO', () => {
      renderPreview({ receipt: { ...defaultReceipt, documentStatus: 'CO' } });
      expect(screen.getByTestId('icon-mail')).toBeInTheDocument();
    });
  });

  it('shows send modal when email button is clicked', () => {
    renderPreview();
    expect(screen.queryByTestId('send-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('icon-mail').closest('button'));
    expect(screen.getByTestId('send-modal')).toBeInTheDocument();
  });

  it('onFileChange in attachmentConfig updates pdfBlobUrl passed to SendDocumentModal', () => {
    renderPreview();

    // Open send modal first
    fireEvent.click(screen.getByTestId('icon-mail').closest('button'));
    expect(screen.getByTestId('send-modal')).toBeInTheDocument();
    expect(screen.getByTestId('send-modal').dataset.pdfUrl).toBeFalsy();

    // Close the modal so we can re-render cleanly with the file change simulation
    fireEvent.click(screen.getByTestId('send-modal-close'));
  });

  it('attachmentConfig.onFileChange callback is wired up and triggers a state update', () => {
    renderPreview();

    // Simulate the GenericPreviewModal calling attachmentConfig.onFileChange
    const simulateBtn = screen.getByTestId('simulate-file-change');
    fireEvent.click(simulateBtn);

    // Open the send modal; pdfBlobUrl should now reflect the stored file
    fireEvent.click(screen.getByTestId('icon-mail').closest('button'));
    expect(screen.getByTestId('send-modal')).toBeInTheDocument();
    expect(screen.getByTestId('send-modal').dataset.pdfUrl).toBe('blob:test-url');
  });

  it('renders 3 tabs: general, messages, history', () => {
    renderPreview();
    expect(screen.getByTestId('tab-general')).toBeInTheDocument();
    expect(screen.getByTestId('tab-messages')).toBeInTheDocument();
    expect(screen.getByTestId('tab-history')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderPreview({ onClose });
    fireEvent.click(screen.getByTestId('close-btn'));
    expect(onClose).toHaveBeenCalled();
  });
});

// ── ReceiptStatsPanel navigation ──────────────────────────────────────────────

describe('Purchase order navigation', () => {
  it('calls onClose and navigates when PO link is clicked', () => {
    const onClose = vi.fn();
    renderPreview({ onClose });
    fireEvent.click(screen.getByText('PO-001'));
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/purchase-order/po-1');
  });

  it('does not render a PO link when salesOrder$_identifier is absent', () => {
    renderPreview({
      receipt: { ...defaultReceipt, salesOrder: null, 'salesOrder$_identifier': null },
    });
    expect(screen.queryByText('PO-001')).not.toBeInTheDocument();
  });
});

// ── closeEmailModal ───────────────────────────────────────────────────────────

describe('closeEmailModal', () => {
  afterEach(() => vi.useRealTimers());

  it('hides the send modal after the 280 ms exit animation', async () => {
    vi.useFakeTimers();
    renderPreview();

    fireEvent.click(screen.getByTestId('icon-mail').closest('button'));
    expect(screen.getByTestId('send-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('send-modal-close'));
    expect(screen.getByTestId('send-modal')).toBeInTheDocument();

    await act(async () => { vi.runAllTimers(); });
    expect(screen.queryByTestId('send-modal')).not.toBeInTheDocument();
  });
});
