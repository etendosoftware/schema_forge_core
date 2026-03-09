/**
 * Aggregate Contract Test Runner
 *
 * Validates structural integrity of aggregate-contract.json files.
 * Pure functions, no I/O. Same pattern as run-contract-tests.js.
 *
 * 8 validation categories:
 *   section-presence, kpi-integrity, table-column-match,
 *   kanban-column-match, alert-severity, link-validity,
 *   layout-coverage, mockData-shape
 */

const VALID_KPI_FORMATS = new Set(['currency', 'number', 'percent']);

let testCounter = 0;
function nextId(category) {
  return `agg-${category}-${++testCounter}`;
}

/**
 * Check that every section in sections[] has a corresponding entry in mockData.
 * Skips quick-actions type sections.
 */
function checkSectionPresence(contract) {
  const results = [];
  const sections = contract.sections ?? [];
  const mockData = contract.mockData ?? {};

  for (const section of sections) {
    if (section.type === 'quick-actions') continue;
    const hasMock = section.id in mockData;
    results.push({
      id: nextId('sp'),
      category: 'section-presence',
      description: `Section '${section.id}' has mockData`,
      passed: hasMock,
      ...(hasMock ? {} : { reason: `No mockData entry for section '${section.id}'` }),
    });
  }
  return results;
}

/**
 * Check KPI sections: each KPI must have a label, a valid format, and a value in mockData.
 */
function checkKpiIntegrity(contract) {
  const results = [];
  const sections = (contract.sections ?? []).filter(s => s.type === 'kpi');
  const mockData = contract.mockData ?? {};

  for (const section of sections) {
    const data = mockData[section.id] ?? {};
    for (const kpi of section.kpis ?? []) {
      // Check label
      const hasLabel = Boolean(kpi.label);
      results.push({
        id: nextId('kpi'),
        category: 'kpi-integrity',
        description: `KPI '${kpi.key}' has a label`,
        passed: hasLabel,
        ...(hasLabel ? {} : { reason: `KPI '${kpi.key}' is missing a label` }),
      });

      // Check format
      const validFormat = VALID_KPI_FORMATS.has(kpi.format);
      results.push({
        id: nextId('kpi'),
        category: 'kpi-integrity',
        description: `KPI '${kpi.key}' has valid format '${kpi.format}'`,
        passed: validFormat,
        ...(validFormat ? {} : { reason: `KPI '${kpi.key}' has invalid format '${kpi.format}', expected one of: currency, number, percent` }),
      });

      // Check value in mockData
      const hasValue = kpi.key in data;
      results.push({
        id: nextId('kpi'),
        category: 'kpi-integrity',
        description: `KPI '${kpi.key}' has value in mockData`,
        passed: hasValue,
        ...(hasValue ? {} : { reason: `KPI '${kpi.key}' (key: '${kpi.key}') not found in mockData for section '${section.id}'` }),
      });
    }
  }
  return results;
}

/**
 * Check data-table sections: first mockData row must contain all column keys.
 */
function checkTableColumnMatch(contract) {
  const results = [];
  const sections = (contract.sections ?? []).filter(s => s.type === 'data-table');
  const mockData = contract.mockData ?? {};

  for (const section of sections) {
    const rows = mockData[section.id];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    const firstRow = rows[0];
    for (const col of section.columns ?? []) {
      const hasKey = col.key in firstRow;
      results.push({
        id: nextId('tcm'),
        category: 'table-column-match',
        description: `Table '${section.id}' row has column '${col.key}'`,
        passed: hasKey,
        ...(hasKey ? {} : { reason: `Column '${col.key}' not found in first mockData row for table '${section.id}'` }),
      });
    }
  }
  return results;
}

/**
 * Check kanban sections: each card's columnId must exist in the section's columns.
 */
function checkKanbanColumnMatch(contract) {
  const results = [];
  const sections = (contract.sections ?? []).filter(s => s.type === 'kanban');
  const mockData = contract.mockData ?? {};

  for (const section of sections) {
    const validIds = new Set((section.columns ?? []).map(c => c.id));
    const cards = mockData[section.id];
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const valid = validIds.has(card.columnId);
      results.push({
        id: nextId('kcm'),
        category: 'kanban-column-match',
        description: `Kanban card '${card.title ?? 'untitled'}' has valid columnId`,
        passed: valid,
        ...(valid ? {} : { reason: `Card columnId '${card.columnId}' not found in kanban columns for '${section.id}'` }),
      });
    }
  }
  return results;
}

