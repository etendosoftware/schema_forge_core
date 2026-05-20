import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { applyDelta, serializeTable } from '../src/xml-apply-delta.js';
import { parseEtgoXmlText } from '../src/lib/etgo-xml-parser.js';
import { compareXmlFiles } from '../src/xml-regeneration-check.js';
import { computeWindowDelta, serializeDelta } from '../src/lib/neo-delta.js';

/**
 * Integration test for the `make regen-check` pipeline, executed in-process:
 *
 *   prev XML  →  computeWindowDelta (no DB)  →  applyDelta  →  predicted XML
 *   prev/predicted  →  compareXmlFiles  →  exit code
 *
 * No DB, no gradle, no subprocess. The Makefile target just wires these
 * three functions together with file I/O between steps; testing them
 * in-process is faster and avoids flake from subprocess plumbing.
 */

function baseContract() {
  return {
    backendContract: {
      specType: 'W',
      window: { id: '143' },
      entities: {
        Order: {
          tabId: '187',
          tabName: 'Header',
          tableName: 'C_Order',
          fields: [
            { name: 'documentNo', column: 'DocumentNo', visibility: 'readOnly' },
            { name: 'partner',    column: 'C_BPartner_ID', visibility: 'editable' },
          ],
        },
      },
    },
  };
}

function adTabs()    { return [{ ad_tab_id: '187', name: 'Header', ad_table_id: '259', seqno: 10 }]; }
function adColumns() {
  return [
    { ad_table_id: '259', ad_column_id: '2070', columnname: 'DocumentNo',    position: 1 },
    { ad_table_id: '259', ad_column_id: '2071', columnname: 'C_BPartner_ID', position: 2 },
  ];
}

/**
 * Build a "committed" prev-XML state that matches what the contract would
 * predict. This is the no-drift scenario.
 */
function buildPrevXmlFromDelta(delta) {
  // Apply onto an empty snapshot to get the canonical state.
  const next = applyDelta({ spec: [], entity: [], field: [] }, delta);
  return {
    spec: serializeTable('ETGO_SF_SPEC', next.spec),
    entity: serializeTable('ETGO_SF_ENTITY', next.entity),
    field: serializeTable('ETGO_SF_FIELD', next.field),
  };
}

function writePrevDir(dir, xmls) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ETGO_SF_SPEC.xml'),   xmls.spec);
  writeFileSync(join(dir, 'ETGO_SF_ENTITY.xml'), xmls.entity);
  writeFileSync(join(dir, 'ETGO_SF_FIELD.xml'),  xmls.field);
}

function setupCheckDirs(tmpRoot) {
  const prevRoot      = join(tmpRoot, 'prev');
  const prevDir       = join(prevRoot, 'sourcedata');
  const predictedRoot = join(tmpRoot, 'predicted');
  const predictedDir  = join(predictedRoot, 'sourcedata');
  mkdirSync(prevDir,      { recursive: true });
  mkdirSync(predictedDir, { recursive: true });
  return { prevRoot, prevDir, predictedRoot, predictedDir };
}

