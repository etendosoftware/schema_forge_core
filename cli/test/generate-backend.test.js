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
  it('creates event handler data from system field derivations', () => {
    const data = prepareTemplateData(minimalSchema, minimalRules, minimalProcesses);
    assert.ok(data.eventHandlers.length > 0);
    const handler = data.eventHandlers[0];
    assert.ok(handler.derivations.length > 0);
    assert.equal(handler.derivations[0].field, 'organization');
  });

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

  it('creates endpoint data with searchable filters', () => {
    const data = prepareTemplateData(minimalSchema, minimalRules, minimalProcesses);
    assert.ok(data.endpoints.length > 0);
  });
});

describe('generateFileList', () => {
  it('produces a list of files to generate', () => {
    const data = prepareTemplateData(minimalSchema, minimalRules, minimalProcesses);
    const files = generateFileList(data, 'sales-order');
    assert.ok(files.length > 0);
    // Should include java files for event handlers, processes, DTOs, endpoints
    const javaFiles = files.filter(f => f.path.endsWith('.java'));
    assert.ok(javaFiles.length >= 4); // handler + process + DTO + endpoint at minimum
    // Should include build.gradle and dataset.xml
    assert.ok(files.find(f => f.path.includes('build.gradle')));
    assert.ok(files.find(f => f.path.includes('dataset.xml')));
  });
});
