import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

// ETP-4269 — window.hideStatusFilter + window.customListIcons code paths.
// Exercises generate-frontend.js lines 1712, 1715, 1975, 1978 and the
// custom-icons import emission (line 2121).
describe('generatePageComponent — hideStatusFilter + customListIcons', () => {
  function buildContract(windowExtras = {}) {
    return {
      frontendContract: {
        window: {
          name: 'Sales Order',
          category: 'sales',
          layoutType: 'document',
          ...windowExtras,
        },
        entities: {
          header: {
            tableName: 'C_Order',
            fields: [
              {
                name: 'documentNo',
                column: 'DocumentNo',
                label: 'Document No',
                type: 'string',
                visibility: 'editable',
                form: true,
                grid: true,
              },
            ],
          },
        },
      },
    };
  }

  it('emits hideStatusFilter, custom sort/refresh icons and the custom-icons import when both flags are true', () => {
    const src = generatePageComponent('header', undefined, buildContract({
      hideStatusFilter: true,
      customListIcons: true,
    }));

    assert.match(src, /hideStatusFilter/);
    assert.match(src, /SortIconComponent=\{SortIcon\}/);
    assert.match(src, /RefreshIconComponent=\{RefreshIcon\}/);
    assert.match(src, /from '@\/components\/ui\/custom-icons'/);
  });

  it('omits the props and the custom-icons import when both flags are false (default)', () => {
    const src = generatePageComponent('header', undefined, buildContract());

    assert.doesNotMatch(src, /hideStatusFilter/);
    assert.doesNotMatch(src, /SortIconComponent=\{SortIcon\}/);
    assert.doesNotMatch(src, /RefreshIconComponent=\{RefreshIcon\}/);
    assert.doesNotMatch(src, /from '@\/components\/ui\/custom-icons'/);
  });
});

// ETP-5101 — window.hideRecordCount code path (record-count badge next to the
// window title, meaningless for tree-view windows like chart-of-accounts).
describe('generatePageComponent — hideRecordCount', () => {
  function buildContract(windowExtras = {}) {
    return {
      frontendContract: {
        window: {
          name: 'Chart of Accounts',
          category: 'accounting',
          layoutType: 'document',
          ...windowExtras,
        },
        entities: {
          header: {
            tableName: 'C_ElementValue',
            fields: [
              {
                name: 'name',
                column: 'Name',
                label: 'Name',
                type: 'string',
                visibility: 'editable',
                form: true,
                grid: true,
              },
            ],
          },
        },
      },
    };
  }

  it('emits hideRecordCount on the ListView call when window.hideRecordCount is true', () => {
    const src = generatePageComponent('header', undefined, buildContract({
      hideRecordCount: true,
    }));

    assert.match(src, /hideRecordCount/);
  });

  it('omits hideRecordCount when the flag is false (default)', () => {
    const src = generatePageComponent('header', undefined, buildContract());

    assert.doesNotMatch(src, /hideRecordCount/);
  });

  it('omits hideRecordCount when the flag is explicitly false', () => {
    const src = generatePageComponent('header', undefined, buildContract({
      hideRecordCount: false,
    }));

    assert.doesNotMatch(src, /hideRecordCount/);
  });
});
