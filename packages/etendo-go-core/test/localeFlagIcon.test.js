import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localeFlagIconPath = join(__dirname, '..', 'src', 'onboarding', 'components', 'LocaleFlagIcon.jsx');
const localeFlagIcon = readFileSync(localeFlagIconPath, 'utf8');

// ETP-4444 (Copilot PR review follow-up, MISSING_TESTS on 5828ecb8e) —
// LocaleFlagIcon.jsx is a new file introduced by this PR; it previously only
// had a few regex assertions embedded inside onboardingLanguageSelect.test.js.
// This file gives it dedicated, thorough coverage of its own and those
// assertions moved out of onboardingLanguageSelect.test.js (which now only
// keeps the integration-level "does OnboardingLanguageSelect import/render it
// correctly" wiring tests).
//
// Node can't parse JSX without a loader, and this package's `test/` runner
// (plain `node --test`) has none configured — so, same as every other .jsx
// file covered elsewhere in this package (see onboardingLanguageSelect.test.js),
// LocaleFlagIcon.jsx is covered by reading its source text and asserting on
// the literal implementation, not by importing and executing it. This also
// applies to `regionFromLocale`, a plain (non-JSX) function: it can't be
// imported in isolation because it lives in the same .jsx file as JSX-bearing
// code, so importing the module at all would hit a syntax error under plain
// Node. There's no meaningful way to exercise its split/uppercase logic
// without either executing it (blocked, as above) or duplicating it in the
// test (which would test the duplicate, not the source) — so, consistent
// with the rest of this file's style for JSX-adjacent logic, it's pinned via
// a regex on the literal implementation.
describe('regionFromLocale', () => {
  it('derives the region from the part after the underscore, upper-cased', () => {
    assert.match(
      localeFlagIcon,
      /export function regionFromLocale\(localeCode\)\s*\{\s*const region = \(localeCode \|\| ''\)\.split\('_'\)\[1\];\s*return region \? region\.toUpperCase\(\) : '';\s*\}/,
    );
  });
});

