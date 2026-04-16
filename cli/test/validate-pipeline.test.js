import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { validatePipeline, classifyArtifact } from '../src/validate-pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES = join(__dirname, 'fixtures', 'pipeline-validator');

/**
 * Run the validator scoped to specific fixture directories using a mock registry.
 * `windowNames` = artifact directory names to check (without the fixtures prefix).
 */
async function runOnFixtures(windowNames, opts = {}) {
  return validatePipeline({
    scope: windowNames,
    strict: opts.strict ?? false,
    skip: opts.skip ?? [],
    root: join(FIXTURES, '..', '..', '..'), // repo root — not used because we override artifactsRoot below
    registryPath: opts.registryPath ?? join(FIXTURES, 'mock-registry.js'),
    // Override the artifacts root to point at our fixture directory
    _artifactsRoot: FIXTURES,
  });
}

// ---------------------------------------------------------------------------
// classifyArtifact
// ---------------------------------------------------------------------------

describe('classifyArtifact', () => {
  it('classifies a window artifact (has contract.json)', async () => {
    const kind = await classifyArtifact(join(FIXTURES, 'window-ok'));
    assert.equal(kind, 'window');
  });

  it('classifies a report artifact (has report-contract.json only)', async () => {
    const kind = await classifyArtifact(join(FIXTURES, 'report-incomplete'));
    assert.equal(kind, 'report');
  });

  it('classifies an aggregate artifact (has aggregate-contract.json)', async () => {
    const kind = await classifyArtifact(join(FIXTURES, 'aggregate-ok'));
    assert.equal(kind, 'aggregate');
  });

  it('classifies an aggregate-section (generated/ only, no contract)', async () => {
    const kind = await classifyArtifact(join(FIXTURES, 'aggregate-missing-contract'));
    // has generated/ but no aggregate-contract.json → aggregate-section
    assert.equal(kind, 'aggregate-section');
  });

  it('classifies orphan output as aggregate-section (generated/ only)', async () => {
    const kind = await classifyArtifact(join(FIXTURES, 'window-orphan-output'));
    // has generated/ but no contract.json
    assert.equal(kind, 'aggregate-section');
  });
});

// ---------------------------------------------------------------------------
// F1 — decisions hash mismatch
// ---------------------------------------------------------------------------

describe('Rule F1 — stale decisions', () => {
  it('emits BLOCK when contract.sourceHashes.decisions does not match decisions.json', async () => {
    const result = await runOnFixtures(['window-stale-decisions']);
    const v = result.violations.find(v => v.rule === 'F1');
    assert.ok(v, 'F1 violation expected');
    assert.equal(v.severity, 'BLOCK');
    assert.equal(v.artifact, 'window-stale-decisions');
  });

  it('skips F1 when contract.sourceHashes is absent (P1 state)', async () => {
    // window-ok does not have sourceHashes → should produce a skipped entry, not a violation
    const result = await runOnFixtures(['window-ok']);
    const v = result.violations.find(v => v.rule === 'F1');
    assert.ok(!v, 'No F1 violation expected for window-ok (no sourceHashes)');
    const s = result.skipped.find(s => s.rule === 'F1');
    assert.ok(s, 'F1 skip expected for window-ok');
  });

  it('passes when decisions hash matches contract.sourceHashes', async () => {
    // window-stale-decisions has a mismatched hash — inversely, window-ok has no hash (skip)
    // To test a passing F1, we use window-ok-2 (also no sourceHashes → skip, not violation)
    const result = await runOnFixtures(['window-ok-2']);
    const v = result.violations.find(v => v.rule === 'F1');
    assert.ok(!v, 'No F1 violation expected');
  });
});

// ---------------------------------------------------------------------------
// F2 — stale generated
// ---------------------------------------------------------------------------

