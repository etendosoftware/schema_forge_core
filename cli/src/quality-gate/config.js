import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';

export class QualityGateConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QualityGateConfigError';
    this.exitCode = 2;
  }
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new QualityGateConfigError(`Unable to read ${path}: ${error.message}`);
  }
}

function validateGracePeriods(config) {
  const today = new Date().toISOString().slice(0, 10);
  for (const entry of config.gracePeriod ?? []) {
    if (entry.until && entry.until < today) {
      throw new QualityGateConfigError(`Expired quality gate grace period: ${JSON.stringify(entry)}`);
    }
  }
}

export function loadQualityGateConfig(rootDir) {
  const configPath = join(rootDir, 'quality-gate.config.json');
  const schemaPath = join(rootDir, 'schemas', 'quality-gate-config.schema.json');

  if (!existsSync(configPath)) {
    throw new QualityGateConfigError('quality-gate.config.json is missing.');
  }
  if (!existsSync(schemaPath)) {
    throw new QualityGateConfigError('schemas/quality-gate-config.schema.json is missing.');
  }

  const config = loadJson(configPath);
  const schema = loadJson(schemaPath);
  const ajv = new Ajv({ allErrors: true, validateSchema: false });
  const validate = ajv.compile(schema);

  if (!validate(config)) {
    throw new QualityGateConfigError(ajv.errorsText(validate.errors, { separator: '; ' }));
  }

  validateGracePeriods(config);
  return config;
}
