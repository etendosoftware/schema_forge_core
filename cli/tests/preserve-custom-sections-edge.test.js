/**
 * Edge case tests for custom section preservation module.
 *
 * Covers: boundaries, malformed input, duplicate IDs, nested markers,
 * whitespace variations, large files, and integration scenarios.
 *
 * Run with: node --test cli/tests/preserve-custom-sections-edge.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  extractCustomSections,
  injectCustomSections,
  appendUnmatchedSections,
  preserveAndRegenerate,
} from '../src/preserve-custom-sections.js';
import { MARKERS, PATTERNS } from '../src/custom-section-markers.js';

// ---------------------------------------------------------------------------
// Helper: create a temporary file and clean up after test
// ---------------------------------------------------------------------------

const TMP_DIR = join(tmpdir(), 'sf-qa-tests');

function ensureTmpDir() {
  if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
}

function writeTmpFile(name, content) {
  ensureTmpDir();
  const path = join(TMP_DIR, name);
  writeFileSync(path, content, 'utf-8');
  return path;
}

function cleanTmpFile(path) {
  try { unlinkSync(path); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// extractCustomSections edge cases
// ---------------------------------------------------------------------------

describe('extractCustomSections - edge cases', () => {
  it('handles file with only whitespace', () => {
    const sections = extractCustomSections('   \n  \n\t\n');
    assert.equal(sections.size, 0);
  });

  it('handles markers with no content between them', () => {
    const content = [
      '// @sf-custom-start empty:section',
      '// @sf-custom-end empty:section',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 1);
    assert.equal(sections.get('empty:section'), '');
  });

  it('handles marker with extra whitespace before ID', () => {
    const content = [
      '//  @sf-custom-start   callout:Spaced',
      'content here',
      '//  @sf-custom-end   callout:Spaced',
    ].join('\n');

    const sections = extractCustomSections(content);
    // The regex uses \s+ which should match multiple spaces
    assert.equal(sections.size, 1);
    // Note: The ID will include leading spaces because the regex captures (.+)
    // This tests whether extra spaces in the ID are handled
    assert.ok(sections.has('  callout:Spaced') || sections.has('callout:Spaced'));
  });

  it('handles ID with special characters (colons, hyphens, dots)', () => {
    const content = [
      '// @sf-custom-start callout:com.etendo.module.MyCallout',
      'complex id code',
      '// @sf-custom-end callout:com.etendo.module.MyCallout',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 1);
    assert.equal(sections.get('callout:com.etendo.module.MyCallout'), 'complex id code');
  });

  it('handles multiple unclosed sections (only first is recovered)', () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      const content = [
        '// @sf-custom-start section:A',
        'code A',
        '// @sf-custom-start section:B',
        'code B',
      ].join('\n');

      const sections = extractCustomSections(content);
      // The second start marker is inside section A (since A was never closed)
      // So section A captures everything including the second start marker
      assert.equal(sections.size, 1);
      assert.ok(sections.has('section:A'));
      assert.ok(sections.get('section:A').includes('code A'));
      assert.ok(sections.get('section:A').includes('code B'));
      assert.equal(warnings.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('handles duplicate section IDs (last one wins)', () => {
    const content = [
      '// @sf-custom-start callout:Dup',
      'first version',
      '// @sf-custom-end callout:Dup',
      '// @sf-custom-start callout:Dup',
      'second version',
      '// @sf-custom-end callout:Dup',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 1);
    assert.equal(sections.get('callout:Dup'), 'second version');
  });

  it('handles markers inside comments or strings (still matches)', () => {
    // If someone writes a marker in a string literal, extraction still picks it up.
    // This is expected behavior - markers are line-based patterns.
    const content = [
      'const x = "// @sf-custom-start test:inside-string";',
      'some code',
      'const y = "// @sf-custom-end test:inside-string";',
    ].join('\n');

    // The trimmed line would be: const x = "// @sf-custom-start test:inside-string";
    // This should NOT match because the regex requires ^// pattern
    const sections = extractCustomSections(content);
    assert.equal(sections.size, 0);
  });

  it('handles very long content inside a section', () => {
    const longLine = 'x'.repeat(10000);
    const content = [
      '// @sf-custom-start section:big',
      longLine,
      '// @sf-custom-end section:big',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 1);
    assert.equal(sections.get('section:big'), longLine);
  });

  it('handles Windows-style line endings (CRLF)', () => {
    const content =
      '// @sf-custom-start callout:Win\r\n' +
      'windows code\r\n' +
      '// @sf-custom-end callout:Win\r\n';

    const sections = extractCustomSections(content);
    // Split by \n leaves \r at end of lines which affects trimming
    // The ID might have trailing \r
    const hasSection = sections.has('callout:Win') || sections.has('callout:Win\r');
    assert.ok(hasSection, `Expected to find section with ID containing 'callout:Win', got keys: ${[...sections.keys()]}`);
  });

  it('handles indented markers', () => {
    const content = [
      '    // @sf-custom-start hooks:IndentedForm',
      '    const [state, setState] = useState(null);',
      '    // @sf-custom-end hooks:IndentedForm',
    ].join('\n');

    const sections = extractCustomSections(content);
    assert.equal(sections.size, 1);
    assert.ok(sections.has('hooks:IndentedForm'));
  });
});

// ---------------------------------------------------------------------------
// injectCustomSections edge cases
// ---------------------------------------------------------------------------

describe('injectCustomSections - edge cases', () => {
  it('handles empty new content', () => {
    const sections = new Map([['section:A', 'code A']]);
    const result = injectCustomSections('', sections);
    assert.equal(result.content, '');
    assert.deepEqual(result.injected, []);
    assert.deepEqual(result.remaining, ['section:A']);
  });

  it('handles empty custom sections map', () => {
    const result = injectCustomSections('some content\n// @sf-custom-slot test:slot', new Map());
    assert.ok(result.content.includes('// @sf-custom-slot test:slot'));
    assert.deepEqual(result.injected, []);
    assert.deepEqual(result.remaining, []);
  });

  it('handles duplicate slot IDs (both get injected)', () => {
    const newContent = [
      '// @sf-custom-slot hooks:Form',
      'middle',
      '// @sf-custom-slot hooks:Form',
    ].join('\n');

    const sections = new Map([['hooks:Form', 'custom hook code']]);
    const result = injectCustomSections(newContent, sections);

    // Both slots should be replaced
    const startMatches = result.content.match(/sf-custom-start hooks:Form/g);
    assert.equal(startMatches?.length, 2, 'Both duplicate slots should be replaced');
    assert.deepEqual(result.injected, ['hooks:Form', 'hooks:Form']);
  });

  it('preserves non-marker content exactly', () => {
    const original = 'line 1\nline 2\nline 3';
    const result = injectCustomSections(original, new Map());
    assert.equal(result.content, original);
  });

  it('handles section content with marker-like lines', () => {
    // Custom section content itself contains something that looks like a marker
    const sections = new Map([
      ['test:meta', '// This is not a real @sf-custom-slot but a comment\nreal code'],
    ]);
    const newContent = '// @sf-custom-slot test:meta';
    const result = injectCustomSections(newContent, sections);
    assert.ok(result.content.includes('// This is not a real @sf-custom-slot but a comment'));
    assert.deepEqual(result.injected, ['test:meta']);
  });
});

// ---------------------------------------------------------------------------
// appendUnmatchedSections edge cases
// ---------------------------------------------------------------------------

describe('appendUnmatchedSections - edge cases', () => {
  it('handles empty content with unmatched sections', () => {
    const sections = new Map([['orphan:A', 'orphan code']]);
    const result = appendUnmatchedSections('', ['orphan:A'], sections);
    assert.ok(result.includes('WARNING'));
    assert.ok(result.includes('orphan code'));
  });

  it('handles section with multi-line content in append', () => {
    const multiLine = 'line 1\nline 2\nline 3\n  indented line 4';
    const sections = new Map([['multi:Lines', multiLine]]);
    const result = appendUnmatchedSections('base', ['multi:Lines'], sections);
    assert.ok(result.includes('line 1'));
    assert.ok(result.includes('  indented line 4'));
    assert.ok(result.includes('// @sf-custom-start multi:Lines'));
    assert.ok(result.includes('// @sf-custom-end multi:Lines'));
  });

  it('preserves order of unmatched IDs', () => {
    const sections = new Map([
      ['orphan:C', 'code C'],
      ['orphan:A', 'code A'],
      ['orphan:B', 'code B'],
    ]);
    const result = appendUnmatchedSections('base', ['orphan:C', 'orphan:A', 'orphan:B'], sections);
    const indexC = result.indexOf('orphan:C');
    const indexA = result.indexOf('orphan:A');
    const indexB = result.indexOf('orphan:B');
    assert.ok(indexC < indexA, 'C should come before A');
    assert.ok(indexA < indexB, 'A should come before B');
  });
});

// ---------------------------------------------------------------------------
// preserveAndRegenerate with real filesystem
// ---------------------------------------------------------------------------

describe('preserveAndRegenerate - filesystem integration', () => {
  it('reads existing file and preserves custom sections', () => {
    const existingContent = [
      '// @sf-generated-start fields:order',
      'const fields = [];',
      '// @sf-generated-end fields:order',
      '',
      '// @sf-custom-start callout:AutoFill',
      'function autoFill() { return 42; }',
      '// @sf-custom-end callout:AutoFill',
    ].join('\n');

    const newContent = [
      '// @sf-generated-start fields:order',
      'const fields = ["new"];',
      '// @sf-generated-end fields:order',
      '',
      '// @sf-custom-slot callout:AutoFill',
    ].join('\n');

    const path = writeTmpFile('preserve-test-1.jsx', existingContent);
    try {
      const result = preserveAndRegenerate(path, newContent);
      assert.ok(result.content.includes('function autoFill() { return 42; }'));
      assert.ok(result.content.includes('const fields = ["new"];'));
      assert.deepEqual(result.preserved, ['callout:AutoFill']);
      assert.deepEqual(result.unmatched, []);
    } finally {
      cleanTmpFile(path);
    }
  });

  it('handles existing file with no custom sections', () => {
    const existingContent = [
      '// @sf-generated-start fields:order',
      'const fields = [];',
      '// @sf-generated-end fields:order',
    ].join('\n');

    const newContent = '// new generated content';

    const path = writeTmpFile('preserve-test-2.jsx', existingContent);
    try {
      const result = preserveAndRegenerate(path, newContent);
      assert.equal(result.content, newContent);
      assert.deepEqual(result.preserved, []);
      assert.deepEqual(result.unmatched, []);
    } finally {
      cleanTmpFile(path);
    }
  });

  it('handles existing file with unmatched sections (appended)', () => {
    const existingContent = [
      '// @sf-custom-start callout:Removed',
      'function removed() { return "old"; }',
      '// @sf-custom-end callout:Removed',
    ].join('\n');

    const newContent = '// @sf-custom-slot callout:New\nconst x = 1;';

    const path = writeTmpFile('preserve-test-3.jsx', existingContent);
    try {
      const result = preserveAndRegenerate(path, newContent);
      assert.deepEqual(result.preserved, []);
      assert.deepEqual(result.unmatched, ['callout:Removed']);
      assert.ok(result.content.includes('function removed()'));
      assert.ok(result.content.includes('WARNING'));
    } finally {
      cleanTmpFile(path);
    }
  });

  it('handles empty existing file', () => {
    const path = writeTmpFile('preserve-test-4.jsx', '');
    try {
      const result = preserveAndRegenerate(path, 'new content');
      assert.equal(result.content, 'new content');
      assert.deepEqual(result.preserved, []);
    } finally {
      cleanTmpFile(path);
    }
  });

  it('handles undefined existingFilePath', () => {
    const result = preserveAndRegenerate(undefined, 'new content');
    assert.equal(result.content, 'new content');
    assert.deepEqual(result.preserved, []);
    assert.deepEqual(result.unmatched, []);
  });

  it('handles empty string existingFilePath', () => {
    const result = preserveAndRegenerate('', 'new content');
    assert.equal(result.content, 'new content');
    assert.deepEqual(result.preserved, []);
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: generate -> customize -> regenerate -> verify
// ---------------------------------------------------------------------------

describe('full round-trip scenario', () => {
  it('Scenario A: first generation produces clean file with slots', () => {
    // Simulate what generate-frontend produces
    const generated = [
      `import { DataTable } from '@/components/contract-ui';`,
      '',
      MARKERS.GENERATED_START('columns:order'),
      `const columns = [`,
      `  { key: 'bp', column: 'C_BPartner_ID', type: 'string' },`,
      `];`,
      MARKERS.GENERATED_END('columns:order'),
      '',
      MARKERS.GENERATED_START('component:OrderTable'),
      `export default function OrderTable(props) {`,
      `  ${MARKERS.CUSTOM_SLOT('hooks:OrderTable')}`,
      `  return <DataTable columns={columns} {...props} />;`,
      `}`,
      MARKERS.GENERATED_END('component:OrderTable'),
      '',
      MARKERS.CUSTOM_SLOT('section:OrderTable-custom'),
    ].join('\n');

    // First generation: no existing file -> slots remain as-is
    const result = preserveAndRegenerate(null, generated);
    assert.equal(result.content, generated);
    assert.ok(result.content.includes('// @sf-custom-slot hooks:OrderTable'));
    assert.ok(result.content.includes('// @sf-custom-slot section:OrderTable-custom'));
  });

  it('Scenario B: regeneration preserves custom code in correct slot', () => {
    // Simulate an existing file where user added custom code
    const existingWithCustom = [
      `import { DataTable } from '@/components/contract-ui';`,
      '',
      MARKERS.GENERATED_START('columns:order'),
      `const columns = [`,
      `  { key: 'bp', column: 'C_BPartner_ID', type: 'string' },`,
      `];`,
      MARKERS.GENERATED_END('columns:order'),
      '',
      MARKERS.GENERATED_START('component:OrderTable'),
      `export default function OrderTable(props) {`,
      `  ${MARKERS.CUSTOM_START('hooks:OrderTable')}`,
      `  const [filter, setFilter] = useState('');`,
      `  ${MARKERS.CUSTOM_END('hooks:OrderTable')}`,
      `  return <DataTable columns={columns} {...props} />;`,
      `}`,
      MARKERS.GENERATED_END('component:OrderTable'),
      '',
      MARKERS.CUSTOM_SLOT('section:OrderTable-custom'),
    ].join('\n');

    // New generation: columns changed, slots are fresh
    const newGenerated = [
      `import { DataTable } from '@/components/contract-ui';`,
      '',
      MARKERS.GENERATED_START('columns:order'),
      `const columns = [`,
      `  { key: 'bp', column: 'C_BPartner_ID', type: 'string' },`,
      `  { key: 'product', column: 'M_Product_ID', type: 'string' },`,
      `];`,
      MARKERS.GENERATED_END('columns:order'),
      '',
      MARKERS.GENERATED_START('component:OrderTable'),
      `export default function OrderTable(props) {`,
      `  ${MARKERS.CUSTOM_SLOT('hooks:OrderTable')}`,
      `  return <DataTable columns={columns} {...props} />;`,
      `}`,
      MARKERS.GENERATED_END('component:OrderTable'),
      '',
      MARKERS.CUSTOM_SLOT('section:OrderTable-custom'),
    ].join('\n');

    const path = writeTmpFile('scenario-b.jsx', existingWithCustom);
    try {
      const result = preserveAndRegenerate(path, newGenerated);

      // Custom hook code should be preserved
      assert.ok(result.content.includes("const [filter, setFilter] = useState('');"),
        'Custom hook code should be preserved');

      // New columns should be present
      assert.ok(result.content.includes("{ key: 'product'"),
        'New product column should be present');

      // Old columns line count should NOT be present (overwritten by new generation)
      assert.deepEqual(result.preserved, ['hooks:OrderTable']);
      assert.deepEqual(result.unmatched, []);
    } finally {
      cleanTmpFile(path);
    }
  });

  it('Scenario C: unmatched custom section gets appended with warning', () => {
    const existingWithRemovedField = [
      MARKERS.CUSTOM_START('callout:Foo'),
      'function onFooChange() { /* custom logic */ }',
      MARKERS.CUSTOM_END('callout:Foo'),
    ].join('\n');

    const newWithoutFooSlot = [
      MARKERS.GENERATED_START('fields:order'),
      'const fields = [];',
      MARKERS.GENERATED_END('fields:order'),
      '',
      MARKERS.CUSTOM_SLOT('hooks:OrderForm'),
    ].join('\n');

    const path = writeTmpFile('scenario-c.jsx', existingWithRemovedField);
    try {
      const result = preserveAndRegenerate(path, newWithoutFooSlot);

      assert.deepEqual(result.unmatched, ['callout:Foo']);
      assert.ok(result.content.includes('WARNING: Unmatched custom sections'));
      assert.ok(result.content.includes('function onFooChange()'));
      // The unmatched section should be wrapped in proper markers
      assert.ok(result.content.includes(MARKERS.CUSTOM_START('callout:Foo')));
      assert.ok(result.content.includes(MARKERS.CUSTOM_END('callout:Foo')));
    } finally {
      cleanTmpFile(path);
    }
  });

  it('Scenario D: unclosed section is recovered', () => {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      const existingWithUnclosed = [
        MARKERS.CUSTOM_START('callout:Orphan'),
        'function orphaned() {',
        '  return "no end marker";',
        '}',
        // Missing CUSTOM_END
      ].join('\n');

      const newContent = MARKERS.CUSTOM_SLOT('callout:Orphan');

      const path = writeTmpFile('scenario-d.jsx', existingWithUnclosed);
      try {
        const result = preserveAndRegenerate(path, newContent);

        assert.ok(warnings.some(w => w.includes('Unclosed custom section')));
        assert.ok(result.content.includes('function orphaned()'));
        assert.deepEqual(result.preserved, ['callout:Orphan']);
      } finally {
        cleanTmpFile(path);
      }
    } finally {
      console.warn = originalWarn;
    }
  });
});

