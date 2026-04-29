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

  describe('draftMode override for the Confirmar button', () => {
    it('defines a draftModeWithModal with enabled and the soConfirmBtn label', () => {
      assert.match(src, /draftModeWithModal\s*=\s*\{[^}]*enabled:\s*true/);
      assert.match(src, /label:\s*['"]soConfirmBtn['"]/);
    });

    it('routes onConfirm through a custom DOM event so QuotationTopbarActions can pick the right modal', () => {
      assert.match(
        src,
        /onConfirm:\s*\(\)\s*=>\s*window\.dispatchEvent\(\s*new\s+CustomEvent\(\s*['"]sales-quotation:open-confirm-modal['"]/,
      );
    });

    it('passes draftModeWithModal to GeneratedApp on the record view', () => {
      assert.match(src, /draftMode=\{draftModeWithModal\}/);
    });
  });
});
