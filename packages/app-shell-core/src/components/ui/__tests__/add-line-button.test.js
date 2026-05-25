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

describe('AddLineButton — GROUP_STYLE Figma tokens', () => {
  it('height is 32px per Figma spec', () => assert.equal(GROUP_STYLE.height, 32));
  it('border uses Figma color #D1D4DB', () => assert.equal(GROUP_STYLE.border, '1px solid #D1D4DB'));
  it('border-radius is 8px per Figma spec', () => assert.equal(GROUP_STYLE.borderRadius, 8));
  it('background is white', () => assert.equal(GROUP_STYLE.background, '#FFFFFF'));
  it('has drop shadow from Figma', () => assert.ok(GROUP_STYLE.boxShadow.includes('rgba(18, 18, 23')));
  it('uses Inter font family', () => assert.ok(GROUP_STYLE.fontFamily.includes('Inter')));
  it('fits content width', () => assert.equal(GROUP_STYLE.width, 'fit-content'));
});

describe('AddLineButton — DIVIDER_STYLE', () => {
  it('divider is 1px wide', () => assert.equal(DIVIDER_STYLE.width, 1));
  it('divider uses Figma separator color #E8EAEF', () => assert.equal(DIVIDER_STYLE.background, '#E8EAEF'));
  it('divider stretches full height', () => assert.equal(DIVIDER_STYLE.alignSelf, 'stretch'));
});

describe('AddLineButton — icon and text colors', () => {
  it('icon color is Figma gray #828FA3', () => assert.equal(ICON_COLOR, '#828FA3'));
  it('text color is Figma dark #121217', () => assert.equal(TEXT_COLOR, '#121217'));
});

describe('AddLineButton — dimension constants', () => {
  it('BUTTON_HEIGHT is 32', () => assert.equal(BUTTON_HEIGHT, 32));
  it('BUTTON_BORDER_COLOR matches GROUP_STYLE border', () => {
    assert.ok(GROUP_STYLE.border.includes(BUTTON_BORDER_COLOR));
  });
});
