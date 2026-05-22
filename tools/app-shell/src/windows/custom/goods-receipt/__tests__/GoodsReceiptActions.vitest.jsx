// Mocks must come before imports (Vitest hoisting)

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
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

vi.mock('@/components/contract-ui/ConfirmDocumentModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="confirm-document-modal">
      <button data-testid="confirm-modal-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('@/components/contract-ui/SendDocumentModal', () => ({
  default: ({ onClose }) => (
    <div data-testid="send-document-modal">
      <button data-testid="send-modal-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('@/components/contract-ui', () => ({
  ConfirmResultModal: ({ onClose }) => (
    <div data-testid="confirm-result-modal">
      <button data-testid="result-modal-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('@generated/goods-receipt/custom/PurchaseReturnWizard', () => ({
  default: () => <div data-testid="purchase-return-wizard" />,
}));

import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePreviewAttachment } from '@/windows/custom/shared/usePreviewAttachment.js';
import GoodsReceiptActions from '@generated/goods-receipt/custom/GoodsReceiptActions';

const defaultProps = {
  data: {
    documentStatus: 'CO',
    documentNo: 'ALB-001',
    'businessPartner$_identifier': 'Supplier A',
    businessPartner: 'bp-1',
    invoiceStatus: 0,
    'currency$_identifier': 'EUR',
  },
  recordId: 'receipt-1',
  token: 'tok',
  apiBaseUrl: '/api/goods-receipt',
};

function renderActions(overrides = {}) {
  return render(<GoodsReceiptActions {...defaultProps} {...overrides} />);
}

