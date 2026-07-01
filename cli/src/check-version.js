#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');

// Properties whose changes are considered breaking (structural contract changes)
const BREAKING_PROPERTIES = new Set(['name', 'type', 'tsType', 'column']);

// Properties whose changes are considered additive (behavioral changes)
const ADDITIVE_PROPERTIES = new Set(['required', 'reference', 'inputMode', 'dependsOn']);

// Properties whose changes are patch-level (UI-only)
const PATCH_PROPERTIES = new Set(['grid', 'form', 'visibility', 'searchable']);

/**
 * Diff two arrays of field objects by name.
 * Returns { added, removed, changed } where changed includes per-property diffs.
 */
export function diffFields(oldFields, newFields) {
  const oldMap = new Map(oldFields.map(f => [f.name, f]));
  const newMap = new Map(newFields.map(f => [f.name, f]));

  const added = newFields.filter(f => !oldMap.has(f.name));
  const removed = oldFields.filter(f => !newMap.has(f.name));

  const changed = [];
  for (const [name, oldField] of oldMap) {
    const newField = newMap.get(name);
    if (!newField) continue;

    const changes = [];
    const allKeys = new Set([...Object.keys(oldField), ...Object.keys(newField)]);
    for (const key of allKeys) {
      if (key === 'name') continue;
      const oldVal = oldField[key];
      const newVal = newField[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ property: key, from: oldVal, to: newVal });
      }
    }
    if (changes.length > 0) {
      changed.push({ field: name, changes });
    }
  }

  return { added, removed, changed };
}

/**
 * Diff two entity maps. Each map is { entityName: { fields: [...] } }.
 * Returns { addedEntities, removedEntities, entityDiffs }.
 */
export function diffEntities(oldEntities, newEntities) {
  const oldNames = Object.keys(oldEntities);
  const newNames = Object.keys(newEntities);

  const addedEntities = newNames.filter(n => !oldNames.includes(n));
  const removedEntities = oldNames.filter(n => !newNames.includes(n));

  const entityDiffs = {};
  for (const name of oldNames) {
    if (!newEntities[name]) continue;
    const fieldDiff = diffFields(
      oldEntities[name].fields || [],
      newEntities[name].fields || []
    );
    if (fieldDiff.added.length || fieldDiff.removed.length || fieldDiff.changed.length) {
      entityDiffs[name] = fieldDiff;
    }
  }

  return { addedEntities, removedEntities, entityDiffs };
}

/**
 * Diff two endpoint arrays. Endpoints are compared by method+path.
 */
function diffEndpoints(oldEndpoints, newEndpoints) {
  const key = e => `${e.method}:${e.path}`;
  const oldKeys = new Set((oldEndpoints || []).map(key));
  const newKeys = new Set((newEndpoints || []).map(key));

  const added = (newEndpoints || []).filter(e => !oldKeys.has(key(e)));
  const removed = (oldEndpoints || []).filter(e => !newKeys.has(key(e)));

  return { added, removed };
}

/**
 * Diff two full contracts (frontend entities, backend entities, endpoints).
 * Returns null if identical.
 */
export function diffContract(oldContract, newContract) {
  const frontend = diffEntities(
    oldContract.frontendContract?.entities || {},
    newContract.frontendContract?.entities || {}
  );
  const backend = diffEntities(
    oldContract.backendContract?.entities || {},
    newContract.backendContract?.entities || {}
  );
  const endpoints = diffEndpoints(
    oldContract.backendContract?.endpoints || [],
    newContract.backendContract?.endpoints || []
  );

  const hasChanges =
    frontend.addedEntities.length > 0 ||
    frontend.removedEntities.length > 0 ||
    Object.keys(frontend.entityDiffs).length > 0 ||
    backend.addedEntities.length > 0 ||
    backend.removedEntities.length > 0 ||
    Object.keys(backend.entityDiffs).length > 0 ||
    endpoints.added.length > 0 ||
    endpoints.removed.length > 0;

  if (!hasChanges) return null;

  return { frontend, backend, endpointsAdded: endpoints.added, endpointsRemoved: endpoints.removed };
}

/**
 * Classify a property change as breaking, additive, or patch.
 */
function classifyProperty(property) {
  if (BREAKING_PROPERTIES.has(property)) return 'breaking';
  if (ADDITIVE_PROPERTIES.has(property)) return 'additive';
  if (PATCH_PROPERTIES.has(property)) return 'patch';
  // Unknown properties default to additive
  return 'additive';
}

/**
 * Classify a diff as 'breaking', 'additive', or 'patch'.
 * Highest severity wins when mixed.
 */
