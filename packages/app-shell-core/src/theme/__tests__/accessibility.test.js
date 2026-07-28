import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  ALIAS_TOKEN_PAIRS,
  SEMANTIC_THEME_TOKENS,
  contrastRatio,
  extractThemeTokens,
  validateThemeContract,
} from '../index.js';

const stylesUrl = new URL('../../styles.css', import.meta.url);

const VALID_THEME = {
  '--background': '0 0% 100%',
  '--card': '0 0% 100%',
  '--border-control': '0 0% 40%',
  '--border-structural': '0 0% 40%',
  '--border-subtle': '0 0% 90%',
  '--text-primary': '0 0% 10%',
  '--text-secondary': '0 0% 40%',
  '--text-disabled': '0 0% 40%',
  '--icon-secondary': '0 0% 40%',
  '--focus-ring': '0 0% 0%',
  '--foreground': '0 0% 10%',
  '--muted-foreground': '0 0% 40%',
};

describe('semantic accessibility theme contract (ETP-4554)', () => {
  it('calculates WCAG contrast for known pairs and accepts uppercase hex', () => {
    assert.equal(contrastRatio('#000000', '#FFFFFF'), 21);
    assert.equal(contrastRatio('#777777', '#ffffff'), 4.48);
  });

  it('rejects invalid color input with an actionable error', () => {
    assert.throws(() => contrastRatio('not-a-color', '#ffffff'), /Invalid color/);
  });

  it('keeps the complete semantic contract in light and dark themes', async () => {
    const styles = await readFile(stylesUrl, 'utf8');
    const lightTheme = extractThemeTokens(styles, ':root');
    const darkTheme = extractThemeTokens(styles, '.dark');

    assert.deepEqual(
      Object.keys(lightTheme).filter((key) => SEMANTIC_THEME_TOKENS.includes(key)).sort(),
      SEMANTIC_THEME_TOKENS.slice().sort(),
    );
    assert.deepEqual(
      Object.keys(darkTheme).filter((key) => SEMANTIC_THEME_TOKENS.includes(key)).sort(),
      SEMANTIC_THEME_TOKENS.slice().sort(),
    );
  });

  it('validates the accessible defaults against their rendered surfaces', async () => {
    const styles = await readFile(stylesUrl, 'utf8');

    assert.deepEqual(validateThemeContract(extractThemeTokens(styles, ':root')), []);
    assert.deepEqual(validateThemeContract(extractThemeTokens(styles, '.dark')), []);
  });

  it('reports the exact token and surface for a contrast failure', () => {
    const errors = validateThemeContract({
      '--background': '0 0% 100%',
      '--card': '0 0% 100%',
      '--border-control': '0 0% 100%',
      '--border-structural': '0 0% 100%',
      '--border-subtle': '0 0% 95%',
      '--text-primary': '0 0% 10%',
      '--text-secondary': '0 0% 60%',
      '--text-disabled': '0 0% 60%',
      '--icon-secondary': '0 0% 60%',
      '--focus-ring': '0 0% 10%',
    });

    assert.ok(errors.some((error) => error.includes('--border-structural') && error.includes('--card')));
  });

  it('does not gate --border-control — it is a documented, accepted a11y gap', () => {
    // WARN(a11y) in styles.css: --border-control matches staging's light color,
    // ~1.5:1 against background/card, well short of 3:1. This must NOT fail.
    const errors = validateThemeContract({
      '--background': '0 0% 100%',
      '--card': '0 0% 100%',
      '--border-control': '0 0% 95%',
      '--border-structural': '0 0% 40%',
      '--border-subtle': '0 0% 90%',
      '--text-primary': '0 0% 10%',
      '--text-secondary': '0 0% 40%',
      '--text-disabled': '0 0% 40%',
      '--icon-secondary': '0 0% 40%',
      '--focus-ring': '0 0% 10%',
    });

    assert.deepEqual(errors, []);
  });

  it('validates every semantic value including the focus ring against page surfaces', () => {
    const errors = validateThemeContract({
      '--background': '0 0% 100%',
      '--card': '0 0% 100%',
      '--border-control': '0 0% 95%',
      '--border-structural': '0 0% 40%',
      '--border-subtle': 'not-a-colour',
      '--text-primary': '0 0% 10%',
      '--text-secondary': '0 0% 40%',
      '--text-disabled': '0 0% 40%',
      '--icon-secondary': '0 0% 40%',
      '--focus-ring': '0 0% 96%',
    });

    assert.ok(errors.some((error) => error.includes('--border-subtle') && error.includes('invalid')));
    assert.ok(errors.some((error) => error.includes('--focus-ring') && error.includes('--card')));
  });

  it('passes when generic role tokens stay equal to their audited counterparts', () => {
    assert.deepEqual(validateThemeContract(VALID_THEME), []);
  });

  it('flags a generic token that drifts from its accessibility-audited counterpart', () => {
    // Reproduces the ETP-4659 regression: --foreground kept its unaudited shadcn
    // default while --text-primary was corrected, so the app rendered a
    // different ink color than the one the contrast contract had verified.
    const drifted = { ...VALID_THEME, '--foreground': '222 47% 11%' };

    const errors = validateThemeContract(drifted);

    assert.ok(errors.some((error) => error.includes('--foreground') && error.includes('--text-primary')));
  });

  it('does not require every alias pair to be present to validate the rest', () => {
    const partial = { ...VALID_THEME };
    delete partial['--foreground'];

    assert.deepEqual(validateThemeContract(partial), []);
  });

  it('keeps ALIAS_TOKEN_PAIRS pointing only at real semantic tokens', () => {
    for (const [, canonical] of ALIAS_TOKEN_PAIRS) {
      assert.ok(SEMANTIC_THEME_TOKENS.includes(canonical), `${canonical} must be a SEMANTIC_THEME_TOKENS entry`);
    }
  });
});
