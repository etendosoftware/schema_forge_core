/**
 * ETP-4254 — end-to-end regression tests for the per-entity HTTP method flags.
 *
 * Walks the whole chain the feature has to survive:
 *
 *   decisions.json
 *     → resolveCurated()        (entity.readOnly / entity.methods land on the curated entity)
 *     → generateContract()      (apiPrediction.crud.<entity>.methods + window.readOnly)
 *     → push-to-neo             (buildEntityMethodFlagsResolver → neo-writer upsertEntity params)
 *     → lib/neo-delta           (ETGO_SF_ENTITY XML row)
 *
 * The last two MUST agree — if the live DB row and the predicted XML row diverge,
 * `regen-check` goes red. Every test that asserts one of them also asserts the
 * other.
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';
import { generateContract } from '../src/generate-contract.js';
import { buildEntityMethodFlagsResolver } from '../src/push-to-neo.js';
import { computeWindowDelta } from '../src/lib/neo-delta.js';

// ETP-4793 — `isIncluded` / `ISINCLUDED` joined this projection: an entity the
// contract DOES declare must stay included on both write paths, and the one it
// does not must be closed on both (see the `exclude: true` test below).
const ALL_Y = { isIncluded: 'Y', isGet: 'Y', isGetbyid: 'Y', isPost: 'Y', isPut: 'Y', isPatch: 'Y', isDelete: 'Y' };
const READ_ONLY = { isIncluded: 'Y', isGet: 'Y', isGetbyid: 'Y', isPost: 'N', isPut: 'N', isPatch: 'N', isDelete: 'N' };
const XML_ALL_Y = { ISINCLUDED: 'Y', ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'Y', ISPUT: 'Y', ISPATCH: 'Y', ISDELETE: 'Y' };
const XML_READ_ONLY = { ISINCLUDED: 'Y', ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'N', ISPUT: 'N', ISPATCH: 'N', ISDELETE: 'N' };

// ---------------------------------------------------------------------------
// Fixture: a two-tab window, mirroring a monitor/log window's shape.
//
// The AD tab NAMES ("Conversion Rate Log") deliberately differ from the curated
// entity names ("log"), because that indirection is where the live push resolves
// a tab to the contract entity whose methods it must apply. A fixture where
// tabName === entityName would not exercise it.
// ---------------------------------------------------------------------------

function schemaRaw() {
  return {
    window: { id: 'W001', name: 'Conversion Rate Downloader Log', tabCount: 2 },
    entities: [
      {
        name: 'log',
        tabId: 'T1',
        tabName: 'Conversion Rate Log',
        tableName: 'ETGO_ConvRate_Log',
        fields: [
          { name: 'documentNo', columnName: 'DocumentNo', type: 'string', reference: 'String' },
          { name: 'status', columnName: 'Status', type: 'string', reference: 'String' },
        ],
      },
      {
        name: 'logLine',
        tabId: 'T2',
        tabName: 'Conversion Rate Log Line',
        tableName: 'ETGO_ConvRate_LogLine',
        fields: [
          { name: 'rate', columnName: 'Rate', type: 'number', reference: 'Amount' },
        ],
      },
    ],
  };
}

const AD_TABS = [
  { ad_tab_id: 'T1', ad_table_id: 'TBL1', name: 'Conversion Rate Log' },
  { ad_tab_id: 'T2', ad_table_id: 'TBL2', name: 'Conversion Rate Log Line' },
];

/** AD tab name → curated entity name, so assertions can be written per entity. */
const ENTITY_BY_TAB = { 'Conversion Rate Log': 'log', 'Conversion Rate Log Line': 'logLine' };
const AD_COLUMNS = [
  { ad_column_id: 'C1', ad_table_id: 'TBL1', columnname: 'DocumentNo' },
  { ad_column_id: 'C2', ad_table_id: 'TBL1', columnname: 'Status' },
  { ad_column_id: 'C3', ad_table_id: 'TBL2', columnname: 'Rate' },
];

