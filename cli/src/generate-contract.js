import { createHash } from 'node:crypto';
import { toSpecName } from './push-to-neo.js';
import { autoSimplifyEntityName, reorderKeys, WINDOW_KEY_ORDER } from './resolve-curated.js';

// Slug helper for deterministic test IDs: collapse non-alphanumerics to hyphens, trim.
const slug = (s) => String(s ?? '')
  .replace(/[^A-Za-z0-9]+/g, '-')
  .replace(/(?:^-)|(?:-$)/g, '');

const CONTRACT_ACTION_PROJECTION = [
  ['entity', 'entity'],
  ['field', 'name'],
  ['column', 'column'],
  ['url', 'url'],
  ['processId', 'processId'],
  ['processType', 'processType'],
];

// Factory for monotonically-disambiguating ID maker. Each call returns a fresh closure
// so different generators don't share state.
function createIdMaker() {
  const seenIds = new Set();
  return (...parts) => {
    const base = `t-${parts.map(slug).filter(Boolean).join('-')}`;
    if (!seenIds.has(base)) { seenIds.add(base); return base; }
    let n = 2;
    while (seenIds.has(`${base}-${n}`)) n++;
    const id = `${base}-${n}`;
    seenIds.add(id);
    return id;
  };
}

function checksumFor(payload) {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16);
}

function projectDefined(source, projection) {
  const result = {};
  for (const [targetKey, sourceKey] of projection) {
    if (source?.[sourceKey] !== undefined) result[targetKey] = source[sourceKey];
  }
  return result;
}

const TS_TYPE_MAP = {
  string: 'string',
  integer: 'number',
  amount: 'number',
  number: 'number',
  quantity: 'number',
  price: 'number',
  decimal: 'number',
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
 * Convert an Etendo readOnly/displayLogic expression into a JS expression string.
 * Uses a column→propertyName map built from the schema to resolve @Column@ references.
 * Falls back to camelCase of the column name when not found in the map.
 */
function convertLogicToJs(rawExpr, columnMap, booleanFields) {
  const boolSet = new Set(booleanFields || []);
  // Helper: for Y/N comparisons on boolean fields, use true/false instead of string
  function eqExpr(col, val) {
    const prop = columnMap[col] ?? (col.charAt(0).toLowerCase() + col.slice(1));
    if ((val === 'Y' || val === 'N') && boolSet.has(prop)) {
      return val === 'Y' ? `record['${prop}'] === true` : `record['${prop}'] !== true`;
    }
    return `record['${prop}'] === '${val}'`;
  }
  function neqExpr(col, val) {
    const prop = columnMap[col] ?? (col.charAt(0).toLowerCase() + col.slice(1));
    if ((val === 'Y' || val === 'N') && boolSet.has(prop)) {
      return val === 'Y' ? `record['${prop}'] !== true` : `record['${prop}'] === true`;
    }
    return `record['${prop}'] !== '${val}'`;
  }
  return rawExpr
    .replace(/@(\w+)@='([^']+)'/g, (_, col, val) => eqExpr(col, val))
    .replace(/@(\w+)@!='([^']+)'/g, (_, col, val) => neqExpr(col, val))
    .replace(/@(\w+)@!'([^']+)'/g, (_, col, val) => neqExpr(col, val))
    .replace(/\s*\|\s*/g, ' || ')
    .replace(/\s*&\s*/g, ' && ');
}

/**
 * Classify whether a raw display/readOnly logic expression can be evaluated client-side.
 * Returns { evaluable: true } or { evaluable: false, reason: string }.
 */
function classifyEvaluability(rawExpr) {
  if (!rawExpr) return { evaluable: true };

  // Server-expanded macro
  if (rawExpr.includes('@ACCT_DIMENSION_DISPLAY@')) {
    return { evaluable: false, reason: 'server-macro' };
  }
  // System preferences (@#VAR@)
  if (/@#\w+@/.test(rawExpr)) {
    return { evaluable: false, reason: 'session-preference' };
  }
  // Accounting dimensions (@$VAR@)
  if (/@\$\w+@/.test(rawExpr)) {
    return { evaluable: false, reason: 'accounting-dimension' };
  }
  // Known session context variables (module flags, not field values)
  const sessionVarPatterns = [
    'FinancialManagement', 'StockReservations', 'IsSOTrx', 'ShowAcct', 'ShowTrl',
    'ACCS_Account_Ope', 'APRM_', 'showAddPayment', 'IsStocked',
    // SQL-computed auxiliary fields (HAS_* are server-only boolean checks)
    'HAS_C_INVOICELINES', 'HAS_M_INOUTLINES', 'HAS_C_ORDERLINES',
    // Payment module session variables
    'IsMultiCurrencyEnabled', 'NotAllowChangeExchange', 'isReceipt',
  ];
  for (const pattern of sessionVarPatterns) {
    if (rawExpr.includes(`@${pattern}`)) {
      return { evaluable: false, reason: 'session-variable' };
    }
  }
  // Auxiliary inputs (SQL-computed values — lowercase start or known patterns)
  if (/@SQL@/i.test(rawExpr)) {
    return { evaluable: false, reason: 'auxiliary-input' };
  }
  // If @ symbols remain after the known patterns, might be untranslatable
  // But simple @FieldName@ patterns are fine — those are field references
  return { evaluable: true };
}

/**
 * Generate frontend contract: visible fields, searchable fields, computed fields.
 * Includes behavioral metadata (callout, displayLogic, readOnlyLogic) when present.
 */