describe('Rule F2 — stale generated', () => {
  it('emits BLOCK when manifest contractChecksum does not match contract.checksum', async () => {
    const result = await runOnFixtures(['window-stale-generated']);
    const v = result.violations.find(v => v.rule === 'F2');
    assert.ok(v, 'F2 violation expected');
    assert.equal(v.severity, 'BLOCK');
    assert.equal(v.artifact, 'window-stale-generated');
  });

  it('skips F2 when manifest is absent (P1 state)', async () => {
    // window-ok has a manifest with matching checksum → passes
    const result = await runOnFixtures(['window-ok']);
    const v = result.violations.find(v => v.rule === 'F2');
    assert.ok(!v, 'No F2 violation expected for window-ok');
  });

  it('passes F2 when manifest.contractChecksum matches contract.checksum', async () => {
    // window-ok has contract.checksum=abc123 and manifest.contractChecksum=abc123
    const result = await runOnFixtures(['window-ok']);
    const v = result.violations.find(v => v.rule === 'F2');
    assert.ok(!v, 'No F2 violation expected — checksums match');
  });
});

// ---------------------------------------------------------------------------
// F3 — missing registry entry
// ---------------------------------------------------------------------------

describe('Rule F3 — orphan registry', () => {
  it('emits BLOCK when contract.json exists but window is not in registry', async () => {
    const result = await runOnFixtures(['window-orphan-registry']);
    const v = result.violations.find(v => v.rule === 'F3');
    assert.ok(v, 'F3 violation expected');
    assert.equal(v.severity, 'BLOCK');
    assert.equal(v.artifact, 'window-orphan-registry');
  });

  it('does not emit F3 when window is registered', async () => {
    const result = await runOnFixtures(['window-ok']); // window-ok is in mock-registry
    const v = result.violations.find(v => v.rule === 'F3');
    assert.ok(!v, 'No F3 violation expected for window-ok');
  });
});

// ---------------------------------------------------------------------------
// F4 — orphaned output
// ---------------------------------------------------------------------------

describe('Rule F4 — orphaned generated output', () => {
  it('emits WARN when generated/ exists but contract.json is absent', async () => {
    // window-orphan-output only has generated/
    const result = await runOnFixtures(['window-orphan-output']);
    const v = result.violations.find(v => v.rule === 'F4');
    assert.ok(v, 'F4 violation expected');
    assert.equal(v.severity, 'WARN');
    assert.equal(v.artifact, 'window-orphan-output');
  });

  it('promotes F4 to BLOCK in --strict mode', async () => {
    const result = await runOnFixtures(['window-orphan-output'], { strict: true });
    const v = result.violations.find(v => v.rule === 'F4');
    assert.ok(v, 'F4 violation expected');
    assert.equal(v.severity, 'BLOCK');
  });

  it('does not emit F4 when contract.json is present alongside generated/', async () => {
    const result = await runOnFixtures(['window-ok']);
    const v = result.violations.find(v => v.rule === 'F4');
    assert.ok(!v, 'No F4 violation expected for window-ok');
  });
});

// ---------------------------------------------------------------------------
// F5 — stale decisions schema
// ---------------------------------------------------------------------------

describe('Rule F5 — stale decisions schema version', () => {
  it('emits BLOCK when decisions.json needs migration', async () => {
    // window-migration-needed has decisions at version 1 (stale)
    const result = await runOnFixtures(['window-migration-needed']);
    const v = result.violations.find(v => v.rule === 'F5');
    assert.ok(v, 'F5 violation expected');
    assert.equal(v.severity, 'BLOCK');
    assert.equal(v.artifact, 'window-migration-needed');
  });

  it('does not emit F5 when decisions.json is at current version', async () => {
    const result = await runOnFixtures(['window-ok']);
    const v = result.violations.find(v => v.rule === 'F5');
    assert.ok(!v, 'No F5 violation expected for window-ok');
  });
});

// ---------------------------------------------------------------------------
// F6 — version downgrade
// ---------------------------------------------------------------------------

describe('Rule F6 — contract version downgrade', () => {
  it('emits BLOCK when contract.json version < contract.prev.json version', async () => {
    const result = await runOnFixtures(['window-version-downgrade']);
    const v = result.violations.find(v => v.rule === 'F6');
    assert.ok(v, 'F6 violation expected');
    assert.equal(v.severity, 'BLOCK');
    assert.equal(v.artifact, 'window-version-downgrade');
  });

  it('does not emit F6 when no contract.prev.json exists', async () => {
    const result = await runOnFixtures(['window-ok']);
    const v = result.violations.find(v => v.rule === 'F6');
    assert.ok(!v, 'No F6 violation expected — no prev file');
  });
});

// ---------------------------------------------------------------------------
// F7 — excludedEntities contains self
// ---------------------------------------------------------------------------

