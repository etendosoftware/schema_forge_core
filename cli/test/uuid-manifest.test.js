import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { getOrCreateUuid, loadManifest, saveManifest } from '../src/uuid-manifest.js';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('uuid-manifest', () => {
  it('generates and returns consistent UUIDs', () => {
    const manifest = {};
    const uuid1 = getOrCreateUuid(manifest, 'AD_Process', 'completeOrder');
    const uuid2 = getOrCreateUuid(manifest, 'AD_Process', 'completeOrder');
    assert.equal(uuid1, uuid2);
    assert.match(uuid1, /^[0-9A-F]{32}$/);
  });

  it('generates different UUIDs for different keys', () => {
    const manifest = {};
    const uuid1 = getOrCreateUuid(manifest, 'AD_Process', 'completeOrder');
    const uuid2 = getOrCreateUuid(manifest, 'AD_Process', 'voidOrder');
    assert.notEqual(uuid1, uuid2);
  });

  it('loads and saves manifest to file', async () => {
    const path = join(tmpdir(), `manifest-test-${Date.now()}.json`);
    const data = { 'AD_Process:test': 'ABC123' };
    await saveManifest(path, data);
    const loaded = await loadManifest(path);
    assert.deepEqual(loaded, data);
    await unlink(path);
  });

  it('loadManifest returns empty object for missing file', async () => {
    const loaded = await loadManifest('/nonexistent/path.json');
    assert.deepEqual(loaded, {});
  });
});