export function generateFrontendContract(schema, rules = []) {
  const entities = {};

  // Build a column→propertyName map from all entities for readOnly/display logic JS conversion
  // Curated fields use field.column (the DB column name) and field.name (the JS property name)
  const columnMap = {};
  const booleanFields = [];
  for (const entity of schema.entities) {
    for (const field of entity.fields ?? []) {
      const col = field.column || field.columnName;
      if (col && field.name) columnMap[col] = field.name;
      if (field.type === 'boolean') booleanFields.push(field.name);
    }
  }

  for (const entity of schema.entities) {
    const visibleFields = entity.fields.filter(isVisible);

    const fields = visibleFields.map(f => {
      const mapped = {
        name: f.name,
        apiKey: f.apiKey || f.name,
        column: f.column,
        label: f.label,
        type: f.type,
        tsType: mapTsType(f.type),
        visibility: f.visibility,
        required: f.required,
        grid: f.grid,
        form: f.form,
      };
      if (f.sourceRequired === true) mapped.sourceRequired = true;
      if (f.derivation) mapped.derivation = f.derivation;
      if (f.columnType) mapped.columnType = f.columnType;
      if (f.reference) mapped.reference = f.reference;
      if (f.enumValues) mapped.enumValues = f.enumValues;
      if (f.inputMode) mapped.inputMode = f.inputMode;
      if (f.dependsOn) mapped.dependsOn = f.dependsOn;
      if (f.lookup) mapped.lookup = true;
      if (f.popup) mapped.popup = true;
      if (f.lookupDrawer) mapped.lookupDrawer = f.lookupDrawer;
      if (f.lookupTitle) mapped.lookupTitle = f.lookupTitle;
      if (Array.isArray(f.onSelectMappings) && f.onSelectMappings.length > 0) mapped.onSelectMappings = f.onSelectMappings;
      if (f.displayFromCatalog) mapped.displayFromCatalog = f.displayFromCatalog;
      if (Array.isArray(f.forceCalloutFields) && f.forceCalloutFields.length > 0) mapped.forceCalloutFields = f.forceCalloutFields;

      // UI hints
      if (f.defaultValue !== undefined) mapped.defaultValue = f.defaultValue;
      if (f.isIdentifier) mapped.isIdentifier = true;
      if (f.help) mapped.help = f.help;
      if (f.fieldGroup) mapped.fieldGroup = f.fieldGroup;
      if (f.isSelectionColumn) mapped.isSelectionColumn = true;
      if (f.isFilterable) mapped.isFilterable = true;
      if (f.precision) mapped.precision = f.precision;
      if (f.isTranslated) mapped.isTranslated = true;
      if (f.section) mapped.section = f.section;
      if (f.seq != null) mapped.seq = f.seq;
      if (f.statusBar) mapped.statusBar = true;
      if (f.badge) mapped.badge = true;
      if (f.badgeLabels) mapped.badgeLabels = f.badgeLabels;
      if (f.badgeColors) mapped.badgeColors = f.badgeColors;
      if (f.badgeVariants) mapped.badgeVariants = f.badgeVariants;
      if (f.enumVariants) mapped.enumVariants = f.enumVariants;
      if (f.labels) mapped.labels = f.labels;
      if (f.summable) mapped.summable = true;
      if (f.display) mapped.display = f.display;
      if (f.cellType) mapped.cellType = f.cellType;
      if (f.gridOrder != null) mapped.gridOrder = f.gridOrder;
      if (f.grow) mapped.grow = true;
      if (f.noTrailing) mapped.noTrailing = true;
      if (f.filterOnly) mapped.filterOnly = true;
      if (f.filterable === false) mapped.filterable = false;
      if (f.min !== undefined) mapped.min = f.min;

      // Behavioral metadata: validationRule (e.g. M_PriceList.issopricelist = @isSOTrx@)
      if (f.validationRule) mapped.validationRule = f.validationRule;

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
        const evalInfo = classifyEvaluability(f.displayLogic);
        mapped.displayLogic.evaluable = evalInfo.evaluable;
        if (!evalInfo.evaluable) {
          mapped.displayLogic.reason = evalInfo.reason;
          mapped.displayLogic.js = null;
        } else if (!mapped.displayLogic.js && !f.displayLogic.includes('@')) {
          // Raw expression has no Etendo @Variable@ markers — treat as direct JS
          mapped.displayLogic.js = f.displayLogic;
        }
        // Prefer explicit displayLogicJs from decisions over rule-based lookup
        // but only when evaluable — if not evaluable, js must remain null
        if (f.displayLogicJs != null && mapped.displayLogic.evaluable !== false) {
          mapped.displayLogic.js = f.displayLogicJs;
        }
      }

      // Behavioral metadata: readOnlyLogic
      if (f.readOnlyLogic) {
        mapped.readOnlyLogic = { raw: f.readOnlyLogic };
        const matchingRule = findMatchingRule(rules, f.readOnlyLogic, 'readOnlyLogic');
        if (matchingRule && matchingRule.translated) {
          mapped.readOnlyLogic.js = matchingRule.translated;
        }
        const evalInfo = classifyEvaluability(f.readOnlyLogic);
        mapped.readOnlyLogic.evaluable = evalInfo.evaluable;
        if (!evalInfo.evaluable) {
          mapped.readOnlyLogic.reason = evalInfo.reason;
          mapped.readOnlyLogic.js = null;
        } else if (!mapped.readOnlyLogic.js) {
          mapped.readOnlyLogic.js = convertLogicToJs(f.readOnlyLogic, columnMap, booleanFields);
        }
      }
      // Prefer explicit readOnlyLogicJs from decisions over AD-expression translation
      if (f.readOnlyLogicJs != null) {
        if (!mapped.readOnlyLogic) mapped.readOnlyLogic = {};
        mapped.readOnlyLogic.js = f.readOnlyLogicJs;
        mapped.readOnlyLogic.evaluable = true;
      }

      return mapped;
    });

    const searchableFields = visibleFields
      .filter(f => f.searchable)
      .map(f => f.apiKey || f.name);

    const computedFields = visibleFields
      .filter(f => f.derivation)
      .map(f => ({ name: f.apiKey || f.name, derivation: f.derivation }));

    const feEntity = { tableName: entity.tableName, tabId: entity.tabId, tabName: entity.tabName, uiPattern: entity.uiPattern ?? 'STD', fields, searchableFields, computedFields };
    if (entity.javaQualifier) feEntity.javaQualifier = entity.javaQualifier;
    if (entity.draftMode?.enabled) feEntity.draftMode = entity.draftMode;
    if (entity.formCols != null) feEntity.formCols = entity.formCols;
    entities[entity.name] = feEntity;
  }

  // Include layoutType from curated schema; default to "default" when absent
  const win = { ...schema.window };
  win.layoutType = schema.window.layoutType ?? 'default';

  // Include templateConfig only for layout types that use it
  if (win.layoutType === 'kanban' || win.layoutType === 'calendar') {
    win.templateConfig = schema.window.templateConfig ?? null;
  }

  // Lines tab layout. "classic" preserves the side-panel edit flow; "inlineEditable"
  // uses InlineLinesPanel for in-place row editing. Omitted from the contract when
  // the window doesn't opt in — generate-frontend.js and DetailView both default to
  // "classic" at runtime, so leaving the key out keeps contracts clean of the
  // implicit default.
  if (schema.window.linesLayout) win.linesLayout = schema.window.linesLayout;

  return { window: reorderKeys(win, WINDOW_KEY_ORDER), entities };
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
      apiKey: f.apiKey || f.name,
      column: f.column,
      type: f.type,
      visibility: f.visibility,
      required: f.required,
    }));

    const beEntity = { tableName: entity.tableName, tabId: entity.tabId, tabName: entity.tabName, fields };
    if (entity.javaQualifier) beEntity.javaQualifier = entity.javaQualifier;
    entities[entity.name] = beEntity;

    const searchableFields = entity.fields
      .filter(f => f.searchable)
      .map(f => f.apiKey || f.name);

    const basePath = `/${entity.name}`;

    endpoints.push(
      { method: 'GET', path: basePath, entity: entity.name, supportedFilters: searchableFields },
      { method: 'GET', path: `${basePath}/:id`, entity: entity.name, supportedFilters: [] },
      { method: 'POST', path: basePath, entity: entity.name, supportedFilters: [] },
      { method: 'PUT', path: `${basePath}/:id`, entity: entity.name, supportedFilters: [] },
      { method: 'DELETE', path: `${basePath}/:id`, entity: entity.name, supportedFilters: [] },
    );
  }

  // Build lookup structures for matching process entities to curated entity names.
  // Processes reference entities by raw OBDal tableName-based names (e.g., "cOrder"),
  // but curated entities may use tabName-based names (e.g., "header").
  const curatedEntityNames = new Set(schema.entities.map(e => e.name));
  const tableNameToEntityName = new Map();
  for (const e of schema.entities) {
    if (e.tableName) tableNameToEntityName.set(e.tableName.toLowerCase(), e.name);
  }

  const processEndpoints = processes.map(p => {
    const columnName = p.trigger?.column ?? p.trigger?.field ?? null;
    const params = p.params ?? (p.trigger
      ? [{ key: columnName, value: p.trigger.value, hidden: true }]
      : []);
    // Map process entity name to the curated entity name.
    // Try: 1) direct match, 2) tableName lookup, 3) autoSimplify, 4) primary entity fallback for button triggers
    let curatedEntity = p.entity;
    if (!curatedEntityNames.has(curatedEntity)) {
      // Process entity might be a tableName-based key — look up by tableName
      // Strip known OBDal prefixes (c, m, ad) only when followed by uppercase
      const stripped = (p.entity || '').replace(/^(c|m|ad)(?=[A-Z])/, '');
      const fromTable = tableNameToEntityName.get(stripped.toLowerCase())
        || tableNameToEntityName.get((p.entity || '').toLowerCase());
      curatedEntity = fromTable || autoSimplifyEntityName(p.entity);
    }
    // If still unresolved and it's a button trigger, fall back to primary entity (header)
    if (!curatedEntityNames.has(curatedEntity) && p.trigger?.type === 'button') {
      curatedEntity = schema.entities[0]?.name || curatedEntity;
    }
    return {
      name: p.name,
      method: 'POST',
      path: columnName ? `/${curatedEntity}/:id/action/${columnName}` : `/process/${p.name}`,
      entity: curatedEntity,
      columnName,
      params,
      preconditions: p.preconditions ?? [],
      steps: p.steps?.length ?? 0,
    };
  });

  return { window: reorderKeys(schema.window, WINDOW_KEY_ORDER), entities, endpoints, processEndpoints };
}

