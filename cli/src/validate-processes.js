/**
 * Process Validator (F2b)
 * Validates process definitions: structure, coverage, step types.
 */

const VALID_STEP_TYPES = ['validate', 'mutation', 'forEach'];

/**
 * @param {object} processesDoc - The processes document with version and processes array
 * @param {object} [schema] - Optional schema with entities array for reference checks
 * @returns {{ errors: Array<{code: string, message: string, path: string, severity: 'error'|'warning'}>, warnings: Array<{code: string, message: string, path: string, severity: 'warning'}> }}
 */
export function validateProcesses(processesDoc, schema) {
  const errors = [];
  const warnings = [];
  const processes = processesDoc?.processes ?? [];

  const entityNames = schema?.entities?.map(e => e.name) ?? null;

  for (let i = 0; i < processes.length; i++) {
    const proc = processes[i];
    const basePath = `processes[${i}]`;

    // Preconditions: non-empty array
    if (!Array.isArray(proc.preconditions) || proc.preconditions.length === 0) {
      errors.push({
        code: 'NO_PRECONDITIONS',
        message: `Process "${proc.name}" must have at least one precondition.`,
        path: `${basePath}.preconditions`,
        severity: 'error',
      });
    }

    // Edge cases: at least 3
    const edgeCount = Array.isArray(proc.edgeCases) ? proc.edgeCases.length : 0;
    if (edgeCount < 3) {
      errors.push({
        code: 'INSUFFICIENT_EDGE_CASES',
        message: `Process "${proc.name}" has ${edgeCount} edge cases, minimum is 3.`,
        path: `${basePath}.edgeCases`,
        severity: 'error',
      });
    }

    // Transactional must be true
    if (proc.transactional !== true) {
      errors.push({
        code: 'NOT_TRANSACTIONAL',
        message: `Process "${proc.name}" must have transactional: true.`,
        path: `${basePath}.transactional`,
        severity: 'error',
      });
    }

    // Process entity reference check
    if (entityNames && proc.entity && !entityNames.includes(proc.entity)) {
      errors.push({
        code: 'UNKNOWN_ENTITY',
        message: `Process "${proc.name}" references unknown entity "${proc.entity}".`,
        path: `${basePath}.entity`,
        severity: 'error',
      });
    }

    // Steps validation
    const steps = Array.isArray(proc.steps) ? proc.steps : [];
    const stepNames = new Set();
    let lastOrder = -Infinity;

    for (let j = 0; j < steps.length; j++) {
      const step = steps[j];
      const stepPath = `${basePath}.steps[${j}]`;

      // Valid step type
      if (!VALID_STEP_TYPES.includes(step.type)) {
        errors.push({
          code: 'INVALID_STEP_TYPE',
          message: `Step "${step.name}" has invalid type "${step.type}". Valid types: ${VALID_STEP_TYPES.join(', ')}.`,
          path: `${stepPath}.type`,
          severity: 'error',
        });
      }

      // forEach must have non-empty steps
      if (step.type === 'forEach') {
        const nestedSteps = step.operation?.steps ?? step.steps;
        if (!Array.isArray(nestedSteps) || nestedSteps.length === 0) {
          errors.push({
            code: 'EMPTY_FOREACH',
            message: `forEach step "${step.name}" must have non-empty steps array.`,
            path: `${stepPath}.steps`,
            severity: 'error',
          });
        }
      }

      // Step target references existing entity
      if (entityNames && step.target && !entityNames.includes(step.target)) {
        errors.push({
          code: 'UNKNOWN_ENTITY',
          message: `Step "${step.name}" references unknown entity "${step.target}".`,
          path: `${stepPath}.target`,
          severity: 'error',
        });
      }

      // Order must be monotonically increasing
      if (typeof step.order === 'number') {
        if (step.order <= lastOrder) {
          errors.push({
            code: 'STEP_ORDER_NOT_SEQUENTIAL',
            message: `Step "${step.name}" order ${step.order} is not greater than previous order ${lastOrder}.`,
            path: `${stepPath}.order`,
            severity: 'error',
          });
        }
        lastOrder = step.order;
      }

      // No duplicate step names
      if (step.name) {
        if (stepNames.has(step.name)) {
          errors.push({
            code: 'DUPLICATE_STEP_NAME',
            message: `Duplicate step name "${step.name}" in process "${proc.name}".`,
            path: `${stepPath}.name`,
            severity: 'error',
          });
        }
        stepNames.add(step.name);
      }
    }
  }

  return { errors, warnings };
}
