import { describe, it, expect, vi } from 'vitest';

// Importing DetailView.jsx pulls in the whole component tree (router, i18n,
// hooks, sub-components, lib helpers). Mirror the mocks used by
// DetailView.calloutHelpers.vitest.js so the module loads in isolation and we
// can import the extracted pure helpers directly.
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
  useLocation: () => ({ pathname: '/test/123', search: '', hash: '' }),
}));

vi.mock('@/i18n', () => ({
  useLabel: () => (key) => key,
  useMenuLabel: () => (key) => key,
  useUI: () => (key) => key,
  useLocale: () => ({}),
  useLocaleSwitch: () => ({ locale: 'en_US', setLocale: vi.fn() }),
}));

vi.mock('@/hooks/useEntity', () => ({
  useEntity: () => ({ handleChange: vi.fn() }),
}));

vi.mock('@/hooks/useCatalogs', () => ({
  useCatalogs: () => ({ catalogs: {}, catalogsLoaded: true }),
}));

vi.mock('@/hooks/useDisplayLogic', () => ({
  useDisplayLogic: () => ({}),
}));

vi.mock('@/hooks/useCallout', () => ({
  useCallout: () => ({
    calloutResult: null,
    calloutLoading: false,
    executeCallout: vi.fn(),
  }),
}));

vi.mock('@/hooks/useLineGrossAmount', () => ({
  useLineGrossAmount: () => ({ grossAmount: 0, computeGrossAmount: vi.fn() }),
  ORDER_LINE_CONFIG: { quantityField: 'orderedQuantity', priceField: 'unitPrice' },
}));

vi.mock('@/hooks/useDocumentAction', () => ({
  useDocumentAction: () => ({ execute: vi.fn(), loading: false }),
}));

vi.mock('@/components/layout/PageMetaContext', () => ({
  useSetPageMeta: () => vi.fn(),
}));

vi.mock('@/components/layout/FavoritesContext', () => ({
  useFavorites: () => ({ isFavorite: () => false, toggleFavorite: vi.fn() }),
}));

vi.mock('../SummaryBar.jsx', () => ({
  SummaryBar: () => null,
}));

vi.mock('../DocumentTotalsPanel.jsx', () => ({ default: () => null }));
vi.mock('../DocumentStatusPill.jsx', () => ({ default: () => null }));
vi.mock('../DocumentPrintDrawer.jsx', () => ({ default: () => null }));

vi.mock('@/lib/resolveIdentifier.js', () => ({
  resolveIdentifier: (data, key) => data?.[key + '$_identifier'] ?? data?.[key] ?? '',
}));

vi.mock('@/lib/lineFieldChange.js', () => ({
  buildCalloutFormState: vi.fn(() => ({})),
  extractAuxValues: vi.fn(() => ({})),
  normalizeCalloutQty: vi.fn(),
  normalizeCalloutResponse: vi.fn(() => ({})),
  applyQtyZeroGuard: vi.fn(),
  roundAmounts: vi.fn((v) => v),
  resolveSnapshotIdentifiers: vi.fn(() => ({})),
}));

vi.mock('@/lib/selectorCatalog.js', () => ({
  getCatalogOptions: () => [],
}));

vi.mock('@/lib/formatAmount.js', () => ({
  formatAmount: (val) => (val != null ? String(val) : ''),
}));

