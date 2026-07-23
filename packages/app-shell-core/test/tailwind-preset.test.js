import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import preset from '../src/tailwind-preset.js';

describe('semantic Tailwind theme API (ETP-4554)', () => {
  const colors = preset.theme.extend.colors;

  it('maps every public semantic token', () => {
    assert.equal(colors.border.control, 'hsl(var(--border-control))');
    assert.equal(colors.border.structural, 'hsl(var(--border-structural))');
    assert.equal(colors.border.subtle, 'hsl(var(--border-subtle))');
    assert.equal(colors['text-secondary'], 'hsl(var(--text-secondary))');
    assert.equal(colors['text-disabled'], 'hsl(var(--text-disabled))');
    assert.equal(colors['icon-secondary'], 'hsl(var(--icon-secondary))');
    assert.equal(colors['focus-ring'], 'hsl(var(--focus-ring))');
    assert.equal(colors.inverse.DEFAULT, 'hsl(var(--inverse))');
    assert.equal(colors.inverse.foreground, 'hsl(var(--inverse-foreground))');
    assert.equal(colors.status.success.DEFAULT, 'var(--status-success-bg)');
    assert.equal(colors.status.success.foreground, 'var(--status-success-fg)');
    assert.equal(colors.status.warning.border, 'var(--status-warning-border)');
    assert.equal(colors.status.info.DEFAULT, 'var(--status-info-bg)');
    assert.equal(colors.status.neutral.foreground, 'var(--status-neutral-fg)');
  });
});
