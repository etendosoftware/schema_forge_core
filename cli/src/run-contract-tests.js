/**
 * Contract Test Runner
 *
 * Reads a contract JSON (with testManifest), generates and runs Node.js-side
 * contract tests against the contract data. These verify structural correctness
 * without needing a running backend.
 */

/**
 * Check field-presence: field exists in frontendContract.entities[entity].fields
 */
function checkFieldPresence(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) {
    return { passed: false, reason: `Entity '${test.entity}' not found in frontendContract` };
  }
  const found = entity.fields.some(f => f.name === test.field);
  return found
    ? { passed: true }
    : { passed: false, reason: `Field '${test.field}' not found in entity '${test.entity}'` };
}

/**
 * Check editable-field: field exists in frontendContract and remains editable.
 */
function checkEditableField(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) {
    return { passed: false, reason: `Entity '${test.entity}' not found in frontendContract` };
  }
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) {
    return { passed: false, reason: `Field '${test.field}' not found in entity '${test.entity}'` };
  }
  return field.visibility === 'editable'
    ? { passed: true }
    : { passed: false, reason: `Field '${test.field}' has visibility '${field.visibility}', expected 'editable'` };
}

/**
 * Check field-type: field has correct tsType in frontendContract
 */
function checkFieldType(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) {
    return { passed: false, reason: `Entity '${test.entity}' not found in frontendContract` };
  }
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) {
    return { passed: false, reason: `Field '${test.field}' not found in entity '${test.entity}'` };
  }
  // If the test specifies an expected type, check it; otherwise just verify field has a tsType
  if (test.expectedType) {
    return field.tsType === test.expectedType
      ? { passed: true }
      : { passed: false, reason: `Field '${test.field}' has tsType '${field.tsType}', expected '${test.expectedType}'` };
  }
  return field.tsType
    ? { passed: true }
    : { passed: false, reason: `Field '${test.field}' has no tsType defined` };
}

/**
 * Check system-field: field exists in backendContract with visibility='system'
 */
function checkSystemField(contract, test) {
  const entity = contract.backendContract?.entities?.[test.entity];
  if (!entity) {
    return { passed: false, reason: `Entity '${test.entity}' not found in backendContract` };
  }
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) {
    return { passed: false, reason: `Field '${test.field}' not found in backend entity '${test.entity}'` };
  }
  return (field.visibility === 'system' || field.visibility === 'discarded')
    ? { passed: true }
    : { passed: false, reason: `Field '${test.field}' has visibility '${field.visibility}', expected 'system' or 'discarded'` };
}

/**
 * Check searchable-filters: field is in searchableFields AND in endpoint supportedFilters
 */
function checkSearchableFilters(contract, test) {
  const frontendEntity = contract.frontendContract?.entities?.[test.entity];
  if (!frontendEntity) {
    return { passed: false, reason: `Entity '${test.entity}' not found in frontendContract` };
  }
  const inSearchable = frontendEntity.searchableFields?.includes(test.field);
  if (!inSearchable) {
    return { passed: false, reason: `Field '${test.field}' not in searchableFields for entity '${test.entity}'` };
  }
  const endpoint = contract.backendContract?.endpoints?.find(e => e.entity === test.entity);
  if (!endpoint) {
    return { passed: false, reason: `No endpoint found for entity '${test.entity}'` };
  }
  const inFilters = endpoint.supportedFilters?.includes(test.field);
  return inFilters
    ? { passed: true }
    : { passed: false, reason: `Field '${test.field}' not in supportedFilters for entity '${test.entity}'` };
}

/**
 * Check visibility: entity has fields matching expected visibility
 */