/**
 * Generate test manifest from contracts, rules, and processes.
 */
export function generateTestManifest(frontendContract, backendContract, rules = [], processes = []) {
  const tests = [];
  const makeId = createIdMaker();

  // Derive system fields from backend minus frontend
  for (const [entityName, entityData] of Object.entries(frontendContract.entities)) {
    const visibleFields = entityData.fields;

    // field-presence: one per visible field
    for (const field of visibleFields) {
      tests.push({
        id: makeId('field-presence', entityName, field.name),
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
        id: makeId('field-type', entityName, field.name),
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
        id: makeId('searchable-filters', entityName, fieldName),
        category: 'searchable-filters',
        entity: entityName,
        field: fieldName,
        runner: 'node',
        description: `Field '${fieldName}' should be a supported filter for ${entityName}`,
      });
    }

    // visibility: one per entity
    tests.push({
      id: makeId('visibility', entityName),
      category: 'visibility',
      entity: entityName,
      runner: 'node',
      description: `Entity '${entityName}' should only expose visible fields in frontend`,
    });

    // displayLogic validity: one per field with displayLogic
    for (const field of visibleFields) {
      if (field.displayLogic) {
        tests.push({
          id: makeId('displaylogic-valid', entityName, field.name),
          category: 'displaylogic-valid',
          entity: entityName,
          field: field.name,
          runner: 'node',
          description: `Display logic for '${field.name}' in ${entityName} should be valid JS`,
        });
      }
    }

    // readOnlyLogic validity: one per field with readOnlyLogic
    for (const field of visibleFields) {
      if (field.readOnlyLogic) {
        tests.push({
          id: makeId('readonlylogic-valid', entityName, field.name),
          category: 'readonlylogic-valid',
          entity: entityName,
          field: field.name,
          runner: 'node',
          description: `Read-only logic for '${field.name}' in ${entityName} should be valid JS`,
        });
      }
    }

    // displayLogic evaluable: one per field with displayLogic
    for (const field of visibleFields) {
      if (field.displayLogic) {
        tests.push({
          id: makeId('displaylogic-evaluable', entityName, field.name),
          category: 'displaylogic-evaluable',
          entity: entityName,
          field: field.name,
          runner: 'node',
          description: `Display logic for '${field.name}' in ${entityName} should have evaluable flag`,
        });
      }
    }

    // readOnlyLogic evaluable: one per field with readOnlyLogic
    for (const field of visibleFields) {
      if (field.readOnlyLogic) {
        tests.push({
          id: makeId('readonlylogic-evaluable', entityName, field.name),
          category: 'readonlylogic-evaluable',
          entity: entityName,
          field: field.name,
          runner: 'node',
          description: `Read-only logic for '${field.name}' in ${entityName} should have evaluable flag`,
        });
      }
    }

    // defaultValue type: one per field with defaultValue
    for (const field of visibleFields) {
      if (field.defaultValue !== undefined) {
        tests.push({
          id: makeId('default-value-type', entityName, field.name),
          category: 'default-value-type',
          entity: entityName,
          field: field.name,
          runner: 'node',
          description: `Default value for '${field.name}' in ${entityName} should be a string`,
        });
      }
    }
  }

  // system-field tests from backend fields not in frontend
  for (const [entityName, beEntity] of Object.entries(backendContract.entities)) {
    const feEntity = frontendContract.entities[entityName];
    const feFieldNames = new Set(feEntity ? feEntity.fields.map(f => f.name) : []);

    for (const field of beEntity.fields) {
      if (!feFieldNames.has(field.name)) {
        tests.push({
          id: makeId('system-field', entityName, field.name),
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
      id: makeId('rule-declared', rule.name),
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
      id: makeId('process-happy', proc.name),
      category: 'process-happy',
      process: proc.name,
      entity: proc.entity,
      runner: 'junit',
      description: `Process '${proc.name}' should complete successfully with valid preconditions`,
    });

    // process-failure
    tests.push({
      id: makeId('process-failure', proc.name),
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
          id: makeId('process-edge', proc.name, edge.name),
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
        id: makeId('process-rollback', proc.name),
        category: 'process-rollback',
        process: proc.name,
        entity: proc.entity,
        runner: 'junit',
        description: `Process '${proc.name}' should rollback on failure`,
      });
    }
  }

  // Sort by id for deterministic ordering across regens
  tests.sort((a, b) => a.id.localeCompare(b.id));

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
    _makeId: makeId,
  };
}


function createSelectorContextIndex(schema, frontendContract, currentEntityName) {
  const currentFields = frontendContract?.entities?.[currentEntityName]?.fields ?? [];
  const currentSchemaEntity = (schema?.entities ?? []).find(entity => entity.name === currentEntityName);
  const isHeaderEntity = currentSchemaEntity?.level === 'header' || currentEntityName === schema?.window?.primaryEntity;
  const parentFields = [];
  const otherFields = [];

  for (const [entityName, entityData] of Object.entries(frontendContract?.entities ?? {})) {
    if (entityName === currentEntityName) continue;
    const schemaEntity = (schema?.entities ?? []).find(entity => entity.name === entityName);
    const bucket = schemaEntity?.level === 'header' || entityName === schema?.window?.primaryEntity
      ? parentFields
      : otherFields;
    bucket.push(...(entityData.fields ?? []));
  }

  const lookupField = (param) => {
    const matches = (field) => field?.column === param || field?.name === param;
    if (!isHeaderEntity) {
      const parent = parentFields.find(matches);
      if (parent) return { field: parent, source: 'parentField' };
    }

    const current = currentFields.find(matches);
    if (current) return { field: current, source: 'field' };

    const parent = parentFields.find(matches) ?? otherFields.find(matches);
    if (parent) return { field: parent, source: 'parentField' };

    return null;
  };

  return { lookupField };
}