/**
 * Run decisions.json through resolve-curated + generate-contract, then project
 * the result onto both write paths.
 *
 * @param {object} decisions
 * @returns {Promise<{contract: object, crud: object, writerFlags: object, xmlFlags: object}>}
 */
async function runChain(decisions) {
  const raw = schemaRaw();
  const { schema } = await resolveCurated(raw, { rules: [] }, decisions);
  const contract = generateContract(schema, [], []);

  // Keyed by curated ENTITY name (not tab name) so the live-push flags can be
  // compared row-for-row against the XML delta, which keys by NAME.
  const resolver = buildEntityMethodFlagsResolver({ schemaRawData: raw, contract });
  const writerFlags = {};
  for (const tab of AD_TABS) writerFlags[ENTITY_BY_TAB[tab.name]] = resolver(tab);

  const delta = computeWindowDelta({
    specName: 'conversion-rate-downloader-log',
    windowId: 'W001',
    moduleId: 'AABBCCDD11223344',
    contract,
    decisions,
    adTabs: AD_TABS,
    adColumns: AD_COLUMNS,
    prevSnapshot: { spec: [], entity: [], field: [] },
    schemaRawData: raw,
  });
  const xmlFlags = {};
  for (const row of delta.tables.ETGO_SF_ENTITY.upserts) {
    xmlFlags[row.NAME] = {
      ISINCLUDED: row.ISINCLUDED,
      ISGET: row.ISGET, ISGETBYID: row.ISGETBYID, ISPOST: row.ISPOST,
      ISPUT: row.ISPUT, ISPATCH: row.ISPATCH, ISDELETE: row.ISDELETE,
    };
  }

  return { contract, crud: contract.apiPrediction.crud, writerFlags, xmlFlags };
}

/** Assert the live-DB flags and the predicted XML flags describe the same row. */
function assertPathsAgree(writerFlags, xmlFlags) {
  const pairs = [
    ['isIncluded', 'ISINCLUDED'],
    ['isGet', 'ISGET'], ['isGetbyid', 'ISGETBYID'], ['isPost', 'ISPOST'],
    ['isPut', 'ISPUT'], ['isPatch', 'ISPATCH'], ['isDelete', 'ISDELETE'],
  ];
  assert.deepEqual(Object.keys(writerFlags).sort(), Object.keys(xmlFlags).sort());
  for (const name of Object.keys(writerFlags)) {
    for (const [w, x] of pairs) {
      assert.equal(
        writerFlags[name][w], xmlFlags[name][x],
        `${name}.${w} (live push) !== ${name}.${x} (XML delta)`,
      );
    }
  }
}

// ---------------------------------------------------------------------------

