import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// CATEGORY_MAP mirrors the mapping in PendingTasksRail.jsx (taskKey → subject/state i18n keys + badge category).
// Kept in sync with the component — if a new taskKey is added there, add it here too.
const CATEGORY_MAP = {
  overdueInvoices:               { category: 'sales',       subjectKey: 'pendingSubjectSalesInvoices', stateKey: 'pendingStateOverdue'  },
  overdueInvoices_plural:        { category: 'sales',       subjectKey: 'pendingSubjectSalesInvoices', stateKey: 'pendingStateOverdue'  },
  pendingSalesDeliveries:        { category: 'sales',       subjectKey: 'pendingSubjectShipments',     stateKey: 'pendingStatePending'  },
  pendingSalesDeliveries_plural: { category: 'sales',       subjectKey: 'pendingSubjectShipments',     stateKey: 'pendingStatePending'  },
  collectionsDueToday:           { category: 'collections', subjectKey: 'pendingSubjectCollections',   stateKey: 'pendingStateDueToday' },
  collectionsDueToday_plural:    { category: 'collections', subjectKey: 'pendingSubjectCollections',   stateKey: 'pendingStateDueToday' },
  paymentsDueToday:              { category: 'payments',    subjectKey: 'pendingSubjectPayments',      stateKey: 'pendingStateDueToday' },
  paymentsDueToday_plural:       { category: 'payments',    subjectKey: 'pendingSubjectPayments',      stateKey: 'pendingStateDueToday' },
  pendingReceptions:             { category: 'purchases',   subjectKey: 'pendingSubjectReceptions',    stateKey: 'pendingStatePending'  },
  pendingReceptions_plural:      { category: 'purchases',   subjectKey: 'pendingSubjectReceptions',    stateKey: 'pendingStatePending'  },
  lowStockAlert:                 { category: 'stock',       subjectKey: 'pendingSubjectStock',         stateKey: 'pendingStateLowStock' },
  lowStockAlerts:                { category: 'stock',       subjectKey: 'pendingSubjectStock',         stateKey: 'pendingStateLowStock' },
};

