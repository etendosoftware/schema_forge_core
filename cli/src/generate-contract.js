import { createHash } from 'node:crypto';

const TS_TYPE_MAP = {
  string: 'string',
  integer: 'number',
  amount: 'number',
  number: 'number',
  boolean: 'boolean',
  date: 'string',
  datetime: 'string',
  id: 'string',
  foreignKey: 'string',
};

function mapTsType(fieldType) {
  return TS_TYPE_MAP[fieldType] ?? 'string';
}

function isVisible(field) {
  return field.visibility !== 'system' && field.visibility !== 'discarded';
}

function isSystem(field) {
  return field.visibility === 'system';
}

/**
 * Find a matching rule for a given identifier and type (callout, displayLogic, readOnlyLogic).
 */
function findMatchingRule(rules, identifier, type) {
  if (!rules || !rules.length || !identifier) return null;
  return rules.find(r => {
    if (r.type !== type) return false;
    return r.className === identifier || r.name === identifier;
  }) ?? null;
}

/**
 * Generate frontend contract: visible fields, searchable fields, computed fields.
 * Includes behavioral metadata (callout, displayLogic, readOnlyLogic) when present.
 */
export function generateFrontendContract(schema, rules = []) {
  const entities = {};

  for (const entity of schema.entities) {
    const visibleFields = entity.fields.filter(isVisible);

    const fields = visibleFields.map(f => {
      const mapped = {
        name: f.name,
        column: f.column,
        type: f.type,
        tsType: mapTsType(f.type),
        visibility: f.visibility,
        required: f.required,
        grid: f.grid,
        form: f.form,
      };
      if (f.reference) mapped.reference = f.reference;
      if (f.inputMode) mapped.inputMode = f.inputMode;
      if (f.dependsOn) mapped.dependsOn = f.dependsOn;

      // UI hints
      if (f.defaultValue) mapped.defaultValue = f.defaultValue;
      if (f.isIdentifier) mapped.isIdentifier = true;
      if (f.help) mapped.help = f.help;
      if (f.fieldGroup) mapped.fieldGroup = f.fieldGroup;
      if (f.isSelectionColumn) mapped.isSelectionColumn = true;
      if (f.isFilterable) mapped.isFilterable = true;
      if (f.precision) mapped.precision = f.precision;
      if (f.isTranslated) mapped.isTranslated = true;

      // Behavioral metadata: callout
      if (f.callout) {
        mapped.callout = { className: f.callout };
        const matchingRule = findMatchingRule(rules, f.callout, 'callout');
        if (matchingRule) {
          if (matchingRule.effects && matchingRule.effects.length) {
            mapped.callout.effects = matchingRule.effects.map(e => e.field ?? e);
          }
          if (matchingRule.complexity) {
            mapped.callout.complexity = matchingRule.complexity;
          }
        }
      }

      // Behavioral metadata: onChangeFunction
      if (f.onChangeFunction) {
        mapped.onChangeFunction = { name: f.onChangeFunction };
      }

      // Behavioral metadata: displayLogic
      if (f.displayLogic) {
        mapped.displayLogic = { raw: f.displayLogic };
        const matchingRule = findMatchingRule(rules, f.displayLogic, 'displayLogic');
        if (matchingRule && matchingRule.translated) {
          mapped.displayLogic.js = matchingRule.translated;
        }
      }

      // Behavioral metadata: readOnlyLogic
      if (f.readOnlyLogic) {
        mapped.readOnlyLogic = { raw: f.readOnlyLogic };
        const matchingRule = findMatchingRule(rules, f.readOnlyLogic, 'readOnlyLogic');
        if (matchingRule && matchingRule.translated) {
          mapped.readOnlyLogic.js = matchingRule.translated;
        }
      }

      return mapped;
    });

    const searchableFields = visibleFields
      .filter(f => f.searchable)
      .map(f => f.name);

    const computedFields = visibleFields
      .filter(f => f.derivation)
      .map(f => ({ name: f.name, derivation: f.derivation }));

    entities[entity.name] = { fields, searchableFields, computedFields };
  }

  return { window: schema.window, entities };
}

/**
 * Generate backend contract: all fields, REST endpoints, process endpoints.
 */
