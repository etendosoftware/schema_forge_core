import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import Ajv from 'ajv';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemasDir = resolve(__dirname, '../../schemas');

async function loadSchema(name) {
  return JSON.parse(await readFile(resolve(schemasDir, name), 'utf8'));
}

describe('JSON Schemas', () => {
  it('all schema files are valid JSON Schema', async () => {
    const ajv = new Ajv({ allErrors: true, validateSchema: false });
    const files = [
      'schema-raw.schema.json',
      'schema-curated.schema.json',
      'rules.schema.json',
      'processes.schema.json',
      'contract.schema.json',
      'quality-gate-config.schema.json',
      'step-operation.schema.json'
    ];
    for (const f of files) {
      const schema = await loadSchema(f);
      assert.doesNotThrow(() => ajv.compile(schema), `${f} is not valid JSON Schema`);
    }
  });

  it('schema-raw requires version, window, entities', async () => {
    const schema = await loadSchema('schema-raw.schema.json');
    assert.ok(schema.required.includes('version'));
    assert.ok(schema.required.includes('window'));
    assert.ok(schema.required.includes('entities'));
  });

  it('step-operation defines validate, mutation, forEach types', async () => {
    const schema = await loadSchema('step-operation.schema.json');
    const types = schema.oneOf.map(s => s.properties.type.const);
    assert.ok(types.includes('validate'));
    assert.ok(types.includes('mutation'));
    assert.ok(types.includes('forEach'));
  });

  it('contract schema exposes frontend field metadata used by the quality gate', async () => {
    const schema = await loadSchema('contract.schema.json');
    const fieldProps = schema.properties.frontendContract.properties.entities.additionalProperties.properties.fields.items.properties;
    assert.equal(fieldProps.sourceRequired.type, 'boolean');
    assert.equal(fieldProps.derivation.type, 'object');
  });

  it('contract schema accepts sparse agent form metadata', async () => {
    const schema = await loadSchema('contract.schema.json');
    const formFieldProps = schema.properties.formState.properties.entities.additionalProperties.properties.fields.additionalProperties.properties;
    assert.equal(formFieldProps.visible.type, 'boolean');
    assert.equal(formFieldProps.readOnly.type, 'boolean');
    assert.equal(formFieldProps.required.type, 'boolean');
    assert.equal(formFieldProps.displayLogic.type, 'string');
    assert.equal(formFieldProps.readOnlyLogic.type, 'string');
    assert.equal(formFieldProps.calloutTriggers.items.type, 'string');
    assert.equal(schema.properties.agentProfile.type, 'object');
  });
});
