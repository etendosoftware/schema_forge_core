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
});
