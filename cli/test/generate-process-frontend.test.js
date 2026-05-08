import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateProcessFormComponent,
  generateProcessIndex,
  generateAllProcess,
} from '../src/generate-frontend.js';

const mockContract = {
  type: 'process',
  process: { name: 'Generate Invoices', specName: 'generate-invoices', uiPattern: 'S' },
  parameters: [
    { name: 'dateFrom', column: 'DateFrom', type: 'date', tsType: 'string', inputMode: 'date-picker', required: true, defaultValue: '@#Date@' },
    { name: 'businessPartner', column: 'C_BPartner_ID', type: 'foreignKey', tsType: 'string', inputMode: 'search', required: false, referenceValueId: 'BPartnerRef' },
    { name: 'includeVoided', column: 'IncludeVoided', type: 'boolean', tsType: 'boolean', inputMode: 'checkbox', required: false },
  ],
  apiPrediction: { specName: 'generate-invoices', baseUrl: '/sws/neo/generate-invoices', execute: 'POST /sws/neo/generate-invoices' },
};

describe('generateProcessFormComponent', () => {
  const code = generateProcessFormComponent(mockContract);

  it('imports ProcessForm from contract-ui', () => {
    assert.ok(code.includes("import { ProcessForm } from '@/components/contract-ui'"));
  });

  it('uses correct component name (PascalCase + Process)', () => {
    assert.ok(code.includes('GenerateInvoicesProcess'));
    assert.ok(code.includes('export default function GenerateInvoicesProcess'));
  });

  it('includes all parameter keys', () => {
    assert.ok(code.includes("key: 'dateFrom'"));
    assert.ok(code.includes("key: 'businessPartner'"));
    assert.ok(code.includes("key: 'includeVoided'"));
  });

  it('includes required flag for required params', () => {
    assert.ok(code.includes("required: true"));
  });

  it('includes defaultValue when present', () => {
    assert.ok(code.includes("defaultValue: '@#Date@'"));
  });

  it('includes inputMode as type', () => {
    assert.ok(code.includes("type: 'date-picker'"));
    assert.ok(code.includes("type: 'search'"));
    assert.ok(code.includes("type: 'checkbox'"));
  });

  it('includes reference for FK params with referenceValueId', () => {
    assert.ok(code.includes("reference: 'BPartnerRef'"));
  });

  it('includes processConfig with executeUrl', () => {
    assert.ok(code.includes("executeUrl: '/sws/neo/generate-invoices'"));
  });

  it('includes processConfig with specName', () => {
    assert.ok(code.includes("specName: 'generate-invoices'"));
  });
});

describe('generateProcessIndex', () => {
  const code = generateProcessIndex(mockContract);

  it('imports the process component', () => {
    assert.ok(code.includes("import GenerateInvoicesProcess from './GenerateInvoicesProcess'"));
  });

  it('exports App as default', () => {
    assert.ok(code.includes('export default function App'));
  });

  it('passes apiBaseUrl without token props', () => {
    assert.ok(!code.includes('token'), 'generated process entrypoint should not expose token');
    assert.ok(code.includes('apiBaseUrl={apiBaseUrl}'));
  });

  it('includes processMeta', () => {
    assert.ok(code.includes("name: 'Generate Invoices'"));
    assert.ok(code.includes("specName: 'generate-invoices'"));
  });
});

describe('generateAllProcess', () => {
  const files = generateAllProcess(mockContract);

  it('returns correct filenames', () => {
    const keys = Object.keys(files);
    assert.ok(keys.includes('GenerateInvoicesProcess.jsx'));
    assert.ok(keys.includes('index.jsx'));
  });

  it('returns exactly 2 files', () => {
    assert.equal(Object.keys(files).length, 2);
  });

  it('form component file contains ProcessForm import', () => {
    assert.ok(files['GenerateInvoicesProcess.jsx'].includes('ProcessForm'));
  });

  it('index file imports the form component', () => {
    assert.ok(files['index.jsx'].includes('GenerateInvoicesProcess'));
  });
});
