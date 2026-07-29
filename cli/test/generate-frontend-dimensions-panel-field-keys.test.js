import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

// ---------------------------------------------------------------------------
// generatePageComponent — dimensionsPanelFieldKeys prop (ETP-4610)
// ---------------------------------------------------------------------------
//
// `buildDimensionsPanelColumn` (generateTableComponent) already collects the
// lines-entity fields flagged `dimensionsPanel: true` into ONE synthetic grid
// column (see the "generateTableComponent — dimensionsPanel column (ETP-4529)"
// describe block in generate-frontend.test.js). `generatePageComponent`
// separately forwards the SAME field keys to the generated
// `<DetailView dimensionsPanelFieldKeys={[...]} />` prop, so the functional
// repo's DetailView.jsx can widen — scoped to that one window instance — which
// keys its `lineHiddenColumns` dimension-macro filtering trusts, without
// touching the small global `DIMENSION_MACRO_KEYS` allowlist baked into that
// component (which deliberately excludes 'product' to avoid reintroducing the
// ETP-4530 regression on sales-invoice/purchase-invoice).
//
// These tests only assert on the generated source string (this repo has no
// React renderer) — the runtime behavior of the prop is covered by
// DetailView.lineHiddenColumns.vitest.jsx in the functional repo.

function makeContract({ detailFields } = {}) {
  return {
    frontendContract: {
      window: { id: '950', name: 'Simple GL Journal', primaryEntity: 'header', category: 'financial' },
      entities: {
        header: {
          fields: [
            { name: 'documentNo', column: 'DocumentNo', type: 'string', tsType: 'string',
              visibility: 'readOnly', required: true, grid: true, form: true },
          ],
          searchableFields: ['documentNo'],
          computedFields: [],
        },
        lines: {
          fields: detailFields,
          searchableFields: [],
          computedFields: [],
        },
      },
    },
    backendContract: { processEndpoints: [] },
  };
}

const DIMENSION_FIELDS = [
  { name: 'businessPartner', column: 'C_BPartner_ID', type: 'foreignKey', tsType: 'string',
    visibility: 'editable', required: false, grid: false, form: true, dimensionsPanel: true },
  { name: 'product', column: 'M_Product_ID', type: 'foreignKey', tsType: 'string',
    visibility: 'editable', required: false, grid: false, form: true, dimensionsPanel: true },
  { name: 'project', column: 'C_Project_ID', type: 'foreignKey', tsType: 'string',
    visibility: 'editable', required: false, grid: false, form: true, dimensionsPanel: true },
  { name: 'costCenter', column: 'C_Costcenter_ID', type: 'foreignKey', tsType: 'string',
    visibility: 'editable', required: false, grid: false, form: true, dimensionsPanel: true },
];

const NO_DIMENSION_FIELDS = [
  { name: 'lineNo', column: 'Line', type: 'number', tsType: 'number',
    visibility: 'editable', required: true, grid: true, form: true },
];

describe('generatePageComponent — dimensionsPanelFieldKeys prop (ETP-4610)', () => {
  it('forwards every dimensionsPanel field key on the lines entity to DetailView', () => {
    const code = generatePageComponent('header', 'lines', makeContract({ detailFields: DIMENSION_FIELDS }));
    const match = code.match(/dimensionsPanelFieldKeys=\{(\[[^\]]*\])\}/);
    assert.ok(match, 'dimensionsPanelFieldKeys prop should be emitted on <DetailView>');
    const keys = JSON.parse(match[1]);
    assert.deepEqual(
      keys.sort(),
      ['businessPartner', 'costCenter', 'product', 'project'].sort(),
      'all four dimensionsPanel-flagged field names should be forwarded verbatim (including product)',
    );
  });

  it('is fully additive: an entity with zero dimensionsPanel fields emits no dimensionsPanelFieldKeys prop', () => {
    const code = generatePageComponent('header', 'lines', makeContract({ detailFields: NO_DIMENSION_FIELDS }));
    assert.ok(!code.includes('dimensionsPanelFieldKeys'), 'no dimensionsPanelFieldKeys prop should appear');
  });

  it('excludes discarded dimensionsPanel fields from the forwarded keys', () => {
    const discardedContract = makeContract({
      detailFields: [
        ...DIMENSION_FIELDS,
        { name: 'legacyDimension', column: 'Legacy_ID', type: 'foreignKey', tsType: 'string',
          visibility: 'discarded', required: false, grid: false, form: false, dimensionsPanel: true },
      ],
    });
    const code = generatePageComponent('header', 'lines', discardedContract);
    const match = code.match(/dimensionsPanelFieldKeys=\{(\[[^\]]*\])\}/);
    assert.ok(match, 'dimensionsPanelFieldKeys prop should still be emitted for the non-discarded fields');
    const keys = JSON.parse(match[1]);
    assert.ok(!keys.includes('legacyDimension'), 'a discarded field must never be forwarded');
  });

  it('does not emit the prop for a header-only window (no detail entity)', () => {
    const contract = makeContract({ detailFields: DIMENSION_FIELDS });
    const code = generatePageComponent('header', undefined, contract);
    assert.ok(!code.includes('dimensionsPanelFieldKeys'), 'no detail entity means no dimensionsPanel fields to forward');
  });
});
