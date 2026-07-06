import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FK_AUTO_RESOLVE_THRESHOLD,
  FK_AMBIGUOUS_GAP,
  classifyCandidates,
  resolveForeignKeyColumn,
  resolveForeignKeys,
} from '../resolveForeignKeys.js';

describe('classifyCandidates', () => {
  it('auto-resolves a single high-confidence candidate', () => {
    const result = classifyCandidates([{ id: 'U-1', name: 'Kilogramo', similarityPercent: '95' }]);
    assert.deepEqual(result, { status: 'auto-resolved', id: 'U-1', name: 'Kilogramo' });
  });

  it('auto-resolves the top candidate when it clears the gap over the runner-up', () => {
    const result = classifyCandidates([
      { id: 'U-1', name: 'Kilogramo', similarityPercent: '95' },
      { id: 'U-2', name: 'Kilograma', similarityPercent: '60' },
    ]);
    assert.equal(result.status, 'auto-resolved');
    assert.equal(result.id, 'U-1');
  });

  it('needs review when the top candidate is below the threshold', () => {
    const result = classifyCandidates([{ id: 'U-1', name: 'Kg', similarityPercent: String(FK_AUTO_RESOLVE_THRESHOLD - 1) }]);
    assert.equal(result.status, 'needs-review');
  });

  it('needs review when two candidates are too close to call', () => {
    const top = FK_AUTO_RESOLVE_THRESHOLD + 10;
    const result = classifyCandidates([
      { id: 'U-1', name: 'A', similarityPercent: String(top) },
      { id: 'U-2', name: 'B', similarityPercent: String(top - (FK_AMBIGUOUS_GAP - 1)) },
    ]);
    assert.equal(result.status, 'needs-review');
    assert.equal(result.candidates.length, 2);
  });

  it('needs review with an empty candidate list when there are zero matches', () => {
    const result = classifyCandidates([]);
    assert.deepEqual(result, { status: 'needs-review', candidates: [] });
  });

  // The real webhook formats this field as "NN.NNNN%", not the bare digit
  // strings used above — that's covered where the raw value actually enters
  // the system: simSearch.test.js's mapRow/parseSimSearchEnvelope regression
  // tests. By the time a candidate reaches classifyCandidates in production
  // it has already gone through that normalization, so a "%"-suffixed input
  // here would test a shape this function never actually receives.
});

describe('resolveForeignKeyColumn', () => {
  it('calls simSearchFn once with the distinct values and matchEntity', async () => {
    const calls = [];
    const simSearchFn = async (args) => {
      calls.push(args);
      return args.items.map(() => ({ id: 'X', name: 'Match', similarityPercent: '99', candidates: [{ id: 'X', name: 'Match', similarityPercent: '99' }] }));
    };
    await resolveForeignKeyColumn({ values: ['Kg', 'L'], matchEntity: 'UOM', simSearchFn, token: 't' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].entityName, 'UOM');
    assert.deepEqual(calls[0].items, ['Kg', 'L']);
    assert.equal(calls[0].token, 't');
  });

  it('returns a map keyed by the original raw value', async () => {
    const simSearchFn = async ({ items }) =>
      items.map((v) => ({ id: `id-${v}`, name: v, similarityPercent: '95', candidates: [{ id: `id-${v}`, name: v, similarityPercent: '95' }] }));
    const result = await resolveForeignKeyColumn({ values: ['Kg', 'L'], matchEntity: 'UOM', simSearchFn, token: 't' });
    assert.equal(result.get('Kg').status, 'auto-resolved');
    assert.equal(result.get('Kg').id, 'id-Kg');
    assert.equal(result.get('L').id, 'id-L');
  });

  it('maps a null simSearch result to needs-review with no candidates', async () => {
    const simSearchFn = async ({ items }) => items.map(() => null);
    const result = await resolveForeignKeyColumn({ values: ['Unknown'], matchEntity: 'UOM', simSearchFn, token: 't' });
    assert.deepEqual(result.get('Unknown'), { status: 'needs-review', candidates: [] });
  });
});

describe('resolveForeignKeys', () => {
  it('resolves multiple columns, one simSearchFn call per column, using only distinct values', async () => {
    const calls = [];
    const simSearchFn = async (args) => {
      calls.push(args);
      return args.items.map((v) => ({ id: `id-${v}`, name: v, similarityPercent: '95', candidates: [{ id: `id-${v}`, name: v, similarityPercent: '95' }] }));
    };
    const rows = [
      { uom: 'Kg', category: 'Bebidas' },
      { uom: 'Kg', category: 'Comida' },
      { uom: 'L', category: 'Bebidas' },
    ];
    const result = await resolveForeignKeys({
      rows,
      columns: [{ target: 'uom', matchEntity: 'UOM' }, { target: 'category', matchEntity: 'ProductCategory' }],
      simSearchFn,
      token: 't',
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.find((c) => c.entityName === 'UOM').items.sort(), ['Kg', 'L']);
    assert.deepEqual(calls.find((c) => c.entityName === 'ProductCategory').items.sort(), ['Bebidas', 'Comida']);
    assert.equal(result.get('uom').get('Kg').id, 'id-Kg');
    assert.equal(result.get('category').get('Bebidas').id, 'id-Bebidas');
  });

  it('excludes blank values from the distinct-value lookup', async () => {
    const calls = [];
    const simSearchFn = async (args) => {
      calls.push(args);
      return args.items.map(() => ({ id: 'X', name: 'X', similarityPercent: '99', candidates: [] }));
    };
    const rows = [{ uom: 'Kg' }, { uom: '' }, { uom: '  ' }];
    await resolveForeignKeys({ rows, columns: [{ target: 'uom', matchEntity: 'UOM' }], simSearchFn, token: 't' });
    assert.deepEqual(calls[0].items, ['Kg']);
  });
});
