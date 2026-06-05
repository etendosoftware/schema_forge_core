// Mock dependencies BEFORE any import
vi.mock('@/i18n', () => ({
  useUI: () => (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('lucide-react', () => ({
  Mail: () => null,
  Search: () => null,
  Loader2: () => null,
}));

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import SendDocumentModal from '../SendDocumentModal.jsx';

const BASE = {
  documentType: 'Invoice',
  documentNo: 'INV-001',
  bpName: 'ACME',
  documentId: 'doc-1',
  windowName: 'sales-invoice',
  token: 'tok',
  onClose: vi.fn(),
  allowEmail: true,
  pdfBlobUrl: 'blob:test',
  cachePreviewBeforeSend: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ response: { data: [] } }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function getSendButton() {
  // The send button contains the text for the 'sendModalSend' key (returned as key itself)
  return screen.getByRole('button', { name: /sendModalSend/i });
}

describe('SendDocumentModal', () => {
  it('renders without crashing with valid email prop', () => {
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);
    // Modal container renders
    expect(document.querySelector('[style]')).toBeTruthy();
  });

  it('Send button stays enabled when bpEmail is empty because backend resolves recipients', () => {
    render(<SendDocumentModal {...BASE} bpEmail="" />);
    const btn = getSendButton();
    expect(btn).not.toBeDisabled();
  });

  it('Send button is enabled when bpEmail is a valid email', () => {
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);
    const btn = getSendButton();
    expect(btn).not.toBeDisabled();
  });

  it('Send button is disabled while a cacheable preview is still loading', () => {
    render(
      <SendDocumentModal
        {...BASE}
        bpEmail="user@domain.com"
        pdfBlobUrl={null}
        pdfBlobLoading
        cachePreviewBeforeSend
      />,
    );
    const btn = getSendButton();
    expect(btn).toBeDisabled();
  });

  it('Send button stays enabled while loading when a preview source is already available', () => {
    render(
      <SendDocumentModal
        {...BASE}
        bpEmail="user@domain.com"
        pdfBlobUrl="blob:test"
        pdfBlobLoading
        cachePreviewBeforeSend
      />,
    );
    const btn = getSendButton();
    expect(btn).not.toBeDisabled();
  });

  it('Send button is not gated by local email without domain dot', () => {
    render(<SendDocumentModal {...BASE} bpEmail="user@nodot" />);
    const btn = getSendButton();
    expect(btn).not.toBeDisabled();
  });

  it('Send button is not gated by local email without local part', () => {
    render(<SendDocumentModal {...BASE} bpEmail="@domain.com" />);
    const btn = getSendButton();
    expect(btn).not.toBeDisabled();
  });

  it('Send button is not gated by local email with multiple @', () => {
    render(<SendDocumentModal {...BASE} bpEmail="a@b@c.com" />);
    const btn = getSendButton();
    expect(btn).not.toBeDisabled();
  });

  it('Send button is disabled when documentId is missing', () => {
    render(<SendDocumentModal {...BASE} documentId="" bpEmail="user@domain.com" />);
    const btn = getSendButton();
    expect(btn).toBeDisabled();
  });

  it('does not show local recipient validation because backend resolves recipients', () => {
    render(<SendDocumentModal {...BASE} bpEmail="" />);
    expect(screen.queryByText('sendModalNoEmail')).not.toBeInTheDocument();
  });

  it('renders contract-driven email fields as read-only', async () => {
    const user = userEvent.setup();
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);
    const input = screen.getByPlaceholderText('email@company.com');
    expect(input).toHaveAttribute('readonly');
    await user.type(input, 'changed@example.com');
    expect(input).toHaveValue('user@domain.com');
  });

  it('prefills the display recipient from contacts without allowing operator overrides', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        response: {
          data: [{ id: '1', etgoEmail: 'john@acme.com', etgoFirstname: 'John', etgoLastname: 'Doe', name: 'John Doe' }],
        },
      }),
    });
    render(
      <SendDocumentModal
        {...BASE}
        bpEmail=""
        bPartnerId="bp-1"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-invoice"
      />,
    );
    // Allow the contacts fetch to settle
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText('email@company.com')).toHaveValue('john@acme.com');
    });
    const input = screen.getByPlaceholderText('email@company.com');
    await user.type(input, 'changed@example.com');
    expect(input).toHaveValue('john@acme.com');
    expect(screen.queryByText('John Doe <john@acme.com>')).not.toBeInTheDocument();
  });

  it('sends a contract command without provider payload fields', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'SENT' }),
    });

    render(
      <SendDocumentModal
        {...BASE}
        bpEmail="user@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-invoice"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/etendo/neo/email-contracts/sales-invoice-send/send',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      version: 'v1',
      recordId: 'doc-1',
      intent: 'send-document',
      idempotencyKey: 'sales-invoice-send:doc-1:send:v1',
    });
    expect(body.to).toBeUndefined();
    expect(body.template).toBeUndefined();
    expect(body.data).toBeUndefined();
    expect(body.subject).toBeUndefined();
    expect(toast.success).toHaveBeenCalledWith('sendModalSentSuccess:{"documentType":"Invoice"}');
  });

  it('caches the generated preview before sending when preview caching is enabled by default', async () => {
    const user = userEvent.setup();
    global.fetch
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'SENT' }) });

    render(
      <SendDocumentModal
        {...BASE}
        cachePreviewBeforeSend
        bpEmail="user@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-invoice"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('blob:test');
    });
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:8080/etendo/neo/preview-file',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      'http://localhost:8080/etendo/neo/email-contracts/sales-invoice-send/send',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(toast.success).toHaveBeenCalledWith('sendModalSentSuccess:{"documentType":"Invoice"}');
  });

  it('routes sales order sends to the sales-order email contract', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'SENT' }),
    });

    render(
      <SendDocumentModal
        {...BASE}
        documentType="Sales Order"
        documentNo="SO-001"
        documentId="order-1"
        windowName="sales-order"
        bpEmail="orders@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-order"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/etendo/neo/email-contracts/sales-order-send/send',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      version: 'v1',
      recordId: 'order-1',
      intent: 'send-document',
      idempotencyKey: 'sales-order-send:order-1:send:v1',
    });
  });

  it('routes sales quotation sends to the sales-quotation email contract', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'SENT' }),
    });

    render(
      <SendDocumentModal
        {...BASE}
        documentType="Sales Quotation"
        documentNo="SQ-001"
        documentId="quotation-1"
        windowName="sales-quotation"
        bpEmail="quotes@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-quotation"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/etendo/neo/email-contracts/sales-quotation-send/send',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body).toEqual({
      version: 'v1',
      recordId: 'quotation-1',
      intent: 'send-document',
      idempotencyKey: 'sales-quotation-send:quotation-1:send:v1',
    });
  });

  it('shows throttled state from the email contract executor', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        response: { data: { status: 'THROTTLED', retryAfterSeconds: 30 } },
      }),
    });

    render(
      <SendDocumentModal
        {...BASE}
        bpEmail="user@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-invoice"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('sendModalThrottled:{"seconds":30}');
    });
    expect(screen.getByRole('status')).toHaveTextContent('sendModalThrottled');
  });

  it('shows duplicate state as a successful idempotent send even with non-2xx HTTP', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        response: { data: { status: 'DUPLICATE' } },
      }),
    });

    render(
      <SendDocumentModal
        {...BASE}
        bpEmail="user@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-invoice"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('sendModalDuplicate:{"documentType":"Invoice"}');
    });
    expect(BASE.onClose).toHaveBeenCalled();
  });

  it('shows unauthorized state from the email contract executor', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        response: { data: { status: 'UNAUTHORIZED' } },
      }),
    });

    render(
      <SendDocumentModal
        {...BASE}
        bpEmail="user@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-invoice"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('sendModalUnauthorized');
    });
    expect(screen.getByRole('status')).toHaveTextContent('sendModalUnauthorized');
  });

  it('shows provider failure state from the email contract executor', async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        response: { data: { status: 'PROVIDER_FAILED' } },
      }),
    });

    render(
      <SendDocumentModal
        {...BASE}
        bpEmail="user@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-invoice"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('sendModalProviderFailed');
    });
    expect(screen.getByRole('status')).toHaveTextContent('sendModalProviderFailed');
  });

  it('shows a user-facing send failure when preview cache throws internal diagnostics', async () => {
    const user = userEvent.setup();
    global.fetch.mockRejectedValueOnce(new Error('Preview file cache failed (500)'));

    render(
      <SendDocumentModal
        {...BASE}
        cachePreviewBeforeSend
        bpEmail="user@domain.com"
        apiBaseUrl="http://localhost:8080/etendo/neo/sales-invoice"
      />,
    );

    await user.click(getSendButton());

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('sendModalSendFailed:{"documentType":"Invoice"}');
    });
    expect(screen.getByRole('status')).toHaveTextContent('sendModalSendFailed');
  });
});
