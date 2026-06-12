import { nonBlank, toIsoDate, buildTaxSearchTerm, buildLineOps } from '../purchaseInvoiceDescriptor';

// Only test exported pure functions — no network calls, no popups.

describe('purchaseInvoiceDescriptor', () => {
  describe('nonBlank', () => {
    it('returns true for non-empty strings', () => {
      expect(nonBlank('hello')).toBe(true);
      expect(nonBlank('0')).toBe(true);
    });

    it('returns false for null, undefined, empty, whitespace', () => {
      expect(nonBlank(null)).toBe(false);
      expect(nonBlank(undefined)).toBe(false);
      expect(nonBlank('')).toBe(false);
      expect(nonBlank('   ')).toBe(false);
    });

    it('handles numbers', () => {
      expect(nonBlank(0)).toBe(true);
      expect(nonBlank(123)).toBe(true);
    });
  });

  describe('toIsoDate', () => {
    it('returns null for falsy input', () => {
      expect(toIsoDate(null)).toBeNull();
      expect(toIsoDate('')).toBeNull();
      expect(toIsoDate(undefined)).toBeNull();
    });

    it('returns ISO dates as-is', () => {
      expect(toIsoDate('2024-03-15')).toBe('2024-03-15');
    });

    it('converts dd/mm/yyyy to ISO', () => {
      expect(toIsoDate('15/03/2024')).toBe('2024-03-15');
    });

    it('converts d-m-yyyy to ISO with padding', () => {
      expect(toIsoDate('5-3-2024')).toBe('2024-03-05');
    });

    it('handles two-digit years', () => {
      expect(toIsoDate('01/06/24')).toBe('2024-06-01');
    });

    it('returns unparseable strings as-is', () => {
      expect(toIsoDate('not a date')).toBe('not a date');
    });
  });

  describe('buildTaxSearchTerm', () => {
    it('returns tax_label when present', () => {
      expect(buildTaxSearchTerm({ tax_label: 'IVA 21%', tax_rate: 21 })).toBe('IVA 21%');
    });

    it('returns rate% when label is empty', () => {
      expect(buildTaxSearchTerm({ tax_label: '', tax_rate: 21 })).toBe('21%');
    });

    it('returns null when no label or rate', () => {
      expect(buildTaxSearchTerm({})).toBeNull();
      expect(buildTaxSearchTerm({ tax_label: '', tax_rate: null })).toBeNull();
    });

    it('handles zero rate', () => {
      expect(buildTaxSearchTerm({ tax_rate: 0 })).toBe('0%');
    });

    it('returns null for NaN rate', () => {
      expect(buildTaxSearchTerm({ tax_rate: 'abc' })).toBeNull();
    });

    it('trims label whitespace', () => {
      expect(buildTaxSearchTerm({ tax_label: '  Exento  ' })).toBe('Exento');
    });
  });

  describe('buildLineOps', () => {
    const lines = [
      { description: 'Widget A', quantity: 2, unit_price: 10.5 },
      { description: 'Widget B', quantity: 1, unit_price: 20 },
      { description: 'Unmatched line' },
    ];
    const productByIdx = { 0: 'PROD1', 1: 'PROD2' }; // line 2 has no product

    it('creates line ops for matched products', () => {
      const { lineOps, unmatched } = buildLineOps(lines, productByIdx);
      expect(lineOps).toHaveLength(2);
      expect(lineOps[0].body.product).toBe('PROD1');
      expect(lineOps[0].body.invoicedQuantity).toBe(2);
      expect(lineOps[0].body.unitPrice).toBe(10.5);
      expect(lineOps[0].body.listPrice).toBe(10.5);
      expect(lineOps[0].entity).toBe('Lines');
      expect(lineOps[0].parentRef).toBe('inv');
    });

    it('collects unmatched descriptions', () => {
      const { unmatched } = buildLineOps(lines, productByIdx);
      expect(unmatched).toEqual(['Unmatched line']);
    });

    it('sets tax when taxByIdx is provided', () => {
      const taxByIdx = { 0: 'TAX1' };
      const { lineOps } = buildLineOps(lines, productByIdx, taxByIdx);
      expect(lineOps[0].body.tax).toBe('TAX1');
      expect(lineOps[1].body.tax).toBeUndefined();
    });

    it('returns empty arrays for no lines', () => {
      const { lineOps, unmatched } = buildLineOps([], {});
      expect(lineOps).toHaveLength(0);
      expect(unmatched).toHaveLength(0);
    });

    it('sets description on line body', () => {
      const { lineOps } = buildLineOps(lines, productByIdx);
      expect(lineOps[0].body.description).toBe('Widget A');
    });

    it('generates sequential ids', () => {
      const { lineOps } = buildLineOps(lines, productByIdx);
      expect(lineOps[0].id).toBe('ln0');
      expect(lineOps[1].id).toBe('ln1');
    });
  });
});