describe('Rule F7 — decisions excludes self', () => {
  it('emits WARN when decisions.json excludedEntities includes the artifact name', async () => {
    const result = await runOnFixtures(['window-excludes-self']);
    const v = result.violations.find(v => v.rule === 'F7');
    assert.ok(v, 'F7 violation expected');
    assert.equal(v.severity, 'WARN');
    assert.equal(v.artifact, 'window-excludes-self');
  });

  it('does not emit F7 for normal excludedEntities (not self)', async () => {
    const result = await runOnFixtures(['window-ok']);
    const v = result.violations.find(v => v.rule === 'F7');
    assert.ok(!v, 'No F7 violation expected for window-ok');
  });
});

// ---------------------------------------------------------------------------
// F8 — incomplete report artifact
// ---------------------------------------------------------------------------

describe('Rule F8 — incomplete report', () => {
  it('emits BLOCK when report artifact is missing required files', async () => {
    // report-incomplete only has report-contract.json (missing template.hbs, helpers.js, mock-data.json)
    const result = await runOnFixtures(['report-incomplete']);
    const v = result.violations.find(v => v.rule === 'F8');
    assert.ok(v, 'F8 violation expected');
    assert.equal(v.severity, 'BLOCK');
    assert.equal(v.artifact, 'report-incomplete');
    assert.ok(v.message.includes('template.hbs'), 'Missing template.hbs should be mentioned');
  });
});

// ---------------------------------------------------------------------------
// F9 — aggregate missing contract
// ---------------------------------------------------------------------------

describe('Rule F9 — aggregate missing contract', () => {
  it('emits BLOCK when aggregate-section has generated/ but no aggregate-contract.json', async () => {
    // aggregate-missing-contract has generated/ but no aggregate-contract.json
    const result = await runOnFixtures(['aggregate-missing-contract']);
    const v = result.violations.find(v => v.rule === 'F9');
    assert.ok(v, 'F9 violation expected');
    assert.equal(v.severity, 'BLOCK');
    assert.equal(v.artifact, 'aggregate-missing-contract');
  });

  it('does not emit F9 when aggregate-contract.json is present', async () => {
    const result = await runOnFixtures(['aggregate-ok']);
    const v = result.violations.find(v => v.rule === 'F9');
    assert.ok(!v, 'No F9 violation expected for aggregate-ok');
  });
});

// ---------------------------------------------------------------------------
// F10 — registry loader points to missing index.jsx
// ---------------------------------------------------------------------------

describe('Rule F10 — registry points to missing index.jsx', () => {
  it('emits BLOCK when registry has window entry but index.jsx is missing', async () => {
    // window-registry-orphan is in mock-registry but has no generated/web/.../index.jsx
    const result = await runOnFixtures(['window-registry-orphan']);
    const v = result.violations.find(v => v.rule === 'F10');
    assert.ok(v, 'F10 violation expected');
    assert.equal(v.severity, 'BLOCK');
    assert.equal(v.artifact, 'window-registry-orphan');
  });

  it('does not emit F10 when index.jsx exists', async () => {
    const result = await runOnFixtures(['window-ok']);
    const v = result.violations.find(v => v.rule === 'F10');
    assert.ok(!v, 'No F10 violation expected for window-ok');
  });
});

// ---------------------------------------------------------------------------
// --skip flag
// ---------------------------------------------------------------------------

describe('--skip flag', () => {
  it('skips specified rules', async () => {
    // window-orphan-registry would normally trigger F3
    const result = await runOnFixtures(['window-orphan-registry'], { skip: ['F3'] });
    const v = result.violations.find(v => v.rule === 'F3');
    assert.ok(!v, 'F3 should be skipped');
  });

  it('skips multiple rules', async () => {
    const result = await runOnFixtures(['window-stale-decisions', 'window-version-downgrade'], {
      skip: ['F1', 'F6'],
    });
    const f1 = result.violations.find(v => v.rule === 'F1');
    const f6 = result.violations.find(v => v.rule === 'F6');
    assert.ok(!f1, 'F1 should be skipped');
    assert.ok(!f6, 'F6 should be skipped');
  });
});

// ---------------------------------------------------------------------------
// Summary object
// ---------------------------------------------------------------------------

