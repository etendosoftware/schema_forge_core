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
const localeFlagIconPath = join(onboardingSrc, 'components', 'LocaleFlagIcon.jsx');
const localeFlagIcon = readFileSync(localeFlagIconPath, 'utf8');
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
// a bug fix on top of the restore.
//
// Follow-up within the same ticket: the selector was further reworked from a
// native <select> to a Radix-based Select/SelectTrigger/SelectContent/
// SelectItem (from app-shell-core's ui/select), explicitly reversing the
// earlier "native-select-only, no flag in options" decision — the flag now
// renders per-option via LocaleFlagIcon inside each SelectItem, and Radix
// projects the selected item's content into the closed trigger automatically.
// These tests pin the new spec down so it doesn't drift again in either
// direction.
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
    // Radix's Select hands the new value directly (no DOM event object), so
    // the wiring is onValueChange={onChange} on the <Select> root itself.
    assert.match(languageSelect, /<Select\s+value=\{locale\}\s+onValueChange=\{onChange\}>/);
  });

  it('the locale change is persisted to localStorage (via useLocaleState)', () => {
    // This is the mechanism setLocale (from useLocaleSwitch) ultimately relies
    // on — if this write is ever dropped, a locale switch would not survive
    // a reload even though the dropdown itself still renders and reacts.
    assert.match(useLocaleState, /localStorage\.setItem\(STORAGE_KEY, newLocale\)/);
    assert.match(useLocaleState, /const STORAGE_KEY = 'schema-forge-locale'/);
  });

  it('renders the current locale flag via the dedicated LocaleFlagIcon component', () => {
    // Flag rendering was extracted out of OnboardingLanguageSelect.jsx into its
    // own component, so a real circular SVG can be used instead of an emoji glyph.
    // It's rendered per-option inside each SelectItem — Radix automatically
    // projects the selected item's content into the closed trigger's
    // SelectValue, so a single usage covers both the open list and the
    // closed control.
    assert.match(
      languageSelect,
      /import\s*\{\s*LocaleFlagIcon\s*\}\s*from\s*'\.\/LocaleFlagIcon\.jsx'/,
    );
    assert.match(languageSelect, /<LocaleFlagIcon\s+locale=\{option\.value\}\s*\/>/);
  });

  it('prefixes each option with a flag icon (Radix SelectItem supports rich content)', () => {
    // Unlike native <option>, Radix's SelectItem can render arbitrary JSX, so
    // the earlier "no flag in options" decision was explicitly reversed: each
    // option now shows LocaleFlagIcon alongside the label text.
    assert.doesNotMatch(languageSelect, /countryFlagEmoji/);
    const optionsBlock = languageSelect.slice(
      languageSelect.indexOf('{options.map((option) =>'),
      languageSelect.indexOf('</SelectContent>'),
    );
    assert.match(optionsBlock, /<SelectItem/);
    assert.match(optionsBlock, /<LocaleFlagIcon\s+locale=\{option\.value\}\s*\/>/);
    assert.match(optionsBlock, /\{option\.label\}/);
  });

  it('LocaleFlagIcon covers ES, US, and falls back gracefully for unknown regions', () => {
    // Known-locale circular SVG icons, hand-authored (no flag-icon dependency).
    assert.match(localeFlagIcon, /region === 'ES'/);
    assert.match(localeFlagIcon, /region === 'US'/);
    assert.match(localeFlagIcon, /<svg/);
    assert.match(localeFlagIcon, /<circle/);
    // Any other region degrades to the shared emoji glyph instead of crashing.
    assert.match(
      localeFlagIcon,
      /import\s*\{\s*countryFlagEmoji\s*\}\s*from\s*'\.\.\/countries\.js'/,
    );
    assert.match(localeFlagIcon, /countryFlagEmoji\(region\)/);
  });

  it('uses the Radix-based Select (no native <select> element)', () => {
    // Explicit reversal of the earlier native-select-only decision: the
    // component now imports the shared Radix Select primitives from
    // app-shell-core instead of rendering a raw <select>. SelectLabel and
    // SelectGroup joined the import list (ETP-4444 design-review follow-up,
    // see below) — this assertion pins the full import list including them.
    assert.match(
      languageSelect,
      /import\s*\{\s*\n?\s*Select,\s*\n?\s*SelectContent,\s*\n?\s*SelectGroup,\s*\n?\s*SelectItem,\s*\n?\s*SelectLabel,\s*\n?\s*SelectTrigger,\s*\n?\s*SelectValue,\s*\n?\s*\}\s*from\s*'@etendosoftware\/app-shell-core\/components\/ui\/select'/,
    );
    assert.match(languageSelect, /<Select\b/);
    assert.match(languageSelect, /<SelectTrigger\b/);
    assert.match(languageSelect, /<SelectContent\b/);
    assert.match(languageSelect, /<SelectItem\b/);
    assert.doesNotMatch(languageSelect, /<select/);
  });

  it('imports SelectLabel from the same shared select primitives module', () => {
    // SelectLabel was previously defined and exported by ui/select.jsx but
    // had zero consumers anywhere in the repo — this component is its first
    // consumer (design-review follow-up: a heading for context inside the
    // open dropdown).
    const importBlock = languageSelect.slice(
      languageSelect.indexOf('import {'),
      languageSelect.indexOf("from '@etendosoftware/app-shell-core/components/ui/select'"),
    );
    assert.match(importBlock, /\bSelectLabel\b/);
  });

  it('wraps SelectLabel and the options list in a SelectGroup inside SelectContent', () => {
    // Radix hard-requires SelectLabel to be a descendant of SelectGroup —
    // rendering it as a direct sibling of SelectItem inside SelectContent
    // throws `Error: \`SelectLabel\` must be used within \`SelectGroup\`` at
    // runtime (caught manually, no test had caught it). SelectGroup must
    // wrap both the label and the options.map block, nested inside
    // SelectContent.
    //
    // Note: SelectLabel now takes an explicit className (scoped override, see
    // the test below), so it's no longer the exact literal
    // `<SelectLabel>{label}</SelectLabel>` — match the opening tag instead.
    const contentOpenIndex = languageSelect.indexOf('<SelectContent>');
    const groupOpenIndex = languageSelect.indexOf('<SelectGroup>');
    const selectLabelIndex = languageSelect.indexOf('<SelectLabel');
    const optionsMapIndex = languageSelect.indexOf('{options.map((option) =>');
    const groupCloseIndex = languageSelect.indexOf('</SelectGroup>');
    const contentCloseIndex = languageSelect.indexOf('</SelectContent>');
    for (const [name, index] of [
      ['<SelectContent>', contentOpenIndex],
      ['<SelectGroup>', groupOpenIndex],
      ['<SelectLabel', selectLabelIndex],
      ['options.map(...)', optionsMapIndex],
      ['</SelectGroup>', groupCloseIndex],
      ['</SelectContent>', contentCloseIndex],
    ]) {
      assert.notEqual(index, -1, `${name} not found`);
    }
    assert.ok(
      contentOpenIndex < groupOpenIndex && groupOpenIndex < selectLabelIndex,
      'SelectGroup must open inside SelectContent, before SelectLabel',
    );
    assert.ok(optionsMapIndex < groupCloseIndex, 'options.map(...) must still be inside SelectGroup');
    assert.ok(groupCloseIndex < contentCloseIndex, 'SelectGroup must close before SelectContent does');
  });

  it('renders a SelectLabel heading as the first meaningful child of SelectContent, before the options list', () => {
    // Gives the open dropdown context (e.g. "Idioma"/"Language") — must
    // appear inside SelectContent (nested one level deeper, inside
    // SelectGroup, per the Radix fix above) and BEFORE options.map, not just
    // anywhere in the file.
    const contentOpenIndex = languageSelect.indexOf('<SelectContent>');
    const selectLabelIndex = languageSelect.indexOf('<SelectLabel');
    const optionsMapIndex = languageSelect.indexOf('{options.map((option) =>');
    assert.notEqual(contentOpenIndex, -1, '<SelectContent> not found');
    assert.notEqual(selectLabelIndex, -1, '<SelectLabel opening tag not found');
    assert.notEqual(optionsMapIndex, -1, 'options.map(...) block not found');
    assert.ok(
      selectLabelIndex > contentOpenIndex,
      'SelectLabel must be rendered inside SelectContent',
    );
    assert.ok(
      selectLabelIndex < optionsMapIndex,
      'SelectLabel must render before the options.map list, as a heading for it',
    );
    // The heading text itself is still the `label` prop (e.g. "Idioma"/"Language").
    const selectLabelBlock = languageSelect.slice(selectLabelIndex, languageSelect.indexOf('</SelectLabel>'));
    assert.match(selectLabelBlock, /\{label\}/);
  });

  it('scopes the three ETP-4444 visual treatments to className overrides on THIS component, not the shared select.jsx primitive', () => {
    // Design-review pushback: the visual fixes (open-state ring, checked-item
    // background, Figma heading style) must not leak into the shared
    // app-shell-core `select.jsx` primitive used app-wide (lookups, process
    // param dialogs, forms, etc.) — they're scoped here via `className`
    // overrides, which `cn()`/tailwind-merge safely layers on top of the
    // shared defaults per element.
    function extractOpeningTag(source, tagName) {
      const start = source.indexOf(`<${tagName}`);
      assert.notEqual(start, -1, `<${tagName}> not found`);
      const end = source.indexOf('>', start);
      assert.notEqual(end, -1, `<${tagName}> opening tag never closes`);
      return source.slice(start, end + 1);
    }

    const triggerTag = extractOpeningTag(languageSelect, 'SelectTrigger');
    assert.match(triggerTag, /className="[^"]*data-\[state=open\]:ring-1 data-\[state=open\]:ring-ring[^"]*"/);

    const itemTag = extractOpeningTag(languageSelect, 'SelectItem');
    assert.match(itemTag, /className="data-\[state=checked\]:bg-\[rgba\(18,18,23,0\.05\)\]"/);

    const labelTag = extractOpeningTag(languageSelect, 'SelectLabel');
    assert.match(labelTag, /className="px-4 py-1 text-xs font-normal leading-6 text-\[#6C6C89\]"/);
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
