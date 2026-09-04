/**
 * Contract of walkthrough copy resolution (ETP-5144).
 *
 * The rule this file protects: a client must NEVER read a raw locale key on
 * screen. `useUI()` echoes the key back when it is missing, which is a fine
 * developer signal and an unacceptable thing to show a Spanish user — so
 * `resolveStepText` does an explicit presence check and falls back to a
 * translated generic sentence instead.
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  MISSING_TEXT_FALLBACK_KEY,
  resetStepTextWarnings,
  resolveStepText,
} from '../stepText.js';

const DICTIONARY = {
  genericLabels: {
    walkthroughContactTitle: 'Crear un contacto',
    [MISSING_TEXT_FALLBACK_KEY]: 'Texto no disponible',
    emptyString: '',
  },
};

/** Captures `console.warn` for the duration of one test. */
function captureWarnings() {
  const original = console.warn;
  const lines = [];
  console.warn = (...args) => lines.push(args.join(' '));
  return { lines, restore: () => { console.warn = original; } };
}

let warnings;

beforeEach(() => {
  resetStepTextWarnings();
  warnings = captureWarnings();
});

afterEach(() => {
  warnings.restore();
});

describe('resolveStepText — the key exists', () => {
  it('returns the translation', () => {
    assert.equal(resolveStepText(DICTIONARY, 'walkthroughContactTitle'), 'Crear un contacto');
  });

  it('returns a legitimately EMPTY translation rather than treating it as missing', () => {
    // `hasOwnProperty`, not truthiness: a deliberately blank label is a
    // translation, and falling back would replace it with an error sentence.
    assert.equal(resolveStepText(DICTIONARY, 'emptyString'), '');
    assert.equal(warnings.lines.length, 0);
  });

  it('does not warn', () => {
    resolveStepText(DICTIONARY, 'walkthroughContactTitle');
    assert.equal(warnings.lines.length, 0);
  });
});

describe('resolveStepText — the key is missing', () => {
  it('NEVER returns the raw key — that is the whole point', () => {
    const text = resolveStepText(DICTIONARY, 'walkthroughSomethingUntranslated');

    assert.notEqual(text, 'walkthroughSomethingUntranslated');
    assert.equal(text, 'Texto no disponible');
  });

  it('renders nothing when even the fallback key is missing', () => {
    // Leaking an internal identifier is worse than rendering an empty hint.
    assert.equal(resolveStepText({ genericLabels: {} }, 'whatever'), '');
    assert.equal(resolveStepText(undefined, 'whatever'), '');
    assert.equal(resolveStepText({}, 'whatever'), '');
  });

  it('warns ONCE per key, not once per render', () => {
    // The overlay re-renders on every rect poll, so a per-render warning would
    // bury the console and make the real signal unreadable.
    resolveStepText(DICTIONARY, 'missingOne');
    resolveStepText(DICTIONARY, 'missingOne');
    resolveStepText(DICTIONARY, 'missingOne');

    assert.equal(warnings.lines.length, 1);
    assert.match(warnings.lines[0], /missing locale key "missingOne"/);
  });

  it('warns separately for each distinct key', () => {
    resolveStepText(DICTIONARY, 'missingOne');
    resolveStepText(DICTIONARY, 'missingTwo');

    assert.equal(warnings.lines.length, 2);
  });

  it('still resolves the fallback when warnings are suppressed', () => {
    // `warn: false` is what the launcher passes for an OPTIONAL label (a flow's
    // `descriptionKey`), where absence is a choice and not a bug.
    const text = resolveStepText(DICTIONARY, 'missingOne', { warn: false });

    assert.equal(text, 'Texto no disponible');
    assert.equal(warnings.lines.length, 0);
  });
});

describe('resolveStepText — no key at all', () => {
  it('returns an empty string without warning, for every empty shape', () => {
    for (const key of [undefined, null, '', '   ', 42, {}]) {
      assert.equal(resolveStepText(DICTIONARY, key), '');
    }
    assert.equal(warnings.lines.length, 0);
  });
});
