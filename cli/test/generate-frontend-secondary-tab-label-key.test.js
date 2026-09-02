import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveSecondaryTabDefs, buildSecondaryTabPropEntry } from '../src/generate-frontend.js';

const contract = { frontendContract: { entities: { locationAddress: { fields: [] } } } };

describe('secondaryTabs labelKey / addLineLabelKey passthrough (ETP-5021)', () => {
  it('resolveSecondaryTabDefs carries the declared labelKey and addLineLabelKey onto the resolved tab def', () => {
    const decl = { locationAddress: { label: 'Dirección', labelKey: 'direccionTab', addLineLabelKey: 'addAddress' } };
    const defs = resolveSecondaryTabDefs(decl, contract, 'header', 'lines', {}, {});
    assert.equal(defs[0].labelKey, 'direccionTab');
    assert.equal(defs[0].addLineLabelKey, 'addAddress');
  });

  it('resolveSecondaryTabDefs defaults both to null when not declared', () => {
    const decl = { locationAddress: { label: 'Dirección' } };
    const defs = resolveSecondaryTabDefs(decl, contract, 'header', 'lines', {}, {});
    assert.equal(defs[0].labelKey, null);
    assert.equal(defs[0].addLineLabelKey, null);
  });

  // The legacy no-decisions.json fallback branch (secondaryTabsDecl === null/undefined,
  // hardcoded known-tab list + entity inference) is intentionally NOT part of ETP-5021's
  // scope — it predates decisions.json-declarative secondaryTabs entirely. Confirms it
  // stays a clean no-op (undefined, not a crash or a stray literal) rather than silently
  // becoming a gap that looks like an oversight.
  it('the legacy no-decisions.json fallback branch omits labelKey/addLineLabelKey entirely (out of ETP-5021 scope, not a gap)', () => {
    const legacyContract = { frontendContract: { entities: { accounting: { fields: [] } } } };
    const defs = resolveSecondaryTabDefs(null, legacyContract, 'header', 'lines', {}, {});
    const accountingDef = defs.find(d => d.key === 'accounting');
    assert.ok(accountingDef, 'expected the hardcoded "accounting" known-tab entry to resolve');
    assert.equal(accountingDef.labelKey, undefined);
    assert.equal(accountingDef.addLineLabelKey, undefined);

    const entry = buildSecondaryTabPropEntry(accountingDef);
    assert.doesNotMatch(entry, /labelKey/);
    assert.doesNotMatch(entry, /addLineLabelKey/);
    assertParsesAsObjectLiteral(entry);
  });

  it('buildSecondaryTabPropEntry emits both literals when present, on a regular table tab', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'locationAddress', label: 'Dirección', TableName: 'LocationAddressTable', FormName: 'LocationAddressForm',
      addLineEntries: [], labelKey: 'direccionTab', addLineLabelKey: 'addAddress',
    });
    assert.match(entry, /labelKey: 'direccionTab'/);
    assert.match(entry, /addLineLabelKey: 'addAddress'/);
  });

  it('buildSecondaryTabPropEntry omits both literals when absent', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'locationAddress', label: 'Dirección', TableName: 'LocationAddressTable', FormName: 'LocationAddressForm',
      addLineEntries: [],
    });
    assert.doesNotMatch(entry, /labelKey/);
    assert.doesNotMatch(entry, /addLineLabelKey/);
  });

  it('buildSecondaryTabPropEntry emits labelKey (but not addLineLabelKey) on isFormTab and isPanelTab entries', () => {
    const formEntry = buildSecondaryTabPropEntry({ key: 'k', label: 'L', isFormTab: true, FormName: 'F', labelKey: 'someKey' });
    assert.match(formEntry, /labelKey: 'someKey'/);
    assert.doesNotMatch(formEntry, /addLineLabelKey/);

    const panelEntry = buildSecondaryTabPropEntry({ key: 'k', label: 'L', isPanelTab: true, PanelName: 'P', labelKey: 'someKey' });
    assert.match(panelEntry, /labelKey: 'someKey'/);
    assert.doesNotMatch(panelEntry, /addLineLabelKey/);
  });

  // Each of labelKey/addLineLabelKey is independently optional — a tab can declare
  // just one without the other. Verify each comes through alone with no dangling
  // ", " artifact left by the other's omitted fragment, and that the emitted
  // literal is syntactically valid (parseable as a JS object).
  it('buildSecondaryTabPropEntry emits labelKey alone (addLineLabelKey absent) with no dangling comma', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'locationAddress', label: 'Dirección', TableName: 'LocationAddressTable', FormName: 'LocationAddressForm',
      addLineEntries: [], labelKey: 'direccionTab',
    });
    assert.match(entry, /labelKey: 'direccionTab'/);
    assert.doesNotMatch(entry, /addLineLabelKey/);
    assert.doesNotMatch(entry, /,\s*,/);
    assert.doesNotMatch(entry, /,\s*\}/);
    assertParsesAsObjectLiteral(entry);
  });

  it('buildSecondaryTabPropEntry emits addLineLabelKey alone (labelKey absent) with no dangling comma', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'locationAddress', label: 'Dirección', TableName: 'LocationAddressTable', FormName: 'LocationAddressForm',
      addLineEntries: [], addLineLabelKey: 'addAddress',
    });
    assert.doesNotMatch(entry, /labelKey: '/);
    assert.match(entry, /addLineLabelKey: 'addAddress'/);
    assert.doesNotMatch(entry, /,\s*,/);
    assert.doesNotMatch(entry, /,\s*\}/);
    assertParsesAsObjectLiteral(entry);
  });

  it('buildSecondaryTabPropEntry with both present is also syntactically valid (no dangling comma)', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'locationAddress', label: 'Dirección', TableName: 'LocationAddressTable', FormName: 'LocationAddressForm',
      addLineEntries: [], labelKey: 'direccionTab', addLineLabelKey: 'addAddress',
    });
    assert.doesNotMatch(entry, /,\s*,/);
    assert.doesNotMatch(entry, /,\s*\}/);
    assertParsesAsObjectLiteral(entry);
  });

  it('buildSecondaryTabPropEntry with neither is also syntactically valid (no dangling comma)', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'locationAddress', label: 'Dirección', TableName: 'LocationAddressTable', FormName: 'LocationAddressForm',
      addLineEntries: [],
    });
    assert.doesNotMatch(entry, /,\s*,/);
    assert.doesNotMatch(entry, /,\s*\}/);
    assertParsesAsObjectLiteral(entry);
  });
});

// The generator emits each entry as a trailing-comma-terminated object-literal
// line meant to sit inside an array (`[ ...entries... ]`), so a bare entry on
// its own is not valid standalone JS. Strip the trailing comma and wrap it as
// the sole element of an array literal, then confirm `new Function` can PARSE
// it without a SyntaxError — this is the concrete "no dangling comma /
// malformed literal" check the string-level regexes above only approximate.
// Deliberately does NOT call the constructed function: Table/Form/Panel are
// emitted as bare component-reference identifiers (e.g. `Table:
// LocationAddressTable`, not a string), which are undefined in this scope and
// would throw a ReferenceError on invocation even though the syntax is fine —
// `new Function(...)` alone already parses the body without executing it.
function assertParsesAsObjectLiteral(entry) {
  const trimmed = entry.trim().replace(/,$/, '');
  assert.doesNotThrow(() => {
    // eslint-disable-next-line no-new-func
    new Function(`return [${trimmed}];`);
  }, `Generated entry is not valid JS:\n${entry}`);
}
