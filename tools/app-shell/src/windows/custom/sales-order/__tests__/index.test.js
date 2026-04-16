import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'index.jsx'), 'utf8');

describe('SalesOrderWindow custom wrapper', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function SalesOrderWindow/);
  });

  it('delegates to GeneratedApp when recordId is present', () => {
    assert.match(src, /GeneratedApp/);
    assert.match(src, /if \(recordId\)/);
  });

  it('renders ListView for the list view (no recordId)', () => {
    assert.match(src, /ListView/);
    assert.match(src, /entity.*header/);
  });

  it('passes onCloneRow to ListView', () => {
    assert.match(src, /onCloneRow/);
    assert.match(src, /setCloneTarget/);
  });

  it('manages cloneTarget state', () => {
    assert.match(src, /useState/);
    assert.match(src, /cloneTarget/);
  });

  it('renders CloneOrderModal via portal when cloneTarget is set', () => {
    assert.match(src, /CloneOrderModal/);
    assert.match(src, /createPortal/);
    assert.match(src, /document\.body/);
  });

  it('passes orderId and data from the clicked row to CloneOrderModal', () => {
    assert.match(src, /orderId.*cloneTarget\.id/);
    assert.match(src, /data.*cloneTarget/);
  });

  it('navigates to the new sales order after a successful clone', () => {
    assert.match(src, /useNavigate/);
    assert.match(src, /\/sales-order\/\$\{newId\}/);
  });

  it('clears cloneTarget on modal close', () => {
    assert.match(src, /setCloneTarget\(null\)/);
  });

  it('builds Authorization headers from the token prop', () => {
    assert.match(src, /Authorization.*Bearer.*token/);
    assert.match(src, /useMemo/);
  });

  it('uses Sales Order entity label and breadcrumb', () => {
    assert.match(src, /Sales Order/);
    assert.match(src, /Sales \/ Sales Order/);
  });

  it('passes hidePrint to ListView', () => {
    assert.match(src, /hidePrint/);
  });

  it('imports HeaderTable from the generated sales-order artifact', () => {
    assert.match(src, /@generated\/sales-order.*HeaderTable/);
  });
});
