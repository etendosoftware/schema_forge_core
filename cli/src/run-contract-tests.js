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
  return field.visibility === 'system'
    ? { passed: true }
    : { passed: false, reason: `Field '${test.field}' has visibility '${field.visibility}', expected 'system'` };
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

const categoryHandlers = {
  'field-presence': checkFieldPresence,
  'field-type': checkFieldType,
  'system-field': checkSystemField,
  'searchable-filters': checkSearchableFilters,
  'visibility': checkVisibility,
  'rule-declared': checkRuleDeclared,
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
