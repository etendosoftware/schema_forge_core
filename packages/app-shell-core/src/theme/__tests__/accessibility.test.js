import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  SEMANTIC_THEME_TOKENS,
  contrastRatio,
  extractThemeTokens,
  validateThemeContract,
} from '../index.js';

const stylesUrl = new URL('../../styles.css', import.meta.url);

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

    assert.ok(errors.some((error) => error.includes('--border-control') && error.includes('--card')));
  });

  it('validates every semantic value and the focus ring against its control boundary', () => {
    const errors = validateThemeContract({
      '--background': '0 0% 100%',
      '--card': '0 0% 100%',
      '--border-control': '0 0% 40%',
      '--border-structural': '0 0% 40%',
      '--border-subtle': 'not-a-colour',
      '--text-primary': '0 0% 10%',
      '--text-secondary': '0 0% 40%',
      '--text-disabled': '0 0% 40%',
      '--icon-secondary': '0 0% 40%',
      '--focus-ring': '0 0% 40%',
    });

    assert.ok(errors.some((error) => error.includes('--border-subtle') && error.includes('invalid')));
    assert.ok(errors.some((error) => error.includes('--focus-ring') && error.includes('--border-control')));
  });
});
