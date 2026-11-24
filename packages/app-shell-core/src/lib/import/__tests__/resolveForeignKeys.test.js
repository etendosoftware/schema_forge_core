// @covers packages/app-shell-core/src/lib/import/resolveForeignKeys.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FK_AUTO_RESOLVE_THRESHOLD,
  FK_AMBIGUOUS_GAP,
  classifyCandidates,
  resolveForeignKeyColumn,
  resolveForeignKeys,
  scoreModeForField,
} from '../resolveForeignKeys.js';
import { parseSimSearchEnvelope } from '../../simSearch.js';

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

  describe('exactMatch flag (ETP-5730)', () => {
    const superReducido = (flags) => [
      { id: 'EX', name: 'IVA Super Reducido', similarityPercent: '100', exactMatch: flags[0] },
      { id: 'P2', name: 'IVA Super Reducido 2%', similarityPercent: '90', exactMatch: flags[1] },
      { id: 'RD', name: 'IVA Reducido', similarityPercent: '68', exactMatch: flags[2] },
    ];

    it('auto-resolves a single exact candidate despite a runner-up inside the ambiguity gap', () => {
      const result = classifyCandidates(superReducido([true, false, false]));
      assert.deepEqual(result, { status: 'auto-resolved', id: 'EX', name: 'IVA Super Reducido' });
    });

    it('picks the exact candidate even when it is not the first one', () => {
      const result = classifyCandidates([
        { id: 'A', name: 'IVA Normal ISP', similarityPercent: '100', exactMatch: false },
        { id: 'EX', name: 'IVA Normal', similarityPercent: '100', exactMatch: true },
        { id: 'B', name: 'IVA Normal Servicios', similarityPercent: '100', exactMatch: false },
      ]);
      assert.deepEqual(result, { status: 'auto-resolved', id: 'EX', name: 'IVA Normal' });
    });

    it('needs review with the candidates attached when two candidates are exact (duplicate names)', () => {
      const candidates = [
        { id: 'D1', name: 'Dup', similarityPercent: '100', exactMatch: true },
        { id: 'D2', name: 'Dup', similarityPercent: '100', exactMatch: true },
      ];
      const result = classifyCandidates(candidates);
      assert.equal(result.status, 'needs-review');
      assert.deepEqual(result.candidates, candidates);
    });

    it('needs review when no exactMatch field is sent and the runner-up is 10 points behind', () => {
      const result = classifyCandidates(superReducido([undefined, undefined, undefined]));
      assert.equal(result.status, 'needs-review');
      assert.equal(result.candidates.length, 3);
    });

    it('needs review when every candidate is exactMatch false and the runner-up is close', () => {
      const result = classifyCandidates(superReducido([false, false, false]));
      assert.equal(result.status, 'needs-review');
    });
  });
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