vi.mock('@/lib/utils.js', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

import {
  mergeSelectorContextFields,
  mergeSelectorAuxFields,
  applyLocalChildRowUpdate,
  collectRowFieldValues,
  getSecondaryTabContentClassName,
  getSecondaryLinesTableRef,
  getSecondaryEditRowHandler,
  getSecondarySelectionChangeHandler,
} from '../DetailView.jsx';

describe('mergeSelectorContextFields', () => {
  it('maps standardPrice to gross keys when isTaxIncluded is undefined', () => {
    const snapshot = {};
    mergeSelectorContextFields({ standardPrice: 10 }, snapshot, 'product');
    expect(snapshot.grossUnitPrice).toBe(10);
    expect(snapshot.grossListPrice).toBe(10);
    expect(snapshot.unitPrice).toBeUndefined();
    expect(snapshot.listPrice).toBeUndefined();
  });

  it('maps standardPrice to gross keys when isTaxIncluded is true', () => {
    const snapshot = {};
    mergeSelectorContextFields({ standardPrice: 25, isTaxIncluded: true }, snapshot, 'product');
    expect(snapshot.grossUnitPrice).toBe(25);
    expect(snapshot.grossListPrice).toBe(25);
  });

  it('maps standardPrice to net keys when isTaxIncluded is false', () => {
    const snapshot = {};
    mergeSelectorContextFields({ standardPrice: 30, isTaxIncluded: false }, snapshot, 'product');
    expect(snapshot.unitPrice).toBe(30);
    expect(snapshot.listPrice).toBe(30);
    expect(snapshot.grossUnitPrice).toBeUndefined();
    expect(snapshot.grossListPrice).toBeUndefined();
  });

  it('does not map standardPrice when it is null', () => {
    const snapshot = {};
    mergeSelectorContextFields({ standardPrice: null }, snapshot, 'product');
    expect(snapshot.grossUnitPrice).toBeUndefined();
    expect(snapshot.unitPrice).toBeUndefined();
    expect('product_standardPrice' in snapshot).toBe(false);
  });

  it('skips reserved keys (id, label, name, searchKey, _aux)', () => {
    const snapshot = {};
    mergeSelectorContextFields(
      { id: 'X1', label: 'L', name: 'N', searchKey: 'SK', _aux: { _UOM: 'EA' } },
      snapshot,
      'product',
    );
    expect(snapshot).toEqual({});
  });

  it('skips object and null values', () => {
    const snapshot = {};
    mergeSelectorContextFields({ nested: { a: 1 }, ref: null }, snapshot, 'product');
    expect(snapshot).toEqual({});
  });

  it('maps a scalar field to `${fieldKey}_${topField}`', () => {
    const snapshot = {};
    mergeSelectorContextFields({ uomCode: 'EA', active: true }, snapshot, 'product');
    expect(snapshot.product_uomCode).toBe('EA');
    expect(snapshot.product_active).toBe(true);
  });

  it('does not overwrite an existing ctxKey', () => {
    const snapshot = { product_uomCode: 'KEEP' };
    mergeSelectorContextFields({ uomCode: 'NEW' }, snapshot, 'product');
    expect(snapshot.product_uomCode).toBe('KEEP');
  });
});

describe('mergeSelectorAuxFields', () => {
  it('folds _aux suffixes with the fieldKey prefix', () => {
    const snapshot = {};
    mergeSelectorAuxFields(
      { _aux: { _PSTD: 5, _PLIM: 8, _UOM: 'EA' } },
      snapshot,
      'product',
    );
    expect(snapshot.product_PSTD).toBe(5);
    expect(snapshot.product_PLIM).toBe(8);
    expect(snapshot.product_UOM).toBe('EA');
  });

  it('is a no-op when _aux is missing', () => {
    const snapshot = { existing: 1 };
    mergeSelectorAuxFields({ standardPrice: 10 }, snapshot, 'product');
    expect(snapshot).toEqual({ existing: 1 });
  });
});

describe('applyLocalChildRowUpdate', () => {
  it('calls hook.handleUpdateChild with row.id and the merged update', () => {
    const hook = { handleUpdateChild: vi.fn() };
    applyLocalChildRowUpdate(
      { tax: 'T1' },
      'product',
      'P1',
      {},
      undefined,
      hook,
      { id: 'row-1' },
    );
    expect(hook.handleUpdateChild).toHaveBeenCalledWith('row-1', {
      tax: 'T1',
      product: 'P1',
    });
  });

  it('includes unitPrice only when fieldValues.unitPrice is defined', () => {
    const hook = { handleUpdateChild: vi.fn() };
    applyLocalChildRowUpdate({}, 'product', 'P1', { unitPrice: 12 }, undefined, hook, { id: 'row-2' });
    expect(hook.handleUpdateChild).toHaveBeenCalledWith('row-2', {
      product: 'P1',
      unitPrice: 12,
    });
  });

  it('omits unitPrice when fieldValues.unitPrice is undefined', () => {
    const hook = { handleUpdateChild: vi.fn() };
    applyLocalChildRowUpdate({}, 'product', 'P1', {}, undefined, hook, { id: 'row-3' });
    const [, update] = hook.handleUpdateChild.mock.calls[0];
    expect('unitPrice' in update).toBe(false);
  });

  it('adds the $_identifier key only when opts.identifier is defined', () => {
    const hook = { handleUpdateChild: vi.fn() };
    applyLocalChildRowUpdate({}, 'product', 'P1', {}, { identifier: 'Widget' }, hook, { id: 'row-4' });
    expect(hook.handleUpdateChild).toHaveBeenCalledWith('row-4', {
      product: 'P1',
      'product$_identifier': 'Widget',
    });
  });

  it('does not add a $_identifier key when opts is undefined', () => {
    const hook = { handleUpdateChild: vi.fn() };
    applyLocalChildRowUpdate({}, 'product', 'P1', {}, undefined, hook, { id: 'row-5' });
    const [, update] = hook.handleUpdateChild.mock.calls[0];
    expect('product$_identifier' in update).toBe(false);
  });

  it('does not throw when the hook has no handleUpdateChild', () => {
    expect(() =>
      applyLocalChildRowUpdate({}, 'product', 'P1', {}, undefined, {}, { id: 'row-6' }),
    ).not.toThrow();
  });
});

describe('collectRowFieldValues', () => {
  it('skips keys ending in $_identifier', () => {
    const fieldValues = {};
    collectRowFieldValues({ 'product$_identifier': 'Widget' }, fieldValues, (v) => v);
    expect(fieldValues).toEqual({});
  });

  it('skips internal markers and metadata keys', () => {
    const fieldValues = {};
    collectRowFieldValues(
      { _identifier: 'x', _entityName: 'OrderLine', $ref: 'r', id: 'row-1', qty: 3 },
      fieldValues,
      (v) => v,
    );
    expect(fieldValues).toEqual({ qty: 3 });
  });

  it('applies coerce to each remaining value', () => {
    const fieldValues = {};
    const coerce = vi.fn((v) => `c:${v}`);
    collectRowFieldValues({ qty: 3, price: 10 }, fieldValues, coerce);
    expect(coerce).toHaveBeenCalledWith(3);
    expect(coerce).toHaveBeenCalledWith(10);
    expect(fieldValues).toEqual({ qty: 'c:3', price: 'c:10' });
  });
});

describe('getSecondaryTabContentClassName', () => {
  it('appends pointer-events-none when embedded is true', () => {
    expect(getSecondaryTabContentClassName('pt-4', true)).toBe(
      'pt-4 flex flex-col gap-3 pointer-events-none',
    );
  });

  it('omits pointer-events-none when embedded is false', () => {
    expect(getSecondaryTabContentClassName('pt-4', false)).toBe('pt-4 flex flex-col gap-3');
  });
});

describe('getSecondaryLinesTableRef', () => {
  it('calls the getter with st.key when layout is inlineEditable', () => {
    const getRef = vi.fn(() => ({ current: null }));
    const result = getSecondaryLinesTableRef('inlineEditable', getRef, { key: 'lines' });
    expect(getRef).toHaveBeenCalledWith('lines');
    expect(result).toEqual({ current: null });
  });

  it('returns undefined for non-inlineEditable layouts', () => {
    const getRef = vi.fn();
    expect(getSecondaryLinesTableRef('readOnly', getRef, { key: 'lines' })).toBeUndefined();
    expect(getRef).not.toHaveBeenCalled();
  });
});

describe('getSecondaryEditRowHandler', () => {
  it('returns a handler that opens the custom modal when customAddModal is set', () => {
    const setCustomModalState = vi.fn();
    const handler = getSecondaryEditRowHandler(
      { key: 'address', customAddModal: () => null },
      setCustomModalState,
    );
    expect(typeof handler).toBe('function');
    handler({ id: 'row-7' });
    expect(setCustomModalState).toHaveBeenCalledWith({ key: 'address', rowId: 'row-7' });
  });

  it('returns undefined when customAddModal is not set', () => {
    expect(getSecondaryEditRowHandler({ key: 'lines' }, vi.fn())).toBeUndefined();
  });
});

describe('getSecondarySelectionChangeHandler', () => {
  it('returns a handler that merges rows under st.key when layout is inlineEditable', () => {
    const setSecondarySelectedRows = vi.fn();
    const handler = getSecondarySelectionChangeHandler(
      'inlineEditable',
      setSecondarySelectedRows,
      { key: 'lines' },
    );
    expect(typeof handler).toBe('function');
    handler(['r1', 'r2']);
    expect(setSecondarySelectedRows).toHaveBeenCalledTimes(1);
    const updater = setSecondarySelectedRows.mock.calls[0][0];
    expect(updater({ other: ['x'] })).toEqual({ other: ['x'], lines: ['r1', 'r2'] });
  });

  it('returns undefined for non-inlineEditable layouts', () => {
    expect(
      getSecondarySelectionChangeHandler('readOnly', vi.fn(), { key: 'lines' }),
    ).toBeUndefined();
  });
});
