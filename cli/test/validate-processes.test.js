import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateProcesses } from '../src/validate-processes.js';

function validProcesses() {
  return {
    version: '0.1.0',
    processes: [{
      name: 'testProcess', displayName: 'Test', entity: 'order',
      trigger: { type: 'action', endpoint: '/api/test', method: 'POST' },
      preconditions: [{ id: 'p1', assertion: 'true', errorMessage: 'err', errorCode: 'E1' }],
      steps: [
        { order: 1, name: 'step1', description: 'test', type: 'validate', target: 'order',
          operation: { type: 'validate', assertion: 'true', errorMessage: 'err', errorCode: 'E1' },
          ruleDecision: null, existingClass: null,
          behavioral: { postcondition: 'validated', sideEffects: [] } }
      ],
      edgeCases: [
        { id: 'e1', description: 'edge1', setup: {}, expectedBehavior: 'fails', assertions: [] },
        { id: 'e2', description: 'edge2', setup: {}, expectedBehavior: 'fails', assertions: [] },
        { id: 'e3', description: 'edge3', setup: {}, expectedBehavior: 'fails', assertions: [] }
      ],
      transactional: true
    }]
  };
}

describe('validateProcesses', () => {
  it('valid process passes', () => {
    const result = validateProcesses(validProcesses());
    assert.equal(result.errors.length, 0);
  });

  it('process without preconditions fails', () => {
    const p = validProcesses();
    p.processes[0].preconditions = [];
    const result = validateProcesses(p);
    assert.ok(result.errors.some(e => e.code === 'NO_PRECONDITIONS'));
  });

  it('process with < 3 edge cases fails', () => {
    const p = validProcesses();
    p.processes[0].edgeCases = [p.processes[0].edgeCases[0]];
    const result = validateProcesses(p);
    assert.ok(result.errors.some(e => e.code === 'INSUFFICIENT_EDGE_CASES'));
  });

  it('step with invalid type fails', () => {
    const p = validProcesses();
    p.processes[0].steps[0].type = 'compute';
    const result = validateProcesses(p);
    assert.ok(result.errors.some(e => e.code === 'INVALID_STEP_TYPE'));
  });

  it('forEach without nested steps fails', () => {
    const p = validProcesses();
    p.processes[0].steps[0].type = 'forEach';
    p.processes[0].steps[0].operation = { type: 'forEach', collection: 'lines', as: 'line', steps: [] };
    const result = validateProcesses(p);
    assert.ok(result.errors.some(e => e.code === 'EMPTY_FOREACH'));
  });

  it('entity reference check with schema', () => {
    const p = validProcesses();
    p.processes[0].entity = 'nonexistent';
    const schema = { entities: [{ name: 'order' }] };
    const result = validateProcesses(p, schema);
    assert.ok(result.errors.some(e => e.code === 'UNKNOWN_ENTITY'));
  });

  it('not transactional fails', () => {
    const p = validProcesses();
    p.processes[0].transactional = false;
    const result = validateProcesses(p);
    assert.ok(result.errors.some(e => e.code === 'NOT_TRANSACTIONAL'));
  });

  it('duplicate step names fails', () => {
    const p = validProcesses();
    p.processes[0].steps.push({
      order: 2, name: 'step1', description: 'dup', type: 'validate', target: 'order',
      operation: { type: 'validate', assertion: 'true', errorMessage: 'err', errorCode: 'E2' },
      ruleDecision: null, existingClass: null,
      behavioral: { postcondition: 'validated', sideEffects: [] }
    });
    const result = validateProcesses(p);
    assert.ok(result.errors.some(e => e.code === 'DUPLICATE_STEP_NAME'));
  });

  it('non-sequential step order fails', () => {
    const p = validProcesses();
    p.processes[0].steps.push({
      order: 1, name: 'step2', description: 'out of order', type: 'validate', target: 'order',
      operation: { type: 'validate', assertion: 'true', errorMessage: 'err', errorCode: 'E2' },
      ruleDecision: null, existingClass: null,
      behavioral: { postcondition: 'validated', sideEffects: [] }
    });
    const result = validateProcesses(p);
    assert.ok(result.errors.some(e => e.code === 'STEP_ORDER_NOT_SEQUENTIAL'));
  });

  it('step target referencing unknown entity fails with schema', () => {
    const p = validProcesses();
    p.processes[0].steps[0].target = 'unknownEntity';
    const schema = { entities: [{ name: 'order' }] };
    const result = validateProcesses(p, schema);
    assert.ok(result.errors.some(e => e.code === 'UNKNOWN_ENTITY'));
  });
});