describe('ETP-4254 — decisions → contract → both write paths', () => {
  it('nothing declared: every entity keeps all six methods (245-entity default)', async () => {
    const { crud, writerFlags, xmlFlags } = await runChain({ version: 'v2', window: {}, entities: {} });

    assert.equal(crud.log.methods, undefined, 'no contract churn for an unrestricted entity');
    assert.equal(crud.logLine.methods, undefined);
    assert.deepEqual(writerFlags.log, ALL_Y);
    assert.deepEqual(writerFlags.logLine, ALL_Y);
    assert.deepEqual(xmlFlags.log, XML_ALL_Y);
    assert.deepEqual(xmlFlags.logLine, XML_ALL_Y);
    assertPathsAgree(writerFlags, xmlFlags);
  });

  it('window.readOnly makes EVERY entity read-only on both write paths', async () => {
    const { contract, writerFlags, xmlFlags } = await runChain({
      version: 'v2', window: { readOnly: true }, entities: {},
    });

    assert.equal(contract.apiPrediction.window.readOnly, true);
    assert.deepEqual(writerFlags.log, READ_ONLY);
    assert.deepEqual(writerFlags.logLine, READ_ONLY);
    assert.deepEqual(xmlFlags.log, XML_READ_ONLY);
    assert.deepEqual(xmlFlags.logLine, XML_READ_ONLY);
    assertPathsAgree(writerFlags, xmlFlags);
  });

  it('per-entity readOnly restricts only that entity', async () => {
    const { crud, writerFlags, xmlFlags } = await runChain({
      version: 'v2', window: {}, entities: { logLine: { readOnly: true } },
    });

    assert.deepEqual(crud.logLine.methods, ['GET', 'GETBYID']);
    assert.equal(crud.log.methods, undefined);
    assert.deepEqual(writerFlags.log, ALL_Y);
    assert.deepEqual(writerFlags.logLine, READ_ONLY);
    assert.deepEqual(xmlFlags.logLine, XML_READ_ONLY);
    assertPathsAgree(writerFlags, xmlFlags);
  });

  it('per-entity readOnly:false re-opens one entity of a read-only window', async () => {
    const { crud, writerFlags, xmlFlags } = await runChain({
      version: 'v2',
      window: { readOnly: true },
      entities: { logLine: { readOnly: false } },
    });

    assert.deepEqual(crud.logLine.methods, ['GET', 'GETBYID', 'POST', 'PUT', 'PATCH', 'DELETE'],
      'the opted-out entity must be pinned explicitly, or the window fallback would restrict it');
    // ETP-4745 — window.readOnly's derived window.hideDelete must not clobber
    // crud.delete for an entity that explicitly opted back out via readOnly:false;
    // that opt-out means "fully writable", delete included.
    assert.equal(crud.logLine.delete, true);
    assert.deepEqual(writerFlags.log, READ_ONLY);
    assert.deepEqual(writerFlags.logLine, ALL_Y);
    assert.deepEqual(xmlFlags.log, XML_READ_ONLY);
    assert.deepEqual(xmlFlags.logLine, XML_ALL_Y);
    assertPathsAgree(writerFlags, xmlFlags);
  });

  it('per-entity methods allowlist reaches both write paths, GET forced back in', async () => {
    const { crud, writerFlags, xmlFlags } = await runChain({
      version: 'v2', window: {}, entities: { log: { methods: ['PUT', 'PATCH'] } },
    });

    assert.deepEqual(crud.log.methods, ['GET', 'GETBYID', 'PUT', 'PATCH']);
    assert.deepEqual(writerFlags.log, {
      isIncluded: 'Y', isGet: 'Y', isGetbyid: 'Y', isPost: 'N', isPut: 'Y', isPatch: 'Y', isDelete: 'N',
    });
    assert.deepEqual(xmlFlags.log, {
      ISINCLUDED: 'Y', ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'N', ISPUT: 'Y', ISPATCH: 'Y', ISDELETE: 'N',
    });
    assertPathsAgree(writerFlags, xmlFlags);
  });

  it('never emits an entity without read access, whatever is declared', async () => {
    for (const entities of [
      { log: { methods: [] } },
      { log: { methods: ['POST'] } },
      { log: { readOnly: true } },
    ]) {
      const { writerFlags, xmlFlags } = await runChain({ version: 'v2', window: { readOnly: true }, entities });
      for (const name of Object.keys(writerFlags)) {
        assert.equal(writerFlags[name].isGet, 'Y', `${name} lost GET for ${JSON.stringify(entities)}`);
        assert.equal(writerFlags[name].isGetbyid, 'Y', `${name} lost GETBYID`);
        assert.equal(xmlFlags[name].ISGET, 'Y');
        assert.equal(xmlFlags[name].ISGETBYID, 'Y');
      }
    }
  });

  it('window.readOnly still derives the UI gating it derived before', async () => {
    const { contract } = await runChain({ version: 'v2', window: { readOnly: true }, entities: {} });
    const win = contract.frontendContract.window;
    assert.equal(win.readOnly, true);
    assert.equal(win.hideCreate, true);
    assert.equal(win.hideDelete, true);
    for (const entityName of ['log', 'logLine']) {
      const crud = contract.apiPrediction.crud[entityName];
      assert.equal(crud.post, false);
      assert.equal(crud.put, false);
      assert.equal(crud.patch, false);
      assert.equal(crud.delete, false);
      assert.equal(crud.get, true);
      assert.equal(crud.getById, true);
    }
  });

  // ETP-4793 — an AD tab with no contract entity is now CLOSED (ISINCLUDED='N'),
  // which is the column every NEO/MCP reader filters on before it resolves an
  // entity. Its method flags deliberately keep following the window default:
  // they are unreachable once the entity is not included, and an all-'N' set
  // would break the GET/GETBYID invariant `entity-methods.js` enforces.
  it('an AD tab with no contract entity is closed, methods still the window default', async () => {
    const { contract } = await runChain({ version: 'v2', window: { readOnly: true }, entities: {} });
    const resolver = buildEntityMethodFlagsResolver({ schemaRawData: schemaRaw(), contract });
    const flags = resolver({ ad_tab_id: 'T9', name: 'someExtraTab' });

    assert.equal(flags.isIncluded, 'N', 'a tab absent from the contract must not be served');
    assert.deepEqual(
      { ...flags, isIncluded: 'Y' }, READ_ONLY,
      'the method flags themselves are untouched — GET/GETBYID stay granted',
    );
  });

  it('exclude: true closes the entity on BOTH write paths', async () => {
    const { contract, writerFlags, xmlFlags } = await runChain({
      version: 'v2', window: {}, entities: { logLine: { exclude: true } },
    });

    assert.equal(
      contract.backendContract.entities.logLine, undefined,
      'exclude: true keeps the entity out of the contract — the precondition being tested',
    );
    assert.equal(writerFlags.logLine.isIncluded, 'N', 'live push must close it');
    assert.equal(xmlFlags.logLine.ISINCLUDED, 'N', 'XML delta must close the same row');
    assert.equal(writerFlags.log.isIncluded, 'Y', 'the sibling the contract DOES declare stays open');
    assert.equal(xmlFlags.log.ISINCLUDED, 'Y');
    assertPathsAgree(writerFlags, xmlFlags);
  });

  // A contract that declares NO entities at all (an older or half-generated
  // artifact) must not be read as "everything is excluded" — that would close a
  // whole window on one malformed file.
  it('an empty contract closes nothing', async () => {
    const resolver = buildEntityMethodFlagsResolver({
      schemaRawData: schemaRaw(), contract: { backendContract: { entities: {} } },
    });
    assert.equal(resolver({ ad_tab_id: 'T1', name: 'Conversion Rate Log' }).isIncluded, 'Y');
    assert.equal(
      buildEntityMethodFlagsResolver({ schemaRawData: schemaRaw(), contract: {} })(
        { ad_tab_id: 'T1', name: 'Conversion Rate Log' },
      ).isIncluded, 'Y',
    );
  });

  // ETP-4745 — `hideDelete` previously only reached `apiPrediction.crud.<entity>.delete`
  // (the frontend contract). Neither the live DB write (`writerFlags`, ETGO_SF_ENTITY.ISDELETE)
  // nor the predicted XML delta ever read it, so delete stayed enabled on both backends
  // regardless of the decision. These assert the fix reaches both write paths.
  it('per-entity hideDelete disables DELETE only for that entity, on both write paths', async () => {
    const { crud, writerFlags, xmlFlags } = await runChain({
      version: 'v2', window: {}, entities: { log: { hideDelete: true } },
    });

    assert.equal(crud.log.delete, false);
    assert.equal(crud.logLine.delete, true);
    assert.deepEqual(writerFlags.log, {
      isIncluded: 'Y', isGet: 'Y', isGetbyid: 'Y', isPost: 'Y', isPut: 'Y', isPatch: 'Y', isDelete: 'N',
    });
    assert.deepEqual(writerFlags.logLine, ALL_Y, 'sibling entity must keep DELETE');
    assert.deepEqual(xmlFlags.log, {
      ISINCLUDED: 'Y', ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'Y', ISPUT: 'Y', ISPATCH: 'Y', ISDELETE: 'N',
    });
    assert.deepEqual(xmlFlags.logLine, XML_ALL_Y);
    assertPathsAgree(writerFlags, xmlFlags);
  });

  it('window.hideDelete disables DELETE for every entity, on both write paths', async () => {
    const { crud, writerFlags, xmlFlags } = await runChain({
      version: 'v2', window: { hideDelete: true }, entities: {},
    });

    for (const entityName of ['log', 'logLine']) {
      assert.equal(crud[entityName].delete, false);
      assert.equal(writerFlags[entityName].isDelete, 'N');
      assert.equal(xmlFlags[entityName].ISDELETE, 'N');
      // Nothing else about the entity's methods is restricted — only DELETE.
      assert.equal(writerFlags[entityName].isGet, 'Y');
      assert.equal(writerFlags[entityName].isPost, 'Y');
      assert.equal(writerFlags[entityName].isPut, 'Y');
      assert.equal(writerFlags[entityName].isPatch, 'Y');
    }
    assertPathsAgree(writerFlags, xmlFlags);
  });

  it('hideDelete composes with a per-entity methods allowlist that still listed DELETE', async () => {
    const { crud, writerFlags, xmlFlags } = await runChain({
      version: 'v2',
      window: {},
      entities: { log: { methods: ['PUT', 'DELETE'], hideDelete: true } },
    });

    assert.deepEqual(crud.log.methods, ['GET', 'GETBYID', 'PUT', 'DELETE'],
      'contract.methods still reflects the declared allowlist verbatim');
    assert.equal(crud.log.delete, false);
    assert.deepEqual(writerFlags.log, {
      isIncluded: 'Y', isGet: 'Y', isGetbyid: 'Y', isPost: 'N', isPut: 'Y', isPatch: 'N', isDelete: 'N',
    });
    assert.deepEqual(xmlFlags.log, {
      ISINCLUDED: 'Y', ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'N', ISPUT: 'Y', ISPATCH: 'N', ISDELETE: 'N',
    });
    assertPathsAgree(writerFlags, xmlFlags);
  });

  it('without hideDelete, DELETE stays enabled by default (no regression)', async () => {
    const { crud, writerFlags, xmlFlags } = await runChain({ version: 'v2', window: {}, entities: {} });

    assert.equal(crud.log.delete, true);
    assert.equal(writerFlags.log.isDelete, 'Y');
    assert.equal(xmlFlags.log.ISDELETE, 'Y');
    assertPathsAgree(writerFlags, xmlFlags);
  });
});

