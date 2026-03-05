import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildUiContext } from '../src/build-ui-context.js';

describe('buildUiContext', () => {
  it('excludes system fields from visible entities', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'documentNo', visibility: 'readOnly', type: 'string', searchable: true, label: 'Document No' },
          { name: 'adClientId', visibility: 'system', type: 'id', searchable: false }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    assert.ok(context.visibleEntities.order.fields.find(f => f.name === 'documentNo'));
    assert.ok(!context.visibleEntities.order.fields.find(f => f.name === 'adClientId'));
  });

  it('excludes discarded fields', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'documentNo', visibility: 'editable', type: 'string', searchable: true, label: 'Doc' },
          { name: 'oldField', visibility: 'discarded', type: 'string', searchable: false }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    assert.ok(!context.visibleEntities.order.fields.find(f => f.name === 'oldField'));
  });

  it('includes searchable fields list', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'documentNo', visibility: 'readOnly', type: 'string', searchable: true, label: 'Doc' },
          { name: 'notes', visibility: 'editable', type: 'text', searchable: false, label: 'Notes' }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    assert.deepEqual(context.visibleEntities.order.searchableFields, ['documentNo']);
  });

  it('marks editable vs readOnly correctly', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'documentNo', visibility: 'readOnly', type: 'string', searchable: false, label: 'Doc' },
          { name: 'notes', visibility: 'editable', type: 'text', searchable: false, label: 'Notes' }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    const docNo = context.visibleEntities.order.fields.find(f => f.name === 'documentNo');
    const notes = context.visibleEntities.order.fields.find(f => f.name === 'notes');
    assert.equal(docNo.readOnly, true);
    assert.equal(docNo.editable, false);
    assert.equal(notes.editable, true);
    assert.equal(notes.readOnly, false);
  });

  it('includes process actions', () => {
    const processes = {
      processes: [
        { name: 'completeOrder', displayName: 'Complete Order',
          trigger: { type: 'action', endpoint: '/api/orders/{id}/complete', method: 'POST' } }
      ]
    };
    const context = buildUiContext({ entities: [] }, [], processes);
    assert.equal(context.actions.length, 1);
    assert.equal(context.actions[0].name, 'completeOrder');
    assert.equal(context.actions[0].endpoint, '/api/orders/{id}/complete');
  });

  it('handles empty schema', () => {
    const context = buildUiContext({ entities: [] }, [], []);
    assert.deepEqual(context.visibleEntities, {});
    assert.deepEqual(context.actions, []);
  });

  it('handles multiple entities', () => {
    const schema = {
      entities: [
        { name: 'order', fields: [{ name: 'docNo', visibility: 'editable', type: 'string', searchable: true, label: 'Doc' }] },
        { name: 'line', fields: [{ name: 'qty', visibility: 'editable', type: 'number', searchable: false, label: 'Qty' }] }
      ]
    };
    const context = buildUiContext(schema, [], []);
    assert.ok(context.visibleEntities.order);
    assert.ok(context.visibleEntities.line);
  });

  // Edge cases

  it('entity with only system fields produces empty fields array but entity key exists', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'adClientId', visibility: 'system', type: 'id', searchable: false },
          { name: 'adOrgId', visibility: 'system', type: 'id', searchable: false }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    assert.ok('order' in context.visibleEntities, 'entity key must exist even when all fields are system');
    assert.deepEqual(context.visibleEntities.order.fields, []);
    assert.deepEqual(context.visibleEntities.order.searchableFields, []);
  });

  it('entity with all discarded fields produces empty fields array', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'legacyField', visibility: 'discarded', type: 'string', searchable: false },
          { name: 'anotherOld', visibility: 'discarded', type: 'string', searchable: true }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    assert.ok('order' in context.visibleEntities, 'entity key must exist even when all fields are discarded');
    assert.deepEqual(context.visibleEntities.order.fields, []);
    assert.deepEqual(context.visibleEntities.order.searchableFields, []);
  });

  it('field with unknown visibility (e.g. hidden) is included in fields', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'customField', visibility: 'hidden', type: 'string', searchable: false, label: 'Custom' }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    const field = context.visibleEntities.order.fields.find(f => f.name === 'customField');
    assert.ok(field, 'field with unknown visibility must be included');
    assert.equal(field.editable, false);
    assert.equal(field.readOnly, false);
  });

  it('process with no trigger produces action with undefined endpoint and method', () => {
    const processes = {
      processes: [
        { name: 'draftAction', displayName: 'Draft Action' }
      ]
    };
    const context = buildUiContext({ entities: [] }, [], processes);
    assert.equal(context.actions.length, 1);
    assert.equal(context.actions[0].name, 'draftAction');
    assert.equal(context.actions[0].endpoint, undefined);
    assert.equal(context.actions[0].method, undefined);
  });

  it('schema with null entities does not crash and returns empty visibleEntities', () => {
    const context = buildUiContext({ entities: null }, [], []);
    assert.deepEqual(context.visibleEntities, {});
    assert.deepEqual(context.actions, []);
  });

  it('schema with undefined entities does not crash and returns empty visibleEntities', () => {
    const context = buildUiContext({}, [], []);
    assert.deepEqual(context.visibleEntities, {});
    assert.deepEqual(context.actions, []);
  });

  it('rules parameter is passed but unused — no side effects on output', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [{ name: 'total', visibility: 'readOnly', type: 'number', searchable: false, label: 'Total' }]
      }]
    };
    const rules = [
      { id: 'rule-1', decision: 'Keep', field: 'total' },
      { id: 'rule-2', decision: 'Omit', field: 'total' }
    ];
    const contextWithRules = buildUiContext(schema, rules, []);
    const contextWithoutRules = buildUiContext(schema, [], []);
    assert.deepEqual(contextWithRules, contextWithoutRules, 'rules must not affect the output');
  });

  it('searchable system field does not appear in searchableFields', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'adClientId', visibility: 'system', type: 'id', searchable: true }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    assert.deepEqual(context.visibleEntities.order.searchableFields, []);
  });

  it('field without label has undefined label in output', () => {
    const schema = {
      entities: [{
        name: 'order',
        fields: [
          { name: 'notes', visibility: 'editable', type: 'text', searchable: false }
        ]
      }]
    };
    const context = buildUiContext(schema, [], []);
    const field = context.visibleEntities.order.fields.find(f => f.name === 'notes');
    assert.ok(field, 'field must be present');
    assert.equal(field.label, undefined);
  });
});
