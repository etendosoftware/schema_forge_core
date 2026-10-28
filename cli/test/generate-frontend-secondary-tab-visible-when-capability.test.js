// @covers cli/src/generate-frontend.js
// @covers cli/src/generate-contract.js
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

const logicContract = { frontendContract: { window: { name: 'Sales Invoice' }, entities: { exchangeRates: { fields: [] } } } };
const columnMap = { C_Currency_ID: 'currency', DocumentStatus: 'documentStatus' };
const LOGIC = "@C_Currency_ID@!'' & @C_Currency_ID@!@#OrgCurrencyId@";

const resolve = (cfg, map = columnMap) =>
  resolveSecondaryTabDefs({ exchangeRates: { label: 'Exchange Rates', ...cfg } }, logicContract, 'header', 'lines', map, []);

describe('secondaryTabs visibleWhenLogic compilation', () => {
  it('compiles to visibleWhenJs with a ctx null-guard prefix', () => {
    const [def] = resolve({ visibleWhenLogic: LOGIC });
    assert.equal(
      def.visibleWhenJs,
      "ctx['OrgCurrencyId'] != null && ((record['currency'] != null && record['currency'] !== '') && record['currency'] !== ctx['OrgCurrencyId'])",
    );
  });

  it('emits one guard per distinct ctx variable', () => {
    const [def] = resolve({ visibleWhenLogic: '@C_Currency_ID@!@#A@ & @DocumentStatus@=@#B@ & @C_Currency_ID@!@#A@' });
    assert.equal(def.visibleWhenJs.match(/ctx\['A'\] != null/g).length, 1);
    assert.match(def.visibleWhenJs, /^ctx\['A'\] != null && ctx\['B'\] != null && /);
  });

  it('a purely record-based expression gets no ctx guard', () => {
    const [def] = resolve({ visibleWhenLogic: "@DocumentStatus@!='DR'" });
    assert.equal(def.visibleWhenJs, "record['documentStatus'] !== 'DR'");
  });

  it('defaults visibleWhenJs to null when not declared', () => {
    assert.equal(resolve({})[0].visibleWhenJs, null);
  });

  it('does not touch how readOnlyLogic compiles', () => {
    const [def] = resolve({ readOnlyLogic: "@DocumentStatus@!='DR'" });
    assert.equal(def.readOnlyLogicJs, "record['documentStatus'] !== 'DR'");
    assert.equal(def.visibleWhenJs, null);
  });

  it('throws naming window and tab when a token is left unresolved', () => {
    assert.throws(() => resolve({ visibleWhenLogic: '@C_Currency_ID@ > @#Org@' }), (e) => {
      assert.match(e.message, /Sales Invoice/);
      assert.match(e.message, /secondaryTabs\.exchangeRates/);
      return true;
    });
  });

  it('throws naming window and tab when a non-# token is not a header column', () => {
    assert.throws(() => resolve({ visibleWhenLogic: "@Nope_ID@!''" }), (e) => {
      assert.match(e.message, /Sales Invoice/);
      assert.match(e.message, /exchangeRates/);
      assert.match(e.message, /Nope_ID/);
      return true;
    });
  });

  it('throws naming window and tab when the compiled output is not valid JS', () => {
    assert.throws(() => resolve({ visibleWhenLogic: "@C_Currency_ID@!'' & (" }), (e) => {
      assert.match(e.message, /Sales Invoice/);
      assert.match(e.message, /exchangeRates/);
      assert.match(e.message, /not valid JS/);
      return true;
    });
  });

  it('rejects backslashes, newlines and U+2028/U+2029 in logic, naming window and tab', () => {
    const bad = [
      "@#X@='\\' | @#Y@='x'",
      "@C_Currency_ID@='a\nb'",
      "@C_Currency_ID@='a\u2028b'",
      "@C_Currency_ID@='a\u2029b'",
    ];
    for (const logic of bad) {
      assert.throws(() => resolve({ visibleWhenLogic: logic }), (e) => {
        assert.match(e.message, /Sales Invoice/);
        assert.match(e.message, /secondaryTabs\.exchangeRates/);
        assert.match(e.message, /illegal character/);
        return true;
      }, logic);
    }
  });

  it('a normal literal still compiles', () => {
    const [def] = resolve({ visibleWhenLogic: "@DocumentStatus@='DR' | @#IsSOTrx@='Y'" });
    assert.equal(def.visibleWhenJs, "ctx['IsSOTrx'] != null && (record['documentStatus'] === 'DR' || ctx['IsSOTrx'] === 'Y')");
  });

  it('falls back to the header entity name when the contract has no window name', () => {
    const bare = { frontendContract: { entities: {} } };
    assert.throws(
      () => resolveSecondaryTabDefs({ t: { visibleWhenLogic: "@X@!''" } }, bare, 'header', 'lines', {}, []),
      /header \/ secondaryTabs\.t/,
    );
  });
});

describe('buildSecondaryTabPropEntry visibleWhen emission', () => {
  const js = "ctx['O'] != null && record['currency'] !== ctx['O']";

  it('emits visibleWhen on a table tab', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'k', label: 'L', TableName: 'T', FormName: 'F', addLineEntries: [], visibleWhenJs: js,
    });
    assert.match(entry, /visibleWhen: \(record, ctx\) => ctx\['O'\] != null/);
    assertParsesAsObjectLiteral(entry);
  });

  it('emits visibleWhen on a form tab', () => {
    const entry = buildSecondaryTabPropEntry({ key: 'k', label: 'L', isFormTab: true, FormName: 'F', visibleWhenJs: js });
    assert.match(entry, /visibleWhen: \(record, ctx\)/);
    assertParsesAsObjectLiteral(entry);
  });

  it('emits visibleWhen on a panel tab', () => {
    const entry = buildSecondaryTabPropEntry({ key: 'k', label: 'L', isPanelTab: true, PanelName: 'P', visibleWhenJs: js });
    assert.match(entry, /visibleWhen: \(record, ctx\)/);
    assertParsesAsObjectLiteral(entry);
  });

  it('emits nothing when visibleWhenJs is null or absent, in all three branches', () => {
    const entries = [
      buildSecondaryTabPropEntry({ key: 'k', label: 'L', TableName: 'T', FormName: 'F', addLineEntries: [], visibleWhenJs: null }),
      buildSecondaryTabPropEntry({ key: 'k', label: 'L', isFormTab: true, FormName: 'F' }),
      buildSecondaryTabPropEntry({ key: 'k', label: 'L', isPanelTab: true, PanelName: 'P' }),
    ];
    for (const entry of entries) {
      assert.doesNotMatch(entry, /visibleWhen\b(?!Capability)/);
      assertParsesAsObjectLiteral(entry);
    }
  });

  it('coexists with visibleWhenCapability and readOnlyLogic and the result is evaluable', () => {
    const entry = buildSecondaryTabPropEntry({
      key: 'k', label: 'L', isFormTab: true, FormName: 'F',
      visibleWhenCapability: 'cap', readOnlyLogicJs: "record['a'] === 'x'", visibleWhenJs: js,
    });
    const trimmed = entry.trim().replace(/,$/, '');
    const F = 'F';
    // eslint-disable-next-line no-new-func
    const [tab] = new Function('F', `return [${trimmed}];`)(F);
    assert.equal(tab.visibleWhen({ currency: 'EUR' }, { O: 'USD' }), true);
    assert.equal(tab.visibleWhen({ currency: 'EUR' }, { O: 'EUR' }), false);
    assert.equal(tab.visibleWhen({ currency: 'EUR' }, {}), false);
    assert.equal(tab.visibleWhenCapability, 'cap');
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
