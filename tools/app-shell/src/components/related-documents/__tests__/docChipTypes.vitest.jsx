import { describe, it, expect, vi } from 'vitest';
import { docChipProps } from '../docChipTypes.jsx';
import { CHIP_ICONS, CHIP_COLORS } from '../constants.jsx';

// Mock translator returns deterministic strings so we can assert the helper
// performs the exact same ui()/STATUS_KEYS dance as the original hand-written
// JSX in each RelatedDocuments window.
function makeUi() {
  return vi.fn((key, params) => (params ? `${key}:${params.number}` : key));
}

describe('docChipProps — preserves exact props of each window call site', () => {
  // ===== order =====
  // Source: purchase-invoice/RelatedDocuments.jsx:56-69, also used in
  // payment-out/RelatedDocuments.jsx:76-88 with identical shape.
  describe('order', () => {
    it('matches the purchase-invoice / payment-out call site', () => {
      const ui = makeUi();
      const navigate = vi.fn();
      const po = {
        id: 'po-1',
        documentNo: 'PO-001',
        grandTotalAmount: 1500.5,
        'currency$_identifier': 'EUR',
        documentStatus: 'CO',
      };

      const props = docChipProps({ type: 'order', doc: po, ui, navigate });

      expect(props.icon).toBe(CHIP_ICONS.order);
      expect(props.iconColor).toBe(CHIP_COLORS.order);
      expect(props.title).toBe('orderDoc:PO-001');
      expect(props.amount).toBe(1500.5);
      expect(props.currency).toBe('EUR');
      expect(props.status).toBe('CO');
      expect(props.statusLabel).toBe('statusCompleted');

      props.onClick();
      expect(navigate).toHaveBeenCalledWith('/purchase-order/po-1');
    });

    // Source: goods-receipt/RelatedDocuments.jsx:32-42 — special case, no
    // documentNo (only an id + label from parent header), no amount, no status.
    it('matches the goods-receipt call site with title override and minimal doc', () => {
      const ui = makeUi();
      const navigate = vi.fn();
      const orderId = 'ord-99';
      const orderLabel = 'Sales Order Foo';

      const props = docChipProps({
        type: 'order',
        doc: { id: orderId },
        ui,
        navigate,
        title: orderLabel,
      });

      expect(props.icon).toBe(CHIP_ICONS.order);
      expect(props.iconColor).toBe(CHIP_COLORS.order);
      expect(props.title).toBe('Sales Order Foo');
      expect(props.amount).toBeUndefined();
      expect(props.currency).toBeUndefined();
      expect(props.status).toBeUndefined();
      expect(props.statusLabel).toBeUndefined();

      props.onClick();
      expect(navigate).toHaveBeenCalledWith('/purchase-order/ord-99');
    });

    it('falls back to ui(orderDoc, { number: id }) when label override is empty', () => {
      const ui = makeUi();
      const navigate = vi.fn();
      // Replicates goods-receipt's `title={orderLabel || ui('orderDoc', { number: orderId })}`
      // by passing `title: undefined` so the helper resolves via ui().
      const props = docChipProps({
        type: 'order',
        doc: { id: 'ord-7', documentNo: 'ord-7' },
        ui,
        navigate,
      });
      expect(props.title).toBe('orderDoc:ord-7');
    });
  });

  // ===== invoice =====
  // Source: purchase-order/RelatedDocuments.jsx:24-39 (RELATED_SPECS),
  // goods-receipt/RelatedDocuments.jsx:45-58, payment-out/RelatedDocuments.jsx:90-103
  describe('invoice', () => {
    it('matches the call sites in purchase-order / goods-receipt / payment-out', () => {
      const ui = makeUi();
      const navigate = vi.fn();
      const inv = {
        id: 'inv-1',
        documentNo: 'INV-001',
        grandTotalAmount: 2000,
        'currency$_identifier': 'USD',
        documentStatus: 'DR',
      };

      const props = docChipProps({ type: 'invoice', doc: inv, ui, navigate });

      expect(props.icon).toBe(CHIP_ICONS.invoice);
      expect(props.iconColor).toBe(CHIP_COLORS.invoice);
      expect(props.title).toBe('invoiceDoc:INV-001');
      expect(props.amount).toBe(2000);
      expect(props.currency).toBe('USD');
      expect(props.status).toBe('DR');
      expect(props.statusLabel).toBe('statusDraft');

      props.onClick();
      expect(navigate).toHaveBeenCalledWith('/purchase-invoice/inv-1');
    });
  });

  // ===== receipt =====
  // Default icon is 'shipment' (purchase-invoice/RelatedDocuments.jsx:73-85).
  // purchase-order's RELATED_SPECS uses 'receipt' icon (line 10-23), which is a
  // pre-existing divergence we preserve via an iconKey override at that call site.
  describe('receipt', () => {
    it('default uses shipment icon (matches purchase-invoice call site)', () => {
      const ui = makeUi();
      const navigate = vi.fn();
      const r = {
        id: 'r-1',
        documentNo: 'GR-001',
        documentStatus: 'CO',
      };

      const props = docChipProps({ type: 'receipt', doc: r, ui, navigate });

      expect(props.icon).toBe(CHIP_ICONS.shipment);
      expect(props.iconColor).toBe(CHIP_COLORS.shipment);
      expect(props.title).toBe('receiptDoc:GR-001');
      expect(props.amount).toBeUndefined();
      expect(props.currency).toBeUndefined();
      expect(props.status).toBe('CO');
      expect(props.statusLabel).toBe('statusCompleted');

      props.onClick();
      expect(navigate).toHaveBeenCalledWith('/goods-receipt/r-1');
    });

    it('iconKey override produces the pre-existing purchase-order receipt rendering', () => {
      const ui = makeUi();
      const navigate = vi.fn();
      const r = { id: 'r-2', documentNo: 'GR-002', documentStatus: 'CO' };

      const props = docChipProps({ type: 'receipt', doc: r, ui, navigate, iconKey: 'receipt' });

      expect(props.icon).toBe(CHIP_ICONS.receipt);
      expect(props.iconColor).toBe(CHIP_COLORS.receipt);
    });
  });

  // ===== payment =====
  // Source: purchase-invoice/RelatedDocuments.jsx:88-101, purchase-order/RelatedDocuments.jsx:106-119
  describe('payment', () => {
    it('matches the call sites in purchase-invoice / purchase-order', () => {
      const ui = makeUi();
      const navigate = vi.fn();
      const p = {
        id: 'pay-1',
        documentNo: 'PAY-001',
        amount: 500,
        'currency$_identifier': 'EUR',
        status: 'PPM',
      };

      const props = docChipProps({ type: 'payment', doc: p, ui, navigate });

      expect(props.icon).toBe(CHIP_ICONS.payment);
      expect(props.iconColor).toBe(CHIP_COLORS.payment);
      expect(props.title).toBe('paymentDoc:PAY-001');
      expect(props.amount).toBe(500);
      expect(props.currency).toBe('EUR');
      expect(props.status).toBe('PPM');
      expect(props.statusLabel).toBe('statusPaid');

      props.onClick();
      expect(navigate).toHaveBeenCalledWith('/payment-out/pay-1');
    });

    it('falls back to id when documentNo is missing (preserves p.documentNo || p.id)', () => {
      const ui = makeUi();
      const navigate = vi.fn();
      const p = { id: 'pay-2', amount: 100, 'currency$_identifier': 'EUR', status: 'PWNC' };

      const props = docChipProps({ type: 'payment', doc: p, ui, navigate });

      expect(props.title).toBe('paymentDoc:pay-2');
      expect(props.statusLabel).toBe('statusPending');
    });
  });

  // ===== status fallback =====
  it('passes raw status code through ui() when not in STATUS_KEYS', () => {
    const ui = makeUi();
    const navigate = vi.fn();
    const doc = {
      id: 'x',
      documentNo: 'X-1',
      grandTotalAmount: 1,
      'currency$_identifier': 'EUR',
      documentStatus: 'XX_UNKNOWN',
    };

    const props = docChipProps({ type: 'order', doc, ui, navigate });

    expect(props.status).toBe('XX_UNKNOWN');
    expect(props.statusLabel).toBe('XX_UNKNOWN');
  });

  // ===== error path =====
  it('throws on unknown type so call-site typos fail loudly', () => {
    expect(() => docChipProps({
      type: 'unknown',
      doc: {},
      ui: () => '',
      navigate: () => {},
    })).toThrow(/Unknown DocChip type/);
  });
});
