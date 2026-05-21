// Mocks must come before imports (Vitest hoisting)

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useLocaleSwitch: () => ({ locale: 'en_US' }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/lib/dateOnly', () => ({
  formatCalendarDate: (date) => date || '—',
}));

vi.mock('../useShipmentPdf.js', () => ({
  useShipmentPdf: vi.fn(() => ({ pdfUrl: null, pdfBlob: null, loading: false, error: null })),
}));

vi.mock('@generated/goods-shipment/custom/RelatedDocuments', () => ({
  default: () => <div data-testid="related-docs" />,
}));

vi.mock('../../shared/GenericPreviewModal.jsx', () => ({
  default: vi.fn(({ title, subtitle, tabs, actionButtons, onClose }) => (
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
    </div>
  )),
}));

vi.mock('../../shared/PreviewActionButtons.jsx', () => ({
  PreviewPdfPanel: ({ pdfUrl }) => <div data-testid="pdf-panel" data-url={pdfUrl} />,
}));

vi.mock('@/components/contract-ui/SendDocumentModal.jsx', () => ({
  default: ({ onClose }) => (
    <div data-testid="send-modal">
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
  Download: () => <span data-testid="icon-download" />,
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

import { render, screen, fireEvent } from '@testing-library/react';
import GoodsShipmentPreview from '../GoodsShipmentPreview.jsx';
import { useShipmentPdf } from '../useShipmentPdf.js';

const defaultShipment = {
  id: 'ship-1',
  documentNo: 'ALB-001',
  documentStatus: 'CO',
  movementDate: '2024-01-10',
  'businessPartner$_identifier': 'Client B',
  businessPartner: 'bp-3',
  'warehouse$_identifier': 'Main Warehouse',
  salesOrder: 'so-1',
  'salesOrder$_identifier': 'SO-001 (01/01/2024)',
  invoiceStatus: 0,
};

function renderGSPreview(overrides = {}) {
  const defaults = {
    shipment: defaultShipment,
    token: 'tok',
    apiBaseUrl: '/api/goods-shipment',
    windowName: 'goods-shipment',
    onClose: vi.fn(),
    onEdit: vi.fn(),
  };
  return render(<GoodsShipmentPreview {...defaults} {...overrides} />);
}

describe('GoodsShipmentPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useShipmentPdf.mockReturnValue({ pdfUrl: null, pdfBlob: null, loading: false, error: null });
  });

  it('returns null when shipment prop is null', () => {
    const { container } = render(
      <GoodsShipmentPreview
        shipment={null}
        token="tok"
        apiBaseUrl="/api"
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders GenericPreviewModal when shipment is provided', () => {
    renderGSPreview();
    expect(screen.getByTestId('generic-preview-modal')).toBeInTheDocument();
  });

  it('title contains Goods Shipment and the documentNo', () => {
    renderGSPreview();
    const title = screen.getByTestId('modal-title').textContent;
    expect(title).toContain('Goods Shipment');
    expect(title).toContain('ALB-001');
  });

  it('renders 4 tabs: general, messages, history, documents', () => {
    renderGSPreview();
    expect(screen.getByTestId('tab-general')).toBeInTheDocument();
    expect(screen.getByTestId('tab-messages')).toBeInTheDocument();
    expect(screen.getByTestId('tab-history')).toBeInTheDocument();
    expect(screen.getByTestId('tab-documents')).toBeInTheDocument();
  });

  it('renders related documents component in the documents tab', () => {
    renderGSPreview();
    expect(screen.getByTestId('related-docs')).toBeInTheDocument();
  });

  it('shows send modal when email button is clicked', () => {
    renderGSPreview();
    expect(screen.queryByTestId('send-modal')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('icon-mail').closest('button'));
    expect(screen.getByTestId('send-modal')).toBeInTheDocument();
  });

  it('download button is disabled when pdfBlob is null', () => {
    useShipmentPdf.mockReturnValue({ pdfUrl: null, pdfBlob: null, loading: false, error: null });
    renderGSPreview();
    const downloadBtn = screen.getByTestId('icon-download').closest('button');
    expect(downloadBtn).toBeDisabled();
  });

  it('download button is not disabled when pdfBlob is set', () => {
    useShipmentPdf.mockReturnValue({
      pdfUrl: 'blob:test',
      pdfBlob: new Blob(['%PDF'], { type: 'application/pdf' }),
      loading: false,
      error: null,
    });
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test');
    global.URL.revokeObjectURL = vi.fn();
    renderGSPreview();
    const downloadBtn = screen.getByTestId('icon-download').closest('button');
    expect(downloadBtn).not.toBeDisabled();
  });
});