function buildCascadeContextEntry(param, contextIndex) {
  const match = contextIndex?.lookupField(param);
  if (!match?.field?.name) return null;

  const entry = {
    param,
    source: match.source,
    field: match.field.name,
  };
  if (match.field.type === 'date' || match.field.type === 'datetime') {
    entry.format = 'DD-MM-YYYY';
  }
  return entry;
}

function isDateContextEntry(entry, contextIndex) {
  const match = contextIndex?.lookupField(entry?.param);
  return match?.field?.type === 'date' || match?.field?.type === 'datetime';
}

/**
 * Build selector context metadata from field dependsOn, validationRule params,
 * and window category. Returns a context object with required/optional entries.
 */
function buildSelectorContext(field, windowCategory, contextIndex) {
  const context = {};
  const required = [];
  const optional = [];

  // dependsOn -> required param from parent field
  if (field.dependsOn && field.dependsOn.field && field.dependsOn.filterKey) {
    required.push({
      param: field.dependsOn.filterKey,
      source: 'field',
      field: field.dependsOn.field,
    });
  }

  // validationRule cascadeParams -> derive context requirements
  if (field.validationRule && Array.isArray(field.validationRule.cascadeParams)) {
    const cascadeParams = field.validationRule.cascadeParams;

    // IsSOTrx / isSOTrx -> window category derived.
    // Preserve the exact validation-rule parameter name because NEO selector
    // context keys are consumed by classic validation SQL.
    let trxParam = null;
    if (cascadeParams.includes('isSOTrx')) {
      trxParam = 'isSOTrx';
    } else if (cascadeParams.includes('IsSOTrx')) {
      trxParam = 'IsSOTrx';
    }
    if (trxParam) {
      if (windowCategory === 'sales' || windowCategory === 'purchases') {
        required.push({
          param: trxParam,
          source: 'windowCategory',
        });
      } else {
        optional.push({
          param: trxParam,
          source: 'windowCategory',
        });
      }
    }

    const dateParams = cascadeParams.filter(param => /date/i.test(param));
    for (const param of cascadeParams) {
      if (param === 'isSOTrx' || param === 'IsSOTrx') continue;
      if (/date/i.test(param)) continue;
      if (required.some(r => r.param === param)) continue;
      const entry = buildCascadeContextEntry(param, contextIndex);
      if (entry) required.push(entry);
    }

    if (dateParams.length > 0) {
      const dateEntry = dateParams
        .map(param => buildCascadeContextEntry(param, contextIndex))
        .find(entry => entry && isDateContextEntry(entry, contextIndex));
      const canonicalParam = dateParams[0];
      if (dateEntry && !required.some(r => r.param === canonicalParam)) {
        required.push({
          ...dateEntry,
          param: canonicalParam,
        });
      }
    }
  }

  if (required.length > 0) context.required = required;
  if (optional.length > 0) context.optional = optional;

  return Object.keys(context).length > 0 ? context : null;
}

// ─── Action classification helpers for ETP-3956 ──────────────────────────────

/**
 * Infer action type from field name, column, and window category.
 */
function inferActionType(field, windowCategory) {
  const name = (field.name || '').toLowerCase();
  const column = (field.column || '').toLowerCase();

  if (name === 'documentaction' || column === 'docaction') return 'documentAction';
  if (name === 'processnow') return 'documentAction';

  const lifecyclePatterns = ['complete', 'void', 'reactivate', 'close', 'reverse', 'post', 'approve', 'reject'];
  if (lifecyclePatterns.some(p => name.includes(p))) return 'documentAction';

  if (name.includes('aprm') || name.includes('payment')) return 'paymentAction';

  if (name.includes('create') || name.includes('generate') || name.includes('copyfrom') ||
      name.includes('pickfrom') || name.includes('receive') || name.includes('send')) return 'createFrom';

  return 'utilityAction';
}

/**
 * Infer action parameters from action type and field metadata.
 */
function inferActionParameters(field, actionType, curated) {
  if (curated?.parameters) return curated.parameters;

  const params = [];
  if (actionType === 'documentAction') {
    params.push({
      name: 'docAction',
      type: 'string',
      required: true,
      description: 'Document action code (e.g. CO=Complete, VO=Void, RE=Reactivate)',
    });
  }
  return params;
}

/**
 * Infer preconditions from action type and field metadata.
 */
function inferActionPreconditions(field, actionType, curated) {
  if (curated?.preconditions) return curated.preconditions;

  if (actionType === 'documentAction') {
    return [{
      field: 'documentStatus',
      operator: 'in',
      values: ['DR', 'IP'],
      description: 'Document must be in draft or in-progress state',
    }];
  }
  return [];
}

/**
 * Infer side effects from action type.
 */
function inferActionEffects(field, actionType) {
  switch (actionType) {
    case 'documentAction':
      return ['Updates document status', 'May trigger workflow transitions'];
    case 'paymentAction':
      return ['Creates or processes payment records', 'May update invoice/order payment status'];
    case 'createFrom':
      return ['Creates child or related records', 'May copy data from source document'];
    default:
      return ['May update related records'];
  }
}

/**
 * Infer edge cases for an action.
 */
function inferEdgeCases(field, actionType) {
  switch (actionType) {
    case 'documentAction':
      return [
        'Document is already completed or closed',
        'Document has pending lines or missing required fields',
        'User lacks permission to execute the action',
      ];
    case 'paymentAction':
      return [
        'Payment amount exceeds remaining balance',
        'Payment method is not configured for the business partner',
        'Invoice is already fully paid',
      ];
    case 'createFrom':
      return [
        'Source document has no valid lines to copy',
        'Target entity already has linked records',
        'Required reference data is missing (price list, warehouse, etc.)',
      ];
    default:
      return [
        'Required context is missing',
        'User lacks permission',
        'Record is in an incompatible state',
      ];
  }
}

/**
 * Classify an action field into a structured action model for agents.
 *
 * @param {object} field - Button field from schema entity
 * @param {string} entityName - Entity name (header, lines, etc.)
 * @param {string} specName - Spec name (kebab-case)
 * @param {string} windowCategory - Window category (sales, purchases, etc.)
 * @param {object} decisionsActions - Curated action overrides from decisions.json
 * @returns {object} Enriched action entry
 */