describe('LocaleFlagIcon — region branches', () => {
  it('renders SpainFlag when region is ES', () => {
    assert.match(localeFlagIcon, /if \(region === 'ES'\) \{\s*return \(/);
    const branchStart = localeFlagIcon.indexOf("if (region === 'ES')");
    const branchEnd = localeFlagIcon.indexOf("if (region === 'US')");
    const branch = localeFlagIcon.slice(branchStart, branchEnd);
    assert.match(branch, /<SpainFlag\s+clipId=\{clipId\}\s*\/>/);
  });

  it('renders UnitedStatesFlag when region is US', () => {
    assert.match(localeFlagIcon, /if \(region === 'US'\) \{\s*return \(/);
    const branchStart = localeFlagIcon.indexOf("if (region === 'US')");
    const branchEnd = localeFlagIcon.indexOf('return <FallbackFlag');
    const branch = localeFlagIcon.slice(branchStart, branchEnd);
    assert.match(branch, /<UnitedStatesFlag\s+clipId=\{clipId\}\s*\/>/);
  });

  it('falls back to FallbackFlag (via countryFlagEmoji) for anything else — unknown region, empty locale, garbage', () => {
    // Explicitly the LAST statement in LocaleFlagIcon, after both region
    // checks — reached for any region that is neither ES nor US, including
    // '' (empty/garbage locale, since regionFromLocale('') === '').
    assert.match(
      localeFlagIcon,
      /return <FallbackFlag region=\{region\} className=\{className\}\s*\/>;\s*\}\s*\n\s*export default LocaleFlagIcon;/,
    );
    assert.match(
      localeFlagIcon,
      /import\s*\{\s*countryFlagEmoji\s*\}\s*from\s*'\.\.\/countries\.js'/,
    );
    const fallbackFlagBlock = localeFlagIcon.slice(
      localeFlagIcon.indexOf('function FallbackFlag'),
      localeFlagIcon.indexOf('export function LocaleFlagIcon'),
    );
    assert.match(fallbackFlagBlock, /const glyph = countryFlagEmoji\(region\);/);
  });

  it('derives the region from the locale prop via regionFromLocale, not a separate lookup', () => {
    assert.match(localeFlagIcon, /const region = regionFromLocale\(locale\);/);
  });
});

describe('SpainFlag / UnitedStatesFlag — circular-crop SVG structure', () => {
  function extractFunctionBody(source, functionName) {
    const start = source.indexOf(`function ${functionName}(`);
    assert.notEqual(start, -1, `function ${functionName} not found`);
    // Both flag components are followed by another top-level declaration —
    // slicing to the next blank-line-separated block is enough here since
    // there's no nested function of the same shape inside either body.
    const nextFunctionIndex = source.indexOf('\nfunction ', start + 1);
    const nextExportIndex = source.indexOf('\nexport ', start + 1);
    const candidates = [nextFunctionIndex, nextExportIndex].filter((i) => i !== -1);
    const end = candidates.length ? Math.min(...candidates) : source.length;
    return source.slice(start, end);
  }

  it('SpainFlag renders a circular-clipped <svg> with the Figma red/yellow palette', () => {
    const body = extractFunctionBody(localeFlagIcon, 'SpainFlag');
    assert.match(body, /<svg\b/);
    assert.match(body, /<clipPath\s+id=\{clipId\}>/);
    assert.match(body, /<circle\s+cx="10"\s+cy="10"\s+r="10"\s*\/>/);
    assert.match(body, /fill="#AA151B"/);
    assert.match(body, /fill="#F1BF00"/);
  });

  it('UnitedStatesFlag renders a circular-clipped <svg> with the 7-stripe pattern and the canton rect', () => {
    const body = extractFunctionBody(localeFlagIcon, 'UnitedStatesFlag');
    assert.match(body, /<svg\b/);
    assert.match(body, /<clipPath\s+id=\{clipId\}>/);
    assert.match(body, /<circle\s+cx="10"\s+cy="10"\s+r="10"\s*\/>/);
    assert.match(body, /Array\.from\(\{\s*length:\s*7\s*\}/);
    assert.match(body, /fill=\{index % 2 === 0 \? '#B22234' : '#FFFFFF'\}/);
    // The canton (blue rectangle) — top-left, distinct from the striped field.
    assert.match(body, /fill="#3C3B6E"/);
  });

  it('both flags mark their <svg> as decorative with aria-hidden="true"', () => {
    // The accessible name comes from the trigger's own aria-label
    // (OnboardingLanguageSelect.jsx), not from these icons — they're purely
    // visual and must not be exposed as separate landmarks/images.
    const spainBody = extractFunctionBody(localeFlagIcon, 'SpainFlag');
    const usBody = extractFunctionBody(localeFlagIcon, 'UnitedStatesFlag');
    assert.match(spainBody, /<svg[^>]*\baria-hidden="true"/);
    assert.match(usBody, /<svg[^>]*\baria-hidden="true"/);
  });
});

describe('LocaleFlagIcon — className threading', () => {
  it('threads className through on the ES branch (wrapping <span>)', () => {
    const branchStart = localeFlagIcon.indexOf("if (region === 'ES')");
    const branchEnd = localeFlagIcon.indexOf("if (region === 'US')");
    const branch = localeFlagIcon.slice(branchStart, branchEnd);
    assert.match(branch, /<span className=\{`inline-flex h-5 w-5 overflow-hidden rounded-full \$\{className \|\| ''\}`\}>/);
  });

  it('threads className through on the US branch (wrapping <span>)', () => {
    const branchStart = localeFlagIcon.indexOf("if (region === 'US')");
    const branchEnd = localeFlagIcon.indexOf('return <FallbackFlag');
    const branch = localeFlagIcon.slice(branchStart, branchEnd);
    assert.match(branch, /<span className=\{`inline-flex h-5 w-5 overflow-hidden rounded-full \$\{className \|\| ''\}`\}>/);
  });

  it('threads className through on the FallbackFlag branch (its own <span>)', () => {
    const fallbackFlagBlock = localeFlagIcon.slice(
      localeFlagIcon.indexOf('function FallbackFlag'),
      localeFlagIcon.indexOf('export function LocaleFlagIcon'),
    );
    assert.match(
      fallbackFlagBlock,
      /className=\{`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs leading-none \$\{className \|\| ''\}`\}/,
    );
    // FallbackFlag's own <span> is also decorative.
    assert.match(fallbackFlagBlock, /<span\s*\n?\s*aria-hidden="true"/);
  });
});
