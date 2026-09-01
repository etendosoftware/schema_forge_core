import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { resolveCurated } from '../src/resolve-curated.js';

// ETP-4913 — a decisions-declared `enumValues` must win over the raw AD List
// reference. `enumValues` appears in BOTH copy lists inside buildField:
// FIELD_DECISION_COPY_PROPS (applied first) and FIELD_RAW_COPY_PROPS (applied
// after, overwriting unconditionally). The raw value therefore always won, and
// the behavior documented in docs/decisions-reference.md — "if the raw schema
// already supplies enumValues (from an AD list reference), decisions.json
// enumValues OVERRIDES them" — never applied to a field that actually had a raw
// reference. It only appeared to work for fields with no raw enumValues at all
// (the synthetic YesNo `processed` status of goods-movements / amortization /
// physical-inventory), which is why the gap went unnoticed.
//
// Concretely: the two return-shipment windows could not redirect DocStatus/CO
// away from the poisoned `docStatusCo` key ("Registrado") to `statusComplete`
// ("Completado").

const RAW_ENUM_VALUES = [
  { value: 'DR', name: 'Draft', labels: { es_ES: 'Borrador' } },
  { value: 'CO', name: 'Completed', labels: { es_ES: 'Completado' } },
  { value: 'VO', name: 'Voided', labels: { es_ES: 'Anulado' } },
];

const DECIDED_ENUM_VALUES = [
  { value: 'DR', name: 'docStatusDr' },
  { value: 'CO', name: 'statusComplete' },
  { value: 'VO', name: 'docStatusVo' },
];

const ENTITY = 'mInOut';
const FIELD = 'documentStatus';

/**
 * Minimal raw schema carrying one List-reference field whose AD enumValues are
 * populated — the shape extract-fields.js produces for a DocStatus column.
 */
function buildSchemaRaw() {
  return {
    window: { id: '100', name: 'Return Material Receipt' },
    entities: [{
      name: ENTITY,
      tableName: 'M_InOut',
      tabId: '10',
      tabName: 'Header',
      fields: [{
        name: FIELD,
        columnName: 'DocStatus',
        label: 'Document Status',
        type: 'enum',
        visibility: 'readOnly',
        enumValues: RAW_ENUM_VALUES,
      }],
    }],
  };
}

/**
 * Wraps a single field decision into the decisions document shape.
 */
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

/**
 * Reads the resolved status field out of a curated schema. The single entity is
 * taken positionally on purpose: resolveCurated normalizes entity names (the
 * raw `mInOut` comes back as `inOut`), so looking it up by the raw name would
 * silently find nothing.
 */
function statusFieldOf(schema) {
  return schema.entities[0].fields.find((f) => f.name === FIELD);
}

async function resolveField(fieldDecision) {
  const { schema } = await resolveCurated(buildSchemaRaw(), { rules: [] }, buildDecisions(fieldDecision));
  return statusFieldOf(schema);
}

describe('resolveCurated — enumValues precedence (ETP-4913)', () => {
  it('lets a decisions-declared enumValues override the raw AD list reference', async () => {
    const field = await resolveField({
      visibility: 'readOnly',
      grid: true,
      enumValues: DECIDED_ENUM_VALUES,
    });
    assert.deepEqual(field.enumValues, DECIDED_ENUM_VALUES);
  });

  it('keeps the raw AD enumValues when decisions declare none', async () => {
    const field = await resolveField({ visibility: 'readOnly', grid: true });
    assert.deepEqual(field.enumValues, RAW_ENUM_VALUES);
  });

  it('keeps the raw AD enumValues when the decision declares an empty array', async () => {
    // copyTruthyDecisionProps only copies truthy values, and an empty array is
    // truthy — but it must not blank out a working AD reference, so the raw
    // fallback still has to produce a usable option set.
    const field = await resolveField({
      visibility: 'readOnly',
      grid: true,
      enumValues: [],
    });
    assert.ok(
      Array.isArray(field.enumValues) && field.enumValues.length > 0,
      'an empty decisions enumValues must not leave the field without options',
    );
  });

  it('does not disturb a field whose enumValues exist only in decisions', async () => {
    // The synthetic YesNo `processed` status: no raw enumValues at all. This
    // path worked before the fix and must keep working.
    const schemaRaw = buildSchemaRaw();
    delete schemaRaw.entities[0].fields[0].enumValues;
    const decisions = buildDecisions({
      visibility: 'readOnly',
      grid: true,
      columnType: 'status',
      enumValues: [
        { value: 'true', name: 'statusProcessed' },
        { value: 'false', name: 'statusDraft' },
      ],
    });
    const { schema } = await resolveCurated(schemaRaw, { rules: [] }, decisions);
    assert.deepEqual(statusFieldOf(schema).enumValues, [
      { value: 'true', name: 'statusProcessed' },
      { value: 'false', name: 'statusDraft' },
    ]);
  });
});