export function generateBackendContract(schema, rules = [], processes = []) {
  const entities = {};
  const endpoints = [];

  for (const entity of schema.entities) {
    const fields = entity.fields.map(f => ({
      name: f.name,
      column: f.column,
      type: f.type,
      visibility: f.visibility,
      required: f.required,
    }));

    entities[entity.name] = { fields };

    const searchableFields = entity.fields
      .filter(f => f.searchable)
      .map(f => f.name);

    const basePath = `/${entity.name}`;

    endpoints.push(
      { method: 'GET', path: basePath, entity: entity.name, supportedFilters: searchableFields },
      { method: 'GET', path: `${basePath}/:id`, entity: entity.name, supportedFilters: [] },
      { method: 'POST', path: basePath, entity: entity.name, supportedFilters: [] },
      { method: 'PUT', path: `${basePath}/:id`, entity: entity.name, supportedFilters: [] },
      { method: 'DELETE', path: `${basePath}/:id`, entity: entity.name, supportedFilters: [] },
    );
  }

  const processEndpoints = processes.map(p => ({
    name: p.name,
    method: 'POST',
    path: `/process/${p.name}`,
    entity: p.entity,
    preconditions: p.preconditions ?? [],
    steps: p.steps?.length ?? 0,
  }));

  return { window: schema.window, entities, endpoints, processEndpoints };
}

/**
 * Generate test manifest from contracts, rules, and processes.
 */
export function generateTestManifest(frontendContract, backendContract, rules = [], processes = []) {
  const tests = [];
  let idCounter = 0;
  const nextId = () => `t-${++idCounter}`;

  // Derive system fields from backend minus frontend
  for (const [entityName, entityData] of Object.entries(frontendContract.entities)) {
    const visibleFields = entityData.fields;

    // field-presence: one per visible field
    for (const field of visibleFields) {
      tests.push({
        id: nextId(),
        category: 'field-presence',
        entity: entityName,
        field: field.name,
        runner: 'node',
        description: `Field '${field.name}' should be present in ${entityName}`,
      });
    }

    // field-type: one per visible field
    for (const field of visibleFields) {
      tests.push({
        id: nextId(),
        category: 'field-type',
        entity: entityName,
        field: field.name,
        runner: 'node',
        description: `Field '${field.name}' should have type '${field.tsType}' in ${entityName}`,
      });
    }

    // searchable-filters: one per searchable field
    for (const fieldName of entityData.searchableFields) {
      tests.push({
        id: nextId(),
        category: 'searchable-filters',
        entity: entityName,
        field: fieldName,
        runner: 'node',
        description: `Field '${fieldName}' should be a supported filter for ${entityName}`,
      });
    }

    // visibility: one per entity
    tests.push({
      id: nextId(),
      category: 'visibility',
      entity: entityName,
      runner: 'node',
      description: `Entity '${entityName}' should only expose visible fields in frontend`,
    });
  }

  // system-field tests from backend fields not in frontend
  for (const [entityName, beEntity] of Object.entries(backendContract.entities)) {
    const feEntity = frontendContract.entities[entityName];
    const feFieldNames = new Set(feEntity ? feEntity.fields.map(f => f.name) : []);

    for (const field of beEntity.fields) {
      if (!feFieldNames.has(field.name)) {
        tests.push({
          id: nextId(),
          category: 'system-field',
          entity: entityName,
          field: field.name,
          runner: 'node',
          description: `System field '${field.name}' should exist in backend but not frontend for ${entityName}`,
        });
      }
    }
  }

  // rule-declared: one per kept rule
  for (const rule of rules) {
    tests.push({
      id: nextId(),
      category: 'rule-declared',
      rule: rule.name,
      runner: 'node',
      description: `Rule '${rule.name}' (${rule.type}) should be declared`,
    });
  }

  // process tests
  for (const proc of processes) {
    // process-happy
    tests.push({
      id: nextId(),
      category: 'process-happy',
      process: proc.name,
      entity: proc.entity,
      runner: 'junit',
      description: `Process '${proc.name}' should complete successfully with valid preconditions`,
    });

    // process-failure
    tests.push({
      id: nextId(),
      category: 'process-failure',
      process: proc.name,
      entity: proc.entity,
      runner: 'junit',
      description: `Process '${proc.name}' should fail when preconditions are not met`,
    });

    // process-edge: one per edge case
    if (proc.edgeCases) {
      for (const edge of proc.edgeCases) {
        tests.push({
          id: nextId(),
          category: 'process-edge',
          process: proc.name,
          entity: proc.entity,
          edgeCase: edge.name,
          runner: 'junit',
          description: `Process '${proc.name}' edge case '${edge.name}': ${edge.trigger} -> ${edge.expected}`,
        });
      }
    }

    // process-rollback: only if transactional
    if (proc.transactional) {
      tests.push({
        id: nextId(),
        category: 'process-rollback',
        process: proc.name,
        entity: proc.entity,
        runner: 'junit',
        description: `Process '${proc.name}' should rollback on failure`,
      });
    }
  }

  // Build summary
  const byCategory = {};
  const byRunner = { node: 0, junit: 0 };
  for (const t of tests) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    byRunner[t.runner] = (byRunner[t.runner] ?? 0) + 1;
  }

  return {
    tests,
    summary: {
      total: tests.length,
      byCategory,
      byRunner,
    },
  };
}

