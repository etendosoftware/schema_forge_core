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

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('Send button is disabled when bpEmail is empty', () => {
    render(<SendDocumentModal {...BASE} bpEmail="" />);
    const btn = getSendButton();
    expect(btn).toBeDisabled();
  });

  it('Send button is enabled when bpEmail is a valid email', () => {
    render(<SendDocumentModal {...BASE} bpEmail="user@domain.com" />);
    const btn = getSendButton();
    expect(btn).not.toBeDisabled();
  });

  it('Send button is disabled for email without domain dot', () => {
    render(<SendDocumentModal {...BASE} bpEmail="user@nodot" />);
    const btn = getSendButton();
    expect(btn).toBeDisabled();
  });

  it('Send button is disabled for email without local part', () => {
    render(<SendDocumentModal {...BASE} bpEmail="@domain.com" />);
    const btn = getSendButton();
    expect(btn).toBeDisabled();
  });

  it('Send button is disabled for email with multiple @', () => {
    render(<SendDocumentModal {...BASE} bpEmail="a@b@c.com" />);
    const btn = getSendButton();
    expect(btn).toBeDisabled();
  });

  it('no validation error shown on initial render (toPristine)', () => {
    render(<SendDocumentModal {...BASE} bpEmail="" />);
    // The error message uses the 'sendModalNoEmail' i18n key — should NOT be visible initially
    expect(screen.queryByText('sendModalNoEmail')).not.toBeInTheDocument();
  });

  it('validation error shown after user types invalid email', async () => {
    const user = userEvent.setup();
    render(<SendDocumentModal {...BASE} bpEmail="" />);
    const input = screen.getByPlaceholderText('email@company.com');
    // Type something invalid — this sets toPristine to false
    await user.type(input, 'not-valid');
    // Tab away to trigger blur (closes dropdown after 150ms) and keep invalid value
    await user.tab();
    // After blur, showDropdown becomes false and toPristine is already false
    // so the error span should become visible
    await waitFor(() => {
      expect(screen.getByText('sendModalNoEmail')).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('contact dropdown hidden by default', async () => {
    // Mock fetch to return contacts — but dropdown should still be hidden until focus
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
    // Dropdown list container should NOT be in the document yet
    expect(screen.queryByText('John Doe <john@acme.com>')).not.toBeInTheDocument();
  });

  it('contact dropdown appears on input focus when contacts exist', async () => {
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
    // Wait for contacts to load (fetch settles, contacts set in state)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    // Give state update time to propagate
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    // Focus the To input — this triggers setShowDropdown(true) when contacts.length > 0
    const input = screen.getByPlaceholderText('email@company.com');
    await act(async () => {
      input.focus();
    });
    // The dropdown item should now be visible
    await waitFor(() => {
      expect(screen.getByText('John Doe <john@acme.com>')).toBeInTheDocument();
    });
  });
});
