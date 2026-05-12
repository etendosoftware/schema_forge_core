// Integration tests for the AttachmentsTab integration in generate-frontend.js.
// These exercise the code paths around `windowConfig.attachments` and the
// `layoutType` gate, validating the JSX output of generatePageComponent.

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

import { generatePageComponent } from '../src/generate-frontend.js';

// ---------------------------------------------------------------------------
// Fixture: a minimal master-detail contract. Header entity declares
// `tableName` (required by the attachments integration) and the window-level
// config (`frontendContract.window`) is what feeds windowConfig in the
// generator.
// ---------------------------------------------------------------------------

function buildContract({ layoutType = 'default', attachments } = {}) {
  const windowCfg = {
    id: '143',
    name: 'Test Window',
    primaryEntity: 'header',
    category: 'sales',
  };
  if (layoutType !== 'default') windowCfg.layoutType = layoutType;
  if (attachments !== undefined) windowCfg.attachments = attachments;

  return {
    apiPrediction: {
      specName: 'test-window',
      window: { category: 'sales' },
    },
    frontendContract: {
      window: windowCfg,
      entities: {
        header: {
          tableName: 'C_Test',
          fields: [
            { name: 'documentNo', column: 'DocumentNo', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
            { name: 'docStatus', column: 'DocStatus', type: 'string', tsType: 'string', visibility: 'readOnly', required: true, grid: true, form: true },
          ],
          searchableFields: ['documentNo'],
          computedFields: [],
        },
        detail: {
          tableName: 'C_TestLine',
          fields: [
            { name: 'item', column: 'Item', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true },
          ],
          searchableFields: [],
          computedFields: [],
        },
      },
    },
    backendContract: { processEndpoints: [] },
  };
}

// ---------------------------------------------------------------------------
// 1. Default behaviour — no `window.attachments` override, layoutType=default.
// ---------------------------------------------------------------------------

describe('generate-frontend attachments integration', () => {
  it('emits the AttachmentsTab import and customTabs entry by default', () => {
    const contract = buildContract();
    const code = generatePageComponent('header', 'detail', contract);

    // Import is added.
    assert.match(code, /import \{ AttachmentsTab \} from '@\/components\/attachments';/);
    // customTabs accumulator contains the attachments tab.
    assert.match(code, /key: 'attachments'/);
    assert.match(code, /labelKey: 'attachments'/);
    assert.match(code, /Component: AttachmentsTab/);
    assert.match(code, /placement: 'tab'/);
    // Header tableName is plumbed through.
    assert.match(code, /tableName:\s*"C_Test"/);
    // Default config is an empty object when no opts are provided.
    assert.match(code, /config:\s*\{\}/);
  });

  // -------------------------------------------------------------------------
  // 2. Opt-out via `window.attachments: false`.
  // -------------------------------------------------------------------------

  it('omits AttachmentsTab when window.attachments is false', () => {
    const contract = buildContract({ attachments: false });
    const code = generatePageComponent('header', 'detail', contract);

    assert.ok(!code.includes("import { AttachmentsTab }"), 'should NOT import AttachmentsTab');
    assert.ok(!code.includes("Component: AttachmentsTab"), 'should NOT register the tab');
  });

  // -------------------------------------------------------------------------
  // 3. Opt-out via `{ enabled: false }` object.
  // -------------------------------------------------------------------------

  it('omits AttachmentsTab when window.attachments.enabled is false', () => {
    const contract = buildContract({ attachments: { enabled: false } });
    const code = generatePageComponent('header', 'detail', contract);

    assert.ok(!code.includes("import { AttachmentsTab }"));
    assert.ok(!code.includes("Component: AttachmentsTab"));
  });

  // -------------------------------------------------------------------------
  // 4. layoutType gate — kanban (or any non-default layout) disables the tab.
  // -------------------------------------------------------------------------

  it('does not emit AttachmentsTab on non-default layouts (kanban)', () => {
    const contract = buildContract({ layoutType: 'kanban', attachments: true });
    const code = generatePageComponent('header', 'detail', contract);

    assert.ok(!code.includes("import { AttachmentsTab }"), 'kanban layout must not import AttachmentsTab');
    assert.ok(!code.includes("Component: AttachmentsTab"), 'kanban layout must not register the tab');
  });

  // -------------------------------------------------------------------------
  // 5. Custom options are forwarded as a JSON literal.
  // -------------------------------------------------------------------------

  it('forwards window.attachments options as a JSON config literal', () => {
    const contract = buildContract({
      attachments: { enabled: true, maxSizeMB: 25 },
    });
    const code = generatePageComponent('header', 'detail', contract);

    assert.match(code, /import \{ AttachmentsTab \}/);
    // The exact stringified options object is embedded in the JSX.
    assert.match(code, /config:\s*\{"enabled":true,"maxSizeMB":25\}/);
  });

  // -------------------------------------------------------------------------
  // 6. Safety: when the header entity has no tableName, the tab is disabled
  // even if the user enabled it explicitly. This protects the runtime against
  // building broken endpoints.
  // -------------------------------------------------------------------------

  it('disables AttachmentsTab when the header entity has no tableName', () => {
    const contract = buildContract();
    // Strip the tableName from the contract before generation.
    delete contract.frontendContract.entities.header.tableName;

    const code = generatePageComponent('header', 'detail', contract);
    assert.ok(!code.includes("import { AttachmentsTab }"), 'should NOT import without tableName');
    assert.ok(!code.includes("Component: AttachmentsTab"), 'should NOT register without tableName');
  });
});
