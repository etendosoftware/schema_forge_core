# Contract Versioning & Window Lock System

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a contract versioning system with diff/classification/auto-bump, a window lock registry for team coordination, git hooks for local validation, and CI enforcement — enabling 10 developers to work safely on 49 windows in parallel.

**Architecture:** Four layered components: (1) `check-version.js` diffs contract.json files and classifies changes as breaking/additive/patch, auto-bumping semver per window; (2) `lock-window.js` manages exclusive window ownership via a committed JSON file; (3) a pre-push git hook validates locks and version bumps locally; (4) a GitHub Action enforces both on PRs. All follow existing CLI patterns (ESM, exported functions, `node:test`).

**Tech Stack:** Node.js 22 (ESM), `node:test` + `node:assert`, GitHub Actions, git hooks via `core.hooksPath`

---

## File Structure

```
cli/src/
  check-version.js       # Contract diff, classification, version bump, changelog
  lock-window.js         # Lock/unlock/status commands for window ownership

cli/test/
  check-version.test.js  # Tests for diff, classification, version bump logic
  lock-window.test.js    # Tests for lock/unlock/status logic

window-locks.json        # Root-level lock registry (committed to repo)

.githooks/
  pre-push               # Local validation hook (lock + version checks)

.github/workflows/
  lock-check.yml         # CI enforcement on PRs
```

**Existing files modified:**
- `artifacts/{window}/contract.json` — `version` field will be bumped from hardcoded `"0.1.0"` to real semver
- `package.json` — add `"prepare"` script for git hooks setup
- `cli/package.json` — add `bin` entries for new tools

---

## Chunk 1: check-version.js — Contract Diff Engine

### Task 1: Contract Diff — Core diffing functions

**Files:**
- Create: `cli/src/check-version.js`
- Create: `cli/test/check-version.test.js`

- [ ] **Step 1: Write failing tests for `diffFields`**

```javascript
// cli/test/check-version.test.js
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { diffFields } from '../src/check-version.js';

describe('diffFields', () => {
  it('detects added fields', () => {
    const oldFields = [
      { name: 'businessPartner', type: 'foreignKey', visibility: 'editable', required: true }
    ];
    const newFields = [
      { name: 'businessPartner', type: 'foreignKey', visibility: 'editable', required: true },
      { name: 'warehouse', type: 'foreignKey', visibility: 'editable', required: false }
    ];
    const diff = diffFields(oldFields, newFields);
    assert.equal(diff.added.length, 1);
    assert.equal(diff.added[0].name, 'warehouse');
    assert.equal(diff.removed.length, 0);
    assert.equal(diff.changed.length, 0);
  });

  it('detects removed fields', () => {
    const oldFields = [
      { name: 'businessPartner', type: 'foreignKey', visibility: 'editable', required: true },
      { name: 'warehouse', type: 'foreignKey', visibility: 'editable', required: false }
    ];
    const newFields = [
      { name: 'businessPartner', type: 'foreignKey', visibility: 'editable', required: true }
    ];
    const diff = diffFields(oldFields, newFields);
    assert.equal(diff.added.length, 0);
    assert.equal(diff.removed.length, 1);
    assert.equal(diff.removed[0].name, 'warehouse');
  });

  it('detects changed field properties', () => {
    const oldFields = [
      { name: 'amount', type: 'amount', visibility: 'editable', required: false }
    ];
    const newFields = [
      { name: 'amount', type: 'amount', visibility: 'readOnly', required: true }
    ];
    const diff = diffFields(oldFields, newFields);
    assert.equal(diff.changed.length, 1);
    assert.equal(diff.changed[0].field, 'amount');
    assert.deepEqual(diff.changed[0].changes, [
      { property: 'visibility', from: 'editable', to: 'readOnly' },
      { property: 'required', from: false, to: true }
    ]);
  });

  it('returns empty diff when contracts are identical', () => {
    const fields = [
      { name: 'businessPartner', type: 'foreignKey', visibility: 'editable', required: true }
    ];
    const diff = diffFields(fields, fields);
    assert.equal(diff.added.length, 0);
    assert.equal(diff.removed.length, 0);
    assert.equal(diff.changed.length, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/check-version.test.js`
Expected: FAIL — `diffFields` not found

- [ ] **Step 3: Implement `diffFields`**

```javascript
// cli/src/check-version.js
#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

// ============================================================================
// DIFF ENGINE
// ============================================================================

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/check-version.test.js`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/check-version.js cli/test/check-version.test.js
git commit -m "feat: add diffFields for contract field-level diffing"
```

---

### Task 2: Contract Diff — Entity and full contract diff

**Files:**
- Modify: `cli/src/check-version.js`
- Modify: `cli/test/check-version.test.js`

- [ ] **Step 1: Write failing tests for `diffEntities` and `diffContract`**

```javascript
// Append to cli/test/check-version.test.js
import { diffEntities, diffContract } from '../src/check-version.js';

describe('diffEntities', () => {
  it('detects added entity', () => {
    const oldEntities = {
      order: { fields: [{ name: 'id', type: 'id' }] }
    };
    const newEntities = {
      order: { fields: [{ name: 'id', type: 'id' }] },
      orderLine: { fields: [{ name: 'lineNo', type: 'number' }] }
    };
    const diff = diffEntities(oldEntities, newEntities);
    assert.deepEqual(diff.addedEntities, ['orderLine']);
    assert.deepEqual(diff.removedEntities, []);
  });

  it('detects removed entity', () => {
    const oldEntities = {
      order: { fields: [{ name: 'id', type: 'id' }] },
      orderLine: { fields: [{ name: 'lineNo', type: 'number' }] }
    };
    const newEntities = {
      order: { fields: [{ name: 'id', type: 'id' }] }
    };
    const diff = diffEntities(oldEntities, newEntities);
    assert.deepEqual(diff.addedEntities, []);
    assert.deepEqual(diff.removedEntities, ['orderLine']);
  });

  it('includes field diffs per entity', () => {
    const oldEntities = {
      order: { fields: [{ name: 'amount', type: 'amount', visibility: 'editable' }] }
    };
    const newEntities = {
      order: { fields: [{ name: 'amount', type: 'amount', visibility: 'readOnly' }] }
    };
    const diff = diffEntities(oldEntities, newEntities);
    assert.equal(diff.entityDiffs.order.changed.length, 1);
  });
});