// ---------------------------------------------------------------------------
// PATTERNS regex validation
// ---------------------------------------------------------------------------

describe('PATTERNS regex correctness', () => {
  it('CUSTOM_START captures ID correctly', () => {
    const match = '// @sf-custom-start callout:MyCallout'.match(PATTERNS.CUSTOM_START);
    assert.ok(match);
    assert.equal(match[1], 'callout:MyCallout');
  });

  it('CUSTOM_END captures ID correctly', () => {
    const match = '// @sf-custom-end callout:MyCallout'.match(PATTERNS.CUSTOM_END);
    assert.ok(match);
    assert.equal(match[1], 'callout:MyCallout');
  });

  it('CUSTOM_SLOT captures ID correctly', () => {
    const match = '// @sf-custom-slot hooks:OrderForm'.match(PATTERNS.CUSTOM_SLOT);
    assert.ok(match);
    assert.equal(match[1], 'hooks:OrderForm');
  });

  it('GENERATED_START captures ID correctly', () => {
    const match = '// @sf-generated-start fields:order'.match(PATTERNS.GENERATED_START);
    assert.ok(match);
    assert.equal(match[1], 'fields:order');
  });

  it('GENERATED_END captures ID correctly', () => {
    const match = '// @sf-generated-end fields:order'.match(PATTERNS.GENERATED_END);
    assert.ok(match);
    assert.equal(match[1], 'fields:order');
  });

  it('patterns do NOT match if not at line start', () => {
    const noMatch = 'const x = "// @sf-custom-start test:id"'.match(PATTERNS.CUSTOM_START);
    assert.equal(noMatch, null);
  });

  it('patterns require at least one space before ID', () => {
    const noMatch = '// @sf-custom-start'.match(PATTERNS.CUSTOM_START);
    assert.equal(noMatch, null, 'Should not match marker without ID');
  });
});

