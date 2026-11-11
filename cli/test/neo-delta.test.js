// @covers cli/src/lib/neo-delta.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  specNaturalKey,
  entityNaturalKey,
  fieldNaturalKey,
  pathFieldNaturalKey,
  computeWindowDelta,
  serializeDelta,
} from '../src/lib/neo-delta.js';

// ---------------------------------------------------------------------------
// Natural key helpers
// ---------------------------------------------------------------------------

describe('neo-delta natural keys', () => {
  it('specNaturalKey returns spec name as-is', () => {
    assert.equal(specNaturalKey('sales-order'), 'sales-order');
  });

  it('entityNaturalKey joins spec/tabId', () => {
    assert.equal(entityNaturalKey('sales-order', '100'), 'sales-order/100');
  });

  it('fieldNaturalKey joins spec/tabId/colId', () => {
    assert.equal(fieldNaturalKey('sales-order', '100', '200'), 'sales-order/100/200');
  });

  it('pathFieldNaturalKey joins spec/tabId/path:<propertyPath>', () => {
    assert.equal(pathFieldNaturalKey('remittance', '100', 'payment.status'), 'remittance/100/path:payment.status');
  });
});

// ---------------------------------------------------------------------------
// serializeDelta
// ---------------------------------------------------------------------------

describe('serializeDelta', () => {
  it('sorts row keys alphabetically with _naturalKey first', () => {
    const delta = {
      spec: 'test',
      tables: {
        ETGO_SF_SPEC: {
          upserts: [{ _naturalKey: 'test', Z_COL: 'z', A_COL: 'a', ETGO_SF_SPEC_ID: '1' }],
          deletes: [],
        },
        ETGO_SF_ENTITY: { upserts: [], deletes: [] },
        ETGO_SF_FIELD: { upserts: [], deletes: [] },
      },
    };
    const result = serializeDelta(delta);
    const keys = Object.keys(result.tables.ETGO_SF_SPEC.upserts[0]);
    assert.equal(keys[0], '_naturalKey');
    assert.equal(keys[1], 'A_COL');
    assert.equal(keys[2], 'ETGO_SF_SPEC_ID');
    assert.equal(keys[3], 'Z_COL');
  });

  it('sorts rows by _naturalKey', () => {
    const delta = {
      spec: 'test',
      tables: {
        ETGO_SF_SPEC: { upserts: [], deletes: [] },
        ETGO_SF_ENTITY: {
          upserts: [
            { _naturalKey: 'test/B', NAME: 'second' },
            { _naturalKey: 'test/A', NAME: 'first' },
          ],
          deletes: [],
        },
        ETGO_SF_FIELD: { upserts: [], deletes: [] },
      },
    };
    const result = serializeDelta(delta);
    assert.equal(result.tables.ETGO_SF_ENTITY.upserts[0]._naturalKey, 'test/A');
    assert.equal(result.tables.ETGO_SF_ENTITY.upserts[1]._naturalKey, 'test/B');
  });

  it('preserves table order: SPEC → ENTITY → FIELD', () => {
    const delta = {
      spec: 'test',
      tables: {
        ETGO_SF_FIELD: { upserts: [], deletes: [] },
        ETGO_SF_SPEC: { upserts: [], deletes: [] },
        ETGO_SF_ENTITY: { upserts: [], deletes: [] },
      },
    };
    const result = serializeDelta(delta);
    const tableKeys = Object.keys(result.tables);
    assert.deepEqual(tableKeys, ['ETGO_SF_SPEC', 'ETGO_SF_ENTITY', 'ETGO_SF_FIELD']);
  });
});

// ---------------------------------------------------------------------------
// computeWindowDelta
// ---------------------------------------------------------------------------

