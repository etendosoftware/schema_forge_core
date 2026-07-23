import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generatePageComponent, generateListModalPage } from '../src/generate-frontend.js';

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

    assert.match(src, /import \{ useWindowAccess, WindowAccessGuard \} from '@\/auth\/AuthContext\.jsx';/);
    assert.match(src, /const windowAccessTier = useWindowAccess\('181'\);/);
    assert.match(src, /if \(windowAccessTier === 'none'\)\s*\{\s*return <WindowAccessGuard windowId="181" \/>;/);
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

// ETP-4520 — generateListModalPage() is a SEPARATE code path from
// generatePageComponent() (list-modal windows: grid + create/edit modal, no
// ListView/DetailView). It previously had none of the windowAccess wiring above,
// so a "none"-tier role could still hit a list-modal window's route directly and
// fetch its data. Same gating contract as generatePageComponent, applied to
// ListModalWindow instead.
describe('generateListModalPage — windowAccess tier gating (ETP-4520)', () => {
  function buildListModalContract(windowExtras = {}) {
    return {
      frontendContract: {
        window: {
          name: 'Match Rules',
          category: 'financial',
          layoutType: 'list-modal',
          ...windowExtras,
        },
        entities: {
          header: {
            tableName: 'ETGO_SF_Match_Rule',
            fields: [
              { name: 'name', column: 'Name', type: 'string', tsType: 'string', visibility: 'editable', required: true, grid: true, form: true, section: 'general' },
            ],
            searchableFields: ['name'],
            computedFields: [],
          },
        },
      },
      backendContract: { processEndpoints: [] },
    };
  }

  it('emits the useWindowAccess hook, the "none" route guard and the effectiveWindow merge when window.id is present', () => {
    const src = generateListModalPage('header', buildListModalContract({ id: '700' }));

    assert.match(src, /import \{ useWindowAccess, WindowAccessGuard \} from '@\/auth\/AuthContext\.jsx';/);
    assert.match(src, /const windowAccessTier = useWindowAccess\('700'\);/);
    assert.match(src, /if \(windowAccessTier === 'none'\)\s*\{\s*return <WindowAccessGuard windowId="700" \/>;/);
    assert.match(src, /const effectiveWindow = useMemo\(/);
    // ListModalWindow must receive the overridden window prop (order-safe:
    // placed after {...props} so it wins the spread).
    assert.match(src, /\{\.\.\.props\}\s*window=\{effectiveWindow\}/);
  });

  it('imports useMemo from react when window.id is present', () => {
    const src = generateListModalPage('header', buildListModalContract({ id: '700' }));
    assert.match(src, /import \{ useMemo \} from 'react';/);
  });

  it('places the "none" guard before the ListModalWindow render', () => {
    const src = generateListModalPage('header', buildListModalContract({ id: '700' }));
    const guardIdx = src.indexOf("if (windowAccessTier === 'none')");
    const renderIdx = src.indexOf('<ListModalWindow');
    assert.ok(guardIdx > -1 && renderIdx > -1, 'both the guard and the render must be present');
    assert.ok(guardIdx < renderIdx, 'the access guard must run before ListModalWindow renders');
  });

  it('omits the entire feature when window.id is absent (legacy/hand-built artifact)', () => {
    const src = generateListModalPage('header', buildListModalContract());

    assert.doesNotMatch(src, /useWindowAccess/);
    assert.doesNotMatch(src, /windowAccessTier/);
    assert.doesNotMatch(src, /effectiveWindow/);
    assert.doesNotMatch(src, /import \{ useMemo \} from 'react';/);
    // No react import at all when the feature isn't emitted — list-modal pages
    // don't otherwise need one.
    assert.doesNotMatch(src, /from 'react';/);
  });

  it('generatePageComponent delegates to generateListModalPage with identical windowAccess wiring', () => {
    const contract = buildListModalContract({ id: '700' });
    const viaPage = generatePageComponent('header', null, contract);
    const viaDirect = generateListModalPage('header', contract);
    assert.equal(viaPage, viaDirect);
  });
});
