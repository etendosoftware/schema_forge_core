// Mocks BEFORE imports
vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));

// Capture props passed to ImportLinesModal so we can extract the pure functions
let capturedProps = null;
vi.mock('@/components/contract-ui/ImportLinesModal', () => ({
  default: vi.fn((props) => {
    capturedProps = props;
    return null;
  }),
}));

import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ImportFromPurchaseInvoiceModal from '../ImportFromPurchaseInvoiceModal.jsx';
import ImportLinesModal from '@/components/contract-ui/ImportLinesModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  receiptId: 'receipt-1',
  bpId: 'bp-1',
  base: '/api',
  headers: { Authorization: 'Bearer tok' },
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

function renderModal(overrides = {}) {
  capturedProps = null;
  render(<ImportFromPurchaseInvoiceModal {...DEFAULT_PROPS} {...overrides} />);
  return capturedProps;
}

// ── Static prop contract ──────────────────────────────────────────────────────

describe('ImportFromPurchaseInvoiceModal — static props', () => {
  it('passes invoiceId=receiptId to ImportLinesModal', () => {
    const props = renderModal({ receiptId: 'rec-99' });
    expect(props.invoiceId).toBe('rec-99');
  });

  it('passes linesEndpoint="goods-receipt/goodsReceiptLine"', () => {
    const props = renderModal();
    expect(props.linesEndpoint).toBe('goods-receipt/goodsReceiptLine');
  });

  it('passes correct i18n key props', () => {
    const props = renderModal();
    expect(props.titleKey).toBe('importFromPurchaseInvoice');
    expect(props.searchPlaceholderKey).toBe('searchPurchaseInvoice');
    expect(props.emptyMessageKey).toBe('noCompletedPurchaseInvoicesForThisVendor');
    expect(props.noSearchResultsKey).toBe('noInvoicesMatchYourSearch');
    expect(props.successMessageKey).toBe('linesImportedFromPurchaseInvoice');
  });

  it('sets showPriceColumns=false', () => {
    const props = renderModal();
    expect(props.showPriceColumns).toBe(false);
  });

  it('forwards bpId, base, headers, onClose, onSuccess', () => {
    const props = renderModal();
    expect(props.bpId).toBe('bp-1');
    expect(props.base).toBe('/api');
    expect(props.headers).toEqual({ Authorization: 'Bearer tok' });
    expect(typeof props.onClose).toBe('function');
    expect(typeof props.onSuccess).toBe('function');
  });

  it('passes fetchDocuments, fetchLines, getDocDisplay, buildLineBody as functions', () => {
    const props = renderModal();
    expect(typeof props.fetchDocuments).toBe('function');
    expect(typeof props.fetchLines).toBe('function');
    expect(typeof props.getDocDisplay).toBe('function');
    expect(typeof props.buildLineBody).toBe('function');
  });
});

// ── enrichLines (via fetchLines) ──────────────────────────────────────────────

describe('enrichLines — via fetchLines with cached data', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ response: { data: [] } }) }),
    ));
  });
  afterEach(() => vi.unstubAllGlobals());

  function getEnrichedLines(rawLines) {
    const props = renderModal();
    const sharedContext = { linesCache: { 'doc-1': rawLines } };
    return props.fetchLines({ base: '/api', headers: {}, docId: 'doc-1', sharedContext });
  }

  it('filters out lines where invoicedQuantity <= 0', async () => {
    const lines = [
      { id: 'l1', invoicedQuantity: 0, 'product$_identifier': 'P1' },
      { id: 'l2', invoicedQuantity: -1, 'product$_identifier': 'P2' },
      { id: 'l3', invoicedQuantity: 2, 'product$_identifier': 'P3' },
    ];
    const result = await getEnrichedLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('l3');
  });

  it('sets _maxQty=0 and _alreadyImported=true when goodsShipmentLine is truthy', async () => {
    const lines = [
      { id: 'l1', invoicedQuantity: 5, goodsShipmentLine: 'gsl-1', 'product$_identifier': 'P1' },
    ];
    const result = await getEnrichedLines(lines);
    expect(result[0]._maxQty).toBe(0);
    expect(result[0]._alreadyImported).toBe(true);
  });

  it('sets _maxQty=invoicedQuantity and _alreadyImported=false when not yet imported', async () => {
    const lines = [
      { id: 'l1', invoicedQuantity: 7, 'product$_identifier': 'Widget' },
    ];
    const result = await getEnrichedLines(lines);
    expect(result[0]._maxQty).toBe(7);
    expect(result[0]._alreadyImported).toBe(false);
  });

  it('sets _productName from product$_identifier', async () => {
    const lines = [
      { id: 'l1', invoicedQuantity: 3, 'product$_identifier': 'Widget A' },
    ];
    const result = await getEnrichedLines(lines);
    expect(result[0]._productName).toBe('Widget A');
  });

  it('falls back to id for _productName when product$_identifier is absent', async () => {
    const lines = [
      { id: 'l42', invoicedQuantity: 3 },
    ];
    const result = await getEnrichedLines(lines);
    expect(result[0]._productName).toBe('l42');
  });
});