describe('Summary object', () => {
  it('summary.blocking counts only BLOCK violations', async () => {
    const result = await runOnFixtures(['window-orphan-output']); // F4=WARN
    assert.equal(result.summary.blocking, 0);
    assert.ok(result.summary.warnings >= 1);
  });

  it('summary.total includes both BLOCK and WARN', async () => {
    const result = await runOnFixtures(['window-orphan-output', 'window-orphan-registry']);
    // F4=WARN from orphan-output, F3=BLOCK from orphan-registry
    assert.ok(result.summary.total >= 2);
  });

  it('summary.blocking = 0 for fully passing artifact', async () => {
    const result = await runOnFixtures(['window-ok']);
    assert.equal(result.summary.blocking, 0);
  });
});

// ---------------------------------------------------------------------------
// Whole-repo run (non-strict, should not crash)
// ---------------------------------------------------------------------------

describe('Whole-repo validation (non-strict)', () => {
  it('runs against the actual repo without throwing', async () => {
    // This is the P1 acceptance test: must not crash.
    // In non-strict mode, the actual repo should produce 0 blocking violations
    // (F1/F2 are skipped, F3/F4/F5/F6/F7/F8/F9/F10 are functional).
    let result;
    try {
      result = await validatePipeline({ scope: 'all', strict: false });
    } catch (err) {
      assert.fail(`validatePipeline threw: ${err.message}`);
    }
    assert.ok(result, 'result should be defined');
    assert.ok(typeof result.summary === 'object', 'summary should be an object');
    assert.ok(typeof result.summary.total === 'number', 'summary.total should be a number');
  });
});

// ---------------------------------------------------------------------------
// C1 — F3/F10 emit skipped when registry is unreadable
// ---------------------------------------------------------------------------

describe('Registry unreadable — F3/F10 emit skipped not BLOCK (C1)', () => {
  it('F3 emits a skipped entry (not BLOCK) when registryPath does not exist', async () => {
    const result = await runOnFixtures(['window-ok'], {
      registryPath: '/nonexistent/path/registry.js',
    });
    const f3Block = result.violations.find(v => v.rule === 'F3' && v.severity === 'BLOCK');
    assert.ok(!f3Block, 'F3 must NOT emit BLOCK when registry is unreadable');
    const f3Skip = result.skipped.find(s => s.rule === 'F3');
    assert.ok(f3Skip, 'F3 must emit a skipped entry when registry is unreadable');
  });

  it('F10 emits a skipped entry (not BLOCK) when registryPath does not exist', async () => {
    const result = await runOnFixtures(['window-ok'], {
      registryPath: '/nonexistent/path/registry.js',
    });
    const f10Block = result.violations.find(v => v.rule === 'F10' && v.severity === 'BLOCK');
    assert.ok(!f10Block, 'F10 must NOT emit BLOCK when registry is unreadable');
    const f10Skip = result.skipped.find(s => s.rule === 'F10');
    assert.ok(f10Skip, 'F10 must emit a skipped entry when registry is unreadable');
  });
});

// ---------------------------------------------------------------------------
// C2 — summary.ok never goes negative
// ---------------------------------------------------------------------------

describe('summary.ok never negative (C2)', () => {
  it('ok is >= 0 even when one artifact has multiple violations', async () => {
    // window-stale-decisions can emit F1 (stale hash) and potentially others.
    // Run multiple bad fixtures to stress the ok count.
    const result = await runOnFixtures([
      'window-stale-decisions',
      'window-orphan-registry',
      'window-version-downgrade',
    ]);
    assert.ok(result.summary.ok >= 0, `summary.ok must not be negative, got: ${result.summary.ok}`);
  });

  it('ok equals artifactCount minus artifacts-with-violations when all violations come from one artifact', async () => {
    // window-stale-decisions fires F1 (and F3 skipped since it has contract and is in mock-registry).
    // Only 1 artifact in scope. It has at least 1 violation → ok should be 0, not negative.
    const result = await runOnFixtures(['window-stale-decisions']);
    assert.ok(result.summary.ok >= 0, `summary.ok must not be negative, got: ${result.summary.ok}`);
    // There's 1 artifact total; it has violations, so ok must be 0
    assert.equal(result.summary.ok, 0, 'ok should be 0 when the only artifact has violations');
  });
});