// ---------------------------------------------------------------------------
// ETP-4793 — the field-level half of `exclude: true`.
//
// Closing the entity row alone would be enough for behaviour (every reader
// filters ETGO_SF_ENTITY.ISINCLUDED before it resolves a field), but the field
// rows kept claiming ISINCLUDED='Y', which is how the gap stayed invisible: 386
// such rows on the reference instance. The reason they survived is specific and
// worth pinning — `stepExcludeNonContractFields` (and the delta that mirrors it
// bug-for-bug) compares column NAMES against a FLAT set gathered across ALL
// contract entities, so an excluded entity's column survives whenever a sibling
// contract entity happens to have a column of the same name.
//
// The fixture below is built for exactly that: the excluded `logLine` tab gets a
// `DocumentNo` column, which the contract's `log` entity also has.
// ---------------------------------------------------------------------------

const SPEC = 'conversion-rate-downloader-log';
const SHARED_COL = { ad_column_id: 'C4', ad_table_id: 'TBL2', columnname: 'DocumentNo' };

/**
 * schemaRaw() with an explicit `editable` visibility on every field, plus a
 * `DocumentNo` column on the second entity so it collides with the first's.
 *
 * The visibility matters: `mapVisibility(undefined)` is `N`/`N`, so the base
 * fixture — which never asserted on field rows — would show every field closed
 * and prove nothing.
 */
