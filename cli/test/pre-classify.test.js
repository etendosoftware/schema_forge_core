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
});
