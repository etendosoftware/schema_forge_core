import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { classifyRule, classifyRules } from '../src/pre-classify.js';

describe('classifyRule (deterministic)', () => {
  it('auto-keeps simple displayLogic', () => {
    const rule = {
      type: 'displayLogic',
      expression: "@IsSalesTransaction@='Y'",
      hasDmlOperations: false
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'auto');
    assert.equal(result.autoDecision, 'keep');
    assert.ok(result.translatedExpression);
  });

  it('escalates displayLogic with framework calls', () => {
    const rule = {
      type: 'displayLogic',
      expression: "OB.Utilities.checkRole()",
      hasDmlOperations: false
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.equal(result.decision, 'pending');
  });

  it('auto-keeps simple callout without DML', () => {
    const rule = {
      type: 'callout',
      complexity: 'low',
      hasDmlOperations: false,
      effects: [{ field: 'total', action: 'setValue' }]
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'auto');
    assert.equal(result.autoDecision, 'keep');
  });

  it('escalates callout with DML', () => {
    const rule = {
      type: 'callout',
      complexity: 'low',
      hasDmlOperations: true,
      dmlWarning: 'Performs direct DB operations',
      effects: [{ field: 'total', action: 'setValue' }]
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.ok(result.warnings);
  });

  it('escalates complex callout with many effects', () => {
    const rule = {
      type: 'callout',
      complexity: 'high',
      hasDmlOperations: false,
      effects: [{}, {}, {}]
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
  });

  it('auto-keeps simple validation', () => {
    const rule = {
      type: 'validation',
      complexity: 'low',
      hasDmlOperations: false,
      expression: "SELECT COUNT(*) FROM C_Order WHERE IsActive='Y'"
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'auto');
  });

  it('readOnlyLogic behaves like displayLogic for simple expressions', () => {
    const rule = {
      type: 'readOnlyLogic',
      expression: "@IsActive@='Y'",
      hasDmlOperations: false
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'auto');
    assert.equal(result.autoDecision, 'keep');
    assert.ok(result.translatedExpression);
  });

  it('readOnlyLogic with framework calls escalates to human', () => {
    const rule = {
      type: 'readOnlyLogic',
      expression: "OB.Utilities.checkPermission()",
      hasDmlOperations: false
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.equal(result.decision, 'pending');
  });

  it('unknown rule type returns human/pending', () => {
    const rule = {
      type: 'unknownType',
      complexity: 'low',
      hasDmlOperations: false
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.equal(result.decision, 'pending');
  });

  it('undefined rule type returns human/pending', () => {
    const rule = { complexity: 'low' };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.equal(result.decision, 'pending');
  });

  it('validation with DML escalates to human/pending', () => {
    const rule = {
      type: 'validation',
      complexity: 'low',
      hasDmlOperations: true
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.equal(result.decision, 'pending');
  });

  it('callout with exactly 2 effects and low complexity is auto', () => {
    const rule = {
      type: 'callout',
      complexity: 'low',
      hasDmlOperations: false,
      effects: [{ field: 'a', action: 'setValue' }, { field: 'b', action: 'setValue' }]
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'auto');
    assert.equal(result.autoDecision, 'keep');
  });

  it('callout with exactly 3 effects escalates to human', () => {
    const rule = {
      type: 'callout',
      complexity: 'low',
      hasDmlOperations: false,
      effects: [{}, {}, {}]
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.equal(result.decision, 'pending');
  });

  it('callout with missing effects field does not crash', () => {
    const rule = {
      type: 'callout',
      complexity: 'low',
      hasDmlOperations: false
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'auto');
    assert.equal(result.autoDecision, 'keep');
  });

  it('callout with DML but no dmlWarning still escalates with empty warnings', () => {
    const rule = {
      type: 'callout',
      complexity: 'low',
      hasDmlOperations: true,
      effects: [{ field: 'a' }]
    };
    const result = classifyRule(rule);
    assert.equal(result.tier, 'human');
    assert.equal(result.decision, 'pending');
    assert.ok(Array.isArray(result.warnings));
    assert.equal(result.warnings.length, 0);
  });

  it('does not mutate the original rule object', () => {
    const rule = {
      type: 'displayLogic',
      expression: "@A@='Y'",
      hasDmlOperations: false
    };
    const original = { ...rule };
    classifyRule(rule);
    assert.deepEqual(rule, original);
  });
});

describe('classifyRules', () => {
  it('produces correct summary counts', () => {
    const rules = [
      { type: 'displayLogic', expression: "@A@='Y'", hasDmlOperations: false },
      { type: 'callout', complexity: 'high', hasDmlOperations: true,
        dmlWarning: 'DML', effects: [{}, {}, {}] },
    ];
    const result = classifyRules(rules, { skipAi: true });
    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.autoClassified, 1);
    assert.equal(result.summary.humanReview, 1);
  });

  it('empty rules array returns all-zero summary', () => {
    const result = classifyRules([], { skipAi: true });
    assert.equal(result.summary.total, 0);
    assert.equal(result.summary.autoClassified, 0);
    assert.equal(result.summary.humanReview, 0);
    assert.deepEqual(result.rules, []);
  });

  it('preserves original rule properties in output', () => {
    const rules = [
      {
        type: 'callout',
        complexity: 'low',
        hasDmlOperations: false,
        effects: [{ field: 'x' }],
        customProp: 'should-survive',
        id: 'ABC-123'
      }
    ];
    const result = classifyRules(rules);
    assert.equal(result.rules[0].customProp, 'should-survive');
    assert.equal(result.rules[0].id, 'ABC-123');
    assert.equal(result.rules[0].tier, 'auto');
  });

  it('classifies mixed rule types correctly', () => {
    const rules = [
      { type: 'displayLogic', expression: "@X@='Y'" },
      { type: 'readOnlyLogic', expression: "@Z@='N'" },
      { type: 'validation', complexity: 'low', hasDmlOperations: false },
      { type: 'callout', complexity: 'low', hasDmlOperations: false, effects: [] },
      { type: 'somethingNew' },
    ];
    const result = classifyRules(rules);
    assert.equal(result.summary.total, 5);
    // displayLogic, readOnlyLogic, validation, callout should be auto; unknown should be human
    assert.equal(result.summary.autoClassified, 4);
    assert.equal(result.summary.humanReview, 1);
  });
});