function classifyAction(field, entityName, specName, windowCategory, decisionsActions) {
  const curated = decisionsActions?.[field.name] ?? decisionsActions?.[field.column] ?? null;
  const actionType = inferActionType(field, windowCategory);
  const url = `/sws/neo/${specName}/${entityName}/{id}/action/${field.name}`;
  const requiresRecord = true;
  const parameters = inferActionParameters(field, actionType, curated);
  const preconditions = inferActionPreconditions(field, actionType, curated);
  const effects = curated?.effects ?? inferActionEffects(field, actionType);
  const dryRunSupported = curated?.dryRunSupported ?? (actionType === 'documentAction');
  const edgeCases = curated?.edgeCases ?? inferEdgeCases(field, actionType);

  const action = {
    name: field.name,
    actionType,
    entity: entityName,
    column: field.column,
    requiresRecord,
    method: 'POST',
    url,
    parameters,
    preconditions,
    effects,
    dryRunSupported,
    edgeCases,
  };

  if (field.processId) action.processId = field.processId;
  if (field.processType) action.processType = field.processType;
  if (curated?.description) action.description = curated.description;
  if (curated?.allowedValues) {
    const paramName = curated.paramName || 'docAction';
    action.parameters = action.parameters.map(p =>
      p.name === paramName ? { ...p, allowedValues: curated.allowedValues } : p
    );
  }

  return action;
}

// ─── End action classification helpers ───────────────────────────────────────

function buildCrudPrediction(baseUrl, entityName, feEntity) {
  return {
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
}

function collectSelectorPredictions(feEntity, entityName, baseUrl, windowCategory, schema, frontendContract) {
  if (!feEntity) return [];
  const contextIndex = createSelectorContextIndex(schema, frontendContract, entityName);

  return feEntity.fields
    .filter(field => field.type === 'foreignKey')
    .map(field => {
      const selectorContext = buildSelectorContext(field, windowCategory, contextIndex);
      const selector = {
        entity: entityName,
        field: field.name,
        column: field.column,
        reference: field.reference,
        inputMode: field.inputMode,
        url: `${baseUrl}/${entityName}/selectors/${field.name}`,
      };
      if (selectorContext) selector.context = selectorContext;
      return selector;
    });
}

function collectActionPredictions(entity, entityName, specName, windowCategory, decisionsActions) {
  return (entity.fields ?? [])
    .filter(field => field.type === 'button')
    .map(field => classifyAction(field, entityName, specName, windowCategory, decisionsActions));
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  return items.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const windowCategory = schema.window.category ?? null;

  for (const entity of schema.entities) {
    const entityName = entity.name;
    const feEntity = frontendContract.entities[entityName];

    // CRUD — NEO Headless enables all methods by default via PopulateSpec
    crud[entityName] = buildCrudPrediction(baseUrl, entityName, feEntity);

    // Selectors — FK fields that are visible (editable or readOnly)
    selectors.push(...collectSelectorPredictions(feEntity, entityName, baseUrl, windowCategory, schema, frontendContract));

    // Actions — fields with type "button" (AD_Reference_ID = 28)
    const decisionsActions = schema.window?.actions ?? {};
    actions.push(...collectActionPredictions(entity, entityName, specName, windowCategory, decisionsActions));
  }

  // Deduplicate selectors and actions by entity+field (contract generator may iterate
  // the same entity multiple times if schema.entities contains duplicate entries)
  const dedupedSelectors = dedupeBy(selectors, selector => `${selector.entity}:${selector.field}`);
  const dedupedActions = dedupeBy(actions, action => `${action.entity}:${action.name}`);

  const result = {
    specName,
    baseUrl,
    crud,
    selectors: dedupedSelectors,
    actions: dedupedActions,
    queryParams: {
      pagination: { startRow: '_startRow', endRow: '_endRow', default: '0-100' },
      sorting: { param: '_sortBy', example: '_sortBy=creationDate desc' },
      filtering: 'Use field name as query param: ?fieldName=value',
      parentFilter: 'parentId={id} for child entities',
    },
  };

  // Forward window.category so components can derive isSOTrx for selector filtering
  if (schema.window.category) {
    result.window = { category: schema.window.category };
  }

  // Forward labelOverrides from the window config so generated components can apply per-window label overrides
  if (schema.window.labelOverrides) {
    result.labelOverrides = schema.window.labelOverrides;
  }

  return result;
}

/**
 * Lock field order per entity to the previous contract so UI generation stays stable
 * across re-extractions. Uses the previous backend contract as canonical order (superset
 * including system/discarded fields). New fields land at the end (alpha-sorted); removed
 * fields drop out naturally. Duplicate field names are matched sequentially.
 */
function lockFieldOrderToPreviousContract(schema, previousContract) {
  const prevBE = previousContract?.backendContract?.entities;
  if (!prevBE) return;
  for (const entity of schema.entities ?? []) {
    const prevFields = prevBE[entity.name]?.fields;
    if (!Array.isArray(entity.fields) || !Array.isArray(prevFields) || prevFields.length === 0) continue;
    entity.fields = reorderFieldsByPrev(entity.fields, prevFields);
  }
}

function reorderFieldsByPrev(currentFields, prevFields) {
  const positionsByName = new Map();
  prevFields.forEach((f, i) => {
    if (!positionsByName.has(f.name)) positionsByName.set(f.name, []);
    positionsByName.get(f.name).push(i);
  });
  const consumed = new Map();
  const rank = new WeakMap();
  for (const f of currentFields) {
    const positions = positionsByName.get(f.name);
    const used = consumed.get(f.name) ?? 0;
    if (positions && used < positions.length) {
      rank.set(f, positions[used]);
      consumed.set(f.name, used + 1);
    } else {
      rank.set(f, Infinity);
    }
  }
  return currentFields.slice().sort((a, b) => {
    const ia = rank.get(a);
    const ib = rank.get(b);
    if (ia !== ib) return ia - ib;
    return (a.name || '').localeCompare(b.name || '');
  });
}

// ─── Form-state generation for ETP-3957 ──────────────────────────────────────

/**
 * Generate form-state metadata for an entity.
 *
 * Returns a structured object describing field visibility, read-only logic,
 * requiredness, display logic, callout triggers, and default value provenance.
 *
 * @param {object} entity - Schema entity
 * @param {object} rules - Business rules for the entity
 * @returns {object} Form state for the entity
 */
function generateEntityFormState(entity, rules) {
  const fields = {};
  const allRules = Array.isArray(rules) ? rules : [];
  const entityRules = allRules.filter(r => r.entity === entity.name);

  for (const field of entity.fields ?? []) {
    if (field.visibility === 'system' || field.visibility === 'discarded') continue;
    fields[field.name] = buildFieldFormState(field, entityRules);
  }

  return fields;
}

function buildFieldFormState(field, entityRules) {
  const fieldRules = entityRules.filter(r => r.fieldName === field.name || r.fieldName === field.column);
  const calloutTriggers = fieldRules.filter(r => r.type === 'callout').map(r => r.className ?? r.name).filter(Boolean);
  const displayLogicRule = fieldRules.find(r => r.type === 'displayLogic');
  const readOnlyRule = fieldRules.find(r => r.type === 'readOnlyLogic');

  const fieldState = {};
  const visible = field.visibility === 'editable' || field.visibility === 'readOnly';
  const readOnly = field.visibility === 'readOnly';
  const required = field.required ?? false;
  const displayLogic = displayLogicRule?.expression ?? null;
  const readOnlyLogic = readOnlyRule?.expression ?? field.readOnlyLogic ?? null;

  if (!visible) fieldState.visible = false;
  if (readOnly) fieldState.readOnly = true;
  if (required) fieldState.required = true;
  if (displayLogic) fieldState.displayLogic = displayLogic;
  if (readOnlyLogic) fieldState.readOnlyLogic = readOnlyLogic;
  if (calloutTriggers.length > 0) fieldState.calloutTriggers = calloutTriggers;
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    fieldState.defaultValue = field.defaultValue;
  }

  return fieldState;
}

