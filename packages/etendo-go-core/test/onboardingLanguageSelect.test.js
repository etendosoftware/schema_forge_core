import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const onboardingSrc = join(__dirname, '..', 'src', 'onboarding');
const loginStep = readFileSync(join(onboardingSrc, 'steps', 'LoginStep.jsx'), 'utf8');
const profileStep = readFileSync(join(onboardingSrc, 'steps', 'ProfileStep.jsx'), 'utf8');
const companyStep = readFileSync(join(onboardingSrc, 'steps', 'CompanyStep.jsx'), 'utf8');
const registerStep = readFileSync(join(onboardingSrc, 'steps', 'RegisterStep.jsx'), 'utf8');
const envSelectStep = readFileSync(join(onboardingSrc, 'steps', 'EnvSelectStep.jsx'), 'utf8');
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
// caught it) → restored on all 5 onboarding steps (58cb87575). This is a
// deliberate, confirmed-with-product follow-up on the SAME ticket: the
// restored spec was incomplete in two ways — it was missing a flag icon, and
// it was over-applied to 4 steps that should never have shown it. Login is
// the only screen where the selector belongs; this is a scope narrowing, not
// a bug fix on top of the restore. These tests pin the new spec down so it
// doesn't drift again in either direction.
describe('OnboardingLanguageSelect wiring (ETP-4444, Login-only scope)', () => {
  it('imports OnboardingLanguageSelect in LoginStep', () => {
    assert.match(
      loginStep,
      /import\s*\{\s*OnboardingLanguageSelect\s*\}\s*from\s*'\.\.\/components\/OnboardingLanguageSelect\.jsx'/,
    );
  });

  it('does not reference OnboardingLanguageSelect in the other 4 onboarding steps', () => {
    for (const [name, content] of [
      ['ProfileStep', profileStep],
      ['CompanyStep', companyStep],
      ['RegisterStep', registerStep],
      ['EnvSelectStep', envSelectStep],
    ]) {
      assert.doesNotMatch(
        content,
        /OnboardingLanguageSelect/,
        `${name} must not import or render OnboardingLanguageSelect`,
      );
    }
  });

  it('renders OnboardingLanguageSelect in the Login header, not just imports it', () => {
    // localeControl must actually use the component (guards against a dead import).
    const localeControlBlock = loginStep.slice(
      loginStep.indexOf('const localeControl ='),
      loginStep.indexOf('const authFeatureLabels ='),
    );
    assert.match(localeControlBlock, /<OnboardingLanguageSelect/);
    // All 3 LoginStep views (login/forgot-password/reset-password) pass it as headerContent.
    const headerContentOccurrences = loginStep.match(/headerContent=\{localeControl\}/g) || [];
    assert.equal(headerContentOccurrences.length, 3);
  });

  it('only renders the selector when a real setLocale is available (no dead control)', () => {
    assert.match(loginStep, /const localeControl = setLocale \?/);
  });

  it('wires the selector onChange to a handler that calls the real setLocale', () => {
    assert.match(loginStep, /const \{ locale, setLocale \} = useLocaleSwitch\(\)/);
    const handlerBlock = loginStep.slice(
      loginStep.indexOf('const setOnboardingLocale ='),
      loginStep.indexOf('const languageOptions ='),
    );
    assert.match(handlerBlock, /if \(setLocale\) setLocale\(nextLocale\)/);
    assert.match(loginStep, /onChange=\{setOnboardingLocale\}/);
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

  it('renders a flag glyph derived from the current locale, reusing countryFlagEmoji', () => {
    // Must reuse the shared helper from countries.js rather than duplicating a flag map.
    assert.match(
      languageSelect,
      /import\s*\{\s*countryFlagEmoji\s*\}\s*from\s*'\.\.\/countries\.js'/,
    );
    // The current flag is shown as a leading visual icon in the closed control.
    assert.match(languageSelect, /countryFlagEmoji\(regionFromLocale\(locale\)\)/);
    // Options are also flag-prefixed.
    assert.match(languageSelect, /countryFlagEmoji\(regionFromLocale\(option\.value\)\)/);
  });

  it('keeps native <select> semantics (no Radix/custom listbox)', () => {
    assert.match(languageSelect, /<select/);
    assert.doesNotMatch(languageSelect, /SelectPrimitive/);
  });

  it('keeps the country field fixed (a static label, not a selector) in ProfileStep', () => {
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
