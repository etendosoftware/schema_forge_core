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
});
