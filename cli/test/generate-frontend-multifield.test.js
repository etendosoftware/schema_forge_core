import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  resolveMultiFieldParts,
  buildMultiFieldColumnLine,
  collectMultiFieldAbsorbed,
} from '../src/generate-frontend.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function fieldByNameFrom(fields) {
  return new Map(fields.map(f => [f.name, f]));
}

const searchKeyField = { name: 'searchKey', column: 'Value', type: 'string', label: 'Search Key' };
const nameField = { name: 'name', column: 'Name', type: 'string', label: 'Name', labels: { en_US: 'Name', es_ES: 'Nombre' } };
const imageField = { name: 'image', column: 'Image_ID', type: 'foreignKey' };

const FIELD_BY_NAME = fieldByNameFrom([searchKeyField, nameField, imageField]);

// ---------------------------------------------------------------------------
// resolveMultiFieldParts
// ---------------------------------------------------------------------------

describe('resolveMultiFieldParts', () => {
  it('resolves parts.field against the contract, filling key/column/type', () => {
    const f = {
      name: 'name',
      multiField: { parts: [{ field: 'searchKey' }, { field: 'name' }] },
    };
    const parts = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.equal(parts.length, 2);
    assert.deepEqual(parts[0], { key: 'searchKey', column: 'Value', type: 'string', label: 'Search Key' });
    assert.equal(parts[1].key, 'name');
    assert.equal(parts[1].column, 'Name');
  });

  it('part-def labels override the contract field labels', () => {
    const f = {
      name: 'name',
      multiField: { parts: [{ field: 'name', labels: { en_US: 'Custom Name' } }] },
    };
    const [part] = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.deepEqual(part.labels, { en_US: 'Custom Name' });
  });

  it('part-def label overrides the contract field label', () => {
    const f = {
      name: 'name',
      multiField: { parts: [{ field: 'searchKey', label: 'Identifier' }] },
    };
    const [part] = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.equal(part.label, 'Identifier');
  });

  it('falls back to the contract field labels/label when the part omits them', () => {
    const f = {
      name: 'name',
      multiField: { parts: [{ field: 'name' }] },
    };
    const [part] = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.deepEqual(part.labels, { en_US: 'Name', es_ES: 'Nombre' });
    assert.equal(part.label, 'Name');
  });

  it('derives [title, subtitle] when parts is omitted and mf.subtitle is set', () => {
    const f = { name: 'name', multiField: { subtitle: 'searchKey' } };
    const parts = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.equal(parts.length, 2);
    assert.equal(parts[0].key, 'name');
    assert.equal(parts[1].key, 'searchKey');
  });

  it('derives only [title] when parts is omitted and there is no subtitle', () => {
    const f = { name: 'name', multiField: {} };
    const parts = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.equal(parts.length, 1);
    assert.equal(parts[0].key, 'name');
  });

  it('degrades an unresolved part.field to a plain string key', () => {
    const f = {
      name: 'name',
      multiField: { parts: [{ field: 'unknownField' }] },
    };
    const [part] = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.deepEqual(part, { key: 'unknownField', column: 'unknownField', type: 'string' });
  });

  it('emits sortable: false only when the part explicitly sets it', () => {
    const f = {
      name: 'name',
      multiField: { parts: [{ field: 'searchKey', sortable: false }, { field: 'name' }] },
    };
    const parts = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.equal(parts[0].sortable, false);
    assert.equal(parts[1].sortable, undefined);
  });

  it('emits filterable: false only when the part explicitly sets it', () => {
    const f = {
      name: 'name',
      multiField: { parts: [{ field: 'searchKey', filterable: false }, { field: 'name' }] },
    };
    const parts = resolveMultiFieldParts(f, FIELD_BY_NAME);
    assert.equal(parts[0].filterable, false);
    assert.equal(parts[1].filterable, undefined);
  });
});

// ---------------------------------------------------------------------------
// collectMultiFieldAbsorbed
// ---------------------------------------------------------------------------

