import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent } from '../src/generate-frontend.js';

// ETP-4520 — window.id-gated per-window access tier ("none" | "read-only" | "full"),
// resolved at runtime from AuthContext.windowAccess (see packages/app-shell-core's
// useWindowAccess). Only emitted when the contract carries a real AD_Window_ID
// (window.id) — legacy/hand-built artifacts without one keep today's behavior.
describe('generatePageComponent — windowAccess tier gating (ETP-4520)', () => {
  function buildContract(windowExtras = {}) {
    return {
      frontendContract: {
        window: {
          name: 'Purchase Order',
          category: 'purchases',
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
      backendContract: { processEndpoints: [] },
    };
  }

  it('emits the useWindowAccess hook, the "none" route guard and the effectiveWindow merge when window.id is present', () => {
    const src = generatePageComponent('header', undefined, buildContract({ id: '181' }));

    assert.match(src, /import \{ useWindowAccess \} from '@\/auth\/AuthContext\.jsx';/);
    assert.match(src, /import \{ useUI \} from '@\/i18n';/);
    assert.match(src, /const windowAccessTier = useWindowAccess\('181'\);/);
    assert.match(src, /if \(windowAccessTier === 'none'\)/);
    assert.match(src, /data-testid="window-access-denied"/);
    assert.match(src, /const effectiveWindow = useMemo\(/);
    // Both ListView and DetailView must receive the overridden window prop
    // (order-safe: placed after {...props} so it wins the spread).
    assert.match(src, /\{\.\.\.props\}\s*window=\{effectiveWindow\}/);
  });

  it('imports useMemo alongside useEffect when window.id is present', () => {
    const src = generatePageComponent('header', undefined, buildContract({ id: '181' }));
    assert.match(src, /import \{ useMemo, useEffect \} from 'react';/);
  });

  it('omits the entire feature when window.id is absent (legacy/hand-built artifact)', () => {
    const src = generatePageComponent('header', undefined, buildContract());

    assert.doesNotMatch(src, /useWindowAccess/);
    assert.doesNotMatch(src, /windowAccessTier/);
    assert.doesNotMatch(src, /effectiveWindow/);
    assert.doesNotMatch(src, /window-access-denied/);
    assert.match(src, /import \{ useEffect \} from 'react';/);
  });

  it('places the "none" guard before the recordId branch so no data fetch happens for either list or detail routes', () => {
    const src = generatePageComponent('header', undefined, buildContract({ id: '181' }));
    const guardIdx = src.indexOf("if (windowAccessTier === 'none')");
    const recordIdIdx = src.indexOf('if (recordId) {');
    assert.ok(guardIdx > -1 && recordIdIdx > -1, 'both branches must be present');
    assert.ok(guardIdx < recordIdIdx, 'the access guard must run before the recordId branch');
  });
});