describe('GoodsReceiptActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePreviewAttachment.mockReturnValue({
      storedFile: null,
      isBusy: false,
      storeFailed: false,
      storeFile: vi.fn(),
      storeBlob: vi.fn(),
      storeUrl: vi.fn(),
      deleteFile: vi.fn(),
    });
  });

  describe('Download <a> visibility', () => {
    it('does NOT render the download link when isCompleted is false (DR status)', () => {
      usePreviewAttachment.mockReturnValue({
        storedFile: { objectUrl: 'blob:test', fileName: 'test.pdf' },
        isBusy: false,
      });
      renderActions({
        data: { ...defaultProps.data, documentStatus: 'DR' },
      });
      expect(screen.queryByTitle('test.pdf')).not.toBeInTheDocument();
    });

    it('does NOT render the download link when storedFile is null even if completed', () => {
      usePreviewAttachment.mockReturnValue({
        storedFile: null,
        isBusy: false,
      });
      renderActions();
      // There should be no anchor with a download attribute pointing to a stored file
      const downloadLink = document.querySelector('a[download]');
      expect(downloadLink).toBeNull();
    });

    it('renders the download link when isCompleted is true and storedFile exists', () => {
      usePreviewAttachment.mockReturnValue({
        storedFile: { objectUrl: 'blob:test-url', fileName: 'receipt.pdf' },
        isBusy: false,
      });
      renderActions();
      const downloadLink = document.querySelector('a[download]');
      expect(downloadLink).toBeInTheDocument();
      expect(downloadLink).toHaveAttribute('href', 'blob:test-url');
      expect(downloadLink).toHaveAttribute('download', 'receipt.pdf');
    });
  });

  describe('goods-receipt:download-pdf event', () => {
    it('programmatically clicks the download link when the event is dispatched', () => {
      usePreviewAttachment.mockReturnValue({
        storedFile: { objectUrl: 'blob:test-url', fileName: 'receipt.pdf' },
        isBusy: false,
      });
      renderActions();

      const downloadLink = document.querySelector('a[download]');
      expect(downloadLink).toBeInTheDocument();

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click');

      act(() => {
        window.dispatchEvent(new CustomEvent('goods-receipt:download-pdf'));
      });

      expect(clickSpy).toHaveBeenCalledTimes(1);
      clickSpy.mockRestore();
    });

    it('does not throw when event is dispatched but no download link is rendered', () => {
      usePreviewAttachment.mockReturnValue({
        storedFile: null,
        isBusy: false,
      });
      renderActions({
        data: { ...defaultProps.data, documentStatus: 'DR' },
      });

      expect(() => {
        act(() => {
          window.dispatchEvent(new CustomEvent('goods-receipt:download-pdf'));
        });
      }).not.toThrow();
    });
  });

  describe('Email button visibility', () => {
    it('does NOT render the email button when documentStatus is not CO', () => {
      renderActions({
        data: { ...defaultProps.data, documentStatus: 'DR' },
      });
      // Email button is an SVG envelope icon wrapped in a button with title quickAction.email
      const emailBtn = screen.queryByTitle('quickAction.email');
      expect(emailBtn).not.toBeInTheDocument();
    });

    it('renders the email button when documentStatus is CO', () => {
      renderActions();
      const emailBtn = screen.getByTitle('quickAction.email');
      expect(emailBtn).toBeInTheDocument();
    });

    it('opens SendDocumentModal when email button is clicked', () => {
      renderActions();
      const emailBtn = screen.getByTitle('quickAction.email');
      fireEvent.click(emailBtn);
      expect(screen.getByTestId('send-document-modal')).toBeInTheDocument();
    });
  });

  describe('"Create Invoice" button visibility', () => {
    it('renders when documentStatus is CO and invoiceStatus < 100', () => {
      renderActions();
      expect(screen.getByText('createInvoiceBtn')).toBeInTheDocument();
    });

    it('does NOT render when documentStatus is DR (not completed)', () => {
      renderActions({ data: { ...defaultProps.data, documentStatus: 'DR' } });
      expect(screen.queryByText('createInvoiceBtn')).not.toBeInTheDocument();
    });

    it('does NOT render when invoiceStatus is 100 (fully invoiced)', () => {
      renderActions({ data: { ...defaultProps.data, invoiceStatus: 100 } });
      expect(screen.queryByText('createInvoiceBtn')).not.toBeInTheDocument();
    });

    it('does NOT render when invoiceStatus is above 100', () => {
      renderActions({ data: { ...defaultProps.data, invoiceStatus: 110 } });
      expect(screen.queryByText('createInvoiceBtn')).not.toBeInTheDocument();
    });
  });

  describe('ReceiptInvoicePreview modal', () => {
    const linesResponse = {
      response: {
        data: [
          { id: 'line-1', 'product$_identifier': 'Product A', movementQuantity: 3, salesOrderLine: 'ol-1' },
          { id: 'line-2', 'product$_identifier': 'Product B', movementQuantity: 1, salesOrderLine: 'ol-2' },
        ],
      },
    };
    const orderLinesResponse = {
      response: {
        data: [
          { id: 'ol-1', unitPrice: '10.00' },
          { id: 'ol-2', unitPrice: '25.00' },
        ],
      },
    };

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.includes('goodsReceiptLine')) {
          return Promise.resolve({ ok: true, json: async () => linesResponse });
        }
        if (url.includes('purchase-order/lines')) {
          return Promise.resolve({ ok: true, json: async () => orderLinesResponse });
        }
        return Promise.resolve({ ok: true, json: async () => ({ response: { data: [] } }) });
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('opens ReceiptInvoicePreview when "Create Invoice" button is clicked', async () => {
      renderActions();
      fireEvent.click(screen.getByText('createInvoiceBtn'));
      // cancel button is always in the modal footer once open
      expect(await screen.findByText('cancel')).toBeInTheDocument();
    });

    it('closes the preview when the overlay backdrop is clicked', async () => {
      renderActions();
      fireEvent.click(screen.getByText('createInvoiceBtn'));
      await screen.findByText('cancel');
      // Click the fixed overlay div (the portal root, not the inner card)
      fireEvent.click(document.querySelector('.fixed'));
      expect(screen.queryByText('cancel')).not.toBeInTheDocument();
    });

    it('renders line rows after fetch resolves', async () => {
      renderActions();
      fireEvent.click(screen.getByText('createInvoiceBtn'));
      expect(await screen.findByText('Product A')).toBeInTheDocument();
      expect(screen.getByText('Product B')).toBeInTheDocument();
    });

    it('shows empty-state message when receipt has no lines', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: { data: [] } }),
      });
      renderActions();
      fireEvent.click(screen.getByText('createInvoiceBtn'));
      expect(await screen.findByText('noLinesInThisReceipt')).toBeInTheDocument();
    });

    it('Confirm button is disabled when there are no lines', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: { data: [] } }),
      });
      renderActions();
      fireEvent.click(screen.getByText('createInvoiceBtn'));
      await screen.findByText('noLinesInThisReceipt');
      // The confirm button renders ui('createInvoiceBtn') text — same key as the outer btn.
      // After modal opens there are two: the topbar btn + the modal confirm btn.
      const buttons = screen.getAllByText('createInvoiceBtn');
      const confirmBtn = buttons.find(b => b.tagName === 'BUTTON' && b.disabled);
      expect(confirmBtn).toBeTruthy();
    });
  });

  describe('handleCreateInvoice — invoice creation API call', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn((url) => {
        if (url.includes('goodsReceiptLine')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              response: {
                data: [
                  { id: 'line-1', 'product$_identifier': 'Product A', movementQuantity: 2, salesOrderLine: 'ol-1' },
                ],
              },
            }),
          });
        }
        if (url.includes('purchase-order/lines')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ response: { data: [{ id: 'ol-1', unitPrice: '15.00' }] } }),
          });
        }
        if (url.includes('createPurchaseInvoice')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ response: { data: { id: 'inv-42', documentNo: 'FAC-2026-001' } } }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('calls POST createPurchaseInvoice with line payload and shows ConfirmResultModal on success', async () => {
      const { toast } = await import('sonner');
      renderActions();

      // Open preview and wait for lines to load
      fireEvent.click(screen.getByText('createInvoiceBtn'));
      await screen.findByText('Product A');

      // The topbar button and the modal confirm button both have text 'createInvoiceBtn'.
      // The confirm button is the last one in DOM order (portal appends after main tree).
      const modalConfirmBtn = screen.getAllByRole('button', { name: 'createInvoiceBtn' }).at(-1);
      fireEvent.click(modalConfirmBtn);

      // Should show the result modal
      expect(await screen.findByTestId('confirm-result-modal')).toBeInTheDocument();

      // Verify the API call
      const invoiceCall = global.fetch.mock.calls.find(([url]) => url.includes('createPurchaseInvoice'));
      expect(invoiceCall).toBeTruthy();
      expect(invoiceCall[1].method).toBe('POST');
      const body = JSON.parse(invoiceCall[1].body);
      expect(body.lines).toEqual([{ receiptLineId: 'line-1', quantity: '2' }]);

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('calls toast.error and keeps preview open when createPurchaseInvoice fails', async () => {
      const { toast } = await import('sonner');
      global.fetch.mockImplementation((url) => {
        if (url.includes('goodsReceiptLine')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              response: {
                data: [{ id: 'line-1', 'product$_identifier': 'Product A', movementQuantity: 2, salesOrderLine: 'ol-1' }],
              },
            }),
          });
        }
        if (url.includes('purchase-order/lines')) {
          return Promise.resolve({ ok: true, json: async () => ({ response: { data: [] } }) });
        }
        if (url.includes('createPurchaseInvoice')) {
          return Promise.resolve({
            ok: false,
            json: async () => ({ response: { message: 'Invoice already exists' } }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      renderActions();
      fireEvent.click(screen.getByText('createInvoiceBtn'));
      await screen.findByText('Product A');

      const modalConfirmBtn = screen.getAllByRole('button', { name: 'createInvoiceBtn' }).at(-1);
      fireEvent.click(modalConfirmBtn);

      await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invoice already exists'));
      // Preview stays open (no result modal)
      expect(screen.queryByTestId('confirm-result-modal')).not.toBeInTheDocument();
    });
  });

  describe('goods-receipt:open-confirm-modal event', () => {
    it('opens ConfirmDocumentModal when event is dispatched', () => {
      renderActions();
      expect(screen.queryByTestId('confirm-document-modal')).not.toBeInTheDocument();
      act(() => {
        window.dispatchEvent(new CustomEvent('goods-receipt:open-confirm-modal'));
      });
      expect(screen.getByTestId('confirm-document-modal')).toBeInTheDocument();
    });

    it('closes ConfirmDocumentModal when onClose is called', () => {
      renderActions();
      act(() => {
        window.dispatchEvent(new CustomEvent('goods-receipt:open-confirm-modal'));
      });
      fireEvent.click(screen.getByTestId('confirm-modal-close'));
      expect(screen.queryByTestId('confirm-document-modal')).not.toBeInTheDocument();
    });
  });
});
