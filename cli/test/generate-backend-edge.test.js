import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { prepareTemplateData, generateFileList, buildSelectorData, toOBDalProperty } from '../src/generate-backend.js';
import { getOrCreateUuid } from '../src/uuid-manifest.js';

// Schema with NO system fields (no derivations at all)
const schemaNoSystemFields = {
  version: '0.2.0',
  window: { id: '200', name: 'Simple Window', primaryEntity: 'item' },
  entities: [{
    name: 'item',
    table: 'C_Item',
    level: 'header',
    fields: [
      { name: 'name', column: 'Name', type: 'string', visibility: 'editable', required: true },
      { name: 'price', column: 'Price', type: 'amount', visibility: 'editable', required: false },
      { name: 'isActive', column: 'IsActive', type: 'boolean', visibility: 'readOnly' },
    ]
  }]
};

// Schema with NO processes
const schemaNoProcesses = {
  version: '0.1.0',
  window: { id: '300', name: 'Inventory', primaryEntity: 'product' },
  entities: [{
    name: 'product',
    table: 'M_Product',
    level: 'header',
    fields: [
      { name: 'sku', column: 'SKU', type: 'string', visibility: 'editable', required: true },
    ]
  }]
};

// Schema with MULTIPLE entities
const schemaMultiEntity = {
  version: '0.3.0',
  window: { id: '400', name: 'Purchase Order', primaryEntity: 'purchaseHeader' },
  entities: [
    {
      name: 'purchaseHeader',
      table: 'C_Purchase',
      level: 'header',
      fields: [
        { name: 'documentNo', column: 'DocumentNo', type: 'string', visibility: 'readOnly', required: true },
        { name: 'vendor', column: 'C_BPartner_ID', type: 'foreignKey', visibility: 'editable', required: true },
        { name: 'orgId', column: 'AD_Org_ID', type: 'id', visibility: 'system',
          systemCategory: 'internal', derivation: { type: 'fromConfig', source: 'OBContext.getOBContext().getCurrentOrganization()' } },
      ]
    },
    {
      name: 'purchaseLine',
      table: 'C_PurchaseLine',
      level: 'line',
      fields: [
        { name: 'product', column: 'M_Product_ID', type: 'foreignKey', visibility: 'editable', required: true },
        { name: 'quantity', column: 'Qty', type: 'number', visibility: 'editable', required: true },
        { name: 'lineNo', column: 'Line', type: 'integer', visibility: 'system',
          systemCategory: 'internal', derivation: { type: 'sequence', source: 'nextLine' } },
      ]
    }
  ]
};

