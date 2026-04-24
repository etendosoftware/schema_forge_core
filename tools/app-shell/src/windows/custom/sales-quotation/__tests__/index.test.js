import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'index.jsx'), 'utf8');

describe('SalesQuotationWindow custom wrapper', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function SalesQuotationWindow/);
  });

  it('delegates to GeneratedApp', () => {
    assert.match(src, /GeneratedApp/);
  });

  it('wraps the record view in CreateContactContext.Provider', () => {
    assert.match(src, /CreateContactContext\.Provider/);
    assert.match(src, /if \(recordId\)/);
  });

  it('manages cloneTargets state in the list view', () => {
    assert.match(src, /useState/);
    assert.match(src, /cloneTargets/);
  });

  it('forwards onCloneRow to GeneratedApp so it reaches the ListView', () => {
    assert.match(src, /onCloneRow/);
    assert.match(src, /setCloneTargets/);
  });

  it('normalizes a single row into an array before opening the modal', () => {
    assert.match(src, /Array\.isArray\(rowOrRows\)\s*\?\s*rowOrRows\s*:\s*\[rowOrRows\]/);
  });

  it('renders CloneOrderModal via portal when targets are selected', () => {
    assert.match(src, /CloneOrderModal/);
    assert.match(src, /createPortal/);
    assert.match(src, /document\.body/);
  });

  it('passes the sales-quotation route prefix so the modal can navigate to the clone', () => {
    assert.match(src, /routePrefix=["']\/sales-quotation\/["']/);
  });

  it('clears cloneTargets when the modal is closed', () => {
    assert.match(src, /setCloneTargets\(null\)/);
  });

  it('imports CloneOrderModal from contract-ui', () => {
    assert.match(src, /import\s+CloneOrderModal\s+from\s+['"]@\/components\/contract-ui\/CloneOrderModal['"]/);
  });
});
