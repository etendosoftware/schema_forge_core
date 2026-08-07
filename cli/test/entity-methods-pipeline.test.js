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

const ALL_Y = { isGet: 'Y', isGetbyid: 'Y', isPost: 'Y', isPut: 'Y', isPatch: 'Y', isDelete: 'Y' };
const READ_ONLY = { isGet: 'Y', isGetbyid: 'Y', isPost: 'N', isPut: 'N', isPatch: 'N', isDelete: 'N' };
const XML_ALL_Y = { ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'Y', ISPUT: 'Y', ISPATCH: 'Y', ISDELETE: 'Y' };
const XML_READ_ONLY = { ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'N', ISPUT: 'N', ISPATCH: 'N', ISDELETE: 'N' };

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
      ISGET: row.ISGET, ISGETBYID: row.ISGETBYID, ISPOST: row.ISPOST,
      ISPUT: row.ISPUT, ISPATCH: row.ISPATCH, ISDELETE: row.ISDELETE,
    };
  }

  return { contract, crud: contract.apiPrediction.crud, writerFlags, xmlFlags };
}

/** Assert the live-DB flags and the predicted XML flags describe the same row. */
function assertPathsAgree(writerFlags, xmlFlags) {
  const pairs = [
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
      isGet: 'Y', isGetbyid: 'Y', isPost: 'N', isPut: 'Y', isPatch: 'Y', isDelete: 'N',
    });
    assert.deepEqual(xmlFlags.log, {
      ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'N', ISPUT: 'Y', ISPATCH: 'Y', ISDELETE: 'N',
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

  it('an AD tab with no contract entity still follows the window default', async () => {
    const { contract } = await runChain({ version: 'v2', window: { readOnly: true }, entities: {} });
    const resolver = buildEntityMethodFlagsResolver({ schemaRawData: schemaRaw(), contract });
    assert.deepEqual(resolver({ ad_tab_id: 'T9', name: 'someExtraTab' }), READ_ONLY);
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
      isGet: 'Y', isGetbyid: 'Y', isPost: 'Y', isPut: 'Y', isPatch: 'Y', isDelete: 'N',
    });
    assert.deepEqual(writerFlags.logLine, ALL_Y, 'sibling entity must keep DELETE');
    assert.deepEqual(xmlFlags.log, {
      ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'Y', ISPUT: 'Y', ISPATCH: 'Y', ISDELETE: 'N',
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
      isGet: 'Y', isGetbyid: 'Y', isPost: 'N', isPut: 'Y', isPatch: 'N', isDelete: 'N',
    });
    assert.deepEqual(xmlFlags.log, {
      ISGET: 'Y', ISGETBYID: 'Y', ISPOST: 'N', ISPUT: 'Y', ISPATCH: 'N', ISDELETE: 'N',
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
