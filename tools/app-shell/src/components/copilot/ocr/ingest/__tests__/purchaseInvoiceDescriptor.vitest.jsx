import { nonBlank, toIsoDate, buildTaxSearchTerm, buildLineOps, findBp, resolveTaxesForLines, findTax } from '../purchaseInvoiceDescriptor';

// Mock simSearch and contactApi to test findBp/resolveTaxesForLines without network
vi.mock('../../../../../lib/simSearch.js', () => ({
  simSearch: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../contactApi.js', () => ({
  deriveContactsApiBase: (url) => url.replace(/\/[^/]+$/, '/contacts'),
}));

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

    it('uses fallback description for unmatched lines without description', () => {
      const noDescLines = [{ quantity: 1 }];
      const { unmatched } = buildLineOps(noDescLines, {});
      expect(unmatched[0]).toBe('line 1');
    });

    it('omits description when blank', () => {
      const blankLines = [{ description: '', quantity: 1, unit_price: 5 }];
      const { lineOps } = buildLineOps(blankLines, { 0: 'P1' });
      expect(lineOps[0].body.description).toBeUndefined();
    });

    it('omits quantity and price when blank', () => {
      const noQtyLines = [{ description: 'Item' }];
      const { lineOps } = buildLineOps(noQtyLines, { 0: 'P1' });
      expect(lineOps[0].body.invoicedQuantity).toBeUndefined();
      expect(lineOps[0].body.unitPrice).toBeUndefined();
    });
  });

  describe('findBp', () => {
    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns null when no apiBaseUrl or token', async () => {
      expect(await findBp({ token: null, apiBaseUrl: '/api', taxId: 'X' })).toBeNull();
      expect(await findBp({ token: 'tk', apiBaseUrl: '', taxId: 'X' })).toBeNull();
    });

    it('returns bp id when taxId matches exactly one', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: { data: [{ id: 'BP1' }] } }),
      });
      const result = await findBp({ token: 'tk', apiBaseUrl: '/api/purchase-invoice', taxId: '12345', name: 'Acme' });
      expect(result).toBe('BP1');
    });

    it('returns null when multiple matches (ambiguous)', async () => {
      globalThis.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ response: { data: [{ id: 'BP1' }, { id: 'BP2' }] } }),
      });
      const result = await findBp({ token: 'tk', apiBaseUrl: '/api/pi', taxId: 'X', name: 'Y' });
      expect(result).toBeNull();
    });

    it('falls back to name search when taxId is blank', async () => {
      // When taxId is blank, nonBlank returns false, so only name query fires
      globalThis.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => ({ response: { data: [{ id: 'BP_NAME' }] } }) });
      const result = await findBp({ token: 'tk', apiBaseUrl: '/api/pi', taxId: '', name: 'Acme' });
      expect(result).toBe('BP_NAME');
    });

    it('returns null on fetch error', async () => {
      globalThis.fetch.mockRejectedValue(new Error('network'));
      const result = await findBp({ token: 'tk', apiBaseUrl: '/api/pi', taxId: 'X' });
      expect(result).toBeNull();
    });

    it('returns null on non-ok response', async () => {
      globalThis.fetch.mockResolvedValue({ ok: false, status: 500 });
      const result = await findBp({ token: 'tk', apiBaseUrl: '/api/pi', taxId: 'X' });
      expect(result).toBeNull();
    });
  });

  describe('resolveTaxesForLines', () => {
    it('returns empty for no token', async () => {
      expect(await resolveTaxesForLines({ token: null, lines: [{}] })).toEqual([]);
    });

    it('returns empty for empty lines', async () => {
      expect(await resolveTaxesForLines({ token: 'tk', lines: [] })).toEqual([]);
    });

    it('returns null-filled array when all terms are empty', async () => {
      const result = await resolveTaxesForLines({ token: 'tk', lines: [{ tax_label: '', tax_rate: null }] });
      expect(result).toEqual([null]);
    });
  });

  describe('findTax', () => {
    it('returns null when no token', async () => {
      expect(await findTax({ token: null, value: 'IVA' })).toBeNull();
    });

    it('returns null when no term', async () => {
      expect(await findTax({ token: 'tk', value: '', extracted: {} })).toBeNull();
    });
  });
});
