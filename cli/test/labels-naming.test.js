// JO-06 + IV-08 — Assertion tests for window.labelOverrides on contacts and
// sales-quotation, plus a hygiene regression for the sales-quotation custom
// wrapper (must NOT re-add the local LABEL_OVERRIDES that used to override
// DateOrdered to "Fecha cotización").
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../..');

function loadDecisions(name) {
  return JSON.parse(
    readFileSync(resolve(repoRoot, 'artifacts', name, 'decisions.json'), 'utf-8'),
  );
}

// ── JO-06 — Vendor account label in contacts ────────────────────────────────

describe('JO-06 — contacts: PO_Financial_Account_ID labelOverride', () => {
  const decisions = loadDecisions('contacts');
  const labelOverrides = decisions?.window?.labelOverrides ?? {};

  it('decisions.json carries window.labelOverrides for both locales', () => {
    assert.ok(labelOverrides.es_ES, 'es_ES labelOverrides must exist');
    assert.ok(labelOverrides.en_US, 'en_US labelOverrides must exist');
  });

  it('PO_Financial_Account_ID es_ES is "Cuenta contable de gastos"', () => {
    assert.equal(
      labelOverrides.es_ES.PO_Financial_Account_ID,
      'Cuenta contable de gastos',
    );
  });

  it('PO_Financial_Account_ID en_US is "Expense Account"', () => {
    assert.equal(labelOverrides.en_US.PO_Financial_Account_ID, 'Expense Account');
  });

  it('PO_Financial_Account_ID es_ES is not the legacy "Cuenta"', () => {
    // Regression guard: the vendor field used to share the customer label.
    assert.notEqual(labelOverrides.es_ES.PO_Financial_Account_ID, 'Cuenta');
  });

  it('FIN_Financial_Account_ID (customer block) stays "Cuenta" / "Account"', () => {
    assert.equal(labelOverrides.es_ES.FIN_Financial_Account_ID, 'Cuenta');
    assert.equal(labelOverrides.en_US.FIN_Financial_Account_ID, 'Account');
  });
});

// ── IV-08 — Sales-quotation: DateOrdered label + wrapper hygiene ─────────────

describe('IV-08 — sales-quotation: DateOrdered labelOverride', () => {
  const decisions = loadDecisions('sales-quotation');
  const labelOverrides = decisions?.window?.labelOverrides ?? {};

  it('decisions.json carries window.labelOverrides for both locales', () => {
    assert.ok(labelOverrides.es_ES, 'es_ES labelOverrides must exist');
    assert.ok(labelOverrides.en_US, 'en_US labelOverrides must exist');
  });

  it('DateOrdered es_ES is "Fecha de presupuesto"', () => {
    assert.equal(labelOverrides.es_ES.DateOrdered, 'Fecha de presupuesto');
  });

  it('DateOrdered en_US is "Quotation Date"', () => {
    assert.equal(labelOverrides.en_US.DateOrdered, 'Quotation Date');
  });

  it('DateOrdered es_ES is not the legacy "Fecha cotización"', () => {
    assert.notEqual(labelOverrides.es_ES.DateOrdered, 'Fecha cotización');
  });
});

describe('IV-08 — sales-quotation custom wrapper hygiene', () => {
  const wrapperPath = resolve(
    repoRoot,
    'tools/app-shell/src/windows/custom/sales-quotation/index.jsx',
  );
  const src = readFileSync(wrapperPath, 'utf-8');

  it('does not contain the legacy literal "Fecha cotización"', () => {
    // Regression guard: nobody should re-add a local override that fights
    // decisions.json. The whole point of IV-08 is that the label is driven
    // from decisions.json now.
    assert.equal(
      src.includes('Fecha cotización'),
      false,
      'Legacy literal "Fecha cotización" must not appear in the wrapper.',
    );
  });

  it('does not declare a LABEL_OVERRIDES constant', () => {
    // Specifically guards against a `const LABEL_OVERRIDES = { ... }` block
    // (any whitespace), which was the structure used by the deleted code.
    assert.doesNotMatch(
      src,
      /const\s+LABEL_OVERRIDES\s*=/,
      'LABEL_OVERRIDES constant must not be re-introduced in the wrapper.',
    );
  });

  it('does not pass labelOverrides={LABEL_OVERRIDES} to a child component', () => {
    assert.doesNotMatch(
      src,
      /labelOverrides\s*=\s*\{\s*LABEL_OVERRIDES\s*\}/,
      'Wrapper must not forward a local LABEL_OVERRIDES (decisions.json owns this).',
    );
  });
});
