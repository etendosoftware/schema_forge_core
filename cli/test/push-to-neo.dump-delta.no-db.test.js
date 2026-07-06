import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { dumpDelta } from '../src/push-to-neo.js';
import { setCacheMode } from '../src/db.js';
import { upsertVersion } from '../src/lib/ad-cache.js';

/**
 * Verifies that `push-to-neo --dump-delta` with SF_CACHE_MODE=read never opens
 * a real DB connection: the cache stub pool answers every query.
 *
 * Strategy: prime a per-query cache directory with the two queries dumpDelta
 * makes (ad-tabs-for-window and ad-columns-for-window), point the cache there,
 * run dumpDelta, and assert the delta JSON file exists and has the expected shape.
 */

const TABS_SQL = `SELECT ad_tab_id, name, ad_table_id, seqno
       FROM ad_tab
       WHERE ad_window_id = $1 AND isactive = 'Y'
       ORDER BY seqno, name, ad_tab_id`;
const COLS_SQL = `SELECT DISTINCT c.ad_table_id, c.ad_column_id, c.columnname, c.position
       FROM ad_column c
       JOIN ad_tab t ON t.ad_table_id = c.ad_table_id
       WHERE t.ad_window_id = $1
         AND t.isactive = 'Y'
         AND c.isactive = 'Y'
       ORDER BY c.ad_table_id, c.position, c.columnname, c.ad_column_id`;

test('dumpDelta in read-cache mode produces a delta without opening a DB connection', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'dump-delta-nodb-'));
  try {
    // ---- 1) Set up a fake project root with one artifact dir ----
    const projectRoot = join(tmp, 'project');
    const artifactsDir = join(projectRoot, 'artifacts', 'tiny-spec');
    mkdirSync(artifactsDir, { recursive: true });

    const contract = {
      backendContract: {
        specType: 'W',
        window: { id: '143' },
        entities: {
          Header: {
            tabId: '187',
            tabName: 'Header',
            tableName: 'C_Order',
            fields: [
              { name: 'documentNo', column: 'DocumentNo', visibility: 'readOnly' },
            ],
          },
        },
      },
    };
    const schemaRaw = { window: { id: '143', name: 'Tiny' } };
    const decisions = {};
    writeFileSync(join(artifactsDir, 'contract.json'),     JSON.stringify(contract));
    writeFileSync(join(artifactsDir, 'schema-raw.json'),   JSON.stringify(schemaRaw));
    writeFileSync(join(artifactsDir, 'decisions.json'),    JSON.stringify(decisions));

    // ---- 2) Build a prev-XML dir (empty rows so no preservation logic needed) ----
    const prevDir = join(tmp, 'sourcedata');
    mkdirSync(prevDir, { recursive: true });
    const emptyData = `<?xml version='1.0' encoding='UTF-8'?>\n<data>\n</data>\n`;
    writeFileSync(join(prevDir, 'ETGO_SF_SPEC.xml'),   emptyData);
    writeFileSync(join(prevDir, 'ETGO_SF_ENTITY.xml'), emptyData);
    writeFileSync(join(prevDir, 'ETGO_SF_FIELD.xml'),  emptyData);

    // ---- 3) Prime the AD cache dir with the two queries dumpDelta makes ----
    const cacheDir = join(tmp, 'cache');
    upsertVersion(cacheDir, TABS_SQL, ['143'],
      [{ ad_tab_id: '187', name: 'Header', ad_table_id: '259', seqno: 10 }]);
    upsertVersion(cacheDir, COLS_SQL, ['143'],
      [{ ad_table_id: '259', ad_column_id: '2070', columnname: 'DocumentNo', position: 1 }]);

    // ---- 4) Switch cache to read mode and call dumpDelta ----
    setCacheMode({ mode: 'read', path: cacheDir });

    const outPath = join(tmp, 'neo-delta.json');
    const { summary } = await dumpDelta('tiny-spec', {
      outPath,
      prevXmlDir: prevDir,
      projectRoot,
    });

    // ---- 5) Assertions ----
    assert.ok(existsSync(outPath), 'delta file written');
    const delta = JSON.parse(readFileSync(outPath, 'utf-8'));
    assert.equal(delta.spec, 'tiny-spec');
    assert.equal(summary.upserts.ETGO_SF_SPEC, 1);
    assert.equal(summary.upserts.ETGO_SF_ENTITY, 1);
    assert.equal(summary.upserts.ETGO_SF_FIELD, 1);
    // The field column we put in the cache:
    const fieldRow = delta.tables.ETGO_SF_FIELD.upserts[0];
    assert.equal(fieldRow.AD_COLUMN_ID, '2070');
    assert.equal(fieldRow.ISREADONLY, 'Y'); // visibility 'readOnly' in contract
  } finally {
    setCacheMode({ mode: 'off' });
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('dumpDelta read-cache mode rejects unknown queries (cache miss is a hard error)', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'dump-delta-nodb-miss-'));
  try {
    const projectRoot = join(tmp, 'project');
    const artifactsDir = join(projectRoot, 'artifacts', 'tiny-spec');
    mkdirSync(artifactsDir, { recursive: true });
    writeFileSync(join(artifactsDir, 'contract.json'), JSON.stringify({
      backendContract: { specType: 'W', window: { id: '143' }, entities: { H: { tabId: '187', fields: [] } } },
    }));
    writeFileSync(join(artifactsDir, 'schema-raw.json'), JSON.stringify({ window: { id: '143' } }));
    writeFileSync(join(artifactsDir, 'decisions.json'), '{}');

    const prevDir = join(tmp, 'sourcedata');
    mkdirSync(prevDir, { recursive: true });
    const emptyData = `<?xml version='1.0' encoding='UTF-8'?>\n<data>\n</data>\n`;
    writeFileSync(join(prevDir, 'ETGO_SF_SPEC.xml'),   emptyData);
    writeFileSync(join(prevDir, 'ETGO_SF_ENTITY.xml'), emptyData);
    writeFileSync(join(prevDir, 'ETGO_SF_FIELD.xml'),  emptyData);

    // Empty cache → first query misses.
    const cachePath = join(tmp, 'cache.json');
    writeFileSync(cachePath, '{}');
    setCacheMode({ mode: 'read', path: cachePath });

    await assert.rejects(
      () => dumpDelta('tiny-spec', { outPath: join(tmp, 'd.json'), prevXmlDir: prevDir, projectRoot }),
      (err) => err.code === 'AD_CACHE_MISS',
    );
  } finally {
    setCacheMode({ mode: 'off' });
    rmSync(tmp, { recursive: true, force: true });
  }
});
