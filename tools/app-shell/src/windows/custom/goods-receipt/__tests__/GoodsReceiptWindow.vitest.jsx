vi.mock('@generated/goods-receipt/generated/web/goods-receipt/index.jsx', () => ({
  default: ({ rowQuickActions }) => (
    <div data-testid="generated-app">
      <button
        data-testid="trigger-email"
        onClick={() =>
          rowQuickActions?.onEmail?.({
            id: 'row-1',
            documentNo: 'ALB-001',
            businessPartner: 'bp-1',
            'businessPartner$_identifier': 'Supplier A',
          })
        }
      >
        TriggerEmail
      </button>
    </div>
  ),
}));

vi.mock('@generated/goods-receipt/generated/web/goods-receipt/GoodsReceiptTable', () => ({
  default: () => <div />,
}));

vi.mock('../GoodsReceiptBottomPanel.jsx', () => ({ default: () => null }));
vi.mock('../GoodsReceiptPreview.jsx', () => ({ default: () => null }));
vi.mock('../RelatedDocuments.jsx', () => ({ default: () => null }));

vi.mock('@/components/attachments', () => ({
  AttachmentsTab: () => null,
}));

vi.mock('@/components/contract-ui/BulkDocumentAction', () => ({
  default: () => null,
  buildInOutActions: vi.fn(),
}));

vi.mock('@/components/contract-ui/CloneOrderModal', () => ({
  default: () => null,
}));

vi.mock('@/components/contract-ui/SendDocumentModal', () => ({
  default: ({ onClose, documentNo }) => (
    <div data-testid="send-modal" data-doc-no={documentNo}>
      <button data-testid="send-close" onClick={onClose}>Close</button>
    </div>
  ),
}));

vi.mock('@/windows/custom/shared/usePreviewAttachment.js', () => ({
  usePreviewAttachment: vi.fn(() => ({
    storedFile: null,
    isBusy: false,
    storeFile: vi.fn(),
    storeBlob: vi.fn(),
    storeUrl: vi.fn(),
    deleteFile: vi.fn(),
  })),
}));

vi.mock('@/hooks/useBulkActionToast', () => ({
  useBulkActionToast: vi.fn(),
}));

vi.mock('@/hooks/useRowDelete', () => ({
  useRowDelete: vi.fn(() => ({
    requestDelete: vi.fn(),
    deleteDialog: null,
  })),
}));

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useMenuLabel: () => (key) => key,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoodsReceiptWindow from '../index.jsx';

const DEFAULT_PROPS = {
  token: 'tok',
  apiBaseUrl: '/api',
  windowName: 'goods-receipt',
};

describe('GoodsReceiptWindow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the generated app', () => {
    render(<GoodsReceiptWindow {...DEFAULT_PROPS} />);
    expect(screen.getByTestId('generated-app')).toBeInTheDocument();
  });

  it('shows SendDocumentModal when the email row quick action is triggered', () => {
    render(<GoodsReceiptWindow {...DEFAULT_PROPS} />);
    expect(screen.queryByTestId('send-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('trigger-email'));

    expect(screen.getByTestId('send-modal')).toBeInTheDocument();
    expect(screen.getByTestId('send-modal').dataset.docNo).toBe('ALB-001');
  });
});
