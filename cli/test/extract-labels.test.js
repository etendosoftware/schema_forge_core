import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractLabels } from '../src/extract-labels.js';

/**
 * Create a mock pool that returns predefined rows for each query type.
 * Identifies query type by checking for table names in the SQL.
 */
function createMockPool(mockData) {
  return {
    query(sql, _params) {
      if (sql.includes('ad_field')) {
        return Promise.resolve({ rows: mockData.fields || [] });
      }
      if (sql.includes('ad_window')) {
        return Promise.resolve({ rows: mockData.windows || [] });
      }
      if (sql.includes('ad_tab')) {
        return Promise.resolve({ rows: mockData.tabs || [] });
      }
      if (sql.includes('ad_menu')) {
        return Promise.resolve({ rows: mockData.menus || [] });
      }
      return Promise.resolve({ rows: [] });
    },
  };
}

describe('extractLabels', () => {
  it('returns object with fields, windows, tabs, menus sections', async () => {
    const pool = createMockPool({
      fields: [],
      windows: [],
      tabs: [],
      menus: [],
    });

    const result = await extractLabels(pool, 'en_US');

    assert.ok(result.fields, 'should have fields section');
    assert.ok(result.windows, 'should have windows section');
    assert.ok(result.tabs, 'should have tabs section');
    assert.ok(result.menus, 'should have menus section');
    assert.equal(typeof result.fields, 'object');
    assert.equal(typeof result.windows, 'object');
    assert.equal(typeof result.tabs, 'object');
    assert.equal(typeof result.menus, 'object');
  });

  it('maps field rows by column_key with label and description', async () => {
    const pool = createMockPool({
      fields: [
        { column_key: 'C_BPartner_ID', label: 'Business Partner', description: 'A business partner' },
        { column_key: 'DateOrdered', label: 'Order Date', description: 'Date of the order' },
      ],
      windows: [],
      tabs: [],
      menus: [],
    });

    const result = await extractLabels(pool, 'en_US');

    assert.equal(result.fields.C_BPartner_ID.label, 'Business Partner');
    assert.equal(result.fields.C_BPartner_ID.description, 'A business partner');
    assert.equal(result.fields.DateOrdered.label, 'Order Date');
    assert.equal(result.fields.DateOrdered.description, 'Date of the order');
  });

  it('deduplicates fields with same column_key (keeps first occurrence)', async () => {
    const pool = createMockPool({
      fields: [
        { column_key: 'C_BPartner_ID', label: 'Business Partner', description: 'desc1' },
        { column_key: 'C_BPartner_ID', label: 'BP (Purchase)', description: 'desc2' },
      ],
      windows: [],
      tabs: [],
      menus: [],
    });

    const result = await extractLabels(pool, 'en_US');

    // Should have only one entry for C_BPartner_ID
    assert.equal(Object.keys(result.fields).length, 1);
    assert.equal(result.fields.C_BPartner_ID.label, 'Business Partner');
  });

  it('maps window rows by name with label', async () => {
    const pool = createMockPool({
      fields: [],
      windows: [
        { key: 'Sales Order', label: 'Sales Order' },
        { key: 'Purchase Order', label: 'Purchase Order' },
      ],
      tabs: [],
      menus: [],
    });

    const result = await extractLabels(pool, 'en_US');

    assert.equal(result.windows['Sales Order'].label, 'Sales Order');
    assert.equal(result.windows['Purchase Order'].label, 'Purchase Order');
  });

  it('maps tab rows by name with label', async () => {
    const pool = createMockPool({
      fields: [],
      windows: [],
      tabs: [
        { key: 'Header', label: 'Header' },
        { key: 'Lines', label: 'Lines' },
      ],
      menus: [],
    });

    const result = await extractLabels(pool, 'en_US');

    assert.equal(result.tabs.Header.label, 'Header');
    assert.equal(result.tabs.Lines.label, 'Lines');
  });

  it('maps menu rows by name with label', async () => {
    const pool = createMockPool({
      fields: [],
      windows: [],
      tabs: [],
      menus: [
        { key: 'Sales Order', label: 'Sales Order' },
      ],
    });

    const result = await extractLabels(pool, 'en_US');

    assert.equal(result.menus['Sales Order'].label, 'Sales Order');
  });

  it('handles null/empty label and description gracefully', async () => {
    const pool = createMockPool({
      fields: [
        { column_key: 'TestCol', label: null, description: null },
      ],
      windows: [
        { key: 'TestWindow', label: null },
      ],
      tabs: [],
      menus: [],
    });

    const result = await extractLabels(pool, 'en_US');

    assert.equal(result.fields.TestCol.label, '');
    assert.equal(result.fields.TestCol.description, '');
    assert.equal(result.windows.TestWindow.label, '');
  });

  it('handles empty result sets', async () => {
    const pool = createMockPool({
      fields: [],
      windows: [],
      tabs: [],
      menus: [],
    });

    const result = await extractLabels(pool, 'es_ES');

    assert.deepEqual(result.fields, {});
    assert.deepEqual(result.windows, {});
    assert.deepEqual(result.tabs, {});
    assert.deepEqual(result.menus, {});
  });

  it('passes language parameter to pool.query', async () => {
    const capturedParams = [];
    const pool = {
      query(sql, params) {
        capturedParams.push(params);
        return Promise.resolve({ rows: [] });
      },
    };

    await extractLabels(pool, 'es_AR');

    // All 4 queries should receive the language parameter
    assert.equal(capturedParams.length, 4);
    for (const params of capturedParams) {
      assert.deepEqual(params, ['es_AR']);
    }
  });
});