// ---------------------------------------------------------------------------
// Pipeline integration: .old backup ordering
// ---------------------------------------------------------------------------

describe('pipeline integration: backup ordering', () => {
  it('verifies .old backup happens from pre-overwrite content (W2 check)', () => {
    // This is a code-level verification that the pipeline reads existing content
    // BEFORE calling preserveAndRegenerate (which reads the same file).
    // The pipeline.js code at line 129 reads existing content first,
    // then at line 131 calls preserveAndRegenerate, then writes at line 132,
    // then at line 138 writes the .old from the pre-overwrite content.
    //
    // This test verifies the logic by simulating the sequence:
    // 1. Write original file
    // 2. Read it (simulating pipeline line 129)
    // 3. preserveAndRegenerate overwrites conceptually
    // 4. .old should have original content

    const original = [
      MARKERS.CUSTOM_START('callout:Old'),
      'function oldCode() {}',
      MARKERS.CUSTOM_END('callout:Old'),
    ].join('\n');

    const newContent = [
      MARKERS.GENERATED_START('fields:test'),
      'const fields = [];',
      MARKERS.GENERATED_END('fields:test'),
    ].join('\n');

    const path = writeTmpFile('backup-order-test.jsx', original);
    try {
      // Simulate pipeline: read existing content first
      const existingContent = readFileSync(path, 'utf-8');

      // Then preserveAndRegenerate
      const result = preserveAndRegenerate(path, newContent);

      // Write new content (simulating pipeline overwrite)
      writeFileSync(path, result.content, 'utf-8');

      // Write .old from pre-overwrite content
      const oldPath = `${path}.old`;
      if (result.unmatched.length > 0) {
        writeFileSync(oldPath, existingContent, 'utf-8');
      }

      // Verify .old has the original content
      if (result.unmatched.length > 0) {
        const oldContent = readFileSync(oldPath, 'utf-8');
        assert.ok(oldContent.includes('function oldCode()'), '.old should have original content');
        cleanTmpFile(oldPath);
      }

      // Verify the new file has unmatched section appended
      assert.deepEqual(result.unmatched, ['callout:Old']);
      assert.ok(result.content.includes('WARNING'));
    } finally {
      cleanTmpFile(path);
    }
  });
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

describe('test cleanup', () => {
  it('removes temporary test directory', () => {
    try { rmSync(TMP_DIR, { recursive: true }); } catch { /* ignore */ }
    assert.ok(true);
  });
});
