/**
 * Tests for custom section preservation module.
 *
 * Run with: node --test cli/tests/preserve-custom-sections.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCustomSections,
  injectCustomSections,
  appendUnmatchedSections,
  preserveAndRegenerate,
} from '../src/preserve-custom-sections.js';
import { MARKERS } from '../src/custom-section-markers.js';

// ---------------------------------------------------------------------------
// extractCustomSections
// ---------------------------------------------------------------------------

describe('extractCustomSections', () => {
  it('extracts a single custom section', () => {
    const content = [
      'const x = 1;',
      '// @sf-custom-start callout:BP_AutoFill',
      'function onBPChange() {',
      '  console.log("custom");',
      '}',
      '// @sf-custom-end callout:BP_AutoFill',
      'const y = 2;',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 1);
    assert.ok(sections.has('callout:BP_AutoFill'));
    assert.ok(sections.get('callout:BP_AutoFill').includes('function onBPChange()'));
  });

  it('extracts multiple custom sections', () => {
    const content = [
      '// @sf-custom-start callout:A',
      'code A',
      '// @sf-custom-end callout:A',
      '',
      '// @sf-custom-start callout:B',
      'code B',
      '// @sf-custom-end callout:B',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 2);
    assert.equal(sections.get('callout:A'), 'code A');
    assert.equal(sections.get('callout:B'), 'code B');
  });

  it('returns empty map when no custom sections exist', () => {
    const content = 'const x = 1;\nconst y = 2;\n';
    const sections = extractCustomSections(content);
    assert.equal(sections.size, 0);
  });

  it('handles empty file content', () => {
    const sections = extractCustomSections('');
    assert.equal(sections.size, 0);
  });

  it('preserves indentation in extracted content', () => {
    const content = [
      '// @sf-custom-start hooks:Form',
      '  const [state, setState] = useState(null);',
      '  useEffect(() => {}, []);',
      '// @sf-custom-end hooks:Form',
    ].join('\n');

    const sections = extractCustomSections(content);
    const code = sections.get('hooks:Form');
    assert.ok(code.startsWith('  const [state'));
  });

  it('ignores mismatched end markers', () => {
    const content = [
      '// @sf-custom-start callout:A',
      'code A',
      '// @sf-custom-end callout:B',
      'still inside A',
      '// @sf-custom-end callout:A',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 1);
    assert.ok(sections.get('callout:A').includes('still inside A'));
  });

  it('extracts sections with similar ID prefixes correctly', () => {
    const content = [
      '// @sf-custom-start callout:BP_Fill',
      'fill code',
      '// @sf-custom-end callout:BP_Fill',
      '// @sf-custom-start callout:BP_FillAddress',
      'address code',
      '// @sf-custom-end callout:BP_FillAddress',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 2);
    assert.equal(sections.get('callout:BP_Fill'), 'fill code');
    assert.equal(sections.get('callout:BP_FillAddress'), 'address code');
  });
});

// ---------------------------------------------------------------------------
// injectCustomSections
// ---------------------------------------------------------------------------

describe('injectCustomSections', () => {
  it('replaces a slot with a matching custom section', () => {
    const newContent = [
      'const fields = [',
      '  // @sf-custom-slot callout:BP_AutoFill',
      '  { key: "bp" },',
      '];',
    ].join('\n');

    const sections = new Map([
      ['callout:BP_AutoFill', 'function onBPChange() {\n  return true;\n}'],
    ]);

    const result = injectCustomSections(newContent, sections);
    assert.ok(result.content.includes('// @sf-custom-start callout:BP_AutoFill'));
    assert.ok(result.content.includes('function onBPChange()'));
    assert.ok(result.content.includes('// @sf-custom-end callout:BP_AutoFill'));
    assert.deepEqual(result.injected, ['callout:BP_AutoFill']);
    assert.deepEqual(result.remaining, []);
  });

  it('keeps slot when no matching custom section exists', () => {
    const newContent = '// @sf-custom-slot callout:Missing\nconst x = 1;';
    const sections = new Map();

    const result = injectCustomSections(newContent, sections);
    assert.ok(result.content.includes('// @sf-custom-slot callout:Missing'));
    assert.deepEqual(result.injected, []);
  });

  it('reports remaining (unmatched) sections', () => {
    const newContent = '// @sf-custom-slot callout:A\nconst x = 1;';
    const sections = new Map([
      ['callout:A', 'code A'],
      ['callout:Orphan', 'orphan code'],
    ]);

    const result = injectCustomSections(newContent, sections);
    assert.deepEqual(result.injected, ['callout:A']);
    assert.deepEqual(result.remaining, ['callout:Orphan']);
  });

  it('handles multiple slots in one file', () => {
    const newContent = [
      '// @sf-custom-slot callout:A',
      '{ key: "a" },',
      '// @sf-custom-slot callout:B',
      '{ key: "b" },',
    ].join('\n');

    const sections = new Map([
      ['callout:A', 'code A'],
      ['callout:B', 'code B'],
    ]);

    const result = injectCustomSections(newContent, sections);
    assert.deepEqual(result.injected, ['callout:A', 'callout:B']);
    assert.deepEqual(result.remaining, []);
    assert.ok(result.content.includes('code A'));
    assert.ok(result.content.includes('code B'));
  });

  it('preserves indentation from the slot line', () => {
    const newContent = '    // @sf-custom-slot hooks:Form';
    const sections = new Map([['hooks:Form', 'const x = 1;']]);

    const result = injectCustomSections(newContent, sections);
    assert.ok(result.content.includes('    // @sf-custom-start hooks:Form'));
    assert.ok(result.content.includes('    // @sf-custom-end hooks:Form'));
  });
});

// ---------------------------------------------------------------------------
// appendUnmatchedSections
// ---------------------------------------------------------------------------

describe('appendUnmatchedSections', () => {
  it('appends unmatched sections with warning', () => {
    const sections = new Map([['callout:Orphan', 'orphan code']]);
    const result = appendUnmatchedSections('existing content', ['callout:Orphan'], sections);

    assert.ok(result.includes('WARNING: Unmatched custom sections'));
    assert.ok(result.includes('// @sf-custom-start callout:Orphan'));
    assert.ok(result.includes('orphan code'));
    assert.ok(result.includes('// @sf-custom-end callout:Orphan'));
  });

  it('returns content unchanged when no unmatched IDs', () => {
    const sections = new Map();
    const result = appendUnmatchedSections('existing content', [], sections);
    assert.equal(result, 'existing content');
  });

  it('appends multiple unmatched sections', () => {
    const sections = new Map([
      ['callout:A', 'code A'],
      ['callout:B', 'code B'],
    ]);
    const result = appendUnmatchedSections('base', ['callout:A', 'callout:B'], sections);

    assert.ok(result.includes('code A'));
    assert.ok(result.includes('code B'));
  });
});

// ---------------------------------------------------------------------------
// preserveAndRegenerate
// ---------------------------------------------------------------------------

describe('preserveAndRegenerate', () => {
  it('returns newContent as-is when existingFilePath is null', () => {
    const result = preserveAndRegenerate(null, 'new code');
    assert.equal(result.content, 'new code');
    assert.deepEqual(result.preserved, []);
    assert.deepEqual(result.unmatched, []);
  });

  it('returns newContent as-is when file does not exist', () => {
    const result = preserveAndRegenerate('/nonexistent/path.jsx', 'new code');
    assert.equal(result.content, 'new code');
    assert.deepEqual(result.preserved, []);
    assert.deepEqual(result.unmatched, []);
  });
});

// ---------------------------------------------------------------------------
// Round-trip: extract then inject
// ---------------------------------------------------------------------------

describe('round-trip preservation', () => {
  it('extracts from old file and injects into new file', () => {
    const oldContent = [
      '// @sf-generated-start fields:order',
      'const fields = [',
      '  // @sf-custom-start callout:AutoFill',
      '  function autoFill() { return 42; }',
      '  // @sf-custom-end callout:AutoFill',
      '  { key: "bp" },',
      '];',
      '// @sf-generated-end fields:order',
    ].join('\n');

    const newContent = [
      '// @sf-generated-start fields:order',
      'const fields = [',
      '  // @sf-custom-slot callout:AutoFill',
      '  { key: "bp" },',
      '  { key: "product" },',
      '];',
      '// @sf-generated-end fields:order',
    ].join('\n');

    const sections = extractCustomSections(oldContent);
    assert.equal(sections.size, 1);

    const result = injectCustomSections(newContent, sections);
    assert.ok(result.content.includes('function autoFill() { return 42; }'));
    assert.ok(result.content.includes('{ key: "product" }'));
    assert.deepEqual(result.injected, ['callout:AutoFill']);
    assert.deepEqual(result.remaining, []);
  });

  it('handles unmatched sections in round-trip', () => {
    const oldContent = [
      '// @sf-custom-start callout:Removed',
      'function removed() {}',
      '// @sf-custom-end callout:Removed',
    ].join('\n');

    const newContent = '// @sf-custom-slot callout:New\nconst x = 1;';

    const sections = extractCustomSections(oldContent);
    const { content, injected, remaining } = injectCustomSections(newContent, sections);
    assert.deepEqual(injected, []);
    assert.deepEqual(remaining, ['callout:Removed']);

    const final = appendUnmatchedSections(content, remaining, sections);
    assert.ok(final.includes('function removed() {}'));
    assert.ok(final.includes('WARNING'));
  });
});

// ---------------------------------------------------------------------------
// Marker format validation
// ---------------------------------------------------------------------------

describe('MARKERS constants', () => {
  it('generates correct marker strings', () => {
    assert.equal(MARKERS.GENERATED_START('fields:order'), '// @sf-generated-start fields:order');
    assert.equal(MARKERS.GENERATED_END('fields:order'), '// @sf-generated-end fields:order');
    assert.equal(MARKERS.CUSTOM_START('callout:A'), '// @sf-custom-start callout:A');
    assert.equal(MARKERS.CUSTOM_END('callout:A'), '// @sf-custom-end callout:A');
    assert.equal(MARKERS.CUSTOM_SLOT('hooks:Form'), '// @sf-custom-slot hooks:Form');
  });
});