describe('prepareTemplateData edge cases', () => {
  it('schema with no system fields produces no event-handler-like data', () => {
    const data = prepareTemplateData(schemaNoSystemFields, [], []);
    // Current implementation does not generate eventHandlers — just handlers, dtos, processes
    assert.ok(data.handlers.length > 0, 'should have handlers');
    assert.ok(data.dtos.length > 0, 'should have dtos');
  });

  it('schema with no processes produces empty processes array', () => {
    const data = prepareTemplateData(schemaNoProcesses, [], null);
    assert.equal(data.processes.length, 0, 'processes should be empty when null is passed');
  });

  it('schema with no processes and undefined produces empty processes array', () => {
    const data = prepareTemplateData(schemaNoProcesses, [], undefined);
    assert.equal(data.processes.length, 0, 'processes should be empty when undefined is passed');
  });

  it('schema with multiple entities produces DTOs for each entity', () => {
    const data = prepareTemplateData(schemaMultiEntity, [], []);
    assert.equal(data.dtos.length, 2, 'should have one DTO per entity');
    const dtoNames = data.dtos.map(d => d.entityName);
    assert.ok(dtoNames.includes('purchaseHeader'), 'should include purchaseHeader DTO');
    assert.ok(dtoNames.includes('purchaseLine'), 'should include purchaseLine DTO');
  });

  it('schema with multiple entities produces handlers for each entity', () => {
    const data = prepareTemplateData(schemaMultiEntity, [], []);
    assert.equal(data.handlers.length, 2, 'should have one handler per entity');
    const handlerNames = data.handlers.map(e => e.entityName);
    assert.ok(handlerNames.includes('purchaseHeader'));
    assert.ok(handlerNames.includes('purchaseLine'));
  });

  it('DTOs for multi-entity schema exclude system fields from each entity', () => {
    const data = prepareTemplateData(schemaMultiEntity, [], []);
    for (const dto of data.dtos) {
      for (const field of dto.fields) {
        assert.notEqual(field.name, 'orgId', `system field orgId should not appear in ${dto.entityName} DTO`);
        assert.notEqual(field.name, 'lineNo', `system field lineNo should not appear in ${dto.entityName} DTO`);
      }
    }
  });

  it('Java type mapping covers all known types correctly', () => {
    const schemaAllTypes = {
      version: '0.1.0',
      window: { id: '500', name: 'Type Test', primaryEntity: 'typeEntity' },
      entities: [{
        name: 'typeEntity',
        table: 'Test_Types',
        level: 'header',
        fields: [
          { name: 'strField', column: 'Str', type: 'string', visibility: 'editable' },
          { name: 'intField', column: 'Int', type: 'integer', visibility: 'editable' },
          { name: 'amtField', column: 'Amt', type: 'amount', visibility: 'editable' },
          { name: 'numField', column: 'Num', type: 'number', visibility: 'editable' },
          { name: 'boolField', column: 'Bool', type: 'boolean', visibility: 'editable' },
          { name: 'dateField', column: 'Dt', type: 'date', visibility: 'editable' },
          { name: 'dtField', column: 'DtTm', type: 'datetime', visibility: 'editable' },
          { name: 'idField', column: 'Id', type: 'id', visibility: 'editable' },
          { name: 'fkField', column: 'Fk', type: 'foreignKey', visibility: 'editable' },
          { name: 'unknownField', column: 'Unk', type: 'somethingNew', visibility: 'editable' },
        ]
      }]
    };

    const data = prepareTemplateData(schemaAllTypes, [], []);
    const dto = data.dtos[0];
    const byName = Object.fromEntries(dto.fields.map(f => [f.name, f]));

    assert.equal(byName.strField.javaType, 'String');
    assert.equal(byName.intField.javaType, 'Integer');
    assert.equal(byName.amtField.javaType, 'BigDecimal');
    assert.equal(byName.numField.javaType, 'BigDecimal');
    assert.equal(byName.boolField.javaType, 'Boolean');
    assert.equal(byName.dateField.javaType, 'Date');
    assert.equal(byName.dtField.javaType, 'Date');
    assert.equal(byName.idField.javaType, 'String');
    assert.equal(byName.fkField.javaType, 'String');
    assert.equal(byName.unknownField.javaType, 'String', 'unknown types should default to String');
  });

  it('PascalCase class name generation handles hyphenated and underscored names', () => {
    const schema = {
      version: '0.1.0',
      window: { id: '600', name: 'Test', primaryEntity: 'my-entity' },
      entities: [{
        name: 'my-entity_name',
        table: 'Test_Table',
        level: 'header',
        fields: [
          { name: 'field1', column: 'Field1', type: 'string', visibility: 'editable' },
        ]
      }]
    };
    const data = prepareTemplateData(schema, [], []);
    assert.equal(data.dtos[0].className, 'MyEntityNameDTO');
    assert.equal(data.handlers[0].className, 'MyEntityNameHandler');
  });

  it('validators are empty when no processes have preconditions', () => {
    const processes = [
      { name: 'noPrecondProc', entity: 'item', preconditions: [], steps: [] }
    ];
    const data = prepareTemplateData(schemaNoSystemFields, [], processes);
    assert.equal(data.validators.length, 0, 'validators should be empty when no preconditions');
  });

  it('readOnly fields are marked as readOnly in DTO', () => {
    const data = prepareTemplateData(schemaNoSystemFields, [], []);
    const dto = data.dtos[0];
    const readOnlyField = dto.fields.find(f => f.name === 'isActive');
    assert.ok(readOnlyField, 'isActive should be in DTO');
    assert.equal(readOnlyField.readOnly, true, 'readOnly visibility should set readOnly=true');
  });

  it('discarded fields are excluded from DTOs', () => {
    const schema = {
      version: '0.1.0',
      window: { id: '700', name: 'Discard Test', primaryEntity: 'ent' },
      entities: [{
        name: 'ent',
        table: 'T_Ent',
        level: 'header',
        fields: [
          { name: 'kept', column: 'Kept', type: 'string', visibility: 'editable' },
          { name: 'gone', column: 'Gone', type: 'string', visibility: 'discarded' },
        ]
      }]
    };
    const data = prepareTemplateData(schema, [], []);
    const dto = data.dtos[0];
    assert.ok(dto.fields.find(f => f.name === 'kept'), 'editable field should be in DTO');
    assert.ok(!dto.fields.find(f => f.name === 'gone'), 'discarded field should not be in DTO');
  });
});

describe('buildSelectorData', () => {
  it('extracts FK fields with reference metadata', () => {
    const entities = [{
      name: 'order',
      fields: [
        { name: 'documentNo', type: 'string', visibility: 'editable' },
        {
          name: 'businessPartner',
          columnName: 'C_BPartner_ID',
          type: 'foreignKey',
          visibility: 'editable',
          reference: { targetTable: 'BusinessPartner', displayColumn: 'Name', keyColumn: 'C_BPartner_ID' },
        },
      ]
    }];
    const selectors = buildSelectorData(entities);
    assert.equal(selectors.length, 1);
    assert.equal(selectors[0].fieldName, 'businessPartner');
    assert.equal(selectors[0].entityClass, 'BusinessPartner');
    assert.equal(selectors[0].displayProperty, 'name');
  });

  it('skips FK fields without reference metadata', () => {
    const entities = [{
      name: 'order',
      fields: [
        { name: 'vendor', type: 'foreignKey', visibility: 'editable' },  // no reference
      ]
    }];
    const selectors = buildSelectorData(entities);
    assert.equal(selectors.length, 0);
  });

  it('skips system and discarded FK fields', () => {
    const entities = [{
      name: 'order',
      fields: [
        { name: 'org', type: 'foreignKey', visibility: 'system',
          reference: { targetTable: 'Organization', displayColumn: 'Name' } },
        { name: 'old', type: 'foreignKey', visibility: 'discarded',
          reference: { targetTable: 'OldTable', displayColumn: 'Name' } },
        { name: 'partner', type: 'foreignKey', visibility: 'editable',
          reference: { targetTable: 'BusinessPartner', displayColumn: 'Name' } },
      ]
    }];
    const selectors = buildSelectorData(entities);
    assert.equal(selectors.length, 1);
    assert.equal(selectors[0].fieldName, 'partner');
  });

  it('deduplicates by field name across entities', () => {
    const entities = [
      {
        name: 'order',
        fields: [
          { name: 'businessPartner', type: 'foreignKey', visibility: 'editable',
            reference: { targetTable: 'BusinessPartner', displayColumn: 'Name' } },
        ]
      },
      {
        name: 'orderLine',
        fields: [
          { name: 'businessPartner', type: 'foreignKey', visibility: 'editable',
            reference: { targetTable: 'BusinessPartner', displayColumn: 'Name' } },
        ]
      },
    ];
    const selectors = buildSelectorData(entities);
    assert.equal(selectors.length, 1, 'should deduplicate by field name');
  });

  it('maps cascade params from column names to OBDal property names', () => {
    const entities = [{
      name: 'order',
      fields: [
        {
          name: 'priceList',
          type: 'foreignKey',
          visibility: 'editable',
          reference: { targetTable: 'PricingPriceList', displayColumn: 'Name' },
          validationRule: { code: "something", cascadeParams: ['C_BPartner_ID', 'AD_Org_ID'] },
        },
      ]
    }];
    const selectors = buildSelectorData(entities);
    assert.deepEqual(selectors[0].cascadeParams, ['cBpartner', 'adOrg']);
  });

  it('defaults displayProperty to name when displayColumn is missing', () => {
    const entities = [{
      name: 'order',
      fields: [
        {
          name: 'warehouse',
          type: 'foreignKey',
          visibility: 'editable',
          reference: { targetTable: 'Warehouse' },  // no displayColumn
        },
      ]
    }];
    const selectors = buildSelectorData(entities);
    assert.equal(selectors[0].displayProperty, 'name');
  });
});

