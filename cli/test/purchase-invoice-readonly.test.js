import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Regression tests for ETP-4012.
 *
 * businessPartner, partnerAddress, paymentMethod, paymentTerms, and priceList
 * must have readOnlyLogic: "@Processed@='Y'" in decisions.json, be reflected
 * in contract.json with evaluable=true, and appear as readOnlyLogic in the
 * generated HeaderForm.jsx.
 *
 * orderReference intentionally has NO readOnlyLogic — it must stay editable
 * even on completed invoices (matches Classic AD metadata).
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

const contractPath = resolve(repoRoot, 'artifacts/purchase-invoice/contract.json');
const headerFormPath = resolve(
  repoRoot,
  'artifacts/purchase-invoice/generated/web/purchase-invoice/HeaderForm.jsx',
);
const decisionsPath = resolve(repoRoot, 'artifacts/purchase-invoice/decisions.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getContractHeaderFields() {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  return contract.frontendContract.entities.header.fields;
}

function findContractField(name) {
  return getContractHeaderFields().find((f) => f.name === name);
}

// ---------------------------------------------------------------------------
// contract.json — readOnlyLogic shape
// ---------------------------------------------------------------------------

const READONLY_FIELDS = [
  'businessPartner',
  'partnerAddress',
  'paymentMethod',
  'paymentTerms',
  'priceList',
];

describe('purchase-invoice contract.json — readOnlyLogic (ETP-4012)', () => {
  for (const fieldName of READONLY_FIELDS) {
    it(`${fieldName}.readOnlyLogic.evaluable is true`, () => {
      const field = findContractField(fieldName);
      assert.ok(field, `field "${fieldName}" must exist in contract header`);
      assert.ok(field.readOnlyLogic, `${fieldName}.readOnlyLogic must be defined`);
      assert.equal(
        field.readOnlyLogic.evaluable,
        true,
        `${fieldName}.readOnlyLogic.evaluable must be true`,
      );
    });

    it(`${fieldName}.readOnlyLogic.js references record['processed']`, () => {
      const field = findContractField(fieldName);
      assert.ok(field?.readOnlyLogic?.js, `${fieldName}.readOnlyLogic.js must be a non-empty string`);
      assert.match(
        field.readOnlyLogic.js,
        /record\['processed'\]/,
        `${fieldName}.readOnlyLogic.js must test record['processed']`,
      );
    });
  }

  it('orderReference has no readOnlyLogic (intentionally editable)', () => {
    const field = findContractField('orderReference');
    assert.ok(field, 'field "orderReference" must exist in contract header');
    assert.ok(
      !field.readOnlyLogic,
      'orderReference must not have a readOnlyLogic — it must stay editable on completed invoices',
    );
  });
});

// ---------------------------------------------------------------------------
// decisions.json — raw readOnlyLogic source
// ---------------------------------------------------------------------------

describe('purchase-invoice decisions.json — readOnlyLogic (ETP-4012)', () => {
  function getDecisionsHeaderFields() {
    const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8'));
    // decisions.json v2+ uses: entities.header.fields
    return decisions?.entities?.header?.fields ?? {};
  }

  it('businessPartner.readOnlyLogic equals "@Processed@=\'Y\'"', () => {
    const fields = getDecisionsHeaderFields();
    const bp = fields.businessPartner;
    assert.ok(bp, 'decisions.json entities.header.fields must declare a businessPartner entry');
    assert.equal(
      bp.readOnlyLogic,
      "@Processed@='Y'",
      "businessPartner.readOnlyLogic must be \"@Processed@='Y'\"",
    );
  });

  it('partnerAddress.readOnlyLogic equals "@Processed@=\'Y\'"', () => {
    const fields = getDecisionsHeaderFields();
    const field = fields.partnerAddress;
    assert.ok(field, 'decisions.json entities.header.fields must declare a partnerAddress entry');
    assert.equal(field.readOnlyLogic, "@Processed@='Y'");
  });

  it('userContact.readOnlyLogic equals "@Processed@=\'Y\'"', () => {
    const fields = getDecisionsHeaderFields();
    const field = fields.userContact;
    assert.ok(field, 'decisions.json entities.header.fields must declare a userContact entry');
    assert.equal(field.readOnlyLogic, "@Processed@='Y'");
  });
});

// ---------------------------------------------------------------------------
// generated HeaderForm.jsx — source-reading checks
// ---------------------------------------------------------------------------

describe('purchase-invoice HeaderForm.jsx — readOnlyLogic entries (ETP-4012)', () => {
  const src = readFileSync(headerFormPath, 'utf8');

  it('businessPartner field entry contains readOnlyLogic:', () => {
    // Match the specific field object for businessPartner
    assert.match(
      src,
      /key:\s*'businessPartner'[^}]*readOnlyLogic:/s,
      "businessPartner field must have a readOnlyLogic: property in HeaderForm.jsx",
    );
  });

  it('businessPartner readOnlyLogic tests processed === true', () => {
    assert.match(
      src,
      /key:\s*'businessPartner'[^}]*record\['processed'\]\s*===\s*true/s,
      "businessPartner readOnlyLogic must test record['processed'] === true",
    );
  });

  it('partnerAddress field entry contains readOnlyLogic:', () => {
    // partnerAddress is declared on a single line — avoid [^}]* which stops
    // at the first } inside the nested dependsOn: { ... } object.
    assert.match(
      src,
      /key: 'partnerAddress'.*readOnlyLogic:/,
      "partnerAddress field must have a readOnlyLogic: property in HeaderForm.jsx",
    );
  });

  it('orderReference field entry does NOT contain readOnlyLogic: (must stay editable)', () => {
    // Extract only the object literal for the orderReference field to avoid
    // false positives from other fields that follow it in the array.
    const orderRefMatch = src.match(
      /\{\s*key:\s*'orderReference'[^}]*\}/s,
    );
    assert.ok(orderRefMatch, 'orderReference field object must exist in HeaderForm.jsx');
    assert.doesNotMatch(
      orderRefMatch[0],
      /readOnlyLogic:/,
      "orderReference must NOT have readOnlyLogic — it is intentionally editable on completed invoices",
    );
  });
});
