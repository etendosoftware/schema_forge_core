import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  toSpecName,
  mapVisibility,
  buildWebhookUrl,
  extractFieldsFromContract,
  formatDuplicateFieldsError,
} from '../src/push-to-neo.js';

describe('toSpecName', () => {
  it('converts simple display name to kebab-case', () => {
    assert.equal(toSpecName('Sales Order'), 'sales-order');
  });

  it('converts multi-word name', () => {
    assert.equal(toSpecName('Business Partner'), 'business-partner');
  });

  it('handles single word', () => {
    assert.equal(toSpecName('Product'), 'product');
  });

  it('trims whitespace', () => {
    assert.equal(toSpecName('  Sales Order  '), 'sales-order');
  });

  it('splits camelCase', () => {
    assert.equal(toSpecName('salesOrder'), 'sales-order');
  });

  it('handles PascalCase', () => {
    assert.equal(toSpecName('PurchaseOrder'), 'purchase-order');
  });

  it('replaces multiple non-alphanumeric chars with single dash', () => {
    assert.equal(toSpecName('Sales  /  Order'), 'sales-order');
  });

  it('removes leading and trailing dashes', () => {
    assert.equal(toSpecName('-Sales Order-'), 'sales-order');
  });

  it('handles already kebab-case', () => {
    assert.equal(toSpecName('sales-order'), 'sales-order');
  });

  it('handles names with numbers', () => {
    assert.equal(toSpecName('Report 2024'), 'report-2024');
  });

  it('handles special characters', () => {
    assert.equal(toSpecName('Sales & Purchase (Orders)'), 'sales-purchase-orders');
  });

  it('handles empty string after trim', () => {
    assert.equal(toSpecName('   '), '');
  });
});

describe('mapVisibility', () => {
  it('maps editable to included and not readOnly', () => {
    assert.deepEqual(mapVisibility('editable'), { isIncluded: 'Y', isReadOnly: 'N' });
  });

  it('maps readOnly to included and readOnly', () => {
    assert.deepEqual(mapVisibility('readOnly'), { isIncluded: 'Y', isReadOnly: 'Y' });
  });

  it('maps system to included and readOnly', () => {
    assert.deepEqual(mapVisibility('system'), { isIncluded: 'Y', isReadOnly: 'Y' });
  });

  it('maps discarded to not included', () => {
    assert.deepEqual(mapVisibility('discarded'), { isIncluded: 'N', isReadOnly: 'N' });
  });

  it('maps unknown visibility to not included', () => {
    assert.deepEqual(mapVisibility('unknown'), { isIncluded: 'N', isReadOnly: 'N' });
  });

  it('maps undefined to not included', () => {
    assert.deepEqual(mapVisibility(undefined), { isIncluded: 'N', isReadOnly: 'N' });
  });

  it('maps null to not included', () => {
    assert.deepEqual(mapVisibility(null), { isIncluded: 'N', isReadOnly: 'N' });
  });
});

describe('buildWebhookUrl', () => {
  it('builds URL from base and webhook name', () => {
    assert.equal(
      buildWebhookUrl('https://etendo.example.com', 'ConfigureNEO'),
      'https://etendo.example.com/sws/webhooks/ConfigureNEO',
    );
  });

  it('strips trailing slashes from base URL', () => {
    assert.equal(
      buildWebhookUrl('https://etendo.example.com/', 'ConfigureNEO'),
      'https://etendo.example.com/sws/webhooks/ConfigureNEO',
    );
  });

  it('strips multiple trailing slashes', () => {
    assert.equal(
      buildWebhookUrl('https://etendo.example.com///', 'MyHook'),
      'https://etendo.example.com/sws/webhooks/MyHook',
    );
  });
});

