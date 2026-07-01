import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

describe('core-maps', () => {
  it('system-columns.json is valid JSON with expected keys', async () => {
    const raw = await readFile(
      new URL('../core-maps/system-columns.json', import.meta.url), 'utf8');
    const data = JSON.parse(raw);
    assert.ok(data['AD_Client_ID'], 'Missing AD_Client_ID');
    assert.ok(data['AD_Org_ID'], 'Missing AD_Org_ID');
    assert.ok(data['Created'], 'Missing Created');
    assert.ok(data['CreatedBy'], 'Missing CreatedBy');
    assert.ok(data['Updated'], 'Missing Updated');
    assert.ok(data['UpdatedBy'], 'Missing UpdatedBy');
    assert.ok(data['IsActive'], 'Missing IsActive');
  });

  it('ad-reference-map.json maps AD_Reference_IDs to schema types', async () => {
    const raw = await readFile(
      new URL('../core-maps/ad-reference-map.json', import.meta.url), 'utf8');
    const data = JSON.parse(raw);
    assert.equal(data['10'], 'string');
    assert.equal(data['11'], 'integer');
    assert.equal(data['12'], 'amount');
    assert.equal(data['13'], 'id');
    assert.equal(data['20'], 'boolean');
  });

  it('impact-messages.json has entries for each system category', async () => {
    const raw = await readFile(
      new URL('../core-maps/impact-messages.json', import.meta.url), 'utf8');
    const data = JSON.parse(raw);
    for (const cat of ['accounting','inventory','costing','audit','tax','integration','internal']) {
      assert.ok(data[cat], `Missing category: ${cat}`);
      assert.ok(typeof data[cat] === 'string', `${cat} should be a string message`);
    }
  });
});
