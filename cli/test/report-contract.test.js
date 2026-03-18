import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateReportContract,
  validateReportContract,
  listAvailableFields,
} from '../src/report-contract.js';

// Minimal schema-curated.json fixture
function sampleSchema() {
  return {
    version: '0.1.0',
    window: { id: '200', name: 'Business Partner', primaryEntity: 'businessPartner', category: 'reference' },
    entities: [{
      name: 'businessPartner',
      tableName: 'C_BPartner',
      fields: [
        { name: 'name', column: 'Name', type: 'string', visibility: 'editable', required: true, grid: true, form: true, searchable: true },
        { name: 'searchKey', column: 'Value', type: 'string', visibility: 'editable', required: true, grid: true, form: true, searchable: true },
        { name: 'taxId', column: 'TaxID', type: 'string', visibility: 'editable', required: false, grid: false, form: true, searchable: false },
        { name: 'creditLimit', column: 'SO_CreditLimit', type: 'amount', visibility: 'editable', required: false, grid: false, form: true, searchable: false },
        { name: 'isActive', column: 'IsActive', type: 'boolean', visibility: 'readOnly', required: true, grid: true, form: true, searchable: false },
        { name: 'adClientId', column: 'AD_Client_ID', type: 'id', visibility: 'system', required: true, grid: false, form: false, searchable: false },
      ],
    }],
  };
}

describe('generateReportContract', () => {
  it('generates a valid report contract from schema', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    assert.equal(contract.version, 1);
    assert.equal(contract.type, 'listing');
    assert.equal(contract.entity, 'business-partner');
    assert.ok(contract.columns.length > 0);
    assert.ok(contract.filters.length >= 0);
    assert.ok(contract.defaultSort);
  });

  it('excludes system fields from columns', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const fieldNames = contract.columns.map(c => c.field);
    assert.ok(!fieldNames.includes('adClientId'));
  });

  it('includes grid fields as columns by default', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const fieldNames = contract.columns.map(c => c.field);
    assert.ok(fieldNames.includes('name'));
    assert.ok(fieldNames.includes('searchKey'));
    assert.ok(fieldNames.includes('isActive'));
  });

  it('generates filters for searchable string fields', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const filterFields = contract.filters.map(f => f.field);
    assert.ok(filterFields.includes('name'));
    assert.ok(filterFields.includes('searchKey'));
  });

  it('generates boolean filters for boolean fields', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const boolFilter = contract.filters.find(f => f.field === 'isActive');
    assert.ok(boolFilter);
    assert.equal(boolFilter.type, 'boolean');
  });

  it('sets default sort to first sortable column', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    assert.ok(contract.defaultSort.field);
    assert.equal(contract.defaultSort.direction, 'asc');
  });

  it('includes reportId as entity + type', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    assert.equal(contract.reportId, 'business-partner-listing');
  });

  it('sets outputs to pdf only (Phase 1)', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    assert.deepEqual(contract.outputs, ['pdf']);
  });
});

describe('validateReportContract', () => {
  it('valid contract passes', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const result = validateReportContract(contract, sampleSchema());
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  it('detects column referencing non-existent field', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    contract.columns.push({ field: 'nonExistent', label: {}, type: 'string' });
    const result = validateReportContract(contract, sampleSchema());
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('nonExistent')));
  });

  it('detects missing required fields', () => {
    const result = validateReportContract({}, sampleSchema());
    assert.equal(result.valid, false);
  });
});

describe('listAvailableFields', () => {
  it('returns fields not in the contract', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const available = listAvailableFields(contract, sampleSchema());
    // taxId and creditLimit are non-grid, should be available
    assert.ok(available.some(f => f.name === 'taxId'));
    assert.ok(available.some(f => f.name === 'creditLimit'));
  });

  it('excludes system fields', () => {
    const contract = generateReportContract(sampleSchema(), 'listing');
    const available = listAvailableFields(contract, sampleSchema());
    assert.ok(!available.some(f => f.name === 'adClientId'));
  });
});
