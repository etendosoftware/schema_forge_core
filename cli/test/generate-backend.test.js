import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { prepareTemplateData, generateFileList } from '../src/generate-backend.js';

const minimalSchema = {
  version: '0.1.0',
  window: { id: '143', name: 'Sales Order', primaryEntity: 'order' },
  entities: [{
    name: 'order',
    table: 'C_Order',
    level: 'header',
    fields: [
      { name: 'documentNo', column: 'DocumentNo', type: 'string', visibility: 'readOnly', required: true },
      { name: 'organization', column: 'AD_Org_ID', type: 'id', visibility: 'system',
        systemCategory: 'internal', derivation: { type: 'fromConfig', source: 'OBContext.getOBContext().getCurrentOrganization()' } },
    ]
  }]
};

const minimalRules = [
  { name: 'calcTotal', type: 'callout', tier: 'auto', autoDecision: 'keep',
    effects: [{ field: 'grandTotal', action: 'setValue' }] }
];

const minimalProcesses = [
  {
    name: 'completeOrder',
    entity: 'order',
    preconditions: [{ field: 'docStatus', operator: 'equals', value: 'DR' }],
    steps: [
      { order: 1, operation: 'validate', target: 'header.docStatus', rule: 'must be Draft' },
      { order: 2, operation: 'mutation', target: 'header.docStatus', value: 'CO' }
    ],
    edgeCases: [{ name: 'alreadyCompleted', trigger: 'docStatus=CO', expected: 'error' }]
  }
];

describe('prepareTemplateData', () => {
  it('creates process data with preconditions', () => {
    const data = prepareTemplateData(minimalSchema, minimalRules, minimalProcesses);
    assert.ok(data.processes.length > 0);
    assert.equal(data.processes[0].className, 'CompleteOrderProcess');
    assert.ok(data.processes[0].preconditions.length > 0);
  });

  it('creates DTO data with only visible fields', () => {
    const data = prepareTemplateData(minimalSchema, minimalRules, minimalProcesses);
    assert.ok(data.dtos.length > 0);
    const dto = data.dtos[0];
    // Only non-system fields in DTO
    assert.ok(dto.fields.every(f => f.name !== 'organization'));
    assert.ok(dto.fields.find(f => f.name === 'documentNo'));
  });

  it('creates handler data with searchable filters', () => {
    const data = prepareTemplateData(minimalSchema, minimalRules, minimalProcesses);
    assert.ok(data.handlers.length > 0);
  });

  it('selectorEndpoint is null when no FK fields with reference data', () => {
    const data = prepareTemplateData(minimalSchema, minimalRules, minimalProcesses);
    assert.equal(data.selectorEndpoint, null, 'no FK fields with reference => null selectorEndpoint');
  });
});