function schemaRawWithSharedColumn() {
  const raw = schemaRaw();
  for (const entity of raw.entities) {
    for (const field of entity.fields) field.visibility = 'editable';
  }
  raw.entities[1].fields.push({
    name: 'documentNo', columnName: 'DocumentNo', type: 'string', reference: 'String',
    visibility: 'editable',
  });
  return raw;
}

/**
 * A prev-XML snapshot holding the rows this window already has, so the delta's
 * "never create NEW records with ISINCLUDED=N" pruning keeps them and the
 * assertions can see the flip. That mirrors the live instance, where all 90
 * closed entities already exist in the exported XML.
 */
function prevSnapshotFor(columns) {
  const entityIdByTab = { T1: 'E1', T2: 'E2' };
  const entityIdByTable = { TBL1: 'E1', TBL2: 'E2' };
  return {
    spec: [{ ETGO_SF_SPEC_ID: 'S1', NAME: SPEC }],
    entity: AD_TABS.map(tab => ({
      ETGO_SF_ENTITY_ID: entityIdByTab[tab.ad_tab_id],
      ETGO_SF_SPEC_ID: 'S1',
      AD_TAB_ID: tab.ad_tab_id,
    })),
    field: columns.map((col, i) => ({
      ETGO_SF_FIELD_ID: `F${i + 1}`,
      ETGO_SF_ENTITY_ID: entityIdByTable[col.ad_table_id],
      AD_COLUMN_ID: col.ad_column_id,
    })),
  };
}

