import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');
const step = readFileSync(join(onboardingSrc, 'steps', 'SetupProgressStep.jsx'), 'utf8');
const card = readFileSync(join(onboardingSrc, 'components', 'SetupProgressCard.jsx'), 'utf8');
const shell = readFileSync(join(onboardingSrc, 'components', 'SetupProgressShell.jsx'), 'utf8');

// ETP-4446 — regression tests for the onboarding loading screen (trickle
// progress + rotating status text + animated ring + dashboard backdrop).
//
// These are STRUCTURAL regression guards, matching the established convention
// of this package's onboarding tests (onboardingDefaultView / LanguageSelect):
// node --test + source assertions. The package ships NO React runtime test
// harness (no @testing-library, no vitest.config) and the SetupProgress* files
// are internal (not part of package.json#exports), so they cannot be mounted or
// imported for a runtime behavioral test from here. Each assertion below pins a
// behavioral contract to the exact code construct that implements it — a revert
// that reintroduces the original bug breaks the matching test.

describe('SetupProgressStep — trickle engine (ETP-4446)', () => {
  // Isolate the trickle interval body so assertions target the creep logic and
  // not incidental matches elsewhere in the file.
  const trickleBlock = step.slice(
    step.indexOf('setDisplayedProgress((prev) => {'),
    step.indexOf('}, TRICKLE_INTERVAL_MS)'),
  );

  it('defines the tuning constants (soft cap never crosses 95 until success)', () => {
    assert.match(step, /const TRICKLE_LOOKAHEAD = 15;/);
    assert.match(step, /const TRICKLE_MAX = 95;/);
    assert.match(step, /const TRICKLE_EASE = 0\.005;/);
    assert.match(step, /const TRICKLE_INTERVAL_MS = 200;/);
    assert.match(step, /const ROTATION_INTERVAL_MS = 7500;/);
  });

  it('is monotonic: each tick starts from max(prev, real milestone), never below', () => {
    // Requirement 1 — the bar advances and NEVER retreats between events.
    assert.match(trickleBlock, /const base = Math\.max\(prev, targetProgressRef\.current\)/);
  });

  it('soft-caps the creep at the next milestone + lookahead, clamped to TRICKLE_MAX', () => {
    // Requirement 1 — never surpasses 95% without a real success.
    assert.match(
      trickleBlock,
      /const softCap = Math\.min\(targetProgressRef\.current \+ TRICKLE_LOOKAHEAD, TRICKLE_MAX\)/,
    );
    assert.match(trickleBlock, /if \(base >= softCap\) return base;/);
    assert.match(trickleBlock, /return base \+ \(softCap - base\) \* TRICKLE_EASE;/);
  });

  it('feeds the real milestone into the trickle target and renders the animated value', () => {
    assert.match(step, /targetProgressRef\.current = setupProgressState\.progress;/);
    // The rendered value is never below the real milestone (monotonic display).
    assert.match(
      step,
      /setupProgressState\.progress = Math\.max\(Math\.round\(displayedProgress\), setupProgressState\.progress\);/,
    );
  });

  it('keeps the milestone itself monotonic via maxSetupProgressRef while running', () => {
    assert.match(
      step,
      /setupProgressState\.progress = Math\.max\(setupProgressState\.progress, maxSetupProgressRef\.current\);\s*maxSetupProgressRef\.current = setupProgressState\.progress;/,
    );
  });
});

describe('SetupProgressStep — snap to 100 on success (ETP-4446)', () => {
  it('drives displayedProgress to 100 in an effect when the result is success', () => {
    // Requirement 2 — including an immediate success as the first message: the
    // effect keys on `result`, so any transition to success snaps the bar.
    assert.match(
      step,
      /useEffect\(\(\) => \{\s*if \(result\?\.status === 'success'\) setDisplayedProgress\(100\);\s*\}, \[result\]\)/,
    );
  });

  it('forces the rendered progress to 100 on success regardless of the trickle value', () => {
    assert.match(
      step,
      /if \(result\?\.status === 'success'\) \{\s*setupProgressState\.progress = 100;\s*\}/,
    );
  });
});