/**
 * Extract required session variables from the schema.
 *
 * Scans fields for @#VAR@ patterns that indicate session-level context requirements.
 *
 * @param {object} schema - Full schema
 * @returns {string[]} List of required session variable names
 */
function addSessionVariablesFromExpression(expression, sessionVars) {
  if (typeof expression !== 'string') return;

  const sessionPattern = /@#(\w+)@/g;
  let match;
  while ((match = sessionPattern.exec(expression)) !== null) {
    sessionVars.add(`#${match[1]}`);
  }
}

function extractRequiredSessionVariables(schema, rules = []) {
  const sessionVars = new Set();

  for (const entity of schema.entities ?? []) {
    for (const field of entity.fields ?? []) {
      const sources = [
        field.displayLogic,
        field.readOnlyLogic,
        field.validationRule?.rawExpression,
      ].filter(Boolean);

      for (const src of sources) {
        addSessionVariablesFromExpression(src, sessionVars);
      }
    }
  }

  const allRules = Array.isArray(rules) ? rules : [];
  for (const rule of allRules) {
    addSessionVariablesFromExpression(rule.expression, sessionVars);
    addSessionVariablesFromExpression(rule.rawExpression, sessionVars);
  }

  return Array.from(sessionVars).sort();
}

/**
 * Generate the full formState section for the contract.
 *
 * @param {object} schema - Full schema
 * @param {object} rules - Business rules array
 * @returns {object} formState contract section
 */
function generateFormState(schema, rules) {
  const entities = {};

  for (const entity of schema.entities ?? []) {
    const entityFormState = generateEntityFormState(entity, rules);
    if (Object.keys(entityFormState).length > 0) {
      entities[entity.name] = { fields: entityFormState };
    }
  }

  return {
    entities,
    requiredSessionVariables: extractRequiredSessionVariables(schema, rules),
    evaluationMode: 'runtime',
  };
}

// ─── End form-state generation ───────────────────────────────────────────────

// ─── Agent Profile generation for ETP-3958 ───────────────────────────────────

/**
 * Generate an agentProfile for a spec.
 *
 * The profile provides a concise, agent-friendly summary of what the spec does,
 * how to use it, and what to watch out for.
 *
 * @param {object} schema - Full schema
 * @param {object} apiPrediction - Generated apiPrediction section
 * @param {object} formState - Generated formState section
 * @param {object} windowConfig - Window config from decisions.json
 * @returns {object} agentProfile
 */
function generateAgentProfile(schema, apiPrediction, formState, windowConfig) {
  const specName = apiPrediction.specName;
  const category = schema.window.category ?? 'unknown';
  const isTransactional = ['sales', 'purchases', 'inventory', 'finance'].includes(category);

  // Derive purpose from category and window name
  const windowName = schema.window.name ?? specName;
  const purpose = derivePurpose(windowName, category);
  const whenToUse = deriveWhenToUse(windowName, category);

  // Derive minimum create fields from required editable fields
  const minimumCreate = deriveMinimumCreate(schema, formState);

  // Collect context-sensitive selectors from apiPrediction
  const selectorContexts = deriveSelectorContexts(apiPrediction);

  const profileActions = (apiPrediction.actions ?? [])
    .filter(a => a.actionType === 'documentAction' || a.actionType === 'createFrom');
  const actions = profileActions.map(a => a.name);

  // Derive workflow
  const workflow = deriveWorkflow(isTransactional, profileActions, minimumCreate);

  // Edge cases from actions and form-state metadata
  const edgeCases = deriveProfileEdgeCases(apiPrediction, formState, isTransactional);

  // Examples and warnings
  const examples = deriveProfileExamples(isTransactional, minimumCreate, actions);
  const warnings = deriveProfileWarnings(schema, formState, isTransactional, actions);

  // Dangerous operations
  const dangerousOperations = (apiPrediction.actions ?? [])
    .filter(a => ['void', 'reverse', 'reactivate', 'cancel'].some(p => (a.name ?? '').toLowerCase().includes(p)))
    .map(a => a.name);

  return {
    purpose,
    whenToUse,
    minimumCreate,
    selectorContexts,
    actions,
    workflow,
    edgeCases,
    examples,
    warnings,
    knownLimitations: [],
    dangerousOperations,
  };
}

function derivePurpose(windowName, category) {
  const name = windowName.toLowerCase();
  if (category === 'sales') return `Create and manage ${name} documents.`;
  if (category === 'purchases') return `Create and manage ${name} documents.`;
  if (category === 'inventory') return `Manage ${name} inventory operations.`;
  if (category === 'finance') return `Manage ${name} financial records.`;
  return `Manage ${name} records.`;
}

function deriveWhenToUse(windowName, category) {
  const when = [];
  if (category === 'sales') when.push(`Use for customer ${windowName.toLowerCase()} before receipt or invoice.`);
  if (category === 'purchases') when.push(`Use for supplier ${windowName.toLowerCase()} before receipt or invoice.`);
  if (category === 'inventory') when.push(`Use for stock and warehouse operations.`);
  if (when.length === 0) when.push(`Use for ${windowName.toLowerCase()} management.`);
  return when;
}

function deriveMinimumCreate(schema, formState) {
  const headerFields = [];
  const lineFields = [];

  for (const entity of schema.entities ?? []) {
    const entityState = formState?.entities?.[entity.name]?.fields ?? {};
    const requiredFields = Object.entries(entityState)
      .filter(([, f]) => f.required && isFormFieldVisible(f) && !isFormFieldReadOnly(f))
      .map(([name]) => name);

    if (entity.level === 'header' || entity.name === 'header' || entity.name === schema.window?.primaryEntity) {
      headerFields.push(...requiredFields);
    } else {
      lineFields.push(...requiredFields);
    }
  }

  const recommendedOrder = [];
  if (headerFields.length > 0) recommendedOrder.push('createHeader');
  if (lineFields.length > 0) recommendedOrder.push('createLines');

  return {
    headerFields: headerFields.length > 0 ? headerFields : undefined,
    lineFields: lineFields.length > 0 ? lineFields : undefined,
    recommendedOrder: recommendedOrder.length > 0 ? recommendedOrder : undefined,
  };
}

function deriveSelectorContexts(apiPrediction) {
  return (apiPrediction.selectors ?? [])
    .filter(s => s.context)
    .map(s => ({
      entity: s.entity,
      field: s.field,
      context: s.context,
    }));
}

function deriveWorkflow(isTransactional, actions, minimumCreate) {
  if (!isTransactional) return [];

  const steps = [];
  if (minimumCreate.headerFields) steps.push('Create draft header with required fields');
  if (minimumCreate.lineFields) steps.push('Add at least one valid line');
  if (actions.some(isLifecycleAction)) {
    steps.push('Validate form state');
    steps.push('Complete the document');
  }
  return steps.length > 0 ? steps : ['Create a new record', 'Update as needed'];
}