/**
 * Convert a window display name to kebab-case spec name.
 * "Sales Order" -> "sales-order", "Business Partner" -> "business-partner"
 */
function toSpecName(windowName) {
  return windowName
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Generate API prediction: predicts NEO Headless URLs, selectors, actions, and query params.
 */
export function generateApiPrediction(schema, frontendContract, backendContract) {
  const specName = toSpecName(schema.window.name);
  const baseUrl = `/sws/neo/${specName}`;

  const crud = {};
  const selectors = [];
  const actions = [];

  for (const entity of schema.entities) {
    const entityName = entity.name;
    const feEntity = frontendContract.entities[entityName];

    // CRUD — NEO Headless enables all methods by default via PopulateSpec
    crud[entityName] = {
      get: true,
      getById: true,
      post: true,
      put: true,
      patch: true,
      delete: true,
      listUrl: `${baseUrl}/${entityName}`,
      detailUrl: `${baseUrl}/${entityName}/{id}`,
      supportedFilters: feEntity ? feEntity.searchableFields : [],
    };

    // Selectors — FK fields that are visible (editable or readOnly)
    if (feEntity) {
      for (const field of feEntity.fields) {
        if (field.type === 'foreignKey') {
          selectors.push({
            entity: entityName,
            field: field.name,
            column: field.column,
            reference: field.reference,
            url: `${baseUrl}/${entityName}/selectors/${field.name}`,
          });
        }
      }
    }

    // Actions — fields with type "button" (AD_Reference_ID = 28)
    for (const field of entity.fields) {
      if (field.type === 'button') {
        actions.push({
          entity: entityName,
          field: field.name,
          column: field.column,
          url: `${baseUrl}/${entityName}/{id}/action/${field.name}`,
        });
      }
    }
  }

  return {
    specName,
    baseUrl,
    crud,
    selectors,
    actions,
    queryParams: {
      pagination: { startRow: '_startRow', endRow: '_endRow', default: '0-100' },
      sorting: { param: '_sortBy', example: `_sortBy=${specName}Date` },
      filtering: 'Use field name as query param: ?fieldName=value',
      parentFilter: 'parentId={id} for child entities',
    },
  };
}

/**
 * Main orchestrator: generates the full contract object.
 */
export function generateContract(schema, rules = [], processes = []) {
  const frontendContract = generateFrontendContract(schema, rules);
  const backendContract = generateBackendContract(schema, rules, processes);
  const testManifest = generateTestManifest(frontendContract, backendContract, rules, processes);
  const apiPrediction = generateApiPrediction(schema, frontendContract, backendContract);

  const contractData = { frontendContract, backendContract, apiPrediction, testManifest };
  const checksum = createHash('sha256')
    .update(JSON.stringify(contractData))
    .digest('hex')
    .slice(0, 16);

  return {
    version: schema.version ?? '0.1.0',
    generatedAt: new Date().toISOString(),
    checksum,
    ...contractData,
  };
}
