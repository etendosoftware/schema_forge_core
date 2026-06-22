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

  it('Send button is disabled when no To recipient is resolved, and enables once one is added', async () => {
    // Editable recipients: an empty proposed To list means there is
    // nothing to send to, so the send button gates until the operator adds one.
    const user = userEvent.setup();
    render(<SendDocumentModal {...BASE} bpEmail="" />);
    const btn = getSendButton();
    expect(btn).toBeDisabled();

    const toInput = screen.getByTestId('send-modal-to-input');
    await user.type(toInput, 'added@example.com{Enter}');

    expect(screen.getByTestId('send-modal-to-chip-added@example.com')).toBeInTheDocument();
    expect(getSendButton()).not.toBeDisabled();
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

  it('renders the To recipients as an editable chip editor, not a read-only field', async () => {
    // Recipients are now editable by default (the read-only input is
    // only the `sendPolicy.editableRecipients: false` opt-out branch).
    const user = userEvent.setup();
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);

    // The proposed recipient is rendered as a removable chip.
    expect(screen.getByTestId('send-modal-to-chip-user@domain.com')).toBeInTheDocument();

    // The chip editor input is present and NOT read-only.
    const toInput = screen.getByTestId('send-modal-to-input');
    expect(toInput).not.toHaveAttribute('readonly');

    // The legacy read-only single-line input must not be rendered.
    expect(screen.queryByPlaceholderText('email@company.com')).not.toBeInTheDocument();

    // Operator can append another address.
    await user.type(toInput, 'second@example.com{Enter}');
    expect(screen.getByTestId('send-modal-to-chip-second@example.com')).toBeInTheDocument();
  });

  it('renders a read-only single-line field when sendPolicy opts out of editable recipients', () => {
    // Opt-out: `sendPolicy.editableRecipients: false` keeps legacy rendering.
    render(
      <SendDocumentModal
        {...BASE}
        bpEmail="user@domain.com"
        sendPolicy={{ editableRecipients: false }}
      />,
    );
    const input = screen.getByPlaceholderText('email@company.com');
    expect(input).toHaveAttribute('readonly');
    expect(input).toHaveValue('user@domain.com');
    // The chip editor must not be rendered in the opt-out branch.
    expect(screen.queryByTestId('send-modal-to-input')).not.toBeInTheDocument();
  });

  it('prefills the To recipient from contacts and lets the operator add and remove addresses', async () => {
    // The fetched contact email seeds the To chip list, but it is now
    // a fully editable proposal: the operator can add and remove addresses.
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

    // The fetched contact email is seeded as a chip.
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByTestId('send-modal-to-chip-john@acme.com')).toBeInTheDocument();
    });

    // Operator adds a second recipient.
    const toInput = screen.getByTestId('send-modal-to-input');
    await user.type(toInput, 'extra@example.com{Enter}');
    expect(screen.getByTestId('send-modal-to-chip-extra@example.com')).toBeInTheDocument();

    // Operator removes the proposed recipient.
    await user.click(screen.getByTestId('send-modal-to-remove-john@acme.com'));
    expect(screen.queryByTestId('send-modal-to-chip-john@acme.com')).not.toBeInTheDocument();
    // The remaining recipient is still present, so send stays enabled.
    expect(screen.getByTestId('send-modal-to-chip-extra@example.com')).toBeInTheDocument();
    expect(getSendButton()).not.toBeDisabled();
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

  // CC (carbon-copy) handling. CC is enabled by default
  // (DEFAULT_SEND_POLICY.cc === true), so the "Add CC" affordance renders for
  // the base props without an explicit sendPolicy.
  it('reveals the CC editor when the operator clicks Add CC', async () => {
    const user = userEvent.setup();
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);

    // The CC editor is collapsed initially; only the Add CC button is shown.
    expect(screen.queryByTestId('send-modal-cc-input')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('send-modal-add-cc'));

    // Clicking Add CC expands the CC chip editor.
    expect(screen.getByTestId('send-modal-cc-input')).toBeInTheDocument();
  });

  it('drops a CC address that is already present in To (cross-channel precedence)', async () => {
    const user = userEvent.setup();
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);

    // To is seeded with user@domain.com.
    expect(screen.getByTestId('send-modal-to-chip-user@domain.com')).toBeInTheDocument();

    await user.click(screen.getByTestId('send-modal-add-cc'));
    const ccInput = screen.getByTestId('send-modal-cc-input');

    // Adding an address already in To is filtered out of CC.
    await user.type(ccInput, 'user@domain.com{Enter}');
    expect(screen.queryByTestId('send-modal-cc-chip-user@domain.com')).not.toBeInTheDocument();

    // A distinct address still commits to CC, proving the editor works.
    await user.type(ccInput, 'cc@example.com{Enter}');
    expect(screen.getByTestId('send-modal-cc-chip-cc@example.com')).toBeInTheDocument();
  });

  it('drops an address from CC when the same address is later added to To (To wins)', async () => {
    const user = userEvent.setup();
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);

    await user.click(screen.getByTestId('send-modal-add-cc'));
    await user.type(screen.getByTestId('send-modal-cc-input'), 'dup@example.com{Enter}');
    expect(screen.getByTestId('send-modal-cc-chip-dup@example.com')).toBeInTheDocument();

    // Adding the same address to To drops it from CC.
    await user.type(screen.getByTestId('send-modal-to-input'), 'dup@example.com{Enter}');
    expect(screen.getByTestId('send-modal-to-chip-dup@example.com')).toBeInTheDocument();
    expect(screen.queryByTestId('send-modal-cc-chip-dup@example.com')).not.toBeInTheDocument();
  });

  it('disables Send when a CC draft is an invalid email', async () => {
    const user = userEvent.setup();
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);

    // Send is enabled with a valid To and no CC invalidity.
    expect(getSendButton()).not.toBeDisabled();

    await user.click(screen.getByTestId('send-modal-add-cc'));
    await user.type(screen.getByTestId('send-modal-cc-input'), 'not-an-email{Enter}');

    // The invalid CC draft shows an inline alert and gates the send button.
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('sendModalInvalidEmail');
    });
    expect(getSendButton()).toBeDisabled();
  });
});