describe('computeWindowDelta', () => {
  const MODULE_ID = 'AABBCCDD11223344';

  function minimalDelta(overrides = {}) {
    return computeWindowDelta({
      specName: 'test-window',
      windowId: 'W001',
      moduleId: MODULE_ID,
      contract: {
        backendContract: {
          entities: {
            header: {
              tabId: 'T1',
              tabName: 'Header',
              tableName: 'C_Order',
              fields: [
                { name: 'documentNo', column: 'DocumentNo', visibility: 'readOnly' },
                { name: 'dateOrdered', column: 'DateOrdered', visibility: 'editable' },
              ],
            },
          },
        },
      },
      decisions: {},
      adTabs: [
        { ad_tab_id: 'T1', ad_table_id: 'TBL1', name: 'Header' },
      ],
      adColumns: [
        { ad_column_id: 'C1', ad_table_id: 'TBL1', columnname: 'DocumentNo' },
        { ad_column_id: 'C2', ad_table_id: 'TBL1', columnname: 'DateOrdered' },
        { ad_column_id: 'C3', ad_table_id: 'TBL1', columnname: 'AD_Client_ID' },
      ],
      prevSnapshot: { spec: [], entity: [], field: [] },
      ...overrides,
    });
  }

  it('produces spec upsert with correct shape', () => {
    const delta = minimalDelta();
    const specUpserts = delta.tables.ETGO_SF_SPEC.upserts;
    assert.equal(specUpserts.length, 1);
    assert.equal(specUpserts[0].NAME, 'test-window');
    assert.equal(specUpserts[0].SPEC_TYPE, 'W');
    assert.equal(specUpserts[0].AD_WINDOW_ID, 'W001');
    assert.equal(specUpserts[0].AD_MODULE_ID, MODULE_ID);
    assert.equal(specUpserts[0].ISACTIVE, 'Y');
  });

  it('creates entity upsert for each tab', () => {
    const delta = minimalDelta();
    const entities = delta.tables.ETGO_SF_ENTITY.upserts;
    assert.equal(entities.length, 1);
    assert.equal(entities[0].AD_TAB_ID, 'T1');
    assert.equal(entities[0].ISGET, 'Y');
    assert.equal(entities[0].ISPOST, 'Y');
  });

  it('excludes system columns by default', () => {
    const delta = minimalDelta();
    const fields = delta.tables.ETGO_SF_FIELD.upserts;
    const colIds = fields.map(f => f.AD_COLUMN_ID);
    assert.ok(!colIds.includes('C3'), 'AD_Client_ID (system column) should be excluded');
    assert.equal(fields.length, 2);
  });

  it('includes system columns when excludeSystemColumns=false', () => {
    // C3 must be an existing row (in prevSnapshot) so the live-push parity
    // filter does not prune it. New ISINCLUDED=N records are never created.
    const prevSnapshot = {
      spec:   [{ ETGO_SF_SPEC_ID: 'S1', NAME: 'test-window', ISACTIVE: 'Y' }],
      entity: [{ ETGO_SF_ENTITY_ID: 'E1', ETGO_SF_SPEC_ID: 'S1', AD_TAB_ID: 'T1', NAME: 'header' }],
      field:  [{ ETGO_SF_FIELD_ID: 'F3', ETGO_SF_ENTITY_ID: 'E1', AD_COLUMN_ID: 'C3' }],
    };
    const delta = minimalDelta({ excludeSystemColumns: false, prevSnapshot });
    const fields = delta.tables.ETGO_SF_FIELD.upserts;
    assert.equal(fields.length, 3);
    const c3 = fields.find(f => f.AD_COLUMN_ID === 'C3');
    assert.equal(c3.ISINCLUDED, 'N', 'system column not in contract → excluded');
  });

  it('does not create new ETGO_SF_FIELD records for non-contract fields', () => {
    // New field with ISINCLUDED=N must be pruned (live push never inserts these).
    const delta = minimalDelta({ excludeSystemColumns: false });
    const fields = delta.tables.ETGO_SF_FIELD.upserts;
    const colIds = fields.map(f => f.AD_COLUMN_ID);
    assert.ok(!colIds.includes('C3'), 'new non-contract column must not appear in upserts');
    assert.equal(fields.length, 2);
  });

  it('maps visibility correctly for contract fields', () => {
    const delta = minimalDelta();
    const fields = delta.tables.ETGO_SF_FIELD.upserts;
    const docNo = fields.find(f => f.AD_COLUMN_ID === 'C1');
    const dateOrdered = fields.find(f => f.AD_COLUMN_ID === 'C2');
    assert.equal(docNo.ISINCLUDED, 'Y');
    assert.equal(docNo.ISREADONLY, 'Y', 'readOnly field');
    assert.equal(dateOrdered.ISINCLUDED, 'Y');
    assert.equal(dateOrdered.ISREADONLY, 'N', 'editable field');
  });

  it('reuses prev-snapshot IDs for existing rows', () => {
    const delta = minimalDelta({
      prevSnapshot: {
        spec: [
          { ETGO_SF_SPEC_ID: 'EXISTING_SPEC_ID', NAME: 'test-window', ISACTIVE: 'Y' },
        ],
        entity: [
          {
            ETGO_SF_ENTITY_ID: 'EXISTING_ENTITY_ID',
            ETGO_SF_SPEC_ID: 'EXISTING_SPEC_ID',
            AD_TAB_ID: 'T1',
            NAME: 'header',
          },
        ],
        field: [
          {
            ETGO_SF_FIELD_ID: 'EXISTING_FIELD_ID',
            ETGO_SF_ENTITY_ID: 'EXISTING_ENTITY_ID',
            AD_COLUMN_ID: 'C1',
          },
        ],
      },
    });
    assert.equal(delta.tables.ETGO_SF_SPEC.upserts[0].ETGO_SF_SPEC_ID, 'EXISTING_SPEC_ID');
    assert.equal(delta.tables.ETGO_SF_ENTITY.upserts[0].ETGO_SF_ENTITY_ID, 'EXISTING_ENTITY_ID');
    const fieldC1 = delta.tables.ETGO_SF_FIELD.upserts.find(f => f.AD_COLUMN_ID === 'C1');
    assert.equal(fieldC1.ETGO_SF_FIELD_ID, 'EXISTING_FIELD_ID');
  });

  it('computes deletes for entities/fields removed from prev-snapshot', () => {
    const delta = minimalDelta({
      prevSnapshot: {
        spec: [
          { ETGO_SF_SPEC_ID: 'S1', NAME: 'test-window' },
        ],
        entity: [
          { ETGO_SF_ENTITY_ID: 'E1', ETGO_SF_SPEC_ID: 'S1', AD_TAB_ID: 'T1', NAME: 'header' },
          { ETGO_SF_ENTITY_ID: 'E_OLD', ETGO_SF_SPEC_ID: 'S1', AD_TAB_ID: 'T_REMOVED', NAME: 'old-tab' },
        ],
        field: [
          { ETGO_SF_FIELD_ID: 'F1', ETGO_SF_ENTITY_ID: 'E1', AD_COLUMN_ID: 'C1' },
          { ETGO_SF_FIELD_ID: 'F_OLD', ETGO_SF_ENTITY_ID: 'E_OLD', AD_COLUMN_ID: 'C_GONE' },
        ],
      },
    });
    assert.equal(delta.tables.ETGO_SF_ENTITY.deletes.length, 1);
    assert.equal(delta.tables.ETGO_SF_ENTITY.deletes[0].ETGO_SF_ENTITY_ID, 'E_OLD');
    assert.equal(delta.tables.ETGO_SF_FIELD.deletes.length, 1);
    assert.equal(delta.tables.ETGO_SF_FIELD.deletes[0].ETGO_SF_FIELD_ID, 'F_OLD');
  });

  it('spec deletes is always empty', () => {
    const delta = minimalDelta();
    assert.deepEqual(delta.tables.ETGO_SF_SPEC.deletes, []);
  });

  it('applies defaultExpr from decisions', () => {
    const delta = minimalDelta({
      decisions: {
        entities: {
          header: {
            name: 'header',
            fields: {
              dateOrdered: { defaultExpr: 'now()' },
            },
          },
        },
      },
    });
    const dateField = delta.tables.ETGO_SF_FIELD.upserts.find(f => f.AD_COLUMN_ID === 'C2');
    assert.equal(dateField.DEFAULTVALUE, 'now()');
  });

  it('resolves entity name from contract', () => {
    const delta = minimalDelta();
    const entity = delta.tables.ETGO_SF_ENTITY.upserts[0];
    assert.equal(entity.NAME, 'header');
  });

  it('uses javaQualifier from contract when present', () => {
    const delta = minimalDelta({
      contract: {
        backendContract: {
          entities: {
            header: {
              tabId: 'T1',
              tabName: 'Header',
              tableName: 'C_Order',
              javaQualifier: 'sales-order-header',
              fields: [
                { name: 'documentNo', column: 'DocumentNo', visibility: 'readOnly' },
              ],
            },
          },
        },
      },
    });
    const entity = delta.tables.ETGO_SF_ENTITY.upserts[0];
    assert.equal(entity.JAVA_QUALIFIER, 'sales-order-header');
  });

  it('emits PRECONDITIONS on the entity row when declared in decisions', () => {
    const preconditions = {
      '1000100': [{ field: 'documentNo', requiredWhen: 'always', message: 'required' }],
    };
    const delta = minimalDelta({
      decisions: {
        entities: {
          header: {
            name: 'header',
            preconditions,
          },
        },
      },
    });
    const entity = delta.tables.ETGO_SF_ENTITY.upserts[0];
    // Value is the JSON STRING the live UPDATE binds, not the raw object.
    assert.equal(entity.PRECONDITIONS, JSON.stringify(preconditions));
  });

  it('does not emit PRECONDITIONS when none are declared', () => {
    const delta = minimalDelta();
    const entity = delta.tables.ETGO_SF_ENTITY.upserts[0];
    assert.ok(!Object.hasOwn(entity, 'PRECONDITIONS'),
      'PRECONDITIONS must be absent when undeclared and no prev value existed');
  });

  it('does not emit PRECONDITIONS for an empty declaration', () => {
    const delta = minimalDelta({
      decisions: { entities: { header: { name: 'header', preconditions: {} } } },
    });
    const entity = delta.tables.ETGO_SF_ENTITY.upserts[0];
    assert.ok(!Object.hasOwn(entity, 'PRECONDITIONS'),
      'empty preconditions collapse to null → column not emitted');
  });

  it('emits PRECONDITIONS=null to clear a stale value from prev-snapshot', () => {
    // Prev XML row carried a PRECONDITIONS value but decisions no longer
    // declares any → the live push clears it, so the delta must too.
    const delta = minimalDelta({
      decisions: {},
      prevSnapshot: {
        spec:   [{ ETGO_SF_SPEC_ID: 'S1', NAME: 'test-window', ISACTIVE: 'Y' }],
        entity: [{
          ETGO_SF_ENTITY_ID: 'E1', ETGO_SF_SPEC_ID: 'S1', AD_TAB_ID: 'T1',
          NAME: 'header', PRECONDITIONS: '{"1000100":[]}',
        }],
        field:  [],
      },
    });
    const entity = delta.tables.ETGO_SF_ENTITY.upserts[0];
    assert.ok(Object.hasOwn(entity, 'PRECONDITIONS'),
      'clear must register as an explicit null');
    assert.equal(entity.PRECONDITIONS, null);
  });

  it('handles discarded visibility', () => {
    // Field must be in prevSnapshot so it is treated as existing — the filter
    // only prunes NEW records that would be ISINCLUDED=N.
    const delta = computeWindowDelta({
      specName: 'test',
      windowId: 'W1',
      moduleId: MODULE_ID,
      contract: {
        backendContract: {
          entities: {
            header: {
              tabId: 'T1',
              tabName: 'Header',
              tableName: 'TBL1',
              fields: [
                { name: 'hidden', column: 'HiddenCol', visibility: 'discarded' },
              ],
            },
          },
        },
      },
      decisions: {},
      adTabs: [{ ad_tab_id: 'T1', ad_table_id: 'TBL1', name: 'Header' }],
      adColumns: [{ ad_column_id: 'C1', ad_table_id: 'TBL1', columnname: 'HiddenCol' }],
      prevSnapshot: {
        spec:   [{ ETGO_SF_SPEC_ID: 'S1', NAME: 'test', ISACTIVE: 'Y' }],
        entity: [{ ETGO_SF_ENTITY_ID: 'E1', ETGO_SF_SPEC_ID: 'S1', AD_TAB_ID: 'T1', NAME: 'header' }],
        field:  [{ ETGO_SF_FIELD_ID: 'F1', ETGO_SF_ENTITY_ID: 'E1', AD_COLUMN_ID: 'C1' }],
      },
    });
    const field = delta.tables.ETGO_SF_FIELD.upserts[0];
    assert.equal(field.ISINCLUDED, 'N', 'discarded → ISINCLUDED=N');
  });

  it('multi-tab produces multiple entities with correct sequence', () => {
    const delta = computeWindowDelta({
      specName: 'multi',
      windowId: 'W1',
      moduleId: MODULE_ID,
      contract: {
        backendContract: {
          entities: {
            header: { tabId: 'T1', tabName: 'Header', fields: [] },
            lines: { tabId: 'T2', tabName: 'Lines', fields: [] },
          },
        },
      },
      decisions: {},
      adTabs: [
        { ad_tab_id: 'T1', ad_table_id: 'TBL1', name: 'Header' },
        { ad_tab_id: 'T2', ad_table_id: 'TBL2', name: 'Lines' },
      ],
      adColumns: [],
      prevSnapshot: { spec: [], entity: [], field: [] },
    });
    const entities = delta.tables.ETGO_SF_ENTITY.upserts;
    assert.equal(entities.length, 2);
    assert.equal(entities[0].SEQNO, '10');
    assert.equal(entities[1].SEQNO, '20');
  });
});