describe('diffContract', () => {
  it('compares full contracts and returns structured diff', () => {
    const oldContract = {
      version: '0.1.0',
      frontendContract: {
        entities: {
          order: { fields: [{ name: 'bp', type: 'foreignKey', visibility: 'editable' }] }
        }
      },
      backendContract: {
        entities: {
          order: { fields: [{ name: 'bp', type: 'foreignKey', visibility: 'editable' }] }
        },
        endpoints: [{ method: 'GET', path: '/order' }]
      }
    };
    const newContract = {
      version: '0.1.0',
      frontendContract: {
        entities: {
          order: { fields: [
            { name: 'bp', type: 'foreignKey', visibility: 'editable' },
            { name: 'warehouse', type: 'foreignKey', visibility: 'editable' }
          ]}
        }
      },
      backendContract: {
        entities: {
          order: { fields: [
            { name: 'bp', type: 'foreignKey', visibility: 'editable' },
            { name: 'warehouse', type: 'foreignKey', visibility: 'editable' }
          ]}
        },
        endpoints: [{ method: 'GET', path: '/order' }, { method: 'POST', path: '/order' }]
      }
    };
    const diff = diffContract(oldContract, newContract);
    assert.ok(diff.frontend);
    assert.ok(diff.backend);
    assert.equal(diff.frontend.entityDiffs.order.added.length, 1);
    assert.equal(diff.endpointsAdded.length, 1);
    assert.equal(diff.endpointsRemoved.length, 0);
  });

  it('returns null when contracts are identical', () => {
    const contract = {
      version: '0.1.0',
      checksum: 'abc123',
      frontendContract: { entities: { order: { fields: [] } } },
      backendContract: { entities: { order: { fields: [] } }, endpoints: [] }
    };
    const diff = diffContract(contract, contract);
    assert.equal(diff, null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/check-version.test.js`
Expected: FAIL — `diffEntities`, `diffContract` not found

- [ ] **Step 3: Implement `diffEntities` and `diffContract`**

```javascript
// Add to cli/src/check-version.js

/**
 * Diff two entity maps. Returns { addedEntities, removedEntities, entityDiffs }.
 */
export function diffEntities(oldEntities, newEntities) {
  const oldNames = Object.keys(oldEntities);
  const newNames = Object.keys(newEntities);

  const addedEntities = newNames.filter(n => !oldEntities[n]);
  const removedEntities = oldNames.filter(n => !newEntities[n]);

  const entityDiffs = {};
  for (const name of oldNames) {
    if (!newEntities[name]) continue;
    const fd = diffFields(oldEntities[name].fields || [], newEntities[name].fields || []);
    if (fd.added.length || fd.removed.length || fd.changed.length) {
      entityDiffs[name] = fd;
    }
  }

  return { addedEntities, removedEntities, entityDiffs };
}

/**
 * Diff two full contracts. Returns null if identical.
 */
export function diffContract(oldContract, newContract) {
  const oldFE = oldContract.frontendContract?.entities || {};
  const newFE = newContract.frontendContract?.entities || {};
  const oldBE = oldContract.backendContract?.entities || {};
  const newBE = newContract.backendContract?.entities || {};

  const frontend = diffEntities(oldFE, newFE);
  const backend = diffEntities(oldBE, newBE);

  const oldEndpoints = oldContract.backendContract?.endpoints || [];
  const newEndpoints = newContract.backendContract?.endpoints || [];
  const oldEpKeys = new Set(oldEndpoints.map(e => `${e.method}:${e.path}`));
  const newEpKeys = new Set(newEndpoints.map(e => `${e.method}:${e.path}`));
  const endpointsAdded = newEndpoints.filter(e => !oldEpKeys.has(`${e.method}:${e.path}`));
  const endpointsRemoved = oldEndpoints.filter(e => !newEpKeys.has(`${e.method}:${e.path}`));

  const hasChanges =
    frontend.addedEntities.length > 0 ||
    frontend.removedEntities.length > 0 ||
    Object.keys(frontend.entityDiffs).length > 0 ||
    backend.addedEntities.length > 0 ||
    backend.removedEntities.length > 0 ||
    Object.keys(backend.entityDiffs).length > 0 ||
    endpointsAdded.length > 0 ||
    endpointsRemoved.length > 0;

  if (!hasChanges) return null;

  return { frontend, backend, endpointsAdded, endpointsRemoved };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/check-version.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/check-version.js cli/test/check-version.test.js
git commit -m "feat: add diffEntities and diffContract for full contract comparison"
```

---

### Task 3: Change Classification — Breaking vs Additive

**Files:**
- Modify: `cli/src/check-version.js`
- Modify: `cli/test/check-version.test.js`

- [ ] **Step 1: Write failing tests for `classifyChanges`**

```javascript
// Append to cli/test/check-version.test.js
import { classifyChanges } from '../src/check-version.js';

describe('classifyChanges', () => {
  it('classifies field removal as breaking', () => {
    const diff = {
      frontend: {
        addedEntities: [], removedEntities: [],
        entityDiffs: {
          order: { added: [], removed: [{ name: 'warehouse' }], changed: [] }
        }
      },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpointsAdded: [], endpointsRemoved: []
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
    assert.ok(result.reasons.some(r => r.includes('warehouse')));
  });

  it('classifies field addition as additive', () => {
    const diff = {
      frontend: {
        addedEntities: [], removedEntities: [],
        entityDiffs: {
          order: { added: [{ name: 'newField' }], removed: [], changed: [] }
        }
      },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpointsAdded: [], endpointsRemoved: []
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'additive');
  });

  it('classifies entity removal as breaking', () => {
    const diff = {
      frontend: { addedEntities: [], removedEntities: ['orderLine'], entityDiffs: {} },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpointsAdded: [], endpointsRemoved: []
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
  });

  it('classifies endpoint removal as breaking', () => {
    const diff = {
      frontend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpointsAdded: [],
      endpointsRemoved: [{ method: 'DELETE', path: '/order/:id' }]
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
  });

  it('classifies type change as breaking', () => {
    const diff = {
      frontend: {
        addedEntities: [], removedEntities: [],
        entityDiffs: {
          order: {
            added: [], removed: [],
            changed: [{ field: 'amount', changes: [{ property: 'type', from: 'string', to: 'number' }] }]
          }
        }
      },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpointsAdded: [], endpointsRemoved: []
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
  });

  it('classifies visibility change to readOnly as patch', () => {
    const diff = {
      frontend: {
        addedEntities: [], removedEntities: [],
        entityDiffs: {
          order: {
            added: [], removed: [],
            changed: [{ field: 'amount', changes: [{ property: 'grid', from: true, to: false }] }]
          }
        }
      },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpointsAdded: [], endpointsRemoved: []
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'patch');
  });

  it('highest severity wins when mixed changes', () => {
    const diff = {
      frontend: {
        addedEntities: [], removedEntities: [],
        entityDiffs: {
          order: {
            added: [{ name: 'newField' }],
            removed: [{ name: 'oldField' }],
            changed: []
          }
        }
      },
      backend: { addedEntities: [], removedEntities: [], entityDiffs: {} },
      endpointsAdded: [], endpointsRemoved: []
    };
    const result = classifyChanges(diff);
    assert.equal(result.level, 'breaking');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/check-version.test.js`
Expected: FAIL — `classifyChanges` not found

- [ ] **Step 3: Implement `classifyChanges`**

```javascript
// Add to cli/src/check-version.js

// Properties whose change is considered breaking (alters data shape)
const BREAKING_PROPERTIES = new Set(['type', 'tsType', 'name', 'column']);
// Properties whose change is additive (new capability)
const ADDITIVE_PROPERTIES = new Set(['reference', 'inputMode', 'dependsOn', 'required']);

/**
 * Classify a contract diff as 'breaking', 'additive', or 'patch'.
 * Returns { level, reasons }.
 *
 * Breaking: field/entity/endpoint removed, type changed, field renamed
 * Additive: field/entity/endpoint added, required changed
 * Patch: grid/form/visibility/searchable changes (UI-only)
 */
export function classifyChanges(diff) {
  const reasons = [];
  let level = 'patch';

  function escalate(newLevel, reason) {
    reasons.push(reason);
    if (newLevel === 'breaking') level = 'breaking';
    else if (newLevel === 'additive' && level !== 'breaking') level = 'additive';
  }

  for (const section of ['frontend', 'backend']) {
    const d = diff[section];

    for (const entity of d.removedEntities) {
      escalate('breaking', `${section}: entity '${entity}' removed`);
    }
    for (const entity of d.addedEntities) {
      escalate('additive', `${section}: entity '${entity}' added`);
    }

    for (const [entity, fd] of Object.entries(d.entityDiffs)) {
      for (const field of fd.removed) {
        escalate('breaking', `${section}.${entity}: field '${field.name}' removed`);
      }
      for (const field of fd.added) {
        escalate('additive', `${section}.${entity}: field '${field.name}' added`);
      }
      for (const change of fd.changed) {
        for (const c of change.changes) {
          if (BREAKING_PROPERTIES.has(c.property)) {
            escalate('breaking', `${section}.${entity}: field '${change.field}' property '${c.property}' changed from '${c.from}' to '${c.to}'`);
          } else if (ADDITIVE_PROPERTIES.has(c.property)) {
            escalate('additive', `${section}.${entity}: field '${change.field}' property '${c.property}' changed`);
          } else {
            escalate('patch', `${section}.${entity}: field '${change.field}' property '${c.property}' changed`);
          }
        }
      }
    }
  }

  for (const ep of diff.endpointsRemoved) {
    escalate('breaking', `endpoint removed: ${ep.method} ${ep.path}`);
  }
  for (const ep of diff.endpointsAdded) {
    escalate('additive', `endpoint added: ${ep.method} ${ep.path}`);
  }

  return { level, reasons };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/check-version.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/check-version.js cli/test/check-version.test.js
git commit -m "feat: add classifyChanges for breaking/additive/patch classification"
```

---

### Task 4: Version Bump & Changelog

**Files:**
- Modify: `cli/src/check-version.js`
- Modify: `cli/test/check-version.test.js`

- [ ] **Step 1: Write failing tests for `bumpVersion` and `buildChangelogEntry`**

```javascript
// Append to cli/test/check-version.test.js
import { bumpVersion, buildChangelogEntry } from '../src/check-version.js';

describe('bumpVersion', () => {
  it('bumps patch for patch-level changes', () => {
    assert.equal(bumpVersion('1.2.3', 'patch'), '1.2.4');
  });

  it('bumps minor for additive changes', () => {
    assert.equal(bumpVersion('1.2.3', 'additive'), '1.3.0');
  });

  it('bumps minor for breaking changes (pre-1.0)', () => {
    assert.equal(bumpVersion('0.1.0', 'breaking'), '0.2.0');
  });

  it('bumps major for breaking changes (post-1.0)', () => {
    assert.equal(bumpVersion('1.2.3', 'breaking'), '2.0.0');
  });
});

describe('buildChangelogEntry', () => {
  it('creates a changelog entry with all required fields', () => {
    const classification = {
      level: 'additive',
      reasons: ['frontend.order: field warehouse added']
    };
    const entry = buildChangelogEntry('0.1.0', '0.2.0', classification, 'sebastian');
    assert.equal(entry.from, '0.1.0');
    assert.equal(entry.to, '0.2.0');
    assert.equal(entry.level, 'additive');
    assert.equal(entry.author, 'sebastian');
    assert.ok(entry.date);
    assert.deepEqual(entry.reasons, ['frontend.order: field warehouse added']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/check-version.test.js`
Expected: FAIL — `bumpVersion`, `buildChangelogEntry` not found

- [ ] **Step 3: Implement `bumpVersion` and `buildChangelogEntry`**

```javascript
// Add to cli/src/check-version.js

/**
 * Bump semver based on change level.
 * Pre-1.0: breaking → minor, additive → minor, patch → patch
 * Post-1.0: breaking → major, additive → minor, patch → patch
 */
export function bumpVersion(currentVersion, level) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  if (level === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }
  if (level === 'additive') {
    return `${major}.${minor + 1}.0`;
  }
  // breaking
  if (major === 0) {
    return `${major}.${minor + 1}.0`;
  }
  return `${major + 1}.0.0`;
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
    author,
    date: new Date().toISOString().split('T')[0],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/check-version.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/check-version.js cli/test/check-version.test.js
git commit -m "feat: add bumpVersion and buildChangelogEntry for semver management"
```

---

### Task 5: CLI Entry Point — `main()` for check-version

**Files:**
- Modify: `cli/src/check-version.js`
- Modify: `cli/test/check-version.test.js`

- [ ] **Step 1: Write failing test for `checkVersion` (orchestrator)**

```javascript
// Append to cli/test/check-version.test.js
import { checkVersion } from '../src/check-version.js';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

describe('checkVersion (integration)', () => {
  const testDir = join(process.cwd(), 'artifacts', '_test-check-version');

  it('detects additive change and bumps version', async () => {
    await mkdir(testDir, { recursive: true });

    const oldContract = {
      version: '0.1.0',
      checksum: 'old123',
      frontendContract: {
        entities: {
          order: { fields: [{ name: 'bp', type: 'foreignKey', visibility: 'editable' }] }
        }
      },
      backendContract: {
        entities: {
          order: { fields: [{ name: 'bp', type: 'foreignKey', visibility: 'editable' }] }
        },
        endpoints: []
      }
    };
    const newContract = {
      ...oldContract,
      frontendContract: {
        entities: {
          order: { fields: [
            { name: 'bp', type: 'foreignKey', visibility: 'editable' },
            { name: 'warehouse', type: 'foreignKey', visibility: 'editable' }
          ]}
        }
      },
      backendContract: {
        entities: {
          order: { fields: [
            { name: 'bp', type: 'foreignKey', visibility: 'editable' },
            { name: 'warehouse', type: 'foreignKey', visibility: 'editable' }
          ]}
        },
        endpoints: []
      }
    };

    await writeFile(join(testDir, 'contract.prev.json'), JSON.stringify(oldContract, null, 2));
    await writeFile(join(testDir, 'contract.json'), JSON.stringify(newContract, null, 2));

    const result = await checkVersion('_test-check-version', 'test-author');
    assert.equal(result.classification.level, 'additive');
    assert.equal(result.newVersion, '0.2.0');
    assert.ok(result.changelog);

    await rm(testDir, { recursive: true, force: true });
  });

  it('returns null when no previous contract exists', async () => {
    await mkdir(testDir, { recursive: true });
    const contract = {
      version: '0.1.0',
      frontendContract: { entities: {} },
      backendContract: { entities: {}, endpoints: [] }
    };
    await writeFile(join(testDir, 'contract.json'), JSON.stringify(contract, null, 2));

    const result = await checkVersion('_test-check-version', 'test-author');
    assert.equal(result, null);

    await rm(testDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test cli/test/check-version.test.js`
Expected: FAIL — `checkVersion` not found

- [ ] **Step 3: Implement `checkVersion` and CLI entry point**

```javascript
// Add to cli/src/check-version.js

/**
 * Main orchestrator: load contracts, diff, classify, bump, write changelog.
 * Returns null if no previous contract exists.
 * Returns { diff, classification, newVersion, changelog } otherwise.
 */
export async function checkVersion(windowName, author) {
  const artifactDir = join(ROOT, 'artifacts', windowName);
  const contractPath = join(artifactDir, 'contract.json');
  const prevPath = join(artifactDir, 'contract.prev.json');
  const changelogPath = join(artifactDir, 'contract-changelog.json');

  let currentContract, prevContract;
  try {
    currentContract = JSON.parse(await readFile(contractPath, 'utf-8'));
  } catch {
    console.error(`No contract.json found for window "${windowName}"`);
    return null;
  }

  try {
    prevContract = JSON.parse(await readFile(prevPath, 'utf-8'));
  } catch {
    // No previous version — first time
    return null;
  }

  const diff = diffContract(prevContract, currentContract);
  if (!diff) {
    console.log(`No changes detected in "${windowName}" contract.`);
    return null;
  }

  const classification = classifyChanges(diff);
  const currentVersion = prevContract.version || '0.1.0';
  const newVersion = bumpVersion(currentVersion, classification.level);
  const changelog = buildChangelogEntry(currentVersion, newVersion, classification, author);

  // Update version in contract.json
  currentContract.version = newVersion;
  await writeFile(contractPath, JSON.stringify(currentContract, null, 2), 'utf-8');

  // Append to changelog
  let existingChangelog = [];
  try {
    existingChangelog = JSON.parse(await readFile(changelogPath, 'utf-8'));
  } catch {
    // No changelog yet
  }
  existingChangelog.push(changelog);
  await writeFile(changelogPath, JSON.stringify(existingChangelog, null, 2), 'utf-8');

  return { diff, classification, newVersion, changelog };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

const isCLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isCLI) {
  const windowName = process.argv[2];
  const author = process.argv[3] || 'unknown';

  if (!windowName) {
    console.error('Usage: node check-version.js <windowName> [author]');
    process.exit(1);
  }

  checkVersion(windowName, author)
    .then(result => {
      if (!result) {
        console.log('No version change needed.');
        process.exit(0);
      }

      console.log(`\n=== Contract Version Check: ${windowName} ===`);
      console.log(`Change level: ${result.classification.level.toUpperCase()}`);
      console.log(`Version: ${result.changelog.from} → ${result.newVersion}`);
      console.log(`\nReasons:`);
      for (const r of result.classification.reasons) {
        console.log(`  - ${r}`);
      }

      if (result.classification.level === 'breaking') {
        console.error('\n⚠ BREAKING CHANGE detected. Review required before merge.');
        process.exit(2);
      }
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test cli/test/check-version.test.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/src/check-version.js cli/test/check-version.test.js
git commit -m "feat: add checkVersion orchestrator with CLI entry point and changelog writing"
```

---

## Chunk 2: lock-window.js — Window Lock Registry

### Task 6: Lock/Unlock/Status — Core functions

**Files:**
- Create: `cli/src/lock-window.js`
- Create: `cli/test/lock-window.test.js`
- Create: `window-locks.json`

- [ ] **Step 1: Create initial empty lock registry**

```json
{}
```

Write this to `/window-locks.json` at the project root.

- [ ] **Step 2: Write failing tests for lock functions**

```javascript
// cli/test/lock-window.test.js
import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { lockWindow, unlockWindow, getLockStatus, validateLock } from '../src/lock-window.js';

describe('lockWindow', () => {
  let locks;

  beforeEach(() => {
    locks = {};
  });

  it('locks an unlocked window', () => {
    const result = lockWindow(locks, 'sales-order', {
      owner: 'sebastian',
      branch: 'feature/ETP-3510-sales-processes',
      reason: 'Adding process buttons'
    });
    assert.equal(result.success, true);
    assert.equal(result.locks['sales-order'].owner, 'sebastian');
    assert.ok(result.locks['sales-order'].since);
  });

  it('rejects locking an already-locked window by different owner', () => {
    locks['sales-order'] = {
      owner: 'pedro',
      branch: 'feature/ETP-3511',
      since: '2026-03-12',
      reason: 'Working on invoices'
    };
    const result = lockWindow(locks, 'sales-order', {
      owner: 'sebastian',
      branch: 'feature/ETP-3510',
      reason: 'Process buttons'
    });
    assert.equal(result.success, false);
    assert.ok(result.error.includes('pedro'));
  });

  it('allows same owner to re-lock (update reason)', () => {
    locks['sales-order'] = {
      owner: 'sebastian',
      branch: 'feature/ETP-3510',
      since: '2026-03-12',
      reason: 'Old reason'
    };
    const result = lockWindow(locks, 'sales-order', {
      owner: 'sebastian',
      branch: 'feature/ETP-3510',
      reason: 'Updated reason'
    });
    assert.equal(result.success, true);
    assert.equal(result.locks['sales-order'].reason, 'Updated reason');
  });
});

describe('unlockWindow', () => {
  it('unlocks a window owned by the requesting owner', () => {
    const locks = {
      'sales-order': { owner: 'sebastian', branch: 'feat', since: '2026-03-12', reason: 'test' }
    };
    const result = unlockWindow(locks, 'sales-order', 'sebastian');
    assert.equal(result.success, true);
    assert.equal(result.locks['sales-order'], undefined);
  });

  it('rejects unlock by different owner', () => {
    const locks = {
      'sales-order': { owner: 'pedro', branch: 'feat', since: '2026-03-12', reason: 'test' }
    };
    const result = unlockWindow(locks, 'sales-order', 'sebastian');
    assert.equal(result.success, false);
    assert.ok(result.error.includes('pedro'));
  });

  it('succeeds silently for already-unlocked window', () => {
    const locks = {};
    const result = unlockWindow(locks, 'sales-order', 'sebastian');
    assert.equal(result.success, true);
  });
});

describe('getLockStatus', () => {
  it('returns all locks with window names', () => {
    const locks = {
      'sales-order': { owner: 'sebastian', branch: 'feat', since: '2026-03-12', reason: 'test' },
      'product': { owner: 'pedro', branch: 'feat2', since: '2026-03-11', reason: 'test2' }
    };
    const status = getLockStatus(locks);
    assert.equal(status.length, 2);
    assert.equal(status[0].window, 'product');
    assert.equal(status[1].window, 'sales-order');
  });

  it('returns empty array when no locks', () => {
    const status = getLockStatus({});
    assert.equal(status.length, 0);
  });
});

describe('validateLock', () => {
  it('returns valid when owner has the lock', () => {
    const locks = {
      'sales-order': { owner: 'sebastian', branch: 'feat', since: '2026-03-12', reason: 'test' }
    };
    const result = validateLock(locks, 'sales-order', 'sebastian');
    assert.equal(result.valid, true);
  });

  it('returns invalid when different owner has the lock', () => {
    const locks = {
      'sales-order': { owner: 'pedro', branch: 'feat', since: '2026-03-12', reason: 'test' }
    };
    const result = validateLock(locks, 'sales-order', 'sebastian');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('pedro'));
  });

  it('returns invalid when window is not locked', () => {
    const result = validateLock({}, 'sales-order', 'sebastian');
    assert.equal(result.valid, false);
    assert.ok(result.error.includes('not locked'));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test cli/test/lock-window.test.js`
Expected: FAIL — functions not found

- [ ] **Step 4: Implement lock functions**

```javascript
// cli/src/lock-window.js
#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');
const LOCKS_PATH = join(ROOT, 'window-locks.json');

// ============================================================================
// CORE FUNCTIONS (pure, testable)
// ============================================================================

/**
 * Attempt to lock a window. Returns { success, locks, error? }.
 */
export function lockWindow(locks, windowName, { owner, branch, reason }) {
  const existing = locks[windowName];
  if (existing && existing.owner !== owner) {
    return {
      success: false,
      locks,
      error: `Window "${windowName}" is locked by ${existing.owner} since ${existing.since} (${existing.reason})`
    };
  }

  const updated = { ...locks };
  updated[windowName] = {
    owner,
    branch,
    since: new Date().toISOString().split('T')[0],
    reason,
  };
  return { success: true, locks: updated };
}

/**
 * Unlock a window. Only the owner can unlock.
 */
export function unlockWindow(locks, windowName, owner) {
  const existing = locks[windowName];
  if (!existing) return { success: true, locks };
  if (existing.owner !== owner) {
    return {
      success: false,
      locks,
      error: `Window "${windowName}" is locked by ${existing.owner} — only they can unlock it`
    };
  }

  const updated = { ...locks };
  delete updated[windowName];
  return { success: true, locks: updated };
}

/**
 * Get sorted list of current locks.
 */
export function getLockStatus(locks) {
  return Object.entries(locks)
    .map(([window, info]) => ({ window, ...info }))
    .sort((a, b) => a.window.localeCompare(b.window));
}

/**
 * Validate that a given owner has the lock for a window.
 */
export function validateLock(locks, windowName, owner) {
  const lock = locks[windowName];
  if (!lock) {
    return { valid: false, error: `Window "${windowName}" is not locked — lock it first with: lock-window.js lock --window ${windowName} --owner ${owner}` };
  }
  if (lock.owner !== owner) {
    return { valid: false, error: `Window "${windowName}" is locked by ${lock.owner}, not ${owner}` };
  }
  return { valid: true };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test cli/test/lock-window.test.js`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add cli/src/lock-window.js cli/test/lock-window.test.js window-locks.json
git commit -m "feat: add window lock registry with lock/unlock/status/validate"
```

---

### Task 7: Lock CLI Entry Point

**Files:**
- Modify: `cli/src/lock-window.js`

- [ ] **Step 1: Add CLI entry point with subcommands**

```javascript
// Add to bottom of cli/src/lock-window.js

// ============================================================================
// FILE I/O
// ============================================================================

async function loadLocks() {
  try {
    return JSON.parse(await readFile(LOCKS_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

async function saveLocks(locks) {
  await writeFile(LOCKS_PATH, JSON.stringify(locks, null, 2) + '\n', 'utf-8');
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

const isCLI = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isCLI) {
  const args = process.argv.slice(2);
  const command = args[0];

  function getFlag(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  }

  if (!command || command === 'help') {
    console.log(`Usage:
  lock-window.js lock   --window <name> --owner <name> [--branch <branch>] [--reason <reason>]
  lock-window.js unlock --window <name> --owner <name>
  lock-window.js status
  lock-window.js check  --window <name> --owner <name>
`);
    process.exit(0);
  }

  const locks = await loadLocks();

  if (command === 'status') {
    const status = getLockStatus(locks);
    if (status.length === 0) {
      console.log('No windows are currently locked.');
    } else {
      console.log(`\n${'Window'.padEnd(30)} ${'Owner'.padEnd(15)} ${'Since'.padEnd(12)} Reason`);
      console.log('-'.repeat(80));
      for (const s of status) {
        console.log(`${s.window.padEnd(30)} ${s.owner.padEnd(15)} ${s.since.padEnd(12)} ${s.reason}`);
      }
    }
    process.exit(0);
  }

  const windowName = getFlag('--window');
  const owner = getFlag('--owner');

  if (!windowName || !owner) {
    console.error('Error: --window and --owner are required');
    process.exit(1);
  }

  if (command === 'lock') {
    const branch = getFlag('--branch') || '';
    const reason = getFlag('--reason') || '';
    const result = lockWindow(locks, windowName, { owner, branch, reason });
    if (!result.success) {
      console.error(`LOCKED: ${result.error}`);
      process.exit(1);
    }
    await saveLocks(result.locks);
    console.log(`Locked "${windowName}" for ${owner}`);
    process.exit(0);
  }

  if (command === 'unlock') {
    const result = unlockWindow(locks, windowName, owner);
    if (!result.success) {
      console.error(`ERROR: ${result.error}`);
      process.exit(1);
    }
    await saveLocks(result.locks);
    console.log(`Unlocked "${windowName}"`);
    process.exit(0);
  }

  if (command === 'check') {
    const result = validateLock(locks, windowName, owner);
    if (!result.valid) {
      console.error(`INVALID: ${result.error}`);
      process.exit(1);
    }
    console.log(`OK: "${windowName}" is locked by ${owner}`);
    process.exit(0);
  }

  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
```

- [ ] **Step 2: Test CLI manually**

Run:
```bash
node cli/src/lock-window.js lock --window sales-order --owner sebastian --reason "Testing lock"
node cli/src/lock-window.js status
node cli/src/lock-window.js check --window sales-order --owner sebastian
node cli/src/lock-window.js unlock --window sales-order --owner sebastian
```

- [ ] **Step 3: Commit**

```bash
git add cli/src/lock-window.js
git commit -m "feat: add lock-window CLI with lock/unlock/status/check subcommands"
```

---

### Task 8: Add bin entries to cli/package.json

**Files:**
- Modify: `cli/package.json`

- [ ] **Step 1: Add bin entries for new tools**

Add to the `"bin"` section in `cli/package.json`:

```json
"sf-check-version": "./src/check-version.js",
"sf-lock": "./src/lock-window.js"
```

- [ ] **Step 2: Commit**

```bash
git add cli/package.json
git commit -m "chore: add bin entries for check-version and lock-window CLI tools"
```

---

## Chunk 3: Git Hooks & CI Enforcement

### Task 9: Pre-push Git Hook

**Files:**
- Create: `.githooks/pre-push`

- [ ] **Step 1: Create the pre-push hook**

```bash
#!/usr/bin/env bash
# .githooks/pre-push
# Validates window locks and contract version bumps before push.
# Skip with: git push --no-verify (CI is the final enforcer)

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
LOCKS_FILE="$ROOT/window-locks.json"

# Get the git user as owner identifier
OWNER=$(git config user.name 2>/dev/null || echo "unknown")

# Find which artifact windows are touched in commits being pushed
CHANGED_WINDOWS=()
while read -r local_ref local_oid remote_ref remote_oid; do
  if [ "$remote_oid" = "0000000000000000000000000000000000000000" ]; then
    # New branch — compare against merge-base with main
    BASE=$(git merge-base HEAD origin/main 2>/dev/null || echo "")
    if [ -z "$BASE" ]; then continue; fi
    RANGE="$BASE..HEAD"
  else
    RANGE="$remote_oid..$local_oid"
  fi

  # Find touched artifact windows
  for file in $(git diff --name-only "$RANGE" 2>/dev/null | grep '^artifacts/' || true); do
    window=$(echo "$file" | cut -d'/' -f2)
    if [ -n "$window" ]; then
      CHANGED_WINDOWS+=("$window")
    fi
  done
done

# Deduplicate
UNIQUE_WINDOWS=($(printf '%s\n' "${CHANGED_WINDOWS[@]}" 2>/dev/null | sort -u || true))

if [ ${#UNIQUE_WINDOWS[@]} -eq 0 ]; then
  exit 0
fi

# Check locks
if [ ! -f "$LOCKS_FILE" ]; then
  echo "WARNING: window-locks.json not found — skipping lock validation"
  exit 0
fi

ERRORS=0
for window in "${UNIQUE_WINDOWS[@]}"; do
  result=$(node "$ROOT/cli/src/lock-window.js" check --window "$window" --owner "$OWNER" 2>&1) || {
    echo "LOCK ERROR: $result"
    ERRORS=$((ERRORS + 1))
  }
done

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "Push rejected: $ERRORS window(s) not locked by you ($OWNER)."
  echo "Lock windows first: node cli/src/lock-window.js lock --window <name> --owner $OWNER"
  exit 1
fi

echo "Lock check passed for ${#UNIQUE_WINDOWS[@]} window(s): ${UNIQUE_WINDOWS[*]}"
```

- [ ] **Step 2: Make hook executable**

Run: `chmod +x .githooks/pre-push`

- [ ] **Step 3: Commit**

```bash
git add .githooks/pre-push
git commit -m "feat: add pre-push git hook for window lock validation"
```

---

### Task 10: Configure git hooks path in package.json

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Add prepare script**

Add to root `package.json` scripts:

```json
"prepare": "git config core.hooksPath .githooks"
```

- [ ] **Step 2: Run it to activate hooks locally**

Run: `npm run prepare`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: configure git hooks path via npm prepare script"
```

---

### Task 11: GitHub Actions CI Enforcement

**Files:**
- Create: `.github/workflows/lock-check.yml`

- [ ] **Step 1: Create the workflow**

```yaml
# .github/workflows/lock-check.yml
name: Window Lock & Version Check

on:
  pull_request:
    types: [opened, synchronize]
    paths:
      - 'artifacts/**'

jobs:
  lock-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Detect changed windows
        id: detect
        run: |
          BASE="${{ github.event.pull_request.base.sha }}"
          HEAD="${{ github.event.pull_request.head.sha }}"
          WINDOWS=$(git diff --name-only "$BASE" "$HEAD" | grep '^artifacts/' | cut -d'/' -f2 | sort -u | tr '\n' ' ')
          echo "windows=$WINDOWS" >> "$GITHUB_OUTPUT"
          echo "Changed windows: $WINDOWS"

      - name: Validate locks
        if: steps.detect.outputs.windows != ''
        run: |
          PR_AUTHOR="${{ github.event.pull_request.user.login }}"
          ERRORS=0
          for window in ${{ steps.detect.outputs.windows }}; do
            LOCK_OWNER=$(node -e "
              const locks = JSON.parse(require('fs').readFileSync('window-locks.json', 'utf-8'));
              const lock = locks['$window'];
              if (!lock) { console.log('UNLOCKED'); process.exit(1); }
              console.log(lock.owner);
            " 2>/dev/null) || {
              echo "::error::Window '$window' is not locked. Lock it before making changes."
              ERRORS=$((ERRORS + 1))
              continue
            }
            echo "Window '$window' locked by: $LOCK_OWNER (PR by: $PR_AUTHOR)"
          done

          if [ $ERRORS -gt 0 ]; then
            echo "::error::$ERRORS window(s) modified without a lock. See lock-window.js."
            exit 1
          fi

  version-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Detect changed contracts
        id: contracts
        run: |
          BASE="${{ github.event.pull_request.base.sha }}"
          HEAD="${{ github.event.pull_request.head.sha }}"
          WINDOWS=$(git diff --name-only "$BASE" "$HEAD" | grep 'artifacts/.*/contract\.json' | cut -d'/' -f2 | sort -u | tr '\n' ' ')
          echo "windows=$WINDOWS" >> "$GITHUB_OUTPUT"
          echo "Changed contracts: $WINDOWS"

      - name: Check version bumps
        if: steps.contracts.outputs.windows != ''
        run: |
          for window in ${{ steps.contracts.outputs.windows }}; do
            # Get old version from base
            OLD_VERSION=$(git show "${{ github.event.pull_request.base.sha }}:artifacts/$window/contract.json" 2>/dev/null | node -e "
              let data=''; process.stdin.on('data',c=>data+=c); process.stdin.on('end',()=>{
                try { console.log(JSON.parse(data).version || '0.0.0'); }
                catch { console.log('0.0.0'); }
              });
            ") || echo "0.0.0"

            # Get new version from HEAD
            NEW_VERSION=$(node -e "
              const c = JSON.parse(require('fs').readFileSync('artifacts/$window/contract.json','utf-8'));
              console.log(c.version || '0.0.0');
            ")

            echo "Window '$window': $OLD_VERSION → $NEW_VERSION"
            if [ "$OLD_VERSION" = "$NEW_VERSION" ]; then
              echo "::warning::Window '$window' contract changed but version was not bumped. Run: node cli/src/check-version.js $window"
            fi
          done
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/lock-check.yml
git commit -m "feat: add GitHub Actions workflow for window lock and version enforcement"
```

---

## Chunk 4: Integration & Snapshot Workflow

### Task 12: Snapshot on Generate — Save `contract.prev.json`

The version check needs a `contract.prev.json` to diff against. This snapshot must be saved **before** a new contract is generated.

**Files:**
- Modify: `cli/src/generate-contract.js` — add prev snapshot logic

- [ ] **Step 1: Read generate-contract.js to find where contract.json is written**

Read `cli/src/generate-contract.js` and find the `writeFile` call that saves `contract.json`.

- [ ] **Step 2: Add snapshot logic before the write**

Before the line that writes `contract.json`, add:

```javascript
// Snapshot current contract as prev for version diffing
try {
  const existingContract = await readFile(contractPath, 'utf-8');
  await writeFile(join(outDir, 'contract.prev.json'), existingContract, 'utf-8');
} catch {
  // No existing contract — first generation, no prev needed
}
```

This ensures that every time `generate-contract.js` runs, the current contract is saved as `.prev.json` before being overwritten.

- [ ] **Step 3: Commit**

```bash
git add cli/src/generate-contract.js
git commit -m "feat: snapshot contract.prev.json before regeneration for version diffing"
```

---

### Task 13: Pipeline Integration — Run check-version after generate-contract

**Files:**
- Modify: `cli/src/pipeline.js` — add check-version step after contract generation

- [ ] **Step 1: Read pipeline.js to understand the step sequence**

Read `cli/src/pipeline.js` and identify where `generate-contract` is called.

- [ ] **Step 2: Add check-version step after contract generation**

After the contract generation step, add:

```javascript
// Version check (after contract generation)
const { checkVersion } = await import('./check-version.js');
const versionResult = await checkVersion(windowName, author || 'pipeline');
if (versionResult) {
  console.log(`Version: ${versionResult.changelog.from} → ${versionResult.newVersion} (${versionResult.classification.level})`);
  if (versionResult.classification.level === 'breaking') {
    console.warn('WARNING: Breaking change detected. Review contract-changelog.json before proceeding.');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add cli/src/pipeline.js
git commit -m "feat: integrate check-version into pipeline after contract generation"
```

---

### Task 14: Run full test suite and verify

- [ ] **Step 1: Run all existing tests**

Run: `node --test 'cli/test/*.test.js'`
Expected: All tests PASS (including new check-version and lock-window tests)

- [ ] **Step 2: Manual integration test**

```bash
# Lock a window
node cli/src/lock-window.js lock --window sales-order --owner test-user --reason "Integration test"

# Check status
node cli/src/lock-window.js status

# Validate lock
node cli/src/lock-window.js check --window sales-order --owner test-user

# Unlock
node cli/src/lock-window.js unlock --window sales-order --owner test-user
```

- [ ] **Step 3: Clean up test locks**

```bash
node cli/src/lock-window.js unlock --window sales-order --owner test-user
```

- [ ] **Step 4: Final commit with all files**

```bash
git add -A
git commit -m "test: verify full integration of contract versioning and window locks"
```

---

## Summary

| # | Task | Component | Tests |
|---|------|-----------|-------|
| 1 | `diffFields` | check-version.js | 4 |
| 2 | `diffEntities` + `diffContract` | check-version.js | 4 |
| 3 | `classifyChanges` | check-version.js | 7 |
| 4 | `bumpVersion` + `buildChangelogEntry` | check-version.js | 6 |
| 5 | `checkVersion` orchestrator + CLI | check-version.js | 2 |
| 6 | `lockWindow` + `unlockWindow` + `validateLock` | lock-window.js | 8 |
| 7 | Lock CLI entry point | lock-window.js | manual |
| 8 | Package bin entries | cli/package.json | — |
| 9 | Pre-push hook | .githooks/pre-push | manual |
| 10 | Git hooks path config | package.json | — |
| 11 | CI workflow | lock-check.yml | CI |
| 12 | contract.prev.json snapshot | generate-contract.js | existing |
| 13 | Pipeline integration | pipeline.js | existing |
| 14 | Full integration test | all | all |

**Total new tests: ~31**
**Total tasks: 14**
**Estimated commits: 12**
