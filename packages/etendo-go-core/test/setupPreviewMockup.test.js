import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(__dirname, '..', 'src', 'onboarding', 'components');
const mockup = readFileSync(join(componentsDir, 'SetupPreviewMockup.jsx'), 'utf8');

// ETP-4445 — the onboarding right panel is a live skeleton preview of the app
// dashboard. These tests pin down the behavior that matters and that a future
// refactor could silently break:
//   1. It is variant-driven (profile → live user in the footer; company → live
//      company in the header) so a single instance can animate between steps.
//   2. The person's data (name / company) is rendered live from props.
//   3. Menu icons are the EXACT same ones the real app sidebar uses (phosphor),
//      not lucide look-alikes.
//   4. The scroll/cross-fade transitions respect prefers-reduced-motion.
describe('SetupPreviewMockup (ETP-4445)', () => {
  it('exposes userName, orgName and a variant prop (default profile)', () => {
    assert.match(
      mockup,
      /export function SetupPreviewMockup\(\{\s*userName,\s*orgName,\s*variant = 'profile'/,
    );
    assert.match(mockup, /const isCompany = variant === 'company'/);
    assert.match(mockup, /data-testid="SetupPreviewMockup__79cf84"/);
  });

  it('renders the user name and avatar initial live in the footer', () => {
    assert.match(mockup, /const displayName = trimmedName \|\| 'Tu nombre'/);
    assert.match(mockup, /const initial = \(trimmedName\[0\] \|\| '\?'\)\.toUpperCase\(\)/);
    assert.match(mockup, /\{displayName\}/);
    assert.match(mockup, /\{initial\}/);
  });

  it('renders the company name live in the header, skeleton until typed', () => {
    assert.match(mockup, /const trimmedOrg = \(orgName \|\| ''\)\.trim\(\)/);
    // Shows the org name when present, otherwise a skeleton bar (ternary).
    assert.match(mockup, /\{trimmedOrg/);
    assert.match(mockup, /<span[^>]*>\{trimmedOrg\}<\/span>/);
    assert.match(mockup, /<span className=\{`inline-block h-2\.5 w-\[90px\] rounded-full \$\{SKELETON_BG\}`\} \/>/);
    // Uses the real product favicon, not a hand-drawn "E" logo.
    assert.match(mockup, /<img src="\/favicon\.png"/);
  });

  it('uses the same phosphor menu icons as the real app sidebar', () => {
    assert.match(mockup, /from '@phosphor-icons\/react'/);
    for (const icon of ['House', 'Star', 'IdentificationCard', 'TrendUp', 'Receipt', 'Package', 'Bank', 'Plug', 'Gear', 'Flask']) {
      assert.match(mockup, new RegExp(`\\b${icon}\\b`), `expected phosphor icon ${icon}`);
    }
  });

  it('cross-fades the gradient by variant (top for profile, bottom for company)', () => {
    assert.match(mockup, /opacity: isCompany \? 0 : 1/); // top fade hidden in company
    assert.match(mockup, /opacity: isCompany \? 1 : 0/); // bottom fade shown in company
  });

  it('respects prefers-reduced-motion on the animated surfaces', () => {
    // Both the card position/shadow transition and the gradient cross-fade must
    // be disabled for users who opted out of motion.
    const matches = mockup.match(/motion-reduce:transition-none/g) || [];
    assert.ok(matches.length >= 2, 'expected motion-reduce guards on card and gradients');
  });
});
