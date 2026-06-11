import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { generateFrontendContract } from '../src/generate-contract.js';

// ---------------------------------------------------------------------------
// Curated schema for a list-modal window. Two grid fields carry the inline
// affordances (`inlineToggle` / `inlineEdit`) so we can assert applyGridHints
// maps them into the frontend contract field. The window declares
// layoutType "list-modal" with a templateConfig.
// ---------------------------------------------------------------------------

const listModalSchema = {
  version: '0.1.0',
  window: {
    id: '700',
    name: 'Match Rules',
    primaryEntity: 'etgoMatchRuleHeader',
    category: 'financial',
    layoutType: 'list-modal',
    templateConfig: {
      titleKey: 'matchRuleNewTitle',
      bannerKey: 'matchRuleBanner',
      autoPriorityField: 'priority',
      autoPriorityStep: 10,
      sections: [{ key: 'general' }, { key: 'dimensions', label: 'matchRuleSectionDimensions' }],
    },
  },
  entities: [{
    name: 'etgoMatchRuleHeader',
    table: 'ETGO_SF_Match_Rule',
    level: 'header',
    fields: [
      { name: 'active', column: 'IsActive', type: 'boolean', visibility: 'editable',
        required: false, searchable: false, grid: true, form: false, inlineToggle: true },
      { name: 'priority', column: 'Priority', type: 'integer', visibility: 'editable',
        required: false, searchable: false, grid: true, form: true, inlineEdit: true },
      { name: 'name', column: 'Name', type: 'string', visibility: 'editable',
        required: true, searchable: true, grid: true, form: true },
    ],
  }],
};

describe('generateFrontendContract — applyGridHints (inline affordances)', () => {
  it('carries inlineToggle: true from a curated field into the mapped field', () => {
    const fc = generateFrontendContract(listModalSchema);
    const active = fc.entities.etgoMatchRuleHeader.fields.find(f => f.name === 'active');
    assert.ok(active, 'active field should be present');
    assert.equal(active.inlineToggle, true, 'inlineToggle should be carried into the contract');
  });

  it('carries inlineEdit: true from a curated field into the mapped field', () => {
    const fc = generateFrontendContract(listModalSchema);
    const priority = fc.entities.etgoMatchRuleHeader.fields.find(f => f.name === 'priority');
    assert.ok(priority, 'priority field should be present');
    assert.equal(priority.inlineEdit, true, 'inlineEdit should be carried into the contract');
  });

  it('does NOT add inlineToggle / inlineEdit to fields that lack them', () => {
    const fc = generateFrontendContract(listModalSchema);
    const name = fc.entities.etgoMatchRuleHeader.fields.find(f => f.name === 'name');
    assert.equal(name.inlineToggle, undefined, 'plain field should not have inlineToggle');
    assert.equal(name.inlineEdit, undefined, 'plain field should not have inlineEdit');
  });
});

describe('generateFrontendContract — templateConfig on list-modal window', () => {
  it('includes templateConfig on the window when layoutType is list-modal', () => {
    const fc = generateFrontendContract(listModalSchema);
    assert.equal(fc.window.layoutType, 'list-modal');
    assert.ok(fc.window.templateConfig, 'templateConfig should be present for list-modal');
    assert.equal(fc.window.templateConfig.titleKey, 'matchRuleNewTitle');
    assert.equal(fc.window.templateConfig.autoPriorityField, 'priority');
    assert.equal(fc.window.templateConfig.autoPriorityStep, 10);
  });

  it('templateConfig is null when not declared on a list-modal window', () => {
    const schema = {
      ...listModalSchema,
      window: { ...listModalSchema.window, templateConfig: undefined },
    };
    const fc = generateFrontendContract(schema);
    assert.equal(fc.window.layoutType, 'list-modal');
    assert.ok('templateConfig' in fc.window, 'list-modal window should always carry the templateConfig key');
    assert.equal(fc.window.templateConfig, null);
  });

  it('does NOT attach templateConfig on a default-layout window', () => {
    const schema = {
      ...listModalSchema,
      window: { ...listModalSchema.window, layoutType: undefined, templateConfig: undefined },
    };
    const fc = generateFrontendContract(schema);
    assert.equal(fc.window.layoutType, 'default');
    assert.equal(fc.window.templateConfig, undefined, 'default layout should not carry templateConfig');
  });
});