const STATUS_BADGE_STYLES = {
  sales:       { backgroundColor: '#FEF0F4', color: '#D50B3E', borderColor: '#FBB1C4' },
  collections: { backgroundColor: '#FFF9EB', color: '#8A6100', borderColor: '#FFDA85' },
  payments:    { backgroundColor: '#FFF9EB', color: '#8A6100', borderColor: '#FFDA85' },
  purchases:   { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' },
  stock:       { backgroundColor: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA' },
  other:       { backgroundColor: '#F5F7F9', color: '#6C6C89', borderColor: '#E8EAEF' },
};

function resolveTaskMeta(task) {
  const key = task.taskKey;
  const meta = key && CATEGORY_MAP[key];
  if (meta) return meta;
  return { category: 'other', subjectKey: null, stateKey: null };
}

describe('PendingTasksRail — CATEGORY_MAP completeness', () => {
  const KNOWN_TASK_KEYS = Object.keys(CATEGORY_MAP);

  it('has exactly 12 task keys (6 singular + 6 plural)', () => {
    assert.equal(KNOWN_TASK_KEYS.length, 12);
  });

  for (const key of KNOWN_TASK_KEYS) {
    it(`"${key}" has category, subjectKey, and stateKey`, () => {
      const meta = CATEGORY_MAP[key];
      assert.ok(meta.category, `${key}.category is empty`);
      assert.ok(meta.subjectKey, `${key}.subjectKey is empty`);
      assert.ok(meta.stateKey, `${key}.stateKey is empty`);
    });
  }

  it('plural variants share the same category/keys as their singular counterpart', () => {
    const singularKeys = KNOWN_TASK_KEYS.filter(k => !k.endsWith('_plural'));
    for (const key of singularKeys) {
      const pluralKey = `${key}_plural`;
      if (!CATEGORY_MAP[pluralKey]) continue;
      assert.equal(CATEGORY_MAP[key].category,   CATEGORY_MAP[pluralKey].category,   `${key} vs ${pluralKey} category mismatch`);
      assert.equal(CATEGORY_MAP[key].subjectKey, CATEGORY_MAP[pluralKey].subjectKey, `${key} vs ${pluralKey} subjectKey mismatch`);
      assert.equal(CATEGORY_MAP[key].stateKey,   CATEGORY_MAP[pluralKey].stateKey,   `${key} vs ${pluralKey} stateKey mismatch`);
    }
  });
});

describe('PendingTasksRail — resolveTaskMeta fallback', () => {
  it('returns "other" category for an unknown taskKey', () => {
    const meta = resolveTaskMeta({ taskKey: 'unknownTask' });
    assert.equal(meta.category, 'other');
    assert.equal(meta.subjectKey, null);
    assert.equal(meta.stateKey, null);
  });

  it('returns "other" category when taskKey is absent', () => {
    assert.equal(resolveTaskMeta({}).category, 'other');
  });

  it('resolves overdueInvoices → sales / pendingSubjectSalesInvoices / pendingStateOverdue', () => {
    const meta = resolveTaskMeta({ taskKey: 'overdueInvoices' });
    assert.equal(meta.category, 'sales');
    assert.equal(meta.subjectKey, 'pendingSubjectSalesInvoices');
    assert.equal(meta.stateKey, 'pendingStateOverdue');
  });

  it('resolves collectionsDueToday → collections / pendingStateDueToday', () => {
    const meta = resolveTaskMeta({ taskKey: 'collectionsDueToday' });
    assert.equal(meta.category, 'collections');
    assert.equal(meta.stateKey, 'pendingStateDueToday');
  });

  it('resolves paymentsDueToday → payments / pendingStateDueToday', () => {
    const meta = resolveTaskMeta({ taskKey: 'paymentsDueToday' });
    assert.equal(meta.category, 'payments');
    assert.equal(meta.stateKey, 'pendingStateDueToday');
  });

  it('resolves lowStockAlert → stock / pendingStateLowStock', () => {
    const meta = resolveTaskMeta({ taskKey: 'lowStockAlert' });
    assert.equal(meta.category, 'stock');
    assert.equal(meta.stateKey, 'pendingStateLowStock');
  });

  it('resolves pendingReceptions_plural → purchases / pendingStatePending', () => {
    const meta = resolveTaskMeta({ taskKey: 'pendingReceptions_plural' });
    assert.equal(meta.category, 'purchases');
    assert.equal(meta.stateKey, 'pendingStatePending');
  });
});

describe('PendingTasksRail — STATUS_BADGE_STYLES Figma palette', () => {
  const EXPECTED_CATEGORIES = ['sales', 'collections', 'payments', 'purchases', 'stock', 'other'];

  it('has all 6 required category styles', () => {
    for (const cat of EXPECTED_CATEGORIES) {
      assert.ok(STATUS_BADGE_STYLES[cat], `Missing style for category: ${cat}`);
    }
  });

  it('every style has backgroundColor, color, and borderColor', () => {
    for (const [cat, style] of Object.entries(STATUS_BADGE_STYLES)) {
      assert.ok(style.backgroundColor, `${cat}.backgroundColor is empty`);
      assert.ok(style.color, `${cat}.color is empty`);
      assert.ok(style.borderColor, `${cat}.borderColor is empty`);
    }
  });

  it('sales uses Figma red palette (#FEF0F4 / #D50B3E / #FBB1C4)', () => {
    assert.equal(STATUS_BADGE_STYLES.sales.backgroundColor, '#FEF0F4');
    assert.equal(STATUS_BADGE_STYLES.sales.color, '#D50B3E');
    assert.equal(STATUS_BADGE_STYLES.sales.borderColor, '#FBB1C4');
  });

  it('collections uses Figma amber palette (#FFF9EB / #8A6100 / #FFDA85)', () => {
    assert.equal(STATUS_BADGE_STYLES.collections.backgroundColor, '#FFF9EB');
    assert.equal(STATUS_BADGE_STYLES.collections.color, '#8A6100');
    assert.equal(STATUS_BADGE_STYLES.collections.borderColor, '#FFDA85');
  });

  it('payments shares the same palette as collections', () => {
    assert.deepStrictEqual(STATUS_BADGE_STYLES.payments, STATUS_BADGE_STYLES.collections);
  });

  it('purchases uses Figma blue palette (#EFF6FF / #1D4ED8 / #BFDBFE)', () => {
    assert.equal(STATUS_BADGE_STYLES.purchases.backgroundColor, '#EFF6FF');
    assert.equal(STATUS_BADGE_STYLES.purchases.color, '#1D4ED8');
    assert.equal(STATUS_BADGE_STYLES.purchases.borderColor, '#BFDBFE');
  });

  it('stock uses Figma orange palette (#FFF7ED / #C2410C / #FED7AA)', () => {
    assert.equal(STATUS_BADGE_STYLES.stock.backgroundColor, '#FFF7ED');
    assert.equal(STATUS_BADGE_STYLES.stock.color, '#C2410C');
    assert.equal(STATUS_BADGE_STYLES.stock.borderColor, '#FED7AA');
  });

  it('other (fallback) uses Figma gray palette (#F5F7F9 / #6C6C89 / #E8EAEF)', () => {
    assert.equal(STATUS_BADGE_STYLES.other.backgroundColor, '#F5F7F9');
    assert.equal(STATUS_BADGE_STYLES.other.color, '#6C6C89');
    assert.equal(STATUS_BADGE_STYLES.other.borderColor, '#E8EAEF');
  });
});
