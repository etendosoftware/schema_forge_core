import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');
const profileStep = readFileSync(join(onboardingSrc, 'steps', 'ProfileStep.jsx'), 'utf8');
const languageSelect = readFileSync(join(onboardingSrc, 'components', 'OnboardingLanguageSelect.jsx'), 'utf8');
// useLocaleState lives in the sibling app-shell-core package — it owns the
// localStorage persistence that setLocale (returned by useLocaleSwitch) relies on.
const useLocaleState = readFileSync(
  join(__dirname, '..', '..', 'app-shell-core', 'src', 'i18n', 'useLocaleState.js'),
  'utf8',
);

// ETP-4444 — regression test for the onboarding language selector.
//
// History: added implicitly → removed by mistake (d7d0c3ea8, bad spec, no test
// caught it) → restored (58cb87575). Nothing pinned this behavior down before,
// so it could silently disappear again. These tests fix in place:
//   1. The selector renders inside ProfileStep (the onboarding profile step).
//   2. Changing it calls the real setLocale from useLocaleSwitch, and that
//      change is persisted (via useLocaleState's localStorage write).
//   3. The country field stays fixed/non-interactive (ETP-4444 also fixed the
//      country to Spain-only — this must not regress alongside the selector).
describe('OnboardingLanguageSelect wiring in ProfileStep (ETP-4444)', () => {
  it('imports OnboardingLanguageSelect from the components dir', () => {
    assert.match(
      profileStep,
      /import\s*\{\s*OnboardingLanguageSelect\s*\}\s*from\s*'\.\.\/components\/OnboardingLanguageSelect\.jsx'/,
    );
  });

  it('renders OnboardingLanguageSelect in the step header, not just imports it', () => {
    // localeControl must actually use the component (guards against a dead import
    // left behind by a future partial revert).
    const localeControlBlock = profileStep.slice(
      profileStep.indexOf('const localeControl ='),
      profileStep.indexOf('const setupHeaderContent ='),
    );
    assert.match(localeControlBlock, /<OnboardingLanguageSelect/);
    // The header (passed to SetupShell) must include the rendered control.
    assert.match(profileStep, /headerContent=\{setupHeaderContent\}/);
    assert.match(profileStep, /\{localeControl\}/);
  });

  it('only renders the selector when a real setLocale is available (no dead control)', () => {
    assert.match(profileStep, /const localeControl = setLocale \?/);
  });

  it('wires the selector onChange to a handler that calls the real setLocale', () => {
    assert.match(profileStep, /const \{ locale, setLocale \} = useLocaleSwitch\(\)/);
    const handlerBlock = profileStep.slice(
      profileStep.indexOf('const setOnboardingLocale ='),
      profileStep.indexOf('const handleContinue ='),
    );
    assert.match(handlerBlock, /if \(setLocale\) setLocale\(nextLocale\)/);
    assert.match(profileStep, /onChange=\{setOnboardingLocale\}/);
  });

  it('the underlying <select> forwards the chosen value via onChange', () => {
    assert.match(languageSelect, /onChange=\{\(event\) => onChange\(event\.target\.value\)\}/);
  });

  it('the locale change is persisted to localStorage (via useLocaleState)', () => {
    // This is the mechanism setLocale (from useLocaleSwitch) ultimately relies
    // on — if this write is ever dropped, a locale switch would not survive
    // a reload even though the dropdown itself still renders and reacts.
    assert.match(useLocaleState, /localStorage\.setItem\(STORAGE_KEY, newLocale\)/);
    assert.match(useLocaleState, /const STORAGE_KEY = 'schema-forge-locale'/);
  });

  it('keeps the country field fixed (a static label, not a selector)', () => {
    const countryBlock = profileStep.slice(
      profileStep.indexOf('id="countryCode"'),
      profileStep.indexOf('id="countryCode"') + 400,
    );
    // No interactive form control (select/input/button) for country.
    assert.doesNotMatch(countryBlock, /<select/);
    assert.doesNotMatch(countryBlock, /<input/);
    assert.doesNotMatch(countryBlock, /onChange=/);
    assert.doesNotMatch(countryBlock, /onClick=/);
    // It renders the single fixed country derived from countries.js.
    assert.match(profileStep, /const fixedCountry = buildCountryOptions\(config\.countryCodes, locale\)\[0\]/);
  });
});