/**
 * Check alerts sections: each alert's severity must be in the section's declared severities set.
 */
function checkAlertSeverity(contract) {
  const results = [];
  const sections = (contract.sections ?? []).filter(s => s.type === 'alerts');
  const mockData = contract.mockData ?? {};

  for (const section of sections) {
    const validSeverities = new Set(section.severities ?? []);
    const alerts = mockData[section.id];
    if (!Array.isArray(alerts)) continue;
    for (const alert of alerts) {
      const valid = validSeverities.has(alert.severity);
      results.push({
        id: nextId('as'),
        category: 'alert-severity',
        description: `Alert severity '${alert.severity}' is valid`,
        passed: valid,
        ...(valid ? {} : { reason: `Alert severity '${alert.severity}' not in declared set [${[...validSeverities].join(', ')}] for section '${section.id}'` }),
      });
    }
  }
  return results;
}

/**
 * Check that action routes exist in the provided menu items list.
 */
function checkLinkValidity(contract, menuItems) {
  const results = [];
  const actions = contract.actions ?? [];
  const menuSet = new Set(menuItems.map(m => m.replace(/^\//, '')));

  for (const action of actions) {
    const route = (action.route ?? '').replace(/^\//, '');
    const valid = menuSet.has(route);
    results.push({
      id: nextId('lv'),
      category: 'link-validity',
      description: `Action route '${action.route}' exists in menu`,
      passed: valid,
      ...(valid ? {} : { reason: `Route '${action.route}' not found in menu items` }),
    });
  }
  return results;
}

/**
 * Check that all section IDs are referenced in layout.areas.
 */
function checkLayoutCoverage(contract) {
  const results = [];
  const sections = contract.sections ?? [];
  const areaSet = new Set((contract.layout?.areas ?? []).map(a => a.section));

  for (const section of sections) {
    const covered = areaSet.has(section.id);
    results.push({
      id: nextId('lc'),
      category: 'layout-coverage',
      description: `Section '${section.id}' is referenced in layout`,
      passed: covered,
      ...(covered ? {} : { reason: `Section '${section.id}' not found in layout.areas` }),
    });
  }
  return results;
}

/**
 * Check mockData shape: arrays must be non-empty, objects must have keys.
 * Skips quick-actions sections.
 */
function checkMockDataShape(contract) {
  const results = [];
  const sections = contract.sections ?? [];
  const mockData = contract.mockData ?? {};
  const skipTypes = new Set(['quick-actions']);

  for (const section of sections) {
    if (skipTypes.has(section.type)) continue;
    const data = mockData[section.id];
    if (data === undefined) continue;

    let valid = true;
    let reason = '';

    if (Array.isArray(data)) {
      if (data.length === 0) {
        valid = false;
        reason = `mockData for '${section.id}' is an empty array`;
      }
    } else if (typeof data === 'object' && data !== null) {
      if (Object.keys(data).length === 0) {
        valid = false;
        reason = `mockData for '${section.id}' is an empty object`;
      }
    }

    results.push({
      id: nextId('mds'),
      category: 'mockData-shape',
      description: `mockData for '${section.id}' has valid shape`,
      passed: valid,
      ...(valid ? {} : { reason }),
    });
  }
  return results;
}

/**
 * Run all aggregate contract tests and return a summary.
 *
 * @param {object} contract - The aggregate contract JSON
 * @param {string[]} menuItems - List of valid menu routes
 * @returns {{total: number, passed: number, failed: number, results: Array<{id: string, category: string, description: string, passed: boolean, reason?: string}>}}
 */
export function runAggregateTests(contract, menuItems = []) {
  // Reset counter for each run so IDs are deterministic per invocation
  testCounter = 0;

  const results = [
    ...checkSectionPresence(contract),
    ...checkKpiIntegrity(contract),
    ...checkTableColumnMatch(contract),
    ...checkKanbanColumnMatch(contract),
    ...checkAlertSeverity(contract),
    ...checkLinkValidity(contract, menuItems),
    ...checkLayoutCoverage(contract),
    ...checkMockDataShape(contract),
  ];

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  return { total: passed + failed, passed, failed, results };
}
