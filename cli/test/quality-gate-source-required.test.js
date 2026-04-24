import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';

describe('resolveCurated sourceRequired metadata', () => {
  it('preserves raw mandatory information on curated fields', async () => {
    const schemaRaw = {
      window: { id: '1', name: 'Sales Order' },
      entities: [{
        name: 'cOrder',
        tableName: 'C_Order',
        tabId: '10',
        tabName: 'Header',
        fields: [{
          name: 'documentNo',
          columnName: 'DocumentNo',
          label: 'Document No.',
          type: 'string',
          visibility: 'editable',
          mandatory: true,
        }],
      }],
    };

    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, {
      version: 2,
      window: {},
      entities: {},
    });

    assert.equal(schema.entities[0].fields[0].sourceRequired, true);
  });
});
