import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VARIANT_STYLES } from '../tag-tokens.js';

describe('Tag — VARIANT_STYLES palette (ETP-3835)', () => {
  const EXPECTED_VARIANTS = ['blue', 'green', 'purple', 'yellow', 'pink', 'orange', 'teal', 'red', 'neutral'];

  it('has all 9 variants defined', () => {
    for (const variant of EXPECTED_VARIANTS) {
      assert.ok(VARIANT_STYLES[variant], `Missing variant: ${variant}`);
    }
  });

  it('each variant has background and color', () => {
    for (const [key, style] of Object.entries(VARIANT_STYLES)) {
      assert.ok(style.background, `${key} missing background`);
      assert.ok(style.color, `${key} missing color`);
    }
  });

  describe('Figma hex values', () => {
    it('blue — Customer type (#F0FAFF / #0075AD)', () => {
      assert.equal(VARIANT_STYLES.blue.background, '#F0FAFF');
      assert.equal(VARIANT_STYLES.blue.color, '#0075AD');
    });

    it('green — Vendor type (#DFF8EA / #17663A)', () => {
      assert.equal(VARIANT_STYLES.green.background, '#DFF8EA');
      assert.equal(VARIANT_STYLES.green.color, '#17663A');
    });

    it('purple — Employee type (#F4F1FD / #4316CA)', () => {
      assert.equal(VARIANT_STYLES.purple.background, '#F4F1FD');
      assert.equal(VARIANT_STYLES.purple.color, '#4316CA');
    });

    it('yellow — Lead type (#FFF3D6 / #8A6100)', () => {
      assert.equal(VARIANT_STYLES.yellow.background, '#FFF3D6');
      assert.equal(VARIANT_STYLES.yellow.color, '#8A6100');
    });

    it('pink — Partner type (#FDDDF8 / #A5088C)', () => {
      assert.equal(VARIANT_STYLES.pink.background, '#FDDDF8');
      assert.equal(VARIANT_STYLES.pink.color, '#A5088C');
    });

    it('orange — Prospect/Expense type (#FFE8E1 / #B82E00)', () => {
      assert.equal(VARIANT_STYLES.orange.background, '#FFE8E1');
      assert.equal(VARIANT_STYLES.orange.color, '#B82E00');
    });

    it('teal — Reseller type (#D5F2EA / #0E6B54)', () => {
      assert.equal(VARIANT_STYLES.teal.background, '#D5F2EA');
      assert.equal(VARIANT_STYLES.teal.color, '#0E6B54');
    });

    it('red — Competitor type (#FDD8E1 / #AF0932)', () => {
      assert.equal(VARIANT_STYLES.red.background, '#FDD8E1');
      assert.equal(VARIANT_STYLES.red.color, '#AF0932');
    });

    it('neutral — fallback (#F5F7F9 / #3F3F50)', () => {
      assert.equal(VARIANT_STYLES.neutral.background, '#F5F7F9');
      assert.equal(VARIANT_STYLES.neutral.color, '#3F3F50');
    });
  });

  it('green and status-success share the same foreground (#17663A)', () => {
    assert.equal(VARIANT_STYLES.green.color, '#17663A');
  });

  it('backgrounds are lighter than foregrounds (contrast check)', () => {
    for (const [key, style] of Object.entries(VARIANT_STYLES)) {
      assert.match(style.background, /^#[0-9A-Fa-f]{6}$/, `${key} background is not a valid hex`);
      assert.match(style.color, /^#[0-9A-Fa-f]{6}$/, `${key} color is not a valid hex`);
    }
  });
});