describe('extractFieldsFromContract', () => {
  it('extracts fields from single entity', () => {
    const contract = {
      entities: {
        header: {
          tabId: 'tab1',
          tableName: 'C_Order',
          fields: [
            { name: 'documentNo', column: 'DocumentNo', visibility: 'readOnly' },
            { name: 'dateOrdered', column: 'DateOrdered', visibility: 'editable' },
          ],
        },
      },
    };
    const fields = extractFieldsFromContract(contract);
    assert.equal(fields.length, 2);
    assert.equal(fields[0].entityName, 'header');
    assert.equal(fields[0].fieldName, 'documentNo');
    assert.equal(fields[0].column, 'DocumentNo');
    assert.equal(fields[0].visibility, 'readOnly');
    assert.equal(fields[0].tabId, 'tab1');
    assert.equal(fields[0].tableName, 'C_Order');
  });

  it('extracts fields from multiple entities', () => {
    const contract = {
      entities: {
        header: {
          fields: [{ name: 'a', column: 'A', visibility: 'editable' }],
        },
        lines: {
          fields: [
            { name: 'b', column: 'B', visibility: 'readOnly' },
            { name: 'c', column: 'C', visibility: 'discarded' },
          ],
        },
      },
    };
    const fields = extractFieldsFromContract(contract);
    assert.equal(fields.length, 3);
    assert.equal(fields[0].entityName, 'header');
    assert.equal(fields[1].entityName, 'lines');
    assert.equal(fields[2].entityName, 'lines');
  });

  it('handles entity without tabId or tableName', () => {
    const contract = {
      entities: {
        header: {
          fields: [{ name: 'x', column: 'X', visibility: 'editable' }],
        },
      },
    };
    const fields = extractFieldsFromContract(contract);
    assert.equal(fields[0].tabId, null);
    assert.equal(fields[0].tableName, null);
  });

  it('returns empty array for entity with no fields', () => {
    const contract = { entities: { header: { fields: [] } } };
    assert.deepEqual(extractFieldsFromContract(contract), []);
  });

  it('handles empty entities object', () => {
    assert.deepEqual(extractFieldsFromContract({ entities: {} }), []);
  });
});

describe('formatDuplicateFieldsError', () => {
  it('formats a single duplicate correctly', () => {
    const duplicates = [
      { entityName: 'header', columnName: 'DocumentNo', fieldIds: ['ID1', 'ID2'] },
    ];
    const msg = formatDuplicateFieldsError('sales-order', duplicates);
    assert.ok(msg.includes("spec 'sales-order'"));
    assert.ok(msg.includes("entity='header'"));
    assert.ok(msg.includes("column='DocumentNo'"));
    assert.ok(msg.includes('keep:    ID1'));
    assert.ok(msg.includes('delete:  ID2'));
    assert.ok(msg.includes('DELETE FROM etgo_sf_field'));
    assert.ok(msg.includes("'ID2'"));
  });

  it('formats multiple duplicates', () => {
    const duplicates = [
      { entityName: 'header', columnName: 'Col1', fieldIds: ['A', 'B'] },
      { entityName: 'lines', columnName: 'Col2', fieldIds: ['C', 'D', 'E'] },
    ];
    const msg = formatDuplicateFieldsError('test-spec', duplicates);
    assert.ok(msg.includes("entity='header'"));
    assert.ok(msg.includes("entity='lines'"));
    assert.ok(msg.includes('keep:    A'));
    assert.ok(msg.includes('delete:  B'));
    assert.ok(msg.includes('keep:    C'));
    assert.ok(msg.includes('delete:  D'));
    assert.ok(msg.includes('delete:  E'));
    // SQL should list B, D, E for deletion
    assert.ok(msg.includes("'B'"));
    assert.ok(msg.includes("'D'"));
    assert.ok(msg.includes("'E'"));
  });

  it('includes regen hint in the message', () => {
    const msg = formatDuplicateFieldsError('my-window', [
      { entityName: 'e', columnName: 'c', fieldIds: ['x', 'y'] },
    ]);
    assert.ok(msg.includes('make regen ONLY=my-window PUSH_TO_NEO=1'));
  });
});
