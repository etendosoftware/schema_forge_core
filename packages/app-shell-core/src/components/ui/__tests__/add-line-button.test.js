import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_STYLE,
  DIVIDER_STYLE,
  ICON_COLOR,
  TEXT_COLOR,
  BUTTON_HEIGHT,
  BUTTON_BORDER_COLOR,
} from '../add-line-button-tokens.js';

describe('AddLineButton — semantic accessibility tokens (ETP-4554)', () => {
  it('height is 32px per Figma spec', () => assert.equal(GROUP_STYLE.height, 32));
  it('uses the semantic control border', () => assert.equal(GROUP_STYLE.border, '1px solid hsl(var(--border-control))'));
  it('border-radius is 8px per Figma spec', () => assert.equal(GROUP_STYLE.borderRadius, 8));
  it('uses the semantic card surface', () => assert.equal(GROUP_STYLE.background, 'hsl(var(--card))'));
  it('has drop shadow from Figma', () => assert.ok(GROUP_STYLE.boxShadow.includes('rgba(18, 18, 23')));
  it('uses Inter font family', () => assert.ok(GROUP_STYLE.fontFamily.includes('Inter')));
  it('fits content width', () => assert.equal(GROUP_STYLE.width, 'fit-content'));
});

describe('AddLineButton — DIVIDER_STYLE', () => {
  it('divider is 1px wide', () => assert.equal(DIVIDER_STYLE.width, 1));
  it('divider uses the structural boundary token', () => assert.equal(DIVIDER_STYLE.background, 'hsl(var(--border-structural))'));
  it('divider stretches full height', () => assert.equal(DIVIDER_STYLE.alignSelf, 'stretch'));
});

describe('AddLineButton — icon and text colors', () => {
  it('icon color is semantic', () => assert.equal(ICON_COLOR, 'hsl(var(--icon-secondary))'));
  it('text color is semantic', () => assert.equal(TEXT_COLOR, 'hsl(var(--text-primary))'));
});

describe('AddLineButton — dimension constants', () => {
  it('BUTTON_HEIGHT is 32', () => assert.equal(BUTTON_HEIGHT, 32));
  it('BUTTON_BORDER_COLOR matches GROUP_STYLE border', () => {
    assert.ok(GROUP_STYLE.border.includes(BUTTON_BORDER_COLOR));
  });
});