test('regen-check: no drift when prev XML matches predicted (full pipeline in-process)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'regen-check-ok-'));
  try {
    // 1) Compute the delta the contract would emit, assuming empty prev (so we
    //    capture the full state).
    const fullDelta = computeWindowDelta({
      specName: 'sales-order',
      windowId: '143',
      moduleId: 'M1',
      contract: baseContract(),
      decisions: {},
      adTabs: adTabs(),
      adColumns: adColumns(),
      prevSnapshot: { spec: [], entity: [], field: [] },
    });
    const serialized = serializeDelta(fullDelta);

    // 2) "Commit" that state as prev-XML.
    const prevXmls = buildPrevXmlFromDelta(serialized);
    const { prevRoot, prevDir, predictedRoot, predictedDir } = setupCheckDirs(tmp);
    writePrevDir(prevDir, prevXmls);

    // 3) Now re-run the delta against the populated prev (the real pipeline path).
    const prevSnapshot = {
      spec:   parseEtgoXmlText(prevXmls.spec,   'ETGO_SF_SPEC'),
      entity: parseEtgoXmlText(prevXmls.entity, 'ETGO_SF_ENTITY'),
      field:  parseEtgoXmlText(prevXmls.field,  'ETGO_SF_FIELD'),
    };
    const deltaWithPrev = computeWindowDelta({
      specName: 'sales-order',
      windowId: '143',
      moduleId: 'M1',
      contract: baseContract(),
      decisions: {},
      adTabs: adTabs(),
      adColumns: adColumns(),
      prevSnapshot,
    });
    const next = applyDelta(prevSnapshot, serializeDelta(deltaWithPrev));
    writePrevDir(predictedDir, {
      spec:   serializeTable('ETGO_SF_SPEC',   next.spec),
      entity: serializeTable('ETGO_SF_ENTITY', next.entity),
      field:  serializeTable('ETGO_SF_FIELD',  next.field),
    });

    // 4) Compare predicted vs prev. Expect zero drift.
    const result = compareXmlFiles(prevRoot, predictedRoot, ['sourcedata']);
    assert.deepEqual(result.changed, [], 'no drift');
    assert.deepEqual(result.missing, []);
    assert.deepEqual(result.extra, []);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok.length, 3, 'all three ETGO_SF_*.xml match');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('regen-check: detects drift when contract changes after commit (visibility flip)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'regen-check-drift-'));
  try {
    // 1) Commit prev with the ORIGINAL contract (documentNo readOnly).
    const originalDelta = computeWindowDelta({
      specName: 'sales-order',
      windowId: '143',
      moduleId: 'M1',
      contract: baseContract(),
      decisions: {},
      adTabs: adTabs(),
      adColumns: adColumns(),
      prevSnapshot: { spec: [], entity: [], field: [] },
    });
    const prevXmls = buildPrevXmlFromDelta(serializeDelta(originalDelta));
    const { prevRoot, prevDir, predictedRoot, predictedDir } = setupCheckDirs(tmp);
    writePrevDir(prevDir, prevXmls);

    // 2) Now the contract changes — flip documentNo from readOnly to editable.
    const driftedContract = baseContract();
    driftedContract.backendContract.entities.Order.fields[0].visibility = 'editable';

    const prevSnapshot = {
      spec:   parseEtgoXmlText(prevXmls.spec,   'ETGO_SF_SPEC'),
      entity: parseEtgoXmlText(prevXmls.entity, 'ETGO_SF_ENTITY'),
      field:  parseEtgoXmlText(prevXmls.field,  'ETGO_SF_FIELD'),
    };
    const newDelta = computeWindowDelta({
      specName: 'sales-order',
      windowId: '143',
      moduleId: 'M1',
      contract: driftedContract,
      decisions: {},
      adTabs: adTabs(),
      adColumns: adColumns(),
      prevSnapshot,
    });
    const next = applyDelta(prevSnapshot, serializeDelta(newDelta));
    writePrevDir(predictedDir, {
      spec:   serializeTable('ETGO_SF_SPEC',   next.spec),
      entity: serializeTable('ETGO_SF_ENTITY', next.entity),
      field:  serializeTable('ETGO_SF_FIELD',  next.field),
    });

    const result = compareXmlFiles(prevRoot, predictedRoot, ['sourcedata']);
    assert.ok(
      result.changed.includes('sourcedata/ETGO_SF_FIELD.xml'),
      `drift expected in ETGO_SF_FIELD.xml, got changed=${JSON.stringify(result.changed)}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('regen-check: helper functions are deterministic across reruns', () => {
  // Sanity: same inputs, same outputs — apply-delta must be a pure function.
  const delta = computeWindowDelta({
    specName: 'sales-order',
    windowId: '143',
    moduleId: 'M1',
    contract: baseContract(),
    decisions: {},
    adTabs: adTabs(),
    adColumns: adColumns(),
    prevSnapshot: { spec: [], entity: [], field: [] },
  });
  const a = applyDelta({ spec: [], entity: [], field: [] }, serializeDelta(delta));
  const b = applyDelta({ spec: [], entity: [], field: [] }, serializeDelta(delta));
  assert.deepEqual(a, b);
});
