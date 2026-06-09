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
  insertLinesTab,
  renderExtraActionButtons,
  getDetailContentContainerClassName,
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

describe('insertLinesTab', () => {
  it('falls back detailLabel -> detailEntity -> "Lines" for the label', () => {
    const a = [];
    insertLinesTab('My Label', 'Entity', { children: [] }, undefined, a);
    expect(a[0].label).toBe('My Label');

    const b = [];
    insertLinesTab('', 'Entity', { children: [] }, undefined, b);
    expect(b[0].label).toBe('Entity');

    const c = [];
    insertLinesTab(undefined, undefined, { children: [] }, undefined, c);
    expect(c[0].label).toBe('Lines');
  });

  it('sets count to hook.children.length', () => {
    const tabs = [];
    insertLinesTab('L', 'E', { children: [{}, {}, {}] }, undefined, tabs);
    expect(tabs[0].count).toBe(3);
  });

  it('sets count to 0 when children is empty or undefined', () => {
    const tabs = [];
    insertLinesTab('L', 'E', { children: [] }, undefined, tabs);
    expect(tabs[0].count).toBe(0);

    const tabs2 = [];
    insertLinesTab('L', 'E', {}, undefined, tabs2);
    expect(tabs2[0].count).toBe(0);
  });

  it('splices at a valid numeric detailTabIndex within [0, tabs.length]', () => {
    const tabs = [{ key: 'a' }, { key: 'b' }];
    insertLinesTab('L', 'E', { children: [] }, 1, tabs);
    expect(tabs.map((t) => t.key)).toEqual(['a', 'lines', 'b']);

    const atEnd = [{ key: 'a' }, { key: 'b' }];
    insertLinesTab('L', 'E', { children: [] }, 2, atEnd);
    expect(atEnd.map((t) => t.key)).toEqual(['a', 'b', 'lines']);
  });

  it('unshifts to the front for out-of-range or non-number index', () => {
    const negative = [{ key: 'a' }];
    insertLinesTab('L', 'E', { children: [] }, -1, negative);
    expect(negative.map((t) => t.key)).toEqual(['lines', 'a']);

    const tooBig = [{ key: 'a' }];
    insertLinesTab('L', 'E', { children: [] }, 5, tooBig);
    expect(tooBig.map((t) => t.key)).toEqual(['lines', 'a']);

    const nonNumber = [{ key: 'a' }];
    insertLinesTab('L', 'E', { children: [] }, undefined, nonNumber);
    expect(nonNumber.map((t) => t.key)).toEqual(['lines', 'a']);
  });

  it('mutates the tabs array in place (same reference) and returns nothing', () => {
    const tabs = [{ key: 'a' }];
    const result = insertLinesTab('L', 'E', { children: [] }, 0, tabs);
    expect(result).toBeUndefined();
    expect(tabs.length).toBe(2);
    expect(tabs[0].key).toBe('lines');
  });
});

describe('renderExtraActionButtons', () => {
  it('calls extraActions once with { data, children } when it is a function', () => {
    const data = { id: 'rec-1' };
    const hook = { children: [{ id: 'c1' }] };
    const extraActions = vi.fn(() => [{ key: 'x', label: 'X' }]);
    renderExtraActionButtons(extraActions, data, hook, 'save-cls');
    expect(extraActions).toHaveBeenCalledTimes(1);
    expect(extraActions).toHaveBeenCalledWith({ data, children: hook.children });
  });

  it('returns one entry per action', () => {
    const actions = [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }];
    const result = renderExtraActionButtons(actions, {}, { children: [] }, 'save-cls');
    expect(result).toHaveLength(2);
  });

  it('maps an action with visible === false to a falsy entry (not a Button)', () => {
    const actions = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B', visible: false },
    ];
    const result = renderExtraActionButtons(actions, {}, { children: [] }, 'save-cls');
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(false);
    expect(result.filter(Boolean)).toHaveLength(1);
  });

  it('result length equals input length (array form)', () => {
    const actions = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    const result = renderExtraActionButtons(actions, {}, { children: [] }, 'save-cls');
    expect(result.length).toBe(actions.length);
  });
});

describe('getDetailContentContainerClassName', () => {
  it('always starts with "flex-1 min-w-0 "', () => {
    const cls = getDetailContentContainerClassName(
      'readOnly', false, false, false, false, false, 'general',
    );
    expect(cls.startsWith('flex-1 min-w-0 ')).toBe(true);
  });

  it('includes the inlineEditable layout classes when linesLayout is inlineEditable', () => {
    const cls = getDetailContentContainerClassName(
      'inlineEditable', false, false, false, false, false, 'general',
    );
    expect(cls).toContain('flex flex-col overflow-y-auto');
    expect(cls).not.toContain('overflow-auto pb-6');
  });

  it('includes the default layout classes when linesLayout is not inlineEditable', () => {
    const cls = getDetailContentContainerClassName(
      'readOnly', false, false, false, false, false, 'general',
    );
    expect(cls).toContain('overflow-auto pb-6');
    expect(cls).not.toContain('flex flex-col overflow-y-auto');
  });

  it('appends " hidden" only when primaryTabs is truthy and activePrimaryTab !== "general"', () => {
    const hidden = getDetailContentContainerClassName(
      'readOnly', false, false, false, false, true, 'lines',
    );
    expect(hidden.endsWith(' hidden')).toBe(true);
  });

  it('does not append " hidden" when activePrimaryTab === "general"', () => {
    const cls = getDetailContentContainerClassName(
      'readOnly', false, false, false, false, true, 'general',
    );
    expect(cls).not.toContain(' hidden');
  });

  it('does not append " hidden" when primaryTabs is falsy', () => {
    const cls = getDetailContentContainerClassName(
      'readOnly', false, false, false, false, false, 'lines',
    );
    expect(cls).not.toContain(' hidden');
  });
});
