import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(__dirname, '..', 'ImportFromShipmentModal.jsx'), 'utf8');

describe('ImportFromShipmentModal', () => {
  it('exports a default function component', () => {
    assert.match(src, /export default function ImportFromShipmentModal/);
  });

  it('delegates to the shared ImportLinesModal and forwards parent props', () => {
    assert.match(src, /from '@\/components\/contract-ui\/ImportLinesModal'/);
    assert.match(src, /function ImportFromShipmentModal\(props\)/);
    assert.match(src, /<ImportLinesModal[\s\S]*\{\.\.\.props\}/);
  });

  it('fetches shipments and existing invoice lines in parallel', () => {
    assert.match(src, /Promise\.all/);
    assert.match(src, /goods-shipment\/goodsShipment/);
    assert.match(src, /sales-invoice\/lines\?parentId=/);
  });

  it('filters shipments by CO status, matching business partner, and not fully invoiced', () => {
    assert.match(src, /documentStatus\s*===\s*'CO'/);
    assert.match(src, /businessPartner\s*===\s*bpId/);
    assert.match(src, /invoiced\s*!==\s*true/);
  });

  it('tracks already-imported shipment lines and order lines', () => {
    assert.match(src, /alreadyImported/);
    assert.match(src, /goodsShipmentLine/);
    assert.match(src, /salesOrderLine/);
  });

  it('wires the shipment-specific i18n keys for search and empty states', () => {
    assert.match(src, /searchPlaceholderKey="searchShipment"/);
    assert.match(src, /emptyMessageKey="noPendingShipmentsForCustomer"/);
    assert.match(src, /noSearchResultsKey="noShipmentsMatchYourSearch"/);
  });

  it('fetches shipment lines on expand with callout price enrichment', () => {
    assert.match(src, /fetchLines/);
    assert.match(src, /goods-shipment\/goodsShipmentLine\?parentId=/);
    assert.match(src, /resolveLinePrice/);
  });

  it('marks lines as already imported via shipment and order line ids', () => {
    assert.match(src, /_alreadyImported/);
    assert.match(src, /alreadyImportedShipmentLines\?\.has\(l\.id\)/);
    assert.match(src, /alreadyImportedOrderLines\?\.has\(l\.salesOrderLine\)/);
  });

  it('creates invoice lines via POST to sales-invoice/lines', () => {
    assert.match(src, /sales-invoice\/lines/);
    assert.match(src, /method:\s*'POST'/);
  });

  it('wires the success message key so the shared modal can toast on success', () => {
    assert.match(src, /successMessageKey="linesImportedFromShipment"/);
    assert.match(src, /titleKey="importFromShipment"/);
  });

  it('injects fetch/build callbacks so the shared modal can drive line selection', () => {
    assert.match(src, /fetchDocuments=\{fetchDocuments\}/);
    assert.match(src, /fetchLines=\{fetchLines\}/);
    assert.match(src, /getDocDisplay=\{getDocDisplay\}/);
    assert.match(src, /buildLineBody=\{buildLineBody\}/);
  });
});