function isLifecycleAction(action) {
  const name = action?.name ?? '';
  return action?.actionType === 'documentAction' || name === 'documentAction' || name.toLowerCase().includes('complete');
}

function deriveProfileEdgeCases(apiPrediction, formState, isTransactional) {
  const edges = new Set();

  for (const edge of collectActionEdgeCases(apiPrediction.actions)) {
    edges.add(edge);
  }

  if (isTransactional) {
    if (hasRequiredFieldWithoutDefault(formState)) {
      edges.add('Required field without default value must be provided');
    }

    if ((apiPrediction.actions ?? []).length > 0) {
      edges.add('Validate the current form state before running lifecycle actions');
      edges.add('Do not run destructive lifecycle actions without explicit user confirmation');
    }
  }

  return Array.from(edges).slice(0, 10);
}

function collectActionEdgeCases(actions = []) {
  return actions.flatMap(action => action.edgeCases ?? []);
}

function hasRequiredFieldWithoutDefault(formState) {
  return Object.values(formState?.entities ?? {}).some(entity =>
    Object.values(entity.fields ?? {}).some(field => field.required && !field.defaultValue)
  );
}

function isFormFieldVisible(field) {
  return field.visible !== false;
}

function isFormFieldReadOnly(field) {
  return field.readOnly === true;
}

function deriveProfileExamples(isTransactional, minimumCreate, actions) {
  const examples = [];

  if (minimumCreate.headerFields?.length) {
    examples.push({
      operation: 'createHeader',
      description: 'Create a draft header with the minimum required editable fields.',
      fields: minimumCreate.headerFields,
    });
  }

  if (isTransactional && minimumCreate.lineFields?.length) {
    examples.push({
      operation: 'createLine',
      description: 'Add a line after the header exists and parent context is available.',
      fields: minimumCreate.lineFields,
    });
  }

  if (isTransactional && actions.length > 0) {
    examples.push({
      operation: 'completeDocument',
      description: 'Validate form state and run the document lifecycle action when the draft is complete.',
      action: actions[0],
    });
  }

  return examples;
}

function deriveProfileWarnings(schema, formState, isTransactional, actions) {
  const warnings = new Set();
  const entities = schema.entities ?? [];
  const visibleFieldCount = Object.values(formState?.entities ?? {})
    .reduce((count, entity) => count + Object.keys(entity.fields ?? {}).length, 0);

  if (visibleFieldCount === 0) {
    warnings.add('No editable or read-only form fields are exposed for this spec');
  }

  const editableFieldCount = Object.values(formState?.entities ?? {})
    .reduce((count, entity) => {
      return count + Object.values(entity.fields ?? {}).filter(field => isFormFieldVisible(field) && !isFormFieldReadOnly(field)).length;
    }, 0);

  if (editableFieldCount === 0 && visibleFieldCount > 0) {
    warnings.add('This spec appears read-only from generated form metadata');
  }

  const hasSystemButtons = entities.some(entity =>
    (entity.fields ?? []).some(field => field.type === 'button' && field.visibility === 'system')
  );
  if (hasSystemButtons && actions.length === 0) {
    warnings.add('System lifecycle actions are present but are not exposed as editable agent actions');
  }

  if (isTransactional && actions.length === 0) {
    warnings.add('Transactional spec has no generated lifecycle action metadata');
  }

  return Array.from(warnings);
}

// ─── End agent profile generation ────────────────────────────────────────────

/**
 * Main orchestrator: generates the full contract object.
 */
export function generateContract(schema, rules = [], processes = [], previousVersion = null, previousContract = null) {
  lockFieldOrderToPreviousContract(schema, previousContract);

  const frontendContract = generateFrontendContract(schema, rules);
  const backendContract = generateBackendContract(schema, rules, processes);
  const testManifest = generateTestManifest(frontendContract, backendContract, rules, processes);
  const apiPrediction = generateApiPrediction(schema, frontendContract, backendContract);
  const formState = generateFormState(schema, rules);
  const agentProfile = generateAgentProfile(schema, apiPrediction, formState, schema.window);

  // Append apiPrediction-based tests to testManifest using stable IDs
  const makeId = testManifest._makeId;
  for (const [entityName, crud] of Object.entries(apiPrediction.crud)) {
    testManifest.tests.push({
      id: makeId('crud-flags', entityName),
      category: 'crud-flags',
      entity: entityName,
      runner: 'node',
      description: `CRUD flags for '${entityName}' should all be booleans`,
    });
  }

  for (const sel of apiPrediction.selectors) {
    testManifest.tests.push({
      id: makeId('selector-endpoint', sel.entity, sel.field),
      category: 'selector-endpoint',
      entity: sel.entity,
      field: sel.field,
      runner: 'node',
      description: `Selector endpoint for '${sel.field}' in ${sel.entity} should exist`,
    });
  }

  for (const action of apiPrediction.actions) {
    testManifest.tests.push({
      id: makeId('action-endpoint', action.entity, action.name),
      category: 'action-endpoint',
      entity: action.entity,
      field: action.name,
      runner: 'node',
      description: `Action endpoint for '${action.name}' in ${action.entity} should exist`,
    });
  }
  delete testManifest._makeId;

  // Re-sort after appending apiPrediction tests
  testManifest.tests.sort((a, b) => a.id.localeCompare(b.id));

  // Update summary counts after adding apiPrediction tests
  const updatedByCategory = {};
  const updatedByRunner = { node: 0, junit: 0 };
  for (const t of testManifest.tests) {
    updatedByCategory[t.category] = (updatedByCategory[t.category] ?? 0) + 1;
    updatedByRunner[t.runner] = (updatedByRunner[t.runner] ?? 0) + 1;
  }
  testManifest.summary = {
    total: testManifest.tests.length,
    byCategory: updatedByCategory,
    byRunner: updatedByRunner,
  };

  const contractData = { frontendContract, backendContract, apiPrediction, formState, agentProfile, testManifest };
  const checksum = checksumFor(contractData);

  const now = new Date().toISOString();
  const generatedAt = previousContract?.generatedAt ?? now;
  const checksumChanged = previousContract && previousContract.checksum !== checksum;
  const result = {
    version: previousVersion ?? schema.version ?? '0.1.0',
    generatedAt,
  };
  if (checksumChanged) {
    result.updatedAt = now;
  } else if (previousContract?.updatedAt) {
    result.updatedAt = previousContract.updatedAt;
  }
  result.checksum = checksum;
  Object.assign(result, contractData);
  return result;
}

function projectApiPredictionForContract(apiPrediction) {
  if (!apiPrediction) return apiPrediction;
  return {
    ...apiPrediction,
    actions: (apiPrediction.actions ?? []).map(action => projectDefined(action, CONTRACT_ACTION_PROJECTION)),
  };
}

/**
 * Split the generated window contract into:
 * - contract.json: compact generation/frontend contract
 * - contract.mcp.json: agentic/MCP metadata that is useful for agents but noisy
 *   for baseline UI diffs.
 */