describe('prepareTemplateData with FK fields', () => {
  const fkSchema = {
    version: '0.1.0',
    window: { id: '143', name: 'Sales Order', primaryEntity: 'order' },
    entities: [{
      name: 'order',
      table: 'C_Order',
      level: 'header',
      fields: [
        { name: 'documentNo', column: 'DocumentNo', type: 'string', visibility: 'readOnly', required: true },
        {
          name: 'businessPartner',
          column: 'C_BPartner_ID',
          type: 'foreignKey',
          visibility: 'editable',
          required: true,
          reference: {
            targetTable: 'BusinessPartner',
            displayColumn: 'Name',
            keyColumn: 'C_BPartner_ID',
          },
        },
        {
          name: 'priceList',
          column: 'M_PriceList_ID',
          type: 'foreignKey',
          visibility: 'editable',
          required: false,
          reference: {
            targetTable: 'PricingPriceList',
            displayColumn: 'Name',
            keyColumn: 'M_PriceList_ID',
          },
          validationRule: {
            code: "e.salesPriceList='Y'",
            cascadeParams: ['C_BPartner_ID'],
          },
        },
      ]
    }]
  };

  it('builds selectorEndpoint with correct selectors', () => {
    const data = prepareTemplateData(fkSchema, [], []);
    assert.ok(data.selectorEndpoint, 'should have selectorEndpoint');
    assert.equal(data.selectorEndpoint.className, 'SalesOrderSelectorHandler');
    assert.equal(data.selectorEndpoint.selectors.length, 2);
  });

  it('selector has correct displayProperty from reference', () => {
    const data = prepareTemplateData(fkSchema, [], []);
    const bpSelector = data.selectorEndpoint.selectors.find(s => s.fieldName === 'businessPartner');
    assert.ok(bpSelector);
    assert.equal(bpSelector.displayProperty, 'name');
    assert.equal(bpSelector.entityClass, 'BusinessPartner');
  });

  it('selector has cascade params converted to OBDal property names', () => {
    const data = prepareTemplateData(fkSchema, [], []);
    const plSelector = data.selectorEndpoint.selectors.find(s => s.fieldName === 'priceList');
    assert.ok(plSelector);
    assert.deepEqual(plSelector.cascadeParams, ['cBpartner']);
  });

  it('excludes system FK fields from selectors', () => {
    const schemaWithSystemFK = {
      version: '0.1.0',
      window: { id: '143', name: 'Sales Order', primaryEntity: 'order' },
      entities: [{
        name: 'order',
        table: 'C_Order',
        level: 'header',
        fields: [
          {
            name: 'organization',
            column: 'AD_Org_ID',
            type: 'foreignKey',
            visibility: 'system',
            reference: { targetTable: 'Organization', displayColumn: 'Name', keyColumn: 'AD_Org_ID' },
          },
          {
            name: 'businessPartner',
            column: 'C_BPartner_ID',
            type: 'foreignKey',
            visibility: 'editable',
            reference: { targetTable: 'BusinessPartner', displayColumn: 'Name', keyColumn: 'C_BPartner_ID' },
          },
        ]
      }]
    };
    const data = prepareTemplateData(schemaWithSystemFK, [], []);
    assert.equal(data.selectorEndpoint.selectors.length, 1);
    assert.equal(data.selectorEndpoint.selectors[0].fieldName, 'businessPartner');
  });
});

describe('generateFileList', () => {
  it('produces a list of files to generate', () => {
    const data = prepareTemplateData(minimalSchema, minimalRules, minimalProcesses);
    const files = generateFileList(data, '/tmp/test-module');
    assert.ok(files.length > 0);
    const javaFiles = files.filter(f => f.path.endsWith('.java'));
    assert.ok(javaFiles.length >= 3); // handler + process + DTO at minimum
  });

  it('includes selector endpoint file when FK fields exist', () => {
    const fkSchema = {
      version: '0.1.0',
      window: { id: '143', name: 'Sales Order', primaryEntity: 'order' },
      entities: [{
        name: 'order',
        table: 'C_Order',
        level: 'header',
        fields: [
          {
            name: 'businessPartner',
            column: 'C_BPartner_ID',
            type: 'foreignKey',
            visibility: 'editable',
            reference: { targetTable: 'BusinessPartner', displayColumn: 'Name', keyColumn: 'C_BPartner_ID' },
          },
        ]
      }]
    };
    const data = prepareTemplateData(fkSchema, [], []);
    const files = generateFileList(data, '/tmp/test-module');
    const selectorFile = files.find(f => f.path.includes('SelectorHandler.java'));
    assert.ok(selectorFile, 'should include SelectorHandler.java');
    assert.equal(selectorFile.templateName, 'SelectorEndpoint.java.hbs');
  });

  it('selector handler is registered in HandlerRegistry', () => {
    const fkSchema = {
      version: '0.1.0',
      window: { id: '143', name: 'Sales Order', primaryEntity: 'order' },
      entities: [{
        name: 'order',
        table: 'C_Order',
        level: 'header',
        fields: [
          {
            name: 'businessPartner',
            column: 'C_BPartner_ID',
            type: 'foreignKey',
            visibility: 'editable',
            reference: { targetTable: 'BusinessPartner', displayColumn: 'Name', keyColumn: 'C_BPartner_ID' },
          },
        ]
      }]
    };
    const data = prepareTemplateData(fkSchema, [], []);
    const files = generateFileList(data, '/tmp/test-module');
    const registryFile = files.find(f => f.path.includes('HandlerRegistry.java'));
    assert.ok(registryFile, 'should have HandlerRegistry');
    assert.ok(registryFile.content.includes('SalesOrderSelectorHandler'), 'HandlerRegistry should import and register the selector handler');
  });
});