// ---------------------------------------------------------------------------
// computeWindowDelta — property-path fields (ETGO_SF_FIELD.PROPERTY_PATH rows)
// ---------------------------------------------------------------------------

describe('computeWindowDelta — property-path fields', () => {
  const MODULE_ID = 'AABBCCDD11223344';
  const INV_ACCOUNT = 'paymentScheduleDetail.invoicePaymentSchedule.invoice.eTABAMBankaccount.displayedAccount';
  const ORD_ACCOUNT = 'paymentScheduleDetail.orderPaymentSchedule.order.eTABAMBankaccount.displayedAccount';

  function deltaWith(fields, prevSnapshot = { spec: [], entity: [], field: [] }, adColumns) {
    return computeWindowDelta({
      specName: 'remittance',
      windowId: 'W1',
      moduleId: MODULE_ID,
      contract: {
        backendContract: {
          entities: {
            lines: { tabId: 'T2', tabName: 'Lines', tableName: 'REM_Line', fields },
          },
        },
      },
      decisions: {},
      adTabs: [{ ad_tab_id: 'T2', ad_table_id: 'TBL2', name: 'Lines' }],
      adColumns: adColumns ?? [
        { ad_column_id: 'C_AMT', ad_table_id: 'TBL2', columnname: 'Amount' },
        { ad_column_id: 'C_ST', ad_table_id: 'TBL2', columnname: 'Status' },
      ],
      prevSnapshot,
    });
  }
  const pathRows = (delta) => delta.tables.ETGO_SF_FIELD.upserts.filter(r => r.PROPERTY_PATH);

  it('emits a path row with no AD column, the path, the apiKey as JAVA_QUALIFIER, read-only', () => {
    const delta = deltaWith([
      { name: 'amount', column: 'Amount', visibility: 'editable' },
      { name: 'displayedAccount', column: 'Displayedaccount', visibility: 'readOnly', propertyPath: INV_ACCOUNT },
    ]);
    const [row] = pathRows(delta);
    assert.ok(row, 'a path row is emitted');
    assert.equal(row._naturalKey, `remittance/T2/path:${INV_ACCOUNT}`);
    assert.equal(Object.hasOwn(row, 'AD_COLUMN_ID'), false, 'no AD column on a path row');
    assert.equal(row.PROPERTY_PATH, INV_ACCOUNT);
    assert.equal(row.JAVA_QUALIFIER, 'displayedAccount');
    assert.equal(row.ISREADONLY, 'Y');
    assert.equal(row.ISINCLUDED, 'Y');
    assert.equal(row.AD_MODULE_ID, MODULE_ID);
    const entityId = delta.tables.ETGO_SF_ENTITY.upserts[0].ETGO_SF_ENTITY_ID;
    assert.equal(row.ETGO_SF_ENTITY_ID, entityId);
  });

  it('forces read-only even when the contract field says editable', () => {
    const [row] = pathRows(deltaWith([
      { name: 'displayedAccount', column: 'Displayedaccount', visibility: 'editable', propertyPath: INV_ACCOUNT },
    ]));
    assert.equal(row.ISREADONLY, 'Y');
  });

  it('keeps two paths on the same target column as two rows', () => {
    const rows = pathRows(deltaWith([
      { name: 'displayedAccount', column: 'Displayedaccount', visibility: 'readOnly', propertyPath: INV_ACCOUNT },
      { name: 'displayedAccount2', column: 'Displayedaccount', visibility: 'readOnly', propertyPath: ORD_ACCOUNT },
    ]));
    assert.deepEqual(rows.map(r => r.JAVA_QUALIFIER).sort(), ['displayedAccount', 'displayedAccount2']);
    assert.deepEqual(rows.map(r => r._naturalKey).sort(), [
      `remittance/T2/path:${INV_ACCOUNT}`,
      `remittance/T2/path:${ORD_ACCOUNT}`,
    ]);
  });

  it('keeps plain column rows keyed <spec>/<tab>/<column>', () => {
    const delta = deltaWith([
      { name: 'amount', column: 'Amount', visibility: 'editable' },
      { name: 'displayedAccount', column: 'Displayedaccount', visibility: 'readOnly', propertyPath: INV_ACCOUNT },
    ]);
    const amount = delta.tables.ETGO_SF_FIELD.upserts.find(r => r.AD_COLUMN_ID === 'C_AMT');
    assert.equal(amount._naturalKey, 'remittance/T2/C_AMT');
    assert.equal(Object.hasOwn(amount, 'PROPERTY_PATH'), false);
  });

  it('does not let a path field keep a same-named column of the tab table included', () => {
    // payment.status targets FIN_Payment.Status; REM_Line has its own Status column, which is
    // not in the contract and must stay out.
    const delta = deltaWith([
      { name: 'amount', column: 'Amount', visibility: 'editable' },
      { name: 'status', column: 'Status', visibility: 'readOnly', propertyPath: 'payment.status' },
    ]);
    const tabStatus = delta.tables.ETGO_SF_FIELD.upserts.find(r => r.AD_COLUMN_ID === 'C_ST');
    assert.equal(tabStatus, undefined, 'the tab Status column is not created as an included row');
    assert.equal(pathRows(delta).length, 1);
  });

  it('writes no row for a new discarded path field', () => {
    const delta = deltaWith([
      { name: 'displayedAccount', column: 'Displayedaccount', visibility: 'discarded', propertyPath: INV_ACCOUNT },
    ]);
    assert.deepEqual(pathRows(delta), []);
  });

  it('reuses the prev-snapshot row matched by path and closes it when discarded', () => {
    const prev = {
      spec: [{ ETGO_SF_SPEC_ID: 'S1', NAME: 'remittance', ISACTIVE: 'Y' }],
      entity: [{ ETGO_SF_ENTITY_ID: 'E1', ETGO_SF_SPEC_ID: 'S1', AD_TAB_ID: 'T2', NAME: 'lines' }],
      field: [{ ETGO_SF_FIELD_ID: 'PF1', ETGO_SF_ENTITY_ID: 'E1', AD_COLUMN_ID: null, PROPERTY_PATH: INV_ACCOUNT }],
    };
    const kept = pathRows(deltaWith([
      { name: 'displayedAccount', column: 'Displayedaccount', visibility: 'readOnly', propertyPath: INV_ACCOUNT },
    ], prev));
    assert.equal(kept[0].ETGO_SF_FIELD_ID, 'PF1');

    const delta = deltaWith([
      { name: 'displayedAccount', column: 'Displayedaccount', visibility: 'discarded', propertyPath: INV_ACCOUNT },
    ], prev);
    const [closed] = pathRows(delta);
    assert.equal(closed.ETGO_SF_FIELD_ID, 'PF1');
    assert.equal(closed.ISINCLUDED, 'N');
    assert.deepEqual(delta.tables.ETGO_SF_FIELD.deletes, []);
  });

  it('closes a stale path row the contract no longer declares instead of deleting it', () => {
    const prev = {
      spec: [{ ETGO_SF_SPEC_ID: 'S1', NAME: 'remittance', ISACTIVE: 'Y' }],
      entity: [{ ETGO_SF_ENTITY_ID: 'E1', ETGO_SF_SPEC_ID: 'S1', AD_TAB_ID: 'T2', NAME: 'lines' }],
      field: [{
        ETGO_SF_FIELD_ID: 'PF_STALE', ETGO_SF_ENTITY_ID: 'E1', AD_COLUMN_ID: null, AD_MODULE_ID: MODULE_ID,
        PROPERTY_PATH: 'payment.status', JAVA_QUALIFIER: 'status', ISINCLUDED: 'Y', ISREADONLY: 'Y',
      }],
    };
    const delta = deltaWith([{ name: 'amount', column: 'Amount', visibility: 'editable' }], prev);
    assert.deepEqual(delta.tables.ETGO_SF_FIELD.deletes, [], 'a stale path row is never deleted');
    const [closed] = pathRows(delta);
    assert.ok(closed, 'the stale path row is kept as an upsert');
    assert.equal(closed._naturalKey, 'remittance/T2/path:payment.status');
    assert.equal(closed.ETGO_SF_FIELD_ID, 'PF_STALE');
    assert.equal(closed.ETGO_SF_ENTITY_ID, 'E1');
    assert.equal(closed.PROPERTY_PATH, 'payment.status');
    assert.equal(closed.JAVA_QUALIFIER, 'status');
    assert.equal(closed.ISINCLUDED, 'N');
    assert.equal(closed.ISREADONLY, 'Y');
    assert.equal(Object.hasOwn(closed, 'AD_COLUMN_ID'), false);
  });

  it('closes only its own spec stale path rows and leaves declared ones open', () => {
    const prev = {
      spec: [
        { ETGO_SF_SPEC_ID: 'S1', NAME: 'remittance', ISACTIVE: 'Y' },
        { ETGO_SF_SPEC_ID: 'S9', NAME: 'remittance-other', ISACTIVE: 'Y' },
      ],
      entity: [
        { ETGO_SF_ENTITY_ID: 'E1', ETGO_SF_SPEC_ID: 'S1', AD_TAB_ID: 'T2', NAME: 'lines' },
        { ETGO_SF_ENTITY_ID: 'E9', ETGO_SF_SPEC_ID: 'S9', AD_TAB_ID: 'T9', NAME: 'lines' },
      ],
      field: [
        { ETGO_SF_FIELD_ID: 'PF_KEEP', ETGO_SF_ENTITY_ID: 'E1', AD_COLUMN_ID: null, PROPERTY_PATH: INV_ACCOUNT },
        { ETGO_SF_FIELD_ID: 'PF_OTHER', ETGO_SF_ENTITY_ID: 'E9', AD_COLUMN_ID: null, PROPERTY_PATH: 'payment.status' },
      ],
    };
    const delta = deltaWith([
      { name: 'displayedAccount', column: 'Displayedaccount', visibility: 'readOnly', propertyPath: INV_ACCOUNT },
    ], prev);
    const rows = pathRows(delta);
    assert.deepEqual(rows.map(r => r.ETGO_SF_FIELD_ID), ['PF_KEEP']);
    assert.equal(rows[0].ISINCLUDED, 'Y');
  });
});