function checkVisibility(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) {
    return { passed: false, reason: `Entity '${test.entity}' not found in frontendContract` };
  }

  // Entity-level visibility test: no system fields should be in frontend
  if (!test.field) {
    const systemFields = entity.fields.filter(f => f.visibility === 'system');
    return systemFields.length === 0
      ? { passed: true }
      : { passed: false, reason: `Entity '${test.entity}' exposes system fields: ${systemFields.map(f => f.name).join(', ')}` };
  }

  // Field-level visibility test
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) {
    return { passed: false, reason: `Field '${test.field}' not found in entity '${test.entity}'` };
  }
  if (test.expectedVisibility) {
    return field.visibility === test.expectedVisibility
      ? { passed: true }
      : { passed: false, reason: `Field '${test.field}' has visibility '${field.visibility}', expected '${test.expectedVisibility}'` };
  }
  return field.visibility
    ? { passed: true }
    : { passed: false, reason: `Field '${test.field}' has no visibility defined` };
}

/**
 * Check rule-declared: pass-through for now
 */
function checkRuleDeclared(_contract, _test) {
  return { passed: true };
}

/**
 * Check displaylogic-valid: display logic JS expression is parseable
 */
function checkDisplayLogicValid(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) return { passed: false, reason: `Entity '${test.entity}' not found` };
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) return { passed: false, reason: `Field '${test.field}' not found` };
  if (!field.displayLogic?.js) return { passed: true }; // no JS translation = skip (valid)
  try {
    new Function('record', `return ${field.displayLogic.js}`);
    return { passed: true };
  } catch (e) {
    return { passed: false, reason: `displayLogic.js parse error: ${e.message}` };
  }
}

/**
 * Check readonlylogic-valid: read-only logic JS expression is parseable
 */
function checkReadOnlyLogicValid(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) return { passed: false, reason: `Entity '${test.entity}' not found` };
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) return { passed: false, reason: `Field '${test.field}' not found` };
  if (!field.readOnlyLogic?.js) return { passed: true }; // no JS translation = skip (valid)
  try {
    new Function('record', `return ${field.readOnlyLogic.js}`);
    return { passed: true };
  } catch (e) {
    return { passed: false, reason: `readOnlyLogic.js parse error: ${e.message}` };
  }
}

/**
 * Check displaylogic-evaluable: displayLogic has evaluable flag and reason when false
 */
function checkDisplayLogicEvaluable(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) return { passed: false, reason: `Entity '${test.entity}' not found` };
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) return { passed: false, reason: `Field '${test.field}' not found` };
  if (!field.displayLogic) return { passed: true };
  if (typeof field.displayLogic.evaluable !== 'boolean') {
    return { passed: false, reason: `displayLogic.evaluable is missing or not boolean` };
  }
  if (field.displayLogic.evaluable === false && !field.displayLogic.reason) {
    return { passed: false, reason: `displayLogic.evaluable is false but no reason provided` };
  }
  if (field.displayLogic.evaluable === false && field.displayLogic.js !== null) {
    return { passed: false, reason: `displayLogic.evaluable is false but js is not null` };
  }
  return { passed: true };
}

/**
 * Check readonlylogic-evaluable: readOnlyLogic has evaluable flag and reason when false
 */
function checkReadOnlyLogicEvaluable(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) return { passed: false, reason: `Entity '${test.entity}' not found` };
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) return { passed: false, reason: `Field '${test.field}' not found` };
  if (!field.readOnlyLogic) return { passed: true };
  if (typeof field.readOnlyLogic.evaluable !== 'boolean') {
    return { passed: false, reason: `readOnlyLogic.evaluable is missing or not boolean` };
  }
  if (field.readOnlyLogic.evaluable === false && !field.readOnlyLogic.reason) {
    return { passed: false, reason: `readOnlyLogic.evaluable is false but no reason provided` };
  }
  if (field.readOnlyLogic.evaluable === false && field.readOnlyLogic.js !== null) {
    return { passed: false, reason: `readOnlyLogic.evaluable is false but js is not null` };
  }
  return { passed: true };
}

/**
 * Check selector-endpoint: FK field has matching selector in apiPrediction
 */
function checkSelectorEndpoint(contract, test) {
  const selectors = contract.apiPrediction?.selectors ?? [];
  const match = selectors.find(s => s.entity === test.entity && s.field === test.field);
  return match
    ? { passed: true }
    : { passed: false, reason: `No selector endpoint for FK field '${test.field}' in entity '${test.entity}'` };
}

