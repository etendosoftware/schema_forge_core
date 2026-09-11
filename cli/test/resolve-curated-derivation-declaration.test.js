import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';

// ETP-5245 — decisions.json could SUPPRESS a raw derivation (`derivation: null`)
// but never DECLARE one: `derivation` sits in FIELD_RAW_COPY_PROPS only, and the
// sole read of `fieldDecision.derivation` was the null-suppression branch. A
// declaration was therefore dropped in silence.
//
// Concretely: product.costing.endingDate is filled server-side by
// ProductCostingHandler.injectDefaultEndingDate() (CostingUtils.getLastDate()),
// so it is optional in the UI even though the column is NOT NULL. The quality
// gate exempts a field whose derivation.type is a server default
// (quality-gate/checks/invariants.js hasServerDefault), but the decisions-declared
// `"derivation": "fromConfig"` never reached the curated schema, so the gate kept
// failing the window.
//
// The shorthand normalization matters just as much as the copy: decisions.json
// writes the string form, while every consumer reads `derivation.type`
// (hasServerDefault, validate-schema's SYSTEM_NO_DERIVATION / INVALID_FROM_PARENT
// / COMPUTED_NO_RULE checks, generate-contract's computedFields).

const ENTITY = 'costing';
const FIELD = 'endingDate';

/**
 * Minimal raw schema with one field. `rawDerivation` seeds the AD-extracted
 * derivation so the precedence cases have something to override or suppress.
 */
function buildSchemaRaw(rawDerivation) {
  const field = {
    name: FIELD,
    columnName: 'DateTo',
    label: 'Ending Date',
    type: 'date',
    visibility: 'editable',
  };
  if (rawDerivation !== undefined) field.derivation = rawDerivation;
  return {
    window: { id: '140', name: 'Product' },
    entities: [{
      name: ENTITY,
      tableName: 'M_Costing',
      tabId: '10',
      tabName: 'Costing',
      fields: [field],
    }],
  };
}

function buildDecisions(fieldDecision) {
  return {
    version: 2,
    entities: {
      [ENTITY]: {
        fields: { [FIELD]: fieldDecision },
      },
    },
  };
}

function fieldOf(schema) {
  return schema.entities[0].fields.find((f) => f.name === FIELD);
}

async function resolveField(fieldDecision, rawDerivation) {
  const { schema } = await resolveCurated(
    buildSchemaRaw(rawDerivation),
    { rules: [] },
    buildDecisions(fieldDecision),
  );
  return fieldOf(schema);
}

describe('resolveCurated — decisions-declared derivation (ETP-5245)', () => {
  it('declares a derivation the raw schema does not carry, expanding the string shorthand', async () => {
    const field = await resolveField({ visibility: 'editable', form: true, derivation: 'fromConfig' });
    // `.type` is what every consumer reads — a bare string would match nothing.
    assert.deepEqual(field.derivation, { type: 'fromConfig' });
  });

  it('accepts an already-expanded object form verbatim', async () => {
    const derivation = { type: 'fromField', source: 'email' };
    const field = await resolveField({ visibility: 'editable', form: true, derivation });
    assert.deepEqual(field.derivation, derivation);
  });

  it('lets a declared derivation win over the raw AD-derived one', async () => {
    // Ordering guard: the declaration is applied AFTER copyRawProps, which copies
    // `derivation` unconditionally from FIELD_RAW_COPY_PROPS.
    const field = await resolveField(
      { visibility: 'editable', form: true, derivation: 'fromConfig' },
      { type: 'computed', source: 'N' },
    );
    assert.deepEqual(field.derivation, { type: 'fromConfig' });
  });

  it('still suppresses the raw derivation with an explicit null', async () => {
    const field = await resolveField(
      { visibility: 'editable', form: true, derivation: null },
      { type: 'computed', source: 'N' },
    );
    assert.equal('derivation' in field, false);
  });

  it('keeps the raw derivation when decisions declare none', async () => {
    const field = await resolveField(
      { visibility: 'editable', form: true },
      { type: 'computed', source: 'N' },
    );
    assert.deepEqual(field.derivation, { type: 'computed', source: 'N' });
  });

  it('leaves the raw derivation untouched for a non-declaration value', async () => {
    // `false` / '' are not decisions: they must not erase the raw value the way
    // an explicit null does, and must not produce a bogus `{ type: false }`.
    for (const notADeclaration of [false, '']) {
      const field = await resolveField(
        { visibility: 'editable', form: true, derivation: notADeclaration },
        { type: 'computed', source: 'N' },
      );
      assert.deepEqual(field.derivation, { type: 'computed', source: 'N' });
    }
  });
});