describe('collectMultiFieldAbsorbed', () => {
  it('absorbs the subtitle field', () => {
    const gridFields = [{ name: 'name', multiField: { subtitle: 'searchKey' } }];
    const absorbed = collectMultiFieldAbsorbed(gridFields);
    assert.ok(absorbed.has('searchKey'));
    assert.equal(absorbed.size, 1);
  });

  it('absorbs the media.field', () => {
    const gridFields = [{ name: 'name', multiField: { media: { field: 'image', kind: 'neoImage', fallback: 'box' } } }];
    const absorbed = collectMultiFieldAbsorbed(gridFields);
    assert.ok(absorbed.has('image'));
  });

  it('absorbs non-host part fields, but never the host field itself', () => {
    const gridFields = [{
      name: 'name',
      multiField: { parts: [{ field: 'searchKey' }, { field: 'name' }, { field: 'brand' }] },
    }];
    const absorbed = collectMultiFieldAbsorbed(gridFields);
    assert.deepEqual([...absorbed].sort(), ['brand', 'searchKey']);
    assert.ok(!absorbed.has('name'));
  });

  it('ignores grid fields without a multiField decorator', () => {
    const gridFields = [{ name: 'status' }, { name: 'name', multiField: { subtitle: 'searchKey' } }];
    const absorbed = collectMultiFieldAbsorbed(gridFields);
    assert.equal(absorbed.size, 1);
    assert.ok(absorbed.has('searchKey'));
  });

  it('returns an empty set when there are no multiField columns', () => {
    const gridFields = [{ name: 'status' }, { name: 'docNo' }];
    const absorbed = collectMultiFieldAbsorbed(gridFields);
    assert.equal(absorbed.size, 0);
  });
});

// ---------------------------------------------------------------------------
// buildMultiFieldColumnLine
// ---------------------------------------------------------------------------

describe('buildMultiFieldColumnLine', () => {
  it('emits a multiField column with title, subtitle, media and parts', () => {
    const f = {
      name: 'name',
      column: 'Name',
      multiField: {
        subtitle: 'searchKey',
        media: { field: 'image', kind: 'neoImage', fallback: 'box' },
        parts: [{ field: 'searchKey', label: 'Identifier' }, { field: 'name', label: 'Name' }],
      },
    };
    const line = buildMultiFieldColumnLine(f, FIELD_BY_NAME);

    assert.match(line, /type: 'multiField'/);
    assert.match(line, /key: 'name'/);
    assert.match(line, /column: 'Name'/);
    assert.match(line, /title: 'name'/);
    assert.match(line, /subtitle: 'searchKey'/);
    assert.match(line, /media: \{"field":"image","kind":"neoImage","fallback":"box"\}/);
    assert.match(line, /parts: \[.*"key":"searchKey".*"key":"name".*\]/);
  });

  it('omits subtitle/media/partSeparator fragments when not configured', () => {
    const f = { name: 'name', column: 'Name', multiField: { parts: [{ field: 'name' }] } };
    const line = buildMultiFieldColumnLine(f, FIELD_BY_NAME);

    assert.doesNotMatch(line, /subtitle:/);
    assert.doesNotMatch(line, /media:/);
    assert.doesNotMatch(line, /partSeparator:/);
  });

  it('emits partSeparator when mf.partSeparator is set', () => {
    const f = { name: 'name', column: 'Name', multiField: { partSeparator: ' / ', parts: [{ field: 'name' }] } };
    const line = buildMultiFieldColumnLine(f, FIELD_BY_NAME);

    assert.match(line, /partSeparator: ' \/ '/);
  });

  it('escapes single quotes in the emitted title (via the shared esc() helper)', () => {
    const f = { name: "o'brien", column: 'Column1', multiField: { parts: [{ field: 'name' }] } };
    const line = buildMultiFieldColumnLine(f, FIELD_BY_NAME);

    assert.match(line, /title: 'o\\'brien'/);
  });
});