// ── fetchLines ────────────────────────────────────────────────────────────────

describe('fetchLines', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses cached lines and does not fetch when cache is populated', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const props = renderModal();
    const cachedLines = [
      { id: 'l1', invoicedQuantity: 4, 'product$_identifier': 'Cached Product' },
    ];
    const sharedContext = { linesCache: { 'doc-cached': cachedLines } };

    await props.fetchLines({ base: '/api', headers: {}, docId: 'doc-cached', sharedContext });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches from API when not in cache', async () => {
    const apiLines = [
      { id: 'l2', invoicedQuantity: 2, 'product$_identifier': 'Remote Product' },
    ];
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ response: { data: apiLines } }),
      }),
    ));

    const props = renderModal();
    const result = await props.fetchLines({
      base: '/api', headers: {}, docId: 'doc-remote', sharedContext: {},
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/purchase-invoice/lines?parentId=doc-remote&_startRow=0&_endRow=200',
      { headers: {} },
    );
    expect(result).toHaveLength(1);
    expect(result[0]._productName).toBe('Remote Product');
  });

  it('returns [] when fetch response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({ ok: false }),
    ));

    const props = renderModal();
    const result = await props.fetchLines({
      base: '/api', headers: {}, docId: 'doc-fail', sharedContext: {},
    });
    expect(result).toEqual([]);
  });

  it('returns [] when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('Network error'))));

    const props = renderModal();
    const result = await props.fetchLines({
      base: '/api', headers: {}, docId: 'doc-throw', sharedContext: {},
    });
    expect(result).toEqual([]);
  });
});

// ── fetchDocuments ────────────────────────────────────────────────────────────

describe('fetchDocuments', () => {
  afterEach(() => vi.unstubAllGlobals());

  const headers = { Authorization: 'Bearer tok' };

  function makeInvoice(overrides = {}) {
    return {
      id: 'inv-1',
      documentNo: 'INV-001',
      documentStatus: 'CO',
      businessPartner: 'bp-1',
      grandTotalAmount: 500,
      'businessPartner$_identifier': 'Supplier',
      invoiceDate: '2024-03-01',
      ...overrides,
    };
  }

  function stubFetch(invoices, linesByInvId = {}) {
    vi.stubGlobal('fetch', vi.fn((url) => {
      if (url.includes('/purchase-invoice/header')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ response: { data: invoices } }),
        });
      }
      // Lines endpoint: /purchase-invoice/lines?parentId=<id>&...
      const match = url.match(/parentId=([^&]+)/);
      const invId = match?.[1];
      const lines = linesByInvId[invId] || [];
      return Promise.resolve({
        ok: true,
        json: async () => ({ response: { data: lines } }),
      });
    }));
  }

  it('filters candidates by documentStatus=CO, businessPartner, and grandTotalAmount>=0', async () => {
    const invoices = [
      makeInvoice({ id: 'inv-1', documentStatus: 'CO', businessPartner: 'bp-1' }),
      makeInvoice({ id: 'inv-2', documentStatus: 'DR', businessPartner: 'bp-1' }), // draft
      makeInvoice({ id: 'inv-3', documentStatus: 'CO', businessPartner: 'bp-other' }), // wrong bp
      makeInvoice({ id: 'inv-4', documentStatus: 'CO', businessPartner: 'bp-1', grandTotalAmount: -1 }), // negative
    ];
    const pendingLine = { id: 'l1', invoicedQuantity: 3, goodsShipmentLine: null };
    stubFetch(invoices, {
      'inv-1': [pendingLine],
      'inv-2': [],
      'inv-3': [pendingLine],
      'inv-4': [pendingLine],
    });

    const props = renderModal();
    const { documents } = await props.fetchDocuments({ base: '/api', headers, bpId: 'bp-1' });

    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe('inv-1');
  });

  it('excludes invoices where ALL lines are already imported', async () => {
    const fullyImported = makeInvoice({ id: 'inv-full' });
    const partiallyImported = makeInvoice({ id: 'inv-partial' });
    const fullyImportedLines = [
      { id: 'l1', invoicedQuantity: 5, goodsShipmentLine: 'gsl-1' },
      { id: 'l2', invoicedQuantity: 3, goodsShipmentLine: 'gsl-2' },
    ];
    const partialLines = [
      { id: 'l3', invoicedQuantity: 5, goodsShipmentLine: 'gsl-3' },
      { id: 'l4', invoicedQuantity: 2, goodsShipmentLine: null },
    ];
    stubFetch([fullyImported, partiallyImported], {
      'inv-full': fullyImportedLines,
      'inv-partial': partialLines,
    });

    const props = renderModal();
    const { documents } = await props.fetchDocuments({ base: '/api', headers, bpId: 'bp-1' });

    expect(documents).toHaveLength(1);
    expect(documents[0].id).toBe('inv-partial');
  });

  it('includes invoice when at least one line has invoicedQuantity > 0 and no goodsShipmentLine', async () => {
    const inv = makeInvoice({ id: 'inv-ok' });
    const lines = [{ id: 'l1', invoicedQuantity: 10, goodsShipmentLine: null }];
    stubFetch([inv], { 'inv-ok': lines });

    const props = renderModal();
    const { documents, sharedContext } = await props.fetchDocuments({ base: '/api', headers, bpId: 'bp-1' });

    expect(documents).toHaveLength(1);
    expect(sharedContext.linesCache['inv-ok']).toEqual(lines);
  });

  it('returns empty documents on non-ok header fetch', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false })));

    const props = renderModal();
    const { documents, sharedContext } = await props.fetchDocuments({ base: '/api', headers, bpId: 'bp-1' });

    expect(documents).toEqual([]);
    expect(sharedContext).toEqual({ linesCache: {} });
  });

  it('populates linesCache in sharedContext', async () => {
    const inv = makeInvoice({ id: 'inv-cache' });
    const lines = [{ id: 'l1', invoicedQuantity: 1, goodsShipmentLine: null }];
    stubFetch([inv], { 'inv-cache': lines });

    const props = renderModal();
    const { sharedContext } = await props.fetchDocuments({ base: '/api', headers, bpId: 'bp-1' });

    expect(sharedContext.linesCache['inv-cache']).toEqual(lines);
  });
});

