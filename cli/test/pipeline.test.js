import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPipelineSteps, validatePipelineInput } from '../src/pipeline.js';

describe('validatePipelineInput', () => {
  it('accepts valid input with windowId and windowName', () => {
    const result = validatePipelineInput({ windowId: '143', windowName: 'sales-order' });
    assert.equal(result.valid, true);
  });

  it('rejects missing windowId', () => {
    const result = validatePipelineInput({ windowName: 'sales-order' });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('windowId'));
  });

  it('rejects missing windowName', () => {
    const result = validatePipelineInput({ windowId: '143' });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('windowName'));
  });
});

describe('buildPipelineSteps', () => {
  it('returns all pipeline steps in correct order', () => {
    const steps = buildPipelineSteps();
    assert.ok(steps.length >= 6);
    assert.equal(steps[0].name, 'extract-fields');
    assert.equal(steps[1].name, 'extract-rules');
    assert.equal(steps[2].name, 'validate');
    assert.equal(steps[3].name, 'pre-classify');
    // Step 4 is human-decisions (interactive, skippable)
    assert.equal(steps[4].name, 'human-decisions');
    assert.equal(steps[5].name, 'generate-contract');
  });

  it('each step has name, description, and phase', () => {
    const steps = buildPipelineSteps();
    for (const step of steps) {
      assert.ok(step.name, `step missing name`);
      assert.ok(step.description, `${step.name} missing description`);
      assert.ok(step.phase, `${step.name} missing phase`);
    }
  });

  it('marks human-decisions as interactive', () => {
    const steps = buildPipelineSteps();
    const humanStep = steps.find(s => s.name === 'human-decisions');
    assert.equal(humanStep.interactive, true);
  });
});