describe('SetupProgressStep — BUG-1: no snap-back on failure (ETP-4446, CRITICAL)', () => {
  // The fix: when `result.failed` arrives while the trickle already showed a
  // value HIGHER than the last real milestone, the bar must FREEZE at what the
  // user saw — it must NOT snap back down to the milestone.
  it('marks terminal state on both success and failure so the trickle freezes', () => {
    assert.match(
      step,
      /terminalRef\.current = result\?\.status === 'success' \|\| result\?\.status === 'failed';/,
    );
  });

  it('renders the failed bar from the animated value, not from the raw milestone', () => {
    // The failed path shares the running branch: progress = max(displayed, milestone).
    // Because the trickle is already frozen on terminal, this holds the last shown
    // value instead of collapsing to maxSetupProgressRef. Guards the exact revert
    // that reintroduced the snap-back.
    const elseBranch = step.slice(
      step.indexOf('} else {', step.indexOf("if (result?.status === 'success') {")),
      step.indexOf('// While actively running'),
    );
    assert.match(
      elseBranch,
      /setupProgressState\.progress = Math\.max\(Math\.round\(displayedProgress\), setupProgressState\.progress\);/,
    );
    // Regression guard: the failed branch must NOT reset the rendered progress to
    // the raw milestone (the pre-fix behavior that caused the visible snap-back).
    assert.doesNotMatch(elseBranch, /setupProgressState\.progress = maxSetupProgressRef\.current;/);
  });

  it('does not treat failure as a monotonic-milestone recompute (keeps the shown value)', () => {
    // The "Keep progress bar monotonic" block is gated on NOT-failed, so a failure
    // never rewrites setupProgressState.progress back to the milestone.
    assert.match(
      step,
      /if \(!setupProgressState\.success && result\?\.status !== 'failed'\) \{/,
    );
  });
});

describe('SetupProgressStep — freeze in terminal state (ETP-4446)', () => {
  it('short-circuits the trickle tick once terminal, so progress stops climbing', () => {
    // Requirement 4 — after success/failed the value does not keep rising.
    const trickleBlock = step.slice(
      step.indexOf('setDisplayedProgress((prev) => {'),
      step.indexOf('}, TRICKLE_INTERVAL_MS)'),
    );
    assert.match(trickleBlock, /if \(terminalRef\.current\) return prev;/);
  });
});

describe('SetupProgressStep — prefers-reduced-motion (ETP-4446)', () => {
  it('reads the reduce media query and stores it in a ref', () => {
    assert.match(step, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    assert.match(step, /reducedMotionRef\.current = mq\.matches;/);
    assert.match(step, /mq\.addEventListener\('change', apply\)/);
    assert.match(step, /mq\.removeEventListener\('change', apply\)/);
  });

  it('reflects only real milestones under reduced motion (no intermediate creep)', () => {
    // Requirement 5 — returns `base` (max of prev and milestone) with no easing.
    const trickleBlock = step.slice(
      step.indexOf('setDisplayedProgress((prev) => {'),
      step.indexOf('}, TRICKLE_INTERVAL_MS)'),
    );
    assert.match(trickleBlock, /if \(reducedMotionRef\.current\) return base;/);
    // The reduced-motion return happens BEFORE the softCap creep computation.
    assert.ok(
      trickleBlock.indexOf('if (reducedMotionRef.current) return base;') <
        trickleBlock.indexOf('const softCap'),
      'reduced-motion early return must precede the creep math',
    );
  });
});

describe('SetupProgressStep — rotating status text (ETP-4446)', () => {
  it('rotates through exactly the four in-progress phrases (no "finishing")', () => {
    // Requirement 6 — 4 keys, and the "finishing" phrase is deliberately excluded.
    const arrBlock = step.slice(
      step.indexOf('const ONBOARDING_ROTATING_KEYS = ['),
      step.indexOf('];', step.indexOf('const ONBOARDING_ROTATING_KEYS = [')),
    );
    const keys = arrBlock.match(/'onboardingPreparing\w+'/g) || [];
    assert.equal(keys.length, 4);
    assert.doesNotMatch(arrBlock, /Finishing/);
    assert.deepEqual(keys, [
      "'onboardingPreparingActivatingDescription'",
      "'onboardingPreparingConfiguringDescription'",
      "'onboardingPreparingDataDescription'",
      "'onboardingPreparingSequencesDescription'",
    ]);
  });

  it('advances rotatingIndex modulo the key count every 7500ms', () => {
    assert.match(
      step,
      /setInterval\(\(\) => \{\s*setRotatingIndex\(\(i\) => \(i \+ 1\) % ONBOARDING_ROTATING_KEYS\.length\);\s*\}, ROTATION_INTERVAL_MS\)/,
    );
  });

  it('only overrides the description with a rotating phrase while running (not terminal)', () => {
    // Requirement 6 — no rotation on success/failed.
    assert.match(
      step,
      /if \(running && result\?\.status !== 'success' && result\?\.status !== 'failed'\) \{\s*setupProgressState\.description = ui\(ONBOARDING_ROTATING_KEYS\[rotatingIndex\]\);/,
    );
  });
});

describe('SetupProgressStep — interval cleanup on unmount (ETP-4446)', () => {
  it('clears both the rotation and the trickle intervals on unmount', () => {
    // Requirement 7 — every setInterval has a matching clearInterval teardown.
    const clears = step.match(/return \(\) => clearInterval\(id\);/g) || [];
    assert.equal(clears.length, 2, 'rotation + trickle intervals must both be cleared');
  });
});

describe('SetupProgressCard — presentational ring & bar (ETP-4446)', () => {
  it('clamps progress into [0,100] when computing the ring dash offset', () => {
    // Requirement 8 — out-of-range progress (e.g. <0 or >100) is clamped.
    assert.match(
      card,
      /const dashOffset = RING_CIRCUMFERENCE \* \(1 - Math\.min\(Math\.max\(progress, 0\), 100\) \/ 100\);/,
    );
    assert.match(card, /const RING_RADIUS = 36;/);
    assert.match(card, /const RING_CIRCUMFERENCE = 2 \* Math\.PI \* RING_RADIUS;/);
  });

  it('spins the arc while loading but stops the spin on success', () => {
    // Requirement 8 — success drops `animate-spin` and holds a static -rotate-90.
    assert.match(
      card,
      /\$\{success \? '-rotate-90' : 'animate-spin motion-reduce:animate-none'\}/,
    );
  });

  it('disables the bar transition under reduced motion', () => {
    // Requirement 8 — bar carries motion-reduce:transition-none.
    assert.match(card, /transition-all duration-300 motion-reduce:transition-none/);
    assert.match(card, /width: `\$\{progress\}%`/);
  });

  it('switches ring/track/bar colors to the success palette', () => {
    assert.match(card, /const ringColor = success \? '#54b56a' : '#171923';/);
    assert.match(card, /const barColor = success \? '#54b56a' : '#171923';/);
  });
});

describe('SetupProgressShell — background slot (ETP-4446)', () => {
  it('renders the background prop as an absolutely-positioned decorative layer', () => {
    assert.match(shell, /export function SetupProgressShell\(\{ children, background, headerContent \}\)/);
    assert.match(shell, /\{background && <div className="absolute inset-0">\{background\}<\/div>\}/);
    // Content sits above the backdrop.
    assert.match(shell, /relative z-10 flex min-h-screen items-center justify-center/);
  });

  it('wires the backdrop from config.background into the shell', () => {
    assert.match(step, /<SetupProgressShell\s+background=\{config\.background\}/);
  });
});
