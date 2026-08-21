import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * ETP-4899 parity guard.
 *
 * The `/api/reports` descriptor used to be copy-pasted into every consumer,
 * each with its own hardcoded field list. When `sections` was added to the
 * contracts, only the Vite dev plugin learned about it; the static-manifest
 * generator and the report-server kept their 7-field literals and dropped
 * `sections` with no error and no warning. Result: 0 of 11 reports carried
 * `sections` on every server, so `useAccordion` in ReportViewerPage was always
 * false in production while every developer saw a working accordion locally.
 *
 * This file makes that class of mistake impossible to reintroduce quietly: each
 * deploy-side consumer must DELEGATE to `report-descriptor.js` and must not
 * contain a hand-built descriptor literal. Same remedy as the ETP-4908
 * helper-registration parity test.
 */

const CONSUMERS = [
  {
    label: 'cli/src/generate-reports-manifest.js',
    path: fileURLToPath(new URL('../src/generate-reports-manifest.js', import.meta.url)),
  },
  {
    label: 'tools/report-server/server.js',
    path: fileURLToPath(new URL('../../tools/report-server/server.js', import.meta.url)),
  },
];

// The tell-tale of a hand-rebuilt descriptor: an object literal that carries
// both `orientation:` and `outputs:`. Those two only ever appear together when
// someone is re-assembling the report descriptor by hand.
const HANDBUILT_DESCRIPTOR = /\{[^{}]*\borientation\s*:[^{}]*\boutputs\s*:[^{}]*\}|\{[^{}]*\boutputs\s*:[^{}]*\borientation\s*:[^{}]*\}/s;

const WHY_HANDBUILDING_IS_BANNED =
  'Hand-building the report descriptor is exactly how the servers silently lost `sections` ' +
  '(ETP-4899): the dev Vite plugin gained the field, these deploy-side copies did not, and ' +
  'ReportViewerPage fell back to the legacy flat sidebar in production with no error. ' +
  'Build the descriptor via buildReportDescriptor()/listReportDescriptors() from ' +
  'cli/src/report-descriptor.js instead of listing fields here.';

describe('report descriptor dev/prod parity — one source of truth', () => {
  for (const { label, path } of CONSUMERS) {
    const src = readFileSync(path, 'utf8');

    it(`${label} imports listReportDescriptors from the shared module`, () => {
      assert.match(
        src,
        /import\s*\{[^}]*listReportDescriptors[^}]*\}\s*from\s*['"][^'"]*report-descriptor\.js['"]/,
        `${label} must obtain the report list from cli/src/report-descriptor.js. ${WHY_HANDBUILDING_IS_BANNED}`
      );
    });

    it(`${label} does not rebuild the descriptor object by hand`, () => {
      const match = src.match(HANDBUILT_DESCRIPTOR);
      assert.equal(
        match,
        null,
        `${label} contains what looks like a hand-built report descriptor ` +
          `(an object literal with both \`orientation:\` and \`outputs:\`):\n\n${match?.[0]}\n\n` +
          WHY_HANDBUILDING_IS_BANNED
      );
    });

    it(`${label} does not re-declare the valid-source whitelist`, () => {
      // A second copy of the source whitelist is the other half of the same
      // divergence: filter drift instead of shape drift.
      assert.doesNotMatch(
        src,
        /['"]jasper-migration['"]/,
        `${label} hardcodes the 'jasper-migration' source — the listable-report filter lives ` +
          `in isListableReport()/VALID_SOURCES (cli/src/report-descriptor.js). ` +
          WHY_HANDBUILDING_IS_BANNED
      );
    });
  }

  it('the regex actually detects a hand-built descriptor (self-test)', () => {
    // Guards the guard: if this regex ever stops matching the pattern it is
    // supposed to ban, the three assertions above would pass vacuously.
    const reintroducedBug = `
      reports.push({
        id: contract.reportId,
        title: contract.title,
        type: contract.type,
        category: contract.category || 'other',
        orientation: contract.orientation,
        outputs: contract.outputs,
        parameters: contract.parameters || [],
      });
    `;
    assert.match(reintroducedBug, HANDBUILT_DESCRIPTOR);
  });
});
