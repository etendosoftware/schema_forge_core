import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import { readJson } from './shared.js';

export async function runContractCheck(_windowName, { rootDir, windowDir }) {
  const schemaPath = join(rootDir, 'schemas', 'contract.schema.json');
  const contractPath = join(windowDir, 'contract.json');

  if (!existsSync(contractPath)) {
    return { status: 'skip', detail: 'contract.json is missing.' };
  }
  if (!existsSync(schemaPath)) {
    return { status: 'skip', detail: 'schemas/contract.schema.json is missing.' };
  }

  const ajv = new Ajv({ allErrors: true, validateSchema: false });
  const validate = ajv.compile(readJson(schemaPath));
  const valid = validate(readJson(contractPath));

  if (!valid) {
    return {
      status: 'fail',
      detail: ajv.errorsText(validate.errors, { separator: '; ' }),
    };
  }

  return {
    status: 'pass',
    detail: 'contract.json matches schemas/contract.schema.json.',
  };
}
