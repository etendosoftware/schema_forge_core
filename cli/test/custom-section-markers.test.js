import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SF_PREFIX, MARKERS, PATTERNS } from '../src/custom-section-markers.js';

describe('custom-section-markers', () => {
  describe('SF_PREFIX', () => {
    it('is the expected prefix string', () => {
      assert.equal(SF_PREFIX, '@sf-');
    });
  });

  describe('MARKERS.GENERATED_START', () => {
    it('produces a start marker with the given id', () => {
      assert.equal(MARKERS.GENERATED_START('imports'), '// @sf-generated-start imports');
    });

    it('handles ids with spaces', () => {
      assert.equal(MARKERS.GENERATED_START('header fields'), '// @sf-generated-start header fields');
    });
  });

  describe('MARKERS.GENERATED_END', () => {
    it('produces an end marker with the given id', () => {
      assert.equal(MARKERS.GENERATED_END('imports'), '// @sf-generated-end imports');
    });
  });

  describe('PATTERNS.GENERATED_START', () => {
    it('matches a valid start marker and captures the id', () => {
      const match = '// @sf-generated-start imports'.match(PATTERNS.GENERATED_START);
      assert.ok(match);
      assert.equal(match[1], 'imports');
    });

    it('matches with extra whitespace and trims to the id', () => {
      const match = '// @sf-generated-start   addLineFields'.match(PATTERNS.GENERATED_START);
      assert.ok(match);
      assert.ok(match[1].includes('addLineFields'));
    });

    it('does not match lines without the marker', () => {
      assert.equal('import React from "react"'.match(PATTERNS.GENERATED_START), null);
    });

    it('does not match end markers', () => {
      assert.equal('// @sf-generated-end imports'.match(PATTERNS.GENERATED_START), null);
    });
  });

  describe('PATTERNS.GENERATED_END', () => {
    it('matches a valid end marker and captures the id', () => {
      const match = '// @sf-generated-end imports'.match(PATTERNS.GENERATED_END);
      assert.ok(match);
      assert.equal(match[1], 'imports');
    });

    it('does not match start markers', () => {
      assert.equal('// @sf-generated-start imports'.match(PATTERNS.GENERATED_END), null);
    });
  });

  describe('round-trip', () => {
    it('GENERATED_START output is matched by PATTERNS.GENERATED_START', () => {
      const id = 'customTabs';
      const line = MARKERS.GENERATED_START(id);
      const match = line.match(PATTERNS.GENERATED_START);
      assert.ok(match);
      assert.equal(match[1], id);
    });

    it('GENERATED_END output is matched by PATTERNS.GENERATED_END', () => {
      const id = 'bottomPanel';
      const line = MARKERS.GENERATED_END(id);
      const match = line.match(PATTERNS.GENERATED_END);
      assert.ok(match);
      assert.equal(match[1], id);
    });
  });
});