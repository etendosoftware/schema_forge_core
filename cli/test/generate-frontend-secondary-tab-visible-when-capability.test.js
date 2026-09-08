import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveSecondaryTabDefs, buildSecondaryTabPropEntry } from '../src/generate-frontend.js';

const contract = { frontendContract: { entities: { accounting: { fields: [] } } } };

describe('secondaryTabs visibleWhenCapability passthrough (ETP-5116)', () => {
  it('resolveSecondaryTabDefs carries the declared visibleWhenCapability onto the resolved tab def', () => {
    const decl = { accounting: { label: 'Accounting', visibleWhenCapability: 'showAccountingFields' } };
    const defs = resolveSecondaryTabDefs(decl, contract, 'header', 'lines', {}, {});
    assert.equal(defs[0].visibleWhenCapability, 'showAccountingFields');
  });

  it('resolveSecondaryTabDefs defaults visibleWhenCapability to null when not declared', () => {
    const decl = { accounting: { label: 'Accounting' } };
    const defs = resolveSecondaryTabDefs(decl, contract, 'header', 'lines', {}, {});
    assert.equal(defs[0].visibleWhenCapability, null);
  });

  it('buildSecondaryTabPropEntry emits visibleWhenCapability (escaped) when present, on a regular table tab', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'accounting', label: 'Accounting', TableName: 'AccountingTable', FormName: 'AccountingForm',
      addLineEntries: [], visibleWhenCapability: "show'AccountingFields",
    });
    assert.match(entry, /visibleWhenCapability: 'show\\'AccountingFields'/);
    assertParsesAsObjectLiteral(entry);
  });

  it('buildSecondaryTabPropEntry omits visibleWhenCapability when absent, no dangling comma', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'accounting', label: 'Accounting', TableName: 'AccountingTable', FormName: 'AccountingForm',
      addLineEntries: [],
    });
    assert.doesNotMatch(entry, /visibleWhenCapability/);
    assert.doesNotMatch(entry, /,\s*,/);
    assert.doesNotMatch(entry, /,\s*\}/);
    assertParsesAsObjectLiteral(entry);
  });

  it('buildSecondaryTabPropEntry emits visibleWhenCapability on isFormTab entries', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'k', label: 'L', isFormTab: true, FormName: 'F', visibleWhenCapability: 'showAccountingFields',
    });
    assert.match(entry, /visibleWhenCapability: 'showAccountingFields'/);
    assertParsesAsObjectLiteral(entry);
  });

  it('buildSecondaryTabPropEntry emits visibleWhenCapability on isPanelTab entries', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'k', label: 'L', isPanelTab: true, PanelName: 'P', visibleWhenCapability: 'showAccountingFields',
    });
    assert.match(entry, /visibleWhenCapability: 'showAccountingFields'/);
    assertParsesAsObjectLiteral(entry);
  });
});

// See the sibling labelKey test file for the rationale behind this parse check:
// strip the trailing comma, wrap as the sole element of an array literal, and
// confirm `new Function` can parse it without throwing a SyntaxError.
function assertParsesAsObjectLiteral(entry) {
  const trimmed = entry.trim().replace(/,$/, '');
  assert.doesNotThrow(() => {
    // eslint-disable-next-line no-new-func
    new Function(`return [${trimmed}];`);
  }, `Generated entry is not valid JS:\n${entry}`);
}