describe('strict matching (ETP-5730)', () => {
  // The endpoint's answer for "IVA Normal": all three names CONTAIN the term, so all score 100.
  const envelope = {
    item_0: {
      data: [
        { id: 'ISP', name: 'IVA Normal ISP', similarity_percent: '100.0000%', text_similarity_percent: '78.6000%', exact_match: false },
        { id: 'EXACT', name: 'IVA Normal', similarity_percent: '100.0000%', text_similarity_percent: '100.0000%', exact_match: true },
        { id: 'SERV', name: 'IVA Normal Servicios', similarity_percent: '100.0000%', text_similarity_percent: '52.4000%', exact_match: false },
      ],
    },
  };
  const simSearchFn = async ({ scoreMode }) => parseSimSearchEnvelope(envelope, 1, scoreMode);

  it("only fields declaring matchMode 'strict' ask for the whole-string score", () => {
    assert.equal(scoreModeForField({ matchMode: 'strict' }), 'text');
    assert.equal(scoreModeForField({ matchEntity: 'UOM' }), undefined);
    assert.equal(scoreModeForField({ matchMode: 'fuzzy' }), undefined);
    assert.equal(scoreModeForField(undefined), undefined);
  });

  it('also resolves a unique exact name with the default score, even though three names score 100', async () => {
    const map = await resolveForeignKeyColumn({ values: ['IVA Normal'], matchEntity: 'FinancialMgmtTaxCategory', simSearchFn });
    const resolution = map.get('IVA Normal');
    assert.equal(resolution.status, 'auto-resolved');
    assert.equal(resolution.id, 'EXACT');
  });

  it('keeps the tie guarantee when no name is flagged exact: three names at 100 need review', async () => {
    const noExact = { item_0: { data: envelope.item_0.data.map((row) => ({ ...row, exact_match: false })) } };
    const fn = async ({ scoreMode }) => parseSimSearchEnvelope(noExact, 1, scoreMode);
    const map = await resolveForeignKeyColumn({ values: ['IVA Normal'], matchEntity: 'FinancialMgmtTaxCategory', simSearchFn: fn });
    assert.equal(map.get('IVA Normal').status, 'needs-review');
  });

  it('resolves "IVA Super Reducido" through the wire envelope, with and without scoreMode text', async () => {
    const family = { item_0: { data: [
      { id: 'EX', name: 'IVA Super Reducido', similarity_percent: '100.0000%', text_similarity_percent: '100.0000%', exact_match: true },
      { id: 'P2', name: 'IVA Super Reducido 2%', similarity_percent: '90.0000%', text_similarity_percent: '90.0000%', exact_match: false },
      { id: 'RD', name: 'IVA Reducido', similarity_percent: '68.0000%', text_similarity_percent: '68.0000%', exact_match: false },
    ] } };
    const fn = async ({ scoreMode }) => parseSimSearchEnvelope(family, 1, scoreMode);
    for (const scoreMode of [undefined, 'text']) {
      const map = await resolveForeignKeyColumn({
        values: ['IVA Super Reducido'], matchEntity: 'FinancialMgmtTaxCategory', simSearchFn: fn, scoreMode,
      });
      const resolution = map.get('IVA Super Reducido');
      assert.equal(resolution.status, 'auto-resolved', `scoreMode=${scoreMode}`);
      assert.equal(resolution.id, 'EX');
    }
  });

  it('asks for review on the same family when nothing is flagged exact', async () => {
    const family = { item_0: { data: [
      { id: 'A', name: 'IVA Super Reducido 2%', similarity_percent: '100.0000%', text_similarity_percent: '90.0000%', exact_match: false },
      { id: 'B', name: 'IVA Super Reducido 4%', similarity_percent: '95.0000%', text_similarity_percent: '88.0000%', exact_match: false },
    ] } };
    const fn = async ({ scoreMode }) => parseSimSearchEnvelope(family, 1, scoreMode);
    for (const scoreMode of [undefined, 'text']) {
      const map = await resolveForeignKeyColumn({
        values: ['IVA Super Reducido'], matchEntity: 'FinancialMgmtTaxCategory', simSearchFn: fn, scoreMode,
      });
      assert.equal(map.get('IVA Super Reducido').status, 'needs-review', `scoreMode=${scoreMode}`);
    }
  });

  it('resolves the exact name on its own when the whole-string score is used', async () => {
    const map = await resolveForeignKeyColumn({
      values: ['IVA Normal'], matchEntity: 'FinancialMgmtTaxCategory', simSearchFn, scoreMode: 'text',
    });
    const resolution = map.get('IVA Normal');
    assert.equal(resolution.status, 'auto-resolved');
    assert.equal(resolution.id, 'EXACT');
  });

  it('still asks for review when no name is close enough, strict or not', async () => {
    const typo = { item_0: { data: [
      { id: 'A', name: 'Metric Ton', similarity_percent: '57.1429%', text_similarity_percent: '28.6000%', exact_match: false },
      { id: 'B', name: 'Meter', similarity_percent: '42.8571%', text_similarity_percent: '30.0000%', exact_match: false },
    ] } };
    const fn = async ({ scoreMode }) => parseSimSearchEnvelope(typo, 1, scoreMode);
    const map = await resolveForeignKeyColumn({ values: ['Metrox'], matchEntity: 'UOM', simSearchFn: fn, scoreMode: 'text' });
    assert.equal(map.get('Metrox').status, 'needs-review');
  });

  it('resolveForeignKeys threads each column\'s scoreMode into its own lookup', async () => {
    const seen = [];
    const fn = async (params) => { seen.push([params.entityName, params.scoreMode]); return params.items.map(() => null); };
    await resolveForeignKeys({
      rows: [{ a: 'x', b: 'y' }],
      columns: [
        { target: 'a', matchEntity: 'UOM', scoreMode: 'text' },
        { target: 'b', matchEntity: 'Country' },
      ],
      simSearchFn: fn,
    });
    assert.deepEqual(seen, [['UOM', 'text'], ['Country', undefined]]);
  });
});