export function classifyChanges(diff) {
  const severityOrder = { breaking: 3, additive: 2, patch: 1 };
  let maxSeverity = 0;
  const reasons = [];

  // Check all entity sections (frontend + backend)
  for (const section of ['frontend', 'backend']) {
    const sectionDiff = diff[section];
    if (!sectionDiff) continue;

    // Removed entities = breaking
    for (const name of sectionDiff.removedEntities || []) {
      maxSeverity = Math.max(maxSeverity, severityOrder.breaking);
      reasons.push(`Entity "${name}" removed from ${section}`);
    }

    // Added entities = additive
    for (const name of sectionDiff.addedEntities || []) {
      maxSeverity = Math.max(maxSeverity, severityOrder.additive);
      reasons.push(`Entity "${name}" added to ${section}`);
    }

    // Field-level diffs
    for (const [entityName, fieldDiff] of Object.entries(sectionDiff.entityDiffs || {})) {
      maxSeverity = processFieldDifferences(fieldDiff, maxSeverity, severityOrder, reasons, entityName, section);
    }
  }

  // Endpoint changes
  for (const ep of diff.endpointsRemoved || []) {
    maxSeverity = Math.max(maxSeverity, severityOrder.breaking);
    reasons.push(`Endpoint ${ep.method} ${ep.path} removed`);
  }
  for (const ep of diff.endpointsAdded || []) {
    maxSeverity = Math.max(maxSeverity, severityOrder.additive);
    reasons.push(`Endpoint ${ep.method} ${ep.path} added`);
  }

  // Map severity back to level name
  const levelMap = { 3: 'breaking', 2: 'additive', 1: 'patch' };
  const level = levelMap[maxSeverity] || 'patch';

  return { level, reasons };
}

function processFieldDifferences(fieldDiff, maxSeverity, severityOrder, reasons, entityName, section) {
  for (const field of fieldDiff.removed || []) {
    maxSeverity = Math.max(maxSeverity, severityOrder.breaking);
    reasons.push(`Field "${field.name}" removed from entity "${entityName}" in ${section}`);
  }
  for (const field of fieldDiff.added || []) {
    maxSeverity = Math.max(maxSeverity, severityOrder.additive);
    reasons.push(`Field "${field.name}" added to entity "${entityName}" in ${section}`);
  }
  for (const change of fieldDiff.changed || []) {
    for (const prop of change.changes) {
      const level = classifyProperty(prop.property);
      maxSeverity = Math.max(maxSeverity, severityOrder[level]);
      reasons.push(`Field "${change.field}" property "${prop.property}" changed from "${prop.from}" to "${prop.to}" in ${section} (${level})`);
    }
  }
  return maxSeverity;
}

/**
 * Bump semver version based on change level.
 * - patch: increment patch
 * - additive: increment minor, reset patch
 * - breaking pre-1.0: increment minor (semver convention)
 * - breaking post-1.0: increment major
 */
export function bumpVersion(currentVersion, level) {
  const parts = currentVersion.split('.').map(Number);
  let [major, minor, patch] = parts;

  switch (level) {
    case 'patch':
      patch += 1;
      break;
    case 'additive':
      minor += 1;
      patch = 0;
      break;
    case 'breaking':
      if (major >= 1) {
        major += 1;
        minor = 0;
        patch = 0;
      } else {
        minor += 1;
        patch = 0;
      }
      break;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * Build a changelog entry object.
 */
export function buildChangelogEntry(fromVersion, toVersion, classification, author) {
  return {
    from: fromVersion,
    to: toVersion,
    level: classification.level,
    reasons: classification.reasons,
    author: author || 'system',
    date: new Date().toISOString().split('T')[0],
  };
}

/**
 * Main orchestrator: load contracts, diff, classify, bump, write.
 * Returns null if no prev contract exists or no changes detected.
 */
export async function checkVersion(windowName, author) {
  const artifactDir = join(ROOT, 'artifacts', windowName);

  // Load current contract
  let currentContract;
  try {
    const raw = await readFile(join(artifactDir, 'contract.json'), 'utf-8');
    currentContract = JSON.parse(raw);
  } catch {
    return null;
  }

  // Load previous contract
  let prevContract;
  try {
    const raw = await readFile(join(artifactDir, 'contract.prev.json'), 'utf-8');
    prevContract = JSON.parse(raw);
  } catch {
    return null;
  }

  // Diff
  const diff = diffContract(prevContract, currentContract);
  if (!diff) return null;

  // Classify
  const classification = classifyChanges(diff);

  // Bump version (base from previous contract)
  const oldVersion = prevContract.version || '0.1.0';
  const newVersion = bumpVersion(oldVersion, classification.level);

  // Update contract.json with new version
  currentContract.version = newVersion;
  await writeFile(
    join(artifactDir, 'contract.json'),
    JSON.stringify(currentContract, null, 2) + '\n'
  );

  // Build changelog entry
  const entry = buildChangelogEntry(oldVersion, newVersion, classification, author);

  // Load or create changelog
  let changelog = [];
  try {
    const raw = await readFile(join(artifactDir, 'contract-changelog.json'), 'utf-8');
    changelog = JSON.parse(raw);
  } catch {
    // No existing changelog
  }
  changelog.push(entry);
  await writeFile(
    join(artifactDir, 'contract-changelog.json'),
    JSON.stringify(changelog, null, 2) + '\n'
  );

  return {
    diff,
    classification,
    newVersion,
    changelog: entry,
  };
}

// CLI entry point
const isCLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCLI) {
  const windowName = process.argv[2];
  const author = process.argv[3] || 'system';

  if (!windowName) {
    console.error('Usage: node check-version.js <windowName> [author]');
    process.exit(1);
  }

  try {
    const result = await checkVersion(windowName, author);
    if (!result) {
      console.log('No changes detected (or no previous contract to compare).');
      process.exit(0);
    }

    console.log(`Change level: ${result.classification.level}`);
    console.log(`Version bump: ${result.changelog.from} -> ${result.newVersion}`);
    console.log('Reasons:');
    for (const reason of result.classification.reasons) {
      console.log(`  - ${reason}`);
    }

    if (result.classification.level === 'breaking') {
      process.exit(2);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