// ── getDocDisplay ─────────────────────────────────────────────────────────────

describe('getDocDisplay', () => {
  it('returns docNo from documentNo and date from invoiceDate', () => {
    const props = renderModal();
    const result = props.getDocDisplay({ documentNo: 'INV-123', invoiceDate: '2024-01-15', id: 'fallback' });
    expect(result).toEqual({ docNo: 'INV-123', date: '2024-01-15' });
  });

  it('falls back to id when documentNo is absent', () => {
    const props = renderModal();
    const result = props.getDocDisplay({ id: 'inv-id', invoiceDate: '2024-02-01' });
    expect(result.docNo).toBe('inv-id');
  });

  it('returns undefined date when invoiceDate is absent', () => {
    const props = renderModal();
    const result = props.getDocDisplay({ documentNo: 'INV-X' });
    expect(result.date).toBeUndefined();
  });
});

// ── buildLineBody ─────────────────────────────────────────────────────────────

describe('buildLineBody', () => {
  it('returns the correct body shape', async () => {
    const props = renderModal();
    const line = { id: 'line-1', product: 'prod-1', uOM: 'uom-1' };
    const result = await props.buildLineBody({ line, qty: 3, invoiceId: 'receipt-5', lineNo: 10 });

    expect(result).toEqual({
      parentId: 'receipt-5',
      product: 'prod-1',
      movementQuantity: 3,
      uOM: 'uom-1',
      invoiceLineId: 'line-1',
      lineNo: 10,
    });
  });

  it('sets uOM=null when line.uOM is absent', async () => {
    const props = renderModal();
    const line = { id: 'line-2', product: 'prod-2' };
    const result = await props.buildLineBody({ line, qty: 1, invoiceId: 'receipt-6', lineNo: 20 });

    expect(result.uOM).toBeNull();
  });

  it('uses receiptId (invoiceId param) as parentId', async () => {
    const props = renderModal();
    const line = { id: 'l', product: 'p' };
    const result = await props.buildLineBody({ line, qty: 2, invoiceId: 'RECEIPT-ABC', lineNo: 30 });

    expect(result.parentId).toBe('RECEIPT-ABC');
  });

  it('sets invoiceLineId from line.id (not parentId)', async () => {
    const props = renderModal();
    const line = { id: 'source-line-id', product: 'p' };
    const result = await props.buildLineBody({ line, qty: 1, invoiceId: 'any-receipt', lineNo: 1 });

    expect(result.invoiceLineId).toBe('source-line-id');
  });
});
