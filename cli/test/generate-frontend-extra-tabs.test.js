import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

function readGenerated(specName) {
  return readFileSync(
    join(ROOT, `artifacts/${specName}/generated/web/${specName}/HeaderPage.jsx`),
    'utf8',
  );
}

function readDecisions(specName) {
  return JSON.parse(
    readFileSync(join(ROOT, `artifacts/${specName}/decisions.json`), 'utf8'),
  );
}

// ─── sales-invoice ─────────────────────────────────────────────────────────────

describe('extraTabs — sales-invoice', () => {
  let src;
  let decisions;

  before(() => {
    src = readGenerated('sales-invoice');
    decisions = readDecisions('sales-invoice');
  });

  it('decisions.json declares the sif extraTab', () => {
    const extraTabs = decisions.window?.extraTabs ?? [];
    const sifTab = extraTabs.find(t => t.key === 'sif');
    assert.ok(sifTab, 'extraTabs must contain an entry with key "sif"');
    assert.equal(sifTab.labelKey, 'sifDataTabs.sectionTitle');
    assert.equal(sifTab.component, 'SifTab');
    assert.equal(sifTab.importFrom, '@/windows/custom/shared/SifTab.jsx');
  });

  it('generated HeaderPage imports SifTab from the shared path', () => {
    assert.match(src, /import SifTab from '@\/windows\/custom\/shared\/SifTab\.jsx'/);
  });

  it('generated customTabs includes the sif entry with placement: tab', () => {
    assert.match(src, /key:\s*'sif'/);
    assert.match(src, /labelKey:\s*'sifDataTabs\.sectionTitle'/);
    assert.match(src, /Component:\s*SifTab/);
    assert.match(src, /placement:\s*'tab'.*key:\s*'sif'|key:\s*'sif'.*placement:\s*'tab'/s);
  });

  it('generated customTabs still contains related-documents entry', () => {
    assert.match(src, /key:\s*'related'/);
    assert.match(src, /labelKey:\s*'relatedDocuments'/);
  });

  it('generated customTabs still contains attachments entry with placement: tab', () => {
    assert.match(src, /key:\s*'attachments'/);
    assert.match(src, /Component:\s*AttachmentsTab/);
  });

  it('SifTab import appears before the component definition', () => {
    const importIdx = src.indexOf("import SifTab from '@/windows/custom/shared/SifTab.jsx'");
    const exportIdx = src.indexOf('export default function ');
    assert.ok(importIdx !== -1, 'import must be present');
    assert.ok(importIdx < exportIdx, 'import must appear before the component definition');
  });

  it('does not hardcode a label string for the sif tab (uses labelKey not label)', () => {
    // The generator should emit labelKey, not label: 'SIF' or similar
    assert.doesNotMatch(src, /key:\s*'sif'[^}]*label:\s*['"][^'"]+['"]/);
  });
});

// ─── purchase-invoice ──────────────────────────────────────────────────────────

describe('extraTabs — purchase-invoice', () => {
  let src;
  let decisions;

  before(() => {
    src = readGenerated('purchase-invoice');
    decisions = readDecisions('purchase-invoice');
  });

  it('decisions.json declares the sif extraTab', () => {
    const extraTabs = decisions.window?.extraTabs ?? [];
    const sifTab = extraTabs.find(t => t.key === 'sif');
    assert.ok(sifTab, 'extraTabs must contain an entry with key "sif"');
    assert.equal(sifTab.labelKey, 'sifDataTabs.sectionTitle');
    assert.equal(sifTab.component, 'SifTab');
  });

  it('generated HeaderPage imports SifTab', () => {
    assert.match(src, /import SifTab from '@\/windows\/custom\/shared\/SifTab\.jsx'/);
  });

  it('generated customTabs includes sif with placement: tab', () => {
    assert.match(src, /key:\s*'sif'/);
    assert.match(src, /Component:\s*SifTab/);
    assert.match(src, /placement:\s*'tab'.*key:\s*'sif'|key:\s*'sif'.*placement:\s*'tab'/s);
  });

  it('purchase-invoice sif tab uses same labelKey as sales-invoice', () => {
    assert.match(src, /labelKey:\s*'sifDataTabs\.sectionTitle'/);
  });
});

// ─── generate-frontend.js generator internals ──────────────────────────────────

describe('generate-frontend.js — extraTabs logic (source-reading)', () => {
  let generatorSrc;

  before(() => {
    generatorSrc = readFileSync(
      join(ROOT, 'cli/src/generate-frontend.js'),
      'utf8',
    );
  });

  it('reads extraTabs from windowConfig with a null-coalescing default', () => {
    assert.match(generatorSrc, /windowConfig\.extraTabs\s*\?\?\s*\[\]/);
  });

  it('generates import statements for each extraTab component', () => {
    assert.match(generatorSrc, /extraTabsImport/);
    assert.match(generatorSrc, /importFrom/);
  });

  it('pushes extraTab entries to customTabItems with placement: tab', () => {
    assert.match(generatorSrc, /customTabItems\.push/);
    assert.match(generatorSrc, /placement.*'tab'/);
  });

  it('uses labelKey (not hardcoded label) in the generated tab entry', () => {
    assert.match(generatorSrc, /labelKey.*et\.labelKey/);
  });

  it('includes extraTabsImport in the template string', () => {
    assert.match(generatorSrc, /extraTabsImport/);
  });
});

// ─── pipeline integrity — no window uses customTabs to override sif ────────────

describe('invoice wrapper integrity — sif tab not overridden', () => {
  it('sales-invoice wrapper does not hardcode customTabs that would suppress sif', () => {
    const src = readFileSync(
      join(ROOT, 'tools/app-shell/src/windows/custom/sales-invoice/index.jsx'),
      'utf8',
    );
    // The wrapper must not pass customTabs= to HeaderPage (would override generated tabs)
    assert.doesNotMatch(src, /customTabs=\{/);
  });

  it('purchase-invoice wrapper does not hardcode customTabs', () => {
    const src = readFileSync(
      join(ROOT, 'tools/app-shell/src/windows/custom/purchase-invoice/index.jsx'),
      'utf8',
    );
    assert.doesNotMatch(src, /customTabs=\{/);
  });
});
