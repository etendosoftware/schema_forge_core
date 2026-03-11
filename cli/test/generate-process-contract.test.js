import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { mapProcessReference, generateProcessContract } from '../src/generate-contract.js';

const mockProcessRaw = {
  process: {
    id: 'TEST123',
    name: 'Generate Invoices',
    description: 'Test process',
    uiPattern: 'S',
    javaClassName: 'com.test.GenInv',
    isReport: false,
    isBackground: false,
  },
  parameters: [
    {
      id: 'P1', name: 'dateFrom', column: 'DateFrom',
      referenceId: '15', referenceName: 'Date', referenceValueId: null,
      mandatory: true, isRange: false, defaultValue: '@#Date@', seqNo: 10,
    },
    {
      id: 'P2', name: 'businessPartner', column: 'C_BPartner_ID',
      referenceId: '19', referenceName: 'TableDir', referenceValueId: null,
      mandatory: false, isRange: false, defaultValue: null, seqNo: 20,
    },
    {
      id: 'P3', name: 'includeVoided', column: 'IncludeVoided',
      referenceId: '20', referenceName: 'YesNo', referenceValueId: null,
      mandatory: false, isRange: false, defaultValue: 'N', seqNo: 30,
    },
  ],
};

describe('mapProcessReference', () => {
  it('maps Date (15) correctly', () => {
    const ref = mapProcessReference('15');
    assert.equal(ref.type, 'date');
    assert.equal(ref.tsType, 'string');
    assert.equal(ref.inputMode, 'date-picker');
  });

  it('maps DateTime (16) correctly', () => {
    const ref = mapProcessReference('16');
    assert.equal(ref.type, 'datetime');
    assert.equal(ref.inputMode, 'datetime-picker');
  });

  it('maps YesNo (20) to boolean', () => {
    const ref = mapProcessReference('20');
    assert.equal(ref.type, 'boolean');
    assert.equal(ref.tsType, 'boolean');
    assert.equal(ref.inputMode, 'checkbox');
  });

  it('maps TableDir (19) to foreignKey', () => {
    const ref = mapProcessReference('19');
    assert.equal(ref.type, 'foreignKey');
    assert.equal(ref.tsType, 'string');
    assert.equal(ref.inputMode, 'search');
  });

  it('maps Table (18) to foreignKey', () => {
    assert.equal(mapProcessReference('18').type, 'foreignKey');
  });

  it('maps Search (30) to foreignKey', () => {
    assert.equal(mapProcessReference('30').type, 'foreignKey');
  });

  it('maps OBUISEL (800011) to foreignKey', () => {
    assert.equal(mapProcessReference('800011').type, 'foreignKey');
  });

  it('maps List (17) to select', () => {
    const ref = mapProcessReference('17');
    assert.equal(ref.type, 'list');
    assert.equal(ref.inputMode, 'select');
  });

  it('maps String (10) to text', () => {
    assert.equal(mapProcessReference('10').inputMode, 'text');
  });

  it('maps Integer (11) to number', () => {
    const ref = mapProcessReference('11');
    assert.equal(ref.type, 'integer');
    assert.equal(ref.tsType, 'number');
  });

  it('maps Amount (12) to number', () => {
    assert.equal(mapProcessReference('12').tsType, 'number');
  });

  it('returns string default for unknown reference', () => {
    const ref = mapProcessReference('9999');
    assert.equal(ref.type, 'string');
    assert.equal(ref.tsType, 'string');
    assert.equal(ref.inputMode, 'text');
  });
});

describe('generateProcessContract', () => {
  const contract = generateProcessContract(mockProcessRaw);

  it('has type "process"', () => {
    assert.equal(contract.type, 'process');
  });

  it('has version 0.1.0', () => {
    assert.equal(contract.version, '0.1.0');
  });

  it('has generatedAt ISO string', () => {
    assert.ok(contract.generatedAt);
    assert.ok(!isNaN(Date.parse(contract.generatedAt)));
  });

  it('has 16-char hex checksum', () => {
    assert.equal(contract.checksum.length, 16);
    assert.ok(/^[0-9a-f]{16}$/.test(contract.checksum));
  });

  it('has correct process info', () => {
    assert.equal(contract.process.id, 'TEST123');
    assert.equal(contract.process.name, 'Generate Invoices');
    assert.equal(contract.process.specName, 'generate-invoices');
    assert.equal(contract.process.uiPattern, 'S');
  });

  it('maps all parameters', () => {
    assert.equal(contract.parameters.length, 3);
  });

  it('maps parameter types correctly', () => {
    const dateParam = contract.parameters.find(p => p.name === 'dateFrom');
    assert.equal(dateParam.type, 'date');
    assert.equal(dateParam.inputMode, 'date-picker');
    assert.equal(dateParam.required, true);
    assert.equal(dateParam.defaultValue, '@#Date@');

    const bpParam = contract.parameters.find(p => p.name === 'businessPartner');
    assert.equal(bpParam.type, 'foreignKey');
    assert.equal(bpParam.required, false);

    const boolParam = contract.parameters.find(p => p.name === 'includeVoided');
    assert.equal(boolParam.type, 'boolean');
    assert.equal(boolParam.inputMode, 'checkbox');
  });

  it('has correct apiPrediction', () => {
    assert.equal(contract.apiPrediction.specName, 'generate-invoices');
    assert.equal(contract.apiPrediction.baseUrl, '/sws/neo/generate-invoices');
    assert.ok(contract.apiPrediction.describe.includes('GET'));
    assert.ok(contract.apiPrediction.execute.includes('POST'));
  });

  it('has correct test count (2*params + 2)', () => {
    const expected = 2 * mockProcessRaw.parameters.length + 2;
    assert.equal(contract.testManifest.summary.total, expected);
  });

  it('has correct test categories', () => {
    const cats = contract.testManifest.summary.byCategory;
    assert.equal(cats['param-presence'], 3);
    assert.equal(cats['param-type'], 3);
    assert.equal(cats['execution-happy'], 1);
    assert.equal(cats['execution-failure'], 1);
  });

  it('has correct runner distribution', () => {
    const runners = contract.testManifest.summary.byRunner;
    assert.equal(runners.node, 6);
    assert.equal(runners.junit, 2);
  });
});
