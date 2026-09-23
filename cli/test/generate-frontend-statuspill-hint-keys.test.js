import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

// ETP-5436 — an optional `hintKeys` map (code -> i18n key) on a statusPills entry lets
// ONE window attach a table-specific explanation to an otherwise-generic posted-status
// code (see resolveStatusPill's javadoc in the functional repo's
// tools/app-shell/src/lib/postedStatus.js for why this is per-window, not a new case in
// the shared registry). Additive: a statusPills entry with no hintKeys must emit nothing.
describe('generatePageComponent — statusPills hintKeys (ETP-5436)', () => {
  function buildContract(pillExtras = {}, fieldExtras = {}) {
    return {
      frontendContract: {
        window: {
          name: 'Goods Movements',
          category: 'inventory',
          statusPills: [
            { field: 'posted', trueKey: 'postedTrue', falseKey: 'postedFalse', ...pillExtras },
          ],
        },
        entities: {
          header: {
            tableName: 'M_Movement',
            fields: [
              { name: 'documentNo', column: 'DocumentNo', label: 'Document No', type: 'string', visibility: 'editable', form: true, grid: true },
              { name: 'posted', column: 'Posted', label: 'Posted', type: 'boolean', visibility: 'readOnly', form: true, ...fieldExtras },
            ],
          },
        },
      },
      backendContract: { processEndpoints: [] },
    };
  }

  it('emits hintKeys on the pill entry when declared', () => {
    const src = generatePageComponent('header', undefined, buildContract({
      hintKeys: { D: 'goodsMovementsPostedDisabledHint' },
    }));
    assert.match(
      src,
      /key: 'posted', type: 'statusPill', trueKey: 'postedTrue', falseKey: 'postedFalse', hintKeys: \{"D":"goodsMovementsPostedDisabledHint"\}/,
    );
  });

  it('omits hintKeys from the pill entry when not declared (backward compatible)', () => {
    const src = generatePageComponent('header', undefined, buildContract());
    const extraBadgesBlock = src.slice(src.indexOf('const extraBadges'), src.indexOf('const processes'));
    assert.doesNotMatch(extraBadgesBlock, /hintKeys:/);
  });

  it('emits hintKeys after visibleWhenCapability when both are present on the same pill', () => {
    const src = generatePageComponent(
      'header',
      undefined,
      buildContract({ hintKeys: { D: 'someHint' } }, { visibleWhenCapability: 'showAccountingFields' }),
    );
    assert.match(
      src,
      /falseKey: 'postedFalse', visibleWhenCapability: 'showAccountingFields', hintKeys: \{"D":"someHint"\}/,
    );
  });
});