function preserveArtifactTimestamps(artifact, previousArtifact) {
  if (!previousArtifact) return artifact;
  if (previousArtifact.checksum === artifact.checksum) {
    artifact.generatedAt = previousArtifact.generatedAt ?? artifact.generatedAt;
    if (previousArtifact.updatedAt) artifact.updatedAt = previousArtifact.updatedAt;
    else delete artifact.updatedAt;
  }
  return artifact;
}

export function splitWindowContractArtifacts(contract, previousContract = null, previousMcpContract = null) {
  const { apiPrediction, formState, agentProfile } = contract;
  const compactApiPrediction = projectApiPredictionForContract(apiPrediction);
  const compactContract = {
    version: contract.version,
    generatedAt: contract.generatedAt,
    ...(contract.updatedAt ? { updatedAt: contract.updatedAt } : {}),
    frontendContract: contract.frontendContract,
    backendContract: contract.backendContract,
    apiPrediction: compactApiPrediction,
    testManifest: contract.testManifest,
  };
  compactContract.checksum = checksumFor({
    frontendContract: compactContract.frontendContract,
    backendContract: compactContract.backendContract,
    apiPrediction: compactApiPrediction,
    testManifest: compactContract.testManifest,
  });
  const compactChecksum = compactContract.checksum;
  delete compactContract.checksum;
  compactContract.checksum = compactChecksum;
  const orderedCompactContract = {
    version: compactContract.version,
    generatedAt: compactContract.generatedAt,
    ...(compactContract.updatedAt ? { updatedAt: compactContract.updatedAt } : {}),
    checksum: compactContract.checksum,
    frontendContract: compactContract.frontendContract,
    backendContract: compactContract.backendContract,
    apiPrediction: compactContract.apiPrediction,
    testManifest: compactContract.testManifest,
  };
  preserveArtifactTimestamps(orderedCompactContract, previousContract);

  const mcpContract = {
    version: contract.version,
    generatedAt: contract.generatedAt,
    ...(contract.updatedAt ? { updatedAt: contract.updatedAt } : {}),
    contractChecksum: orderedCompactContract.checksum,
    apiPrediction,
    formState,
    agentProfile,
  };
  mcpContract.checksum = checksumFor({
    apiPrediction,
    formState,
    agentProfile,
  });
  preserveArtifactTimestamps(mcpContract, previousMcpContract);

  return { contract: orderedCompactContract, mcpContract };
}

// ---------------------------------------------------------------------------
// Process contract generation
// ---------------------------------------------------------------------------

const PROCESS_REFERENCE_MAP = {
  '15': { type: 'date', tsType: 'string', inputMode: 'date-picker' },
  '16': { type: 'datetime', tsType: 'string', inputMode: 'datetime-picker' },
  '10': { type: 'string', tsType: 'string', inputMode: 'text' },
  '14': { type: 'string', tsType: 'string', inputMode: 'text' },
  '11': { type: 'integer', tsType: 'number', inputMode: 'number' },
  '22': { type: 'number', tsType: 'number', inputMode: 'number' },
  '12': { type: 'amount', tsType: 'number', inputMode: 'number' },
  '800019': { type: 'number', tsType: 'number', inputMode: 'number' },
  '20': { type: 'boolean', tsType: 'boolean', inputMode: 'checkbox' },
  '17': { type: 'list', tsType: 'string', inputMode: 'select' },
  '19': { type: 'foreignKey', tsType: 'string', inputMode: 'search' },
  '18': { type: 'foreignKey', tsType: 'string', inputMode: 'search' },
  '30': { type: 'foreignKey', tsType: 'string', inputMode: 'search' },
  '800011': { type: 'foreignKey', tsType: 'string', inputMode: 'search' },
};

const DEFAULT_REFERENCE = { type: 'string', tsType: 'string', inputMode: 'text' };

/**
 * Map an AD_Reference_ID to type info for process parameters.
 */
export function mapProcessReference(referenceId) {
  return PROCESS_REFERENCE_MAP[String(referenceId)] ?? DEFAULT_REFERENCE;
}

/**
 * Generate a contract for a standalone process (not window-attached).
 *
 * @param {object} processRaw - The process-raw.json structure
 * @returns {object} Process contract
 */
export function generateProcessContract(processRaw, previousContract = null) {
  const { process: proc, parameters: rawParams } = processRaw;
  const specName = toSpecName(proc.name);

  const parameters = rawParams.map(p => {
    const ref = mapProcessReference(p.referenceId);
    const param = {
      name: p.name,
      column: p.column,
      type: ref.type,
      tsType: ref.tsType,
      inputMode: ref.inputMode,
      required: p.mandatory === true,
      isRange: p.isRange === true,
    };
    if (p.defaultValue) param.defaultValue = p.defaultValue;
    if (p.referenceValueId) param.referenceValueId = p.referenceValueId;
    return param;
  });

  const apiPrediction = {
    specName,
    baseUrl: `/sws/neo/${specName}`,
    describe: `GET /sws/neo/${specName}`,
    execute: `POST /sws/neo/${specName}`,
  };

  // Build test manifest with deterministic IDs
  const tests = [];
  const makeId = createIdMaker();

  for (const param of parameters) {
    tests.push({
      id: makeId('param-presence', param.name),
      category: 'param-presence',
      param: param.name,
      runner: 'node',
      description: `Parameter '${param.name}' should be present`,
    });
  }

  for (const param of parameters) {
    tests.push({
      id: makeId('param-type', param.name),
      category: 'param-type',
      param: param.name,
      expectedType: param.tsType,
      runner: 'node',
      description: `Parameter '${param.name}' should have type '${param.tsType}'`,
    });
  }

  tests.push({
    id: makeId('execution-happy'),
    category: 'execution-happy',
    runner: 'junit',
    description: `Process '${proc.name}' should execute successfully with valid parameters`,
  });

  tests.push({
    id: makeId('execution-failure'),
    category: 'execution-failure',
    runner: 'junit',
    description: `Process '${proc.name}' should fail with invalid parameters`,
  });

  tests.sort((a, b) => a.id.localeCompare(b.id));

  const byCategory = {};
  const byRunner = { node: 0, junit: 0 };
  for (const t of tests) {
    byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    byRunner[t.runner] = (byRunner[t.runner] ?? 0) + 1;
  }

  const testManifest = {
    tests,
    summary: { total: tests.length, byCategory, byRunner },
  };

  const contractData = {
    type: 'process',
    process: {
      id: proc.id,
      name: proc.name,
      specName,
      uiPattern: proc.uiPattern,
      javaClassName: proc.javaClassName || null,
      isReport: proc.isReport === true,
    },
    parameters,
    apiPrediction,
    testManifest,
  };

  const checksum = createHash('sha256')
    .update(JSON.stringify(contractData))
    .digest('hex')
    .slice(0, 16);

  const now = new Date().toISOString();
  const generatedAt = previousContract?.generatedAt ?? now;
  const checksumChanged = previousContract && previousContract.checksum !== checksum;
  const result = {
    version: '0.1.0',
    generatedAt,
  };
  if (checksumChanged) {
    result.updatedAt = now;
  } else if (previousContract?.updatedAt) {
    result.updatedAt = previousContract.updatedAt;
  }
  result.checksum = checksum;
  Object.assign(result, contractData);
  return result;
}