/** Compute the XML delta for a window whose second entity is `exclude: true`. */
async function deltaWithExcludedLogLine() {
  const raw = schemaRawWithSharedColumn();
  const columns = [...AD_COLUMNS, SHARED_COL];
  const decisions = { version: 'v2', window: {}, entities: { logLine: { exclude: true } } };
  const { schema } = await resolveCurated(raw, { rules: [] }, decisions);
  const contract = generateContract(schema, [], []);
  const delta = computeWindowDelta({
    specName: SPEC,
    windowId: 'W001',
    moduleId: 'AABBCCDD11223344',
    contract,
    decisions,
    adTabs: AD_TABS,
    adColumns: columns,
    prevSnapshot: prevSnapshotFor(columns),
    schemaRawData: raw,
  });
  const byColumn = {};
  for (const row of delta.tables.ETGO_SF_FIELD.upserts) byColumn[row.AD_COLUMN_ID] = row;
  return { contract, delta, byColumn };
}

describe('ETP-4793 — fields of an entity excluded from the contract', () => {
  it('are closed even when a declared entity shares the column name', async () => {
    const { contract, byColumn } = await deltaWithExcludedLogLine();

    assert.equal(contract.backendContract.entities.logLine, undefined);
    assert.equal(
      byColumn.C4?.ISINCLUDED, 'N',
      "logLine.DocumentNo must be closed — the flat column set alone would keep it 'Y' "
      + 'because log.DocumentNo IS in the contract',
    );
    assert.equal(byColumn.C3?.ISINCLUDED, 'N', 'logLine.Rate is closed as well');
  });

  it('leaves the fields of the declared entity untouched', async () => {
    const { byColumn } = await deltaWithExcludedLogLine();

    assert.equal(byColumn.C1?.ISINCLUDED, 'Y', 'log.DocumentNo is contract-declared');
    assert.equal(byColumn.C2?.ISINCLUDED, 'Y', 'log.Status is contract-declared');
  });
});
