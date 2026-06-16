/**
 * Integration render test for useOcrFlow hook.
 * Renders via renderHook with mocked dependencies.
 */
import { renderHook, act } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
}));

vi.mock('@/hooks/useBulkActionToast', () => ({
  useBulkActionToast: () => ({
    showResult: vi.fn(),
  }),
}));

vi.mock('../ingest/useBatch', () => ({
  useBatch: () => ({
    runBatch: vi.fn().mockResolvedValue({ committed: true, operations: [] }),
  }),
}));

vi.mock('../ingest/purchaseInvoiceDescriptor', () => ({
  buildPurchaseInvoiceBatch: vi.fn().mockResolvedValue({ ops: [], unmatched: [] }),
}));

vi.mock('../ocrDocTypes', () => ({
  getOcrDocType: (id) => {
    if (id === 'purchase-invoice') {
      return {
        id: 'purchase-invoice',
        eventName: 'ocr:purchase-invoice',
        headerFields: [],
        lineColumns: [],
      };
    }
    return null;
  },
}));

vi.mock('../ProductResolverPopup', () => ({
  default: () => null,
}));

vi.mock('../OcrReviewModal', () => ({
  default: () => null,
}));

vi.mock('../OcrLinesReviewModal', () => ({
  default: () => null,
}));

vi.mock('../contactApi', () => ({
  deriveContactsApiBase: (base) => `${base}/contacts`,
}));

vi.mock('../strategies', () => ({
  CREATE_COMPONENTS: {},
  PRE_RESOLVERS: {},
}));

import { useOcrFlow } from '../useOcrFlow.jsx';

describe('useOcrFlow', () => {
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

  it('returns initial state', () => {
    const { result } = renderHook(() =>
      useOcrFlow({
        docTypeId: 'purchase-invoice',
        token: 'test-token',
        apiBaseUrl: '/api',
        onRefresh: vi.fn(),
      }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.pendingModal).toBeNull();
  });

  it('returns null state for unknown docType', () => {
    const { result } = renderHook(() =>
      useOcrFlow({
        docTypeId: 'unknown',
        token: 'test-token',
        apiBaseUrl: '/api',
      }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.pendingModal).toBeNull();
  });

  it('returns null state when no arguments', () => {
    const { result } = renderHook(() => useOcrFlow());
    expect(result.current.loading).toBe(false);
    expect(result.current.result).toBeNull();
  });

  it('registers event listener for known docType', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderHook(() =>
      useOcrFlow({
        docTypeId: 'purchase-invoice',
        token: 'test-token',
        apiBaseUrl: '/api',
      }),
    );
    const ocrCalls = addSpy.mock.calls.filter(([name]) => name === 'ocr:purchase-invoice');
    expect(ocrCalls.length).toBeGreaterThanOrEqual(1);
    addSpy.mockRestore();
  });

  it('cleans up event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() =>
      useOcrFlow({
        docTypeId: 'purchase-invoice',
        token: 'test-token',
        apiBaseUrl: '/api',
      }),
    );
    unmount();
    const ocrCalls = removeSpy.mock.calls.filter(([name]) => name === 'ocr:purchase-invoice');
    expect(ocrCalls.length).toBeGreaterThanOrEqual(1);
    removeSpy.mockRestore();
  });
});