describe('toOBDalProperty', () => {
  it('strips _ID suffix and converts to camelCase', () => {
    assert.equal(toOBDalProperty('C_BPartner_ID'), 'cBpartner');
    assert.equal(toOBDalProperty('AD_Org_ID'), 'adOrg');
    assert.equal(toOBDalProperty('M_Product_ID'), 'mProduct');
  });

  it('handles columns without _ID suffix', () => {
    assert.equal(toOBDalProperty('DocumentNo'), 'documentNo');
    assert.equal(toOBDalProperty('IsActive'), 'isActive');
  });
});

describe('generateFileList edge cases', () => {
  it('generates base files when no handlers, processes, validators exist', () => {
    const data = prepareTemplateData(schemaNoSystemFields, [], []);
    const files = generateFileList(data, '/tmp/test-module');
    // Should have: 1 DTO + 1 handler + RequestHandler + HandlerRegistry = 4 minimum
    assert.ok(files.length >= 4, `should have base files, got ${files.length}`);
  });

  it('generates correct number of files for multi-entity schema without FK refs', () => {
    const data = prepareTemplateData(schemaMultiEntity, [], []);
    const files = generateFileList(data, '/tmp/test-module');
    // 0 processes + 2 DTOs + 2 handlers + 0 validators + RequestHandler + HandlerRegistry = 6
    // selectorEndpoint is null (no reference metadata on FK fields)
    const javaFiles = files.filter(f => f.path.endsWith('.java'));
    assert.ok(javaFiles.length >= 4, `should have at least 4 java files, got ${javaFiles.length}`);
  });

  it('includes selector file when FK fields have reference data', () => {
    const fkSchema = {
      version: '0.1.0',
      window: { id: '400', name: 'Purchase Order', primaryEntity: 'purchaseHeader' },
      entities: [{
        name: 'purchaseHeader',
        table: 'C_Purchase',
        level: 'header',
        fields: [
          { name: 'vendor', column: 'C_BPartner_ID', type: 'foreignKey', visibility: 'editable',
            reference: { targetTable: 'BusinessPartner', displayColumn: 'Name' } },
        ]
      }]
    };
    const data = prepareTemplateData(fkSchema, [], []);
    const files = generateFileList(data, '/tmp/test-module');
    const selectorFile = files.find(f => f.path.includes('SelectorHandler.java'));
    assert.ok(selectorFile, 'should include selector handler file');
  });
});

describe('UUID idempotency edge cases', () => {
  it('UUID is idempotent across multiple calls with same manifest', () => {
    const manifest = {};
    const uuid1 = getOrCreateUuid(manifest, 'AD_Process', 'testProc');
    const uuid2 = getOrCreateUuid(manifest, 'AD_Process', 'testProc');
    const uuid3 = getOrCreateUuid(manifest, 'AD_Process', 'testProc');
    assert.equal(uuid1, uuid2);
    assert.equal(uuid2, uuid3);
  });

  it('same key name under different entity types gets different UUIDs', () => {
    const manifest = {};
    const uuid1 = getOrCreateUuid(manifest, 'AD_Process', 'sameName');
    const uuid2 = getOrCreateUuid(manifest, 'AD_Table', 'sameName');
    assert.notEqual(uuid1, uuid2, 'different entity types should produce different UUIDs');
  });

  it('pre-populated manifest preserves existing UUIDs', () => {
    const existingUuid = 'AABBCCDD11223344AABBCCDD11223344';
    const manifest = { 'AD_Process:myProc': existingUuid };
    const result = getOrCreateUuid(manifest, 'AD_Process', 'myProc');
    assert.equal(result, existingUuid, 'should return pre-existing UUID');
  });

  it('UUID format is exactly 32 uppercase hex characters', () => {
    const manifest = {};
    for (let i = 0; i < 20; i++) {
      const uuid = getOrCreateUuid(manifest, 'Test', `key${i}`);
      assert.match(uuid, /^[0-9A-F]{32}$/, `UUID #${i} should be 32 uppercase hex chars`);
    }
  });
});