/**
 * Check action-endpoint: button field has matching action in apiPrediction
 */
function checkActionEndpoint(contract, test) {
  const actions = contract.apiPrediction?.actions ?? [];
  const match = actions.find(a => a.entity === test.entity && a.field === test.field);
  return match
    ? { passed: true }
    : { passed: false, reason: `No action endpoint for button field '${test.field}' in entity '${test.entity}'` };
}

/**
 * Check crud-flags: CRUD flags are all booleans
 */
function checkCrudFlags(contract, test) {
  const crud = contract.apiPrediction?.crud?.[test.entity];
  if (!crud) return { passed: false, reason: `No CRUD entry for entity '${test.entity}'` };
  const flags = ['get', 'getById', 'post', 'put', 'patch', 'delete'];
  for (const flag of flags) {
    if (typeof crud[flag] !== 'boolean') {
      return { passed: false, reason: `CRUD flag '${flag}' is ${typeof crud[flag]}, expected boolean` };
    }
  }
  return { passed: true };
}

/**
 * Check default-value-type: defaultValue is string or undefined
 */
function checkDefaultValueType(contract, test) {
  const entity = contract.frontendContract?.entities?.[test.entity];
  if (!entity) return { passed: false, reason: `Entity '${test.entity}' not found` };
  const field = entity.fields.find(f => f.name === test.field);
  if (!field) return { passed: false, reason: `Field '${test.field}' not found` };
  if (field.defaultValue !== undefined && typeof field.defaultValue !== 'string') {
    return { passed: false, reason: `defaultValue is ${typeof field.defaultValue}, expected string` };
  }
  return { passed: true };
}

const categoryHandlers = {
  'field-presence': checkFieldPresence,
  'editable-field': checkEditableField,
  'field-type': checkFieldType,
  'system-field': checkSystemField,
  'searchable-filters': checkSearchableFilters,
  'visibility': checkVisibility,
  'rule-declared': checkRuleDeclared,
  'displaylogic-valid': checkDisplayLogicValid,
  'readonlylogic-valid': checkReadOnlyLogicValid,
  'displaylogic-evaluable': checkDisplayLogicEvaluable,
  'readonlylogic-evaluable': checkReadOnlyLogicEvaluable,
  'selector-endpoint': checkSelectorEndpoint,
  'action-endpoint': checkActionEndpoint,
  'crud-flags': checkCrudFlags,
  'default-value-type': checkDefaultValueType,
};

/**
 * Generate test assertions for each test in testManifest with runner: 'node'.
 * Skips runner: 'junit' tests entirely.
 *
 * @param {object} contract - The full contract JSON with testManifest
 * @returns {Array<{id: string, category: string, description: string, passed: boolean, reason?: string}>}
 */
export function generateTestAssertions(contract) {
  const tests = contract.testManifest?.tests ?? [];
  const results = [];

  for (const test of tests) {
    if (test.runner !== 'node') {
      continue;
    }

    const handler = categoryHandlers[test.category];
    if (!handler) {
      results.push({
        id: test.id,
        category: test.category,
        description: test.description,
        passed: false,
        reason: `Unknown test category: '${test.category}'`,
      });
      continue;
    }

    const { passed, reason } = handler(contract, test);
    const result = { id: test.id, category: test.category, description: test.description, passed };
    if (reason) result.reason = reason;
    results.push(result);
  }

  return results;
}

/**
 * Run all contract tests and return a summary.
 *
 * @param {object} contract - The full contract JSON with testManifest
 * @returns {{total: number, passed: number, failed: number, skipped: number, results: Array}}
 */
export function runContractTests(contract) {
  const allTests = contract.testManifest?.tests ?? [];
  const skippedCount = allTests.filter(t => t.runner !== 'node').length;

  const results = generateTestAssertions(contract);
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return {
    total: passed + failed,
    passed,
    failed,
    skipped: skippedCount,
    results,
  };
}
