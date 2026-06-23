// Unit tests for getMenuActionsProp — menuAction handler precedence.
// ETP-4298: adds the `action` kind (declarative NEO action endpoint) to the
// existing precedence: documentAction > columnName > action (neoAction) > onClick.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMenuActionsProp } from '../src/generate-frontend.js';

describe('getMenuActionsProp — handler precedence', () => {
  it('emits neoAction for a menuAction with `action`', () => {
    const out = getMenuActionsProp(
      [{ key: 'post', label: 'Post', labelKey: 'post', action: 'post', successKey: 'documentPosted' }],
      '({ row, status })',
    );
    assert.match(out, /key: 'post'/);
    assert.match(out, /label: 'Post'/);
    assert.match(out, /labelKey: 'post'/);
    assert.match(out, /successKey: 'documentPosted'/);
    assert.match(out, /neoAction: 'post'/);
    // Must NOT fall through to the empty onClick placeholder.
    assert.ok(!/onClick: \(\) => \{\}/.test(out), 'should not emit empty onClick when action is set');
  });

  it('prefers documentAction over action when both are present', () => {
    const out = getMenuActionsProp(
      [{ key: 'complete', label: 'Complete', documentAction: 'CO', action: 'post' }],
      '({ row, status })',
    );
    assert.match(out, /documentAction: 'CO'/);
    assert.ok(!/neoAction:/.test(out), 'documentAction must win over action');
  });

  it('prefers columnName over action when both are present', () => {
    const out = getMenuActionsProp(
      [{ key: 'proc', label: 'Process', columnName: 'processNow', action: 'post' }],
      '({ row, status })',
    );
    assert.match(out, /columnName: 'processNow'/);
    assert.ok(!/neoAction:/.test(out), 'columnName must win over action');
  });

  it('falls back to empty onClick when no handler kind is set', () => {
    const out = getMenuActionsProp(
      [{ key: 'noop', label: 'NoOp' }],
      '({ row, status })',
    );
    assert.match(out, /onClick: \(\) => \{\}/);
  });

  it('returns empty string when there are no menu actions', () => {
    assert.equal(getMenuActionsProp([], '({ row, status })'), '');
  });
});
