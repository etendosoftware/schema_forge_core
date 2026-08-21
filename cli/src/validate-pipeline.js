#!/usr/bin/env node
/**
 * validate-pipeline.js
 *
 * Pipeline completeness validator. Detects incomplete pipeline runs by checking
 * git-tracked artifact files for consistency across the pipeline stages.
 *
 * Failure modes are defined in docs/pipeline-validator-reference.md.
 *
 * Usage:
 *   node cli/src/validate-pipeline.js [--scope=name1,name2] [--staged] [--changed-since=<ref>] [--strict] [--format=text|json] [--skip=F4,F7]
 *
 * Exit codes:
 *   0 = clean (no violations, or only warnings)
 *   1 = blocking violations present
 */

import { readFile, readdir, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { needsMigration } from './migrations/index.js';
import { collectSourceFiles, isJavaScriptModule, parseModuleSource, walkAst } from './quality-gate/checks/shared.js';
import {
  canonicalizeMethod,
  NEO_READ_METHODS,
  resolveContractEntityMethods,
  resolveEntityHideDelete,
  resolveEntityMethods,
} from './lib/entity-methods.js';
import { parseEtgoXmlFile } from './lib/etgo-xml-parser.js';
import { visibilityMatchesFlags } from './lib/field-visibility.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');

// Artifact dirs that are intentionally custom-only: they have decisions.json
// but no contract pipeline (no contract.json, report-contract.json, etc.).
// These are fully hand-written custom windows — skipping them is correct.
const CUSTOM_ONLY_ARTIFACTS = new Set([
  'fiscal-config',
  'fiscal-monitor',
  'financial-account',
  'not-posted-documents',
]);

// Backend-only artifacts: they run the contract + push-to-neo pipeline (so they have a
// contract.json) to expose a NEO W spec for selectors / inline create, but they have NO
// frontend window — no AD menu, no route, no registry entry, no generated/ output. The
// registry checks (F3, F10) must not fire for these.
const BACKEND_ONLY_ARTIFACTS = new Set([
  'transaction-type',
]);

// ---------------------------------------------------------------------------
// Artifact classifier
// ---------------------------------------------------------------------------

/**
 * Classify an artifact directory into one of four kinds:
 *   'window'            - has contract.json (and optionally decisions.json + generated/)
 *   'report'            - has report-contract.json
 *   'aggregate'         - has aggregate-contract.json (full aggregate with contract)
 *   'aggregate-section' - has generated/ only (section folder, no contract — whitelisted)
 *   'unknown'           - none of the above signals present
 *
 * @param {string} artifactDir - absolute path to the artifact directory
 * @returns {Promise<'window'|'report'|'aggregate'|'aggregate-section'|'unknown'>}
 */
export async function classifyArtifact(artifactDir) {
  const [hasAggregate, hasReport, hasContract, hasGenerated] = await Promise.all([
    fileExists(join(artifactDir, 'aggregate-contract.json')),
    fileExists(join(artifactDir, 'report-contract.json')),
    fileExists(join(artifactDir, 'contract.json')),
    dirExists(join(artifactDir, 'generated')),
  ]);

  if (hasAggregate) return 'aggregate';
  if (hasReport) return 'report';
  if (hasContract) return 'window';
  if (hasGenerated) return 'aggregate-section';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

async function fileExists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function dirExists(p) {
  try {
    await readdir(p);
    return true;
  } catch { return false; }
}

async function readJSON(p) {
  const raw = await readFile(p, 'utf-8');
  return JSON.parse(raw);
}

async function readJSONIfExists(p) {
  if (!(await fileExists(p))) return null;
  return readJSON(p);
}

async function readWindowContractBundle(artifactDir) {
  const contract = await readJSON(join(artifactDir, 'contract.json'));
  const mcp = await readJSONIfExists(join(artifactDir, 'contract.mcp.json'));
  if (!mcp) return contract;
  return {
    ...contract,
    apiPrediction: mcp.apiPrediction ?? contract.apiPrediction,
    formState: mcp.formState,
    agentProfile: mcp.agentProfile,
  };
}

/**
 * Compute SHA-256 hash of a file's raw bytes, returned as a hex string.
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function sha256File(filePath) {
  const raw = await readFile(filePath);
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Build a violation entry.
 */
function violation(rule, artifact, severity, message, fix, extra = {}) {
  return { rule, artifact, kind: extra.kind ?? 'violation', severity, message, fix, ...extra };
}

/**
 * Build a skipped entry (rule cannot be evaluated — expected in P1).
 */
function skipped(rule, artifact, message) {
  return { rule, artifact, kind: 'skipped', severity: 'SKIP', message, fix: null };
}

// ---------------------------------------------------------------------------
// Rule implementations
// ---------------------------------------------------------------------------

/**
 * F1: decisions.json modified but contract.json not re-generated.
 * Detection: hash(decisions.json) !== contract.sourceHashes.decisions
 * Skipped if contract.sourceHashes is absent (P1 — not yet embedded by generator).
 */
async function ruleF1(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  const decisionsPath = join(artifactDir, 'decisions.json');

  const [hasDecisions, hasContract] = await Promise.all([
    fileExists(decisionsPath),
    fileExists(contractPath),
  ]);

  if (!hasDecisions || !hasContract) return null; // nothing to check

  const contract = await readJSON(contractPath);

  if (!contract.sourceHashes || !contract.sourceHashes.decisions) {
    return skipped('F1', artifactName, 'contract.sourceHashes.decisions not present — will be enforced after P2 generator patch');
  }

  const actualHash = await sha256File(decisionsPath);
  if (actualHash !== contract.sourceHashes.decisions) {
    return violation(
      'F1', artifactName, 'BLOCK',
      `decisions.json has changed but contract.json was not regenerated (hash mismatch)`,
      'Re-run the pipeline to regenerate contract.json from the current decisions.json',
    );
  }
  return null;
}

/**
 * F2: contract.json modified but generated/ not regenerated.
 * Detection: contract.checksum !== generated/.manifest.json.contractChecksum
 * Skipped if generated/.manifest.json is absent (P1 — not yet emitted by generator).
 */
async function ruleF2(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  const manifestPath = join(artifactDir, 'generated', '.manifest.json');

  const [hasContract, hasManifest] = await Promise.all([
    fileExists(contractPath),
    fileExists(manifestPath),
  ]);

  if (!hasContract) return null;

  if (!hasManifest) {
    // Only emit skipped if generated/ exists (otherwise there's nothing to check)
    const hasGenerated = await dirExists(join(artifactDir, 'generated'));
    if (!hasGenerated) return null;
    return skipped('F2', artifactName, 'generated/.manifest.json not present — will be enforced after P2 generator patch');
  }

  const [contract, manifest] = await Promise.all([
    readJSON(contractPath),
    readJSON(manifestPath),
  ]);

  if (contract.checksum && manifest.contractChecksum && contract.checksum !== manifest.contractChecksum) {
    return violation(
      'F2', artifactName, 'BLOCK',
      `contract.json has changed but generated/ was not regenerated (checksum mismatch: contract=${contract.checksum}, manifest=${manifest.contractChecksum})`,
      'Re-run the pipeline to regenerate the frontend from the current contract.json',
    );
  }
  return null;
}

/**
 * F3: New window has contract.json but no entry in registry.js.
 * The caller passes registryContent (raw text of registry.js), or null if unreadable.
 */
async function ruleF3(artifactDir, artifactName, registryContent) {
  if (BACKEND_ONLY_ARTIFACTS.has(artifactName)) {
    return skipped('F3', artifactName, 'backend-only artifact (NEO spec, no frontend window) — F3 not applicable');
  }
  if (registryContent === null) {
    return skipped('F3', artifactName, 'registry.js could not be read — F3 check skipped');
  }

  const contractPath = join(artifactDir, 'contract.json');
  if (!(await fileExists(contractPath))) return null;

  // Check both windowLoaders and customLoaders sections
  const isInRegistry = registryContent.includes(`'${artifactName}'`);
  if (!isInRegistry) {
    return violation(
      'F3', artifactName, 'BLOCK',
      `Window has contract.json but '${artifactName}' is not registered in registry.js`,
      `Add an entry for '${artifactName}' to windowLoaders or customLoaders in tools/app-shell/src/windows/registry.js`,
    );
  }
  return null;
}

/**
 * F4: generated/ exists but contract.json is missing (orphaned output).
 */
async function ruleF4(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  const generatedDir = join(artifactDir, 'generated');

  const [hasContract, hasGenerated] = await Promise.all([
    fileExists(contractPath),
    dirExists(generatedDir),
  ]);

  if (hasGenerated && !hasContract) {
    return violation(
      'F4', artifactName, 'WARN',
      `generated/ folder exists but contract.json is missing (orphaned output)`,
      `Either delete the generated/ folder or regenerate the full pipeline for '${artifactName}'`,
    );
  }
  return null;
}

/**
 * F5: decisions.json schema/version is stale (auto-migration would change it).
 */
async function ruleF5(artifactDir, artifactName) {
  const decisionsPath = join(artifactDir, 'decisions.json');
  if (!(await fileExists(decisionsPath))) return null;

  const decisions = await readJSON(decisionsPath);

  if (needsMigration(decisions)) {
    return violation(
      'F5', artifactName, 'BLOCK',
      `decisions.json schema version is stale and needs migration`,
      `Run: node cli/src/pipeline.js --menu-name "${artifactName}" to auto-migrate decisions.json`,
    );
  }
  return null;
}

/**
 * F6: contract.version in repo is below contract.prev.json version (downgrade).
 */
async function ruleF6(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  const prevPath = join(artifactDir, 'contract.prev.json');

  const [hasCurrent, hasPrev] = await Promise.all([
    fileExists(contractPath),
    fileExists(prevPath),
  ]);

  if (!hasCurrent || !hasPrev) return null;

  const [current, prev] = await Promise.all([
    readJSON(contractPath),
    readJSON(prevPath),
  ]);

  const currentVersion = current.version;
  const prevVersion = prev.version;

  if (!currentVersion || !prevVersion) return null;

  if (compareSemver(currentVersion, prevVersion) < 0) {
    return violation(
      'F6', artifactName, 'BLOCK',
      `contract.json version ${currentVersion} is lower than previous version ${prevVersion} (downgrade detected)`,
      `Investigate why the version went backwards. Re-run the pipeline from a correct state, then delete contract.prev.json if needed.`,
    );
  }
  return null;
}

/**
 * Simple semver comparison. Returns -1, 0, or 1.
 */
function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }
  return 0;
}

function contractVersionAtLeast(contract, version) {
  return compareSemver(contract?.version ?? '0.0.0', version) >= 0;
}

/**
 * F7: Window has decisions.json but the artifact name is listed in excludedEntities.
 */
async function ruleF7(artifactDir, artifactName) {
  const decisionsPath = join(artifactDir, 'decisions.json');
  if (!(await fileExists(decisionsPath))) return null;

  const decisions = await readJSON(decisionsPath);
  const excluded = decisions.excludedEntities;

  if (Array.isArray(excluded) && excluded.includes(artifactName)) {
    return violation(
      'F7', artifactName, 'WARN',
      `decisions.json lists '${artifactName}' in excludedEntities (window excludes itself — likely a copy-paste typo)`,
      `Remove '${artifactName}' from excludedEntities in decisions.json`,
    );
  }
  return null;
}

/**
 * F8: Report artifact missing required files.
 * Required: report-contract.json, template.hbs, helpers.js, mock-data.json
 * Triggered only if at least one of the four files is present.
 */
async function ruleF8(artifactDir, artifactName) {
  const required = ['report-contract.json', 'template.hbs', 'helpers.js', 'mock-data.json'];
  const presence = await Promise.all(required.map(f => fileExists(join(artifactDir, f))));
  const presentFiles = required.filter((_, i) => presence[i]);
  const missingFiles = required.filter((_, i) => !presence[i]);

  // Only check if at least one is present (indicates intent to be a report artifact)
  if (presentFiles.length === 0) return null;
  if (missingFiles.length === 0) return null;

  return violation(
    'F8', artifactName, 'BLOCK',
    `Report artifact is incomplete. Missing: ${missingFiles.join(', ')}`,
    `Add the missing report files: ${missingFiles.join(', ')}`,
  );
}

/**
 * F9: Aggregate artifact has generated/ but is missing aggregate-contract.json.
 * Only fires when there is no decisions.json (which would indicate a window artifact
 * that lost its contract.json — that case is handled by F4).
 */
async function ruleF9(artifactDir, artifactName) {
  const aggregatePath = join(artifactDir, 'aggregate-contract.json');
  const generatedDir = join(artifactDir, 'generated');
  const decisionsPath = join(artifactDir, 'decisions.json');

  const [hasAggregate, hasGenerated, hasDecisions] = await Promise.all([
    fileExists(aggregatePath),
    dirExists(generatedDir),
    fileExists(decisionsPath),
  ]);

  // If decisions.json is present, this looks like a window artifact (handled by F4)
  if (hasDecisions) return null;

  if (hasGenerated && !hasAggregate) {
    return violation(
      'F9', artifactName, 'BLOCK',
      `Aggregate artifact has generated/ but is missing aggregate-contract.json`,
      `Run the aggregate pipeline to generate aggregate-contract.json for '${artifactName}'`,
    );
  }
  return null;
}

/**
 * F10: registry.js has loader for a window but artifacts/<window>/generated/web/<window>/index.jsx is missing.
 * @param {string} artifactDir - absolute path to the artifact directory
 * @param {string} artifactName
 * @param {string|null} registryContent - raw text of registry.js, or null if unreadable
 * @param {string} repoRoot - repo root (for resolving custom window paths)
 */
async function ruleF10(artifactDir, artifactName, registryContent, repoRoot = ROOT) {
  if (registryContent === null) {
    return skipped('F10', artifactName, 'registry.js could not be read — F10 check skipped');
  }
  if (!registryContent.includes(`'${artifactName}'`)) return null; // not in registry, skip

  const indexPath = join(artifactDir, 'generated', 'web', artifactName, 'index.jsx');
  // Also check the custom path (custom loaders)
  const customIndexPath = join(repoRoot, 'tools', 'app-shell', 'src', 'windows', 'custom', artifactName, 'index.jsx');

  const [hasIndex, hasCustomIndex] = await Promise.all([
    fileExists(indexPath),
    fileExists(customIndexPath),
  ]);

  if (!hasIndex && !hasCustomIndex) {
    return violation(
      'F10', artifactName, 'BLOCK',
      `registry.js has loader for '${artifactName}' but generated/web/${artifactName}/index.jsx is missing`,
      `Re-run the frontend generator for '${artifactName}' or remove the registry entry if the window is deprecated`,
    );
  }
  return null;
}

/**
 * Canonical row-quick-action keys that never need to be validated against the menu/process
 * list — they always have built-in handlers (Edit/Duplicate/Email/Delete).
 */
const ROW_QUICK_ACTION_CANONICAL_KEYS = new Set(['edit', 'duplicate', 'email', 'delete']);

/**
 * F11: `window.rowQuickActions.actions.<key>` references a process key that does NOT exist
 * in the window's `menuActions` / `processOverrides` declaration.
 *
 * Canonical keys (edit/duplicate/email/delete) are always valid and never reported.
 * Detection runs on the raw `decisions.json` (no contract needed) so it works even before
 * the contract has been regenerated.
 *
 * @param {string} artifactDir
 * @param {string} artifactName
 * @returns {Promise<object|null>}
 */
function collectAllowedActionKeys(win) {
  const allowed = new Set();
  for (const a of (Array.isArray(win.menuActions) ? win.menuActions : [])) {
    if (a && typeof a.key === 'string') allowed.add(a.key);
  }
  if (win.processOverrides && typeof win.processOverrides === 'object') {
    for (const k of Object.keys(win.processOverrides)) allowed.add(k);
  }
  return allowed;
}

async function ruleF11(artifactDir, artifactName) {
  const decisionsPath = join(artifactDir, 'decisions.json');
  if (!(await fileExists(decisionsPath))) return null;

  const decisions = await readJSON(decisionsPath);
  const win = decisions.window;
  const rqa = win?.rowQuickActions;
  if (!rqa || typeof rqa !== 'object') return null;
  const actions = rqa.actions;
  if (!actions || typeof actions !== 'object') return null;

  const allowed = collectAllowedActionKeys(win);

  // A `show: false` entry is also pointless if the key doesn't exist, so we still flag it —
  // the user almost certainly meant a real process and made a typo.
  const offenders = Object.keys(actions).filter(
    key => !ROW_QUICK_ACTION_CANONICAL_KEYS.has(key) && !allowed.has(key),
  );

  if (offenders.length === 0) return null;

  return violation(
    'F11', artifactName, 'BLOCK',
    `rowQuickActions.actions references unknown process key(s): ${offenders.join(', ')}. Allowed: canonical (edit, duplicate, email, delete) or any key declared in window.menuActions / window.processOverrides`,
    `Remove the unknown key(s) from rowQuickActions.actions, or add the corresponding entry to window.menuActions / window.processOverrides in decisions.json`,
  );
}

const VALID_LINES_LAYOUTS = ['classic', 'inlineEditable'];

/**
 * F12: window.linesLayout in decisions.json must be one of the supported values.
 * @param {string} artifactDir - absolute path to the artifact directory
 * @param {string} artifactName
 */
async function ruleF12(artifactDir, artifactName) {
  const decisionsPath = join(artifactDir, 'decisions.json');
  if (!(await fileExists(decisionsPath))) return null;
  let decisions;
  try {
    decisions = JSON.parse(await readFile(decisionsPath, 'utf8'));
  } catch {
    return skipped('F12', artifactName, 'decisions.json could not be parsed — F12 check skipped');
  }
  const value = decisions?.window?.linesLayout;
  if (value === undefined || value === null) return null;
  if (!VALID_LINES_LAYOUTS.includes(value)) {
    return violation(
      'F12', artifactName, 'BLOCK',
      `window.linesLayout = '${value}' is not a supported value`,
      `Set decisions.json window.linesLayout to one of: ${VALID_LINES_LAYOUTS.join(', ')}`,
    );
  }
  return null;
}

/**
 * F13: Window contract is missing apiPrediction.actions with edge cases (ETP-3956).
 * Every action in apiPrediction must have at least 3 edge cases.
 */
async function ruleF13(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  if (!(await fileExists(contractPath))) return null;
  let contract;
  try {
    contract = await readWindowContractBundle(artifactDir);
  } catch {
    return skipped('F13', artifactName, 'contract.json or contract.mcp.json could not be parsed');
  }

  // Only enforce on contracts generated with action classification (v0.7.0+)
  if (!contractVersionAtLeast(contract, '0.7.0')) return null;

  const actions = contract?.apiPrediction?.actions ?? [];
  for (const action of actions) {
    if (!Array.isArray(action.edgeCases) || action.edgeCases.length < 3) {
      return violation(
        'F13', artifactName, 'BLOCK',
        `Action '${action.name || action.field}' has fewer than 3 edge cases (${action.edgeCases?.length ?? 0})`,
        `Every process/action must declare at least 3 edge cases. Update the action classification in generate-contract.js or add curated overrides.`,
      );
    }
  }
  return null;
}

/**
 * F14: Window contract is missing formState section (ETP-3957).
 * Contracts for windows with editable fields must include formState metadata.
 */
async function ruleF14(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  if (!(await fileExists(contractPath))) return null;
  let contract;
  try {
    contract = await readWindowContractBundle(artifactDir);
  } catch {
    return skipped('F14', artifactName, 'contract.json or contract.mcp.json could not be parsed');
  }

  if (!contractVersionAtLeast(contract, '0.7.0')) return null;

  if (!contract.formState) {
    return violation(
      'F14', artifactName, 'BLOCK',
      `MCP contract is missing formState section`,
      `Re-run the contract generator to include formState metadata in contract.mcp.json for agent form fidelity.`,
    );
  }
  return null;
}

/**
 * F15: Window contract is missing agentProfile section (ETP-3958).
 * Contracts must include agentProfile for agent planning.
 */
async function ruleF15(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  if (!(await fileExists(contractPath))) return null;
  let contract;
  try {
    contract = await readWindowContractBundle(artifactDir);
  } catch {
    return skipped('F15', artifactName, 'contract.json or contract.mcp.json could not be parsed');
  }

  if (!contractVersionAtLeast(contract, '0.7.0')) return null;

  if (!contract.agentProfile) {
    return violation(
      'F15', artifactName, 'BLOCK',
      `MCP contract is missing agentProfile section`,
      `Re-run the contract generator to include agentProfile metadata in contract.mcp.json for agent planning.`,
    );
  }

  const profile = contract.agentProfile;
  const formStateFields = collectFormStateFieldsByScope(contract);
  const missingHeaderField = findMissingReference(
    profile.minimumCreate?.headerFields ?? [],
    formStateFields.header,
  );
  if (missingHeaderField) return agentProfileFieldViolation(artifactName, missingHeaderField, 'headerFields');

  const missingLineField = findMissingReference(
    profile.minimumCreate?.lineFields ?? [],
    formStateFields.line,
  );
  if (missingLineField) return agentProfileFieldViolation(artifactName, missingLineField, 'lineFields');

  const missingSelector = findMissingReference(
    (profile.selectorContexts ?? []).map(selectorContextReference).filter(Boolean),
    collectSelectorReferences(contract),
  );
  if (missingSelector) return agentProfileSelectorViolation(artifactName, missingSelector);

  const missingAction = findMissingReference(
    profile.actions ?? [],
    new Set((contract.apiPrediction?.actions ?? []).map(action => action.name)),
  );
  if (missingAction) return agentProfileActionViolation(artifactName, missingAction);

  return null;
}

function collectFormStateFieldsByScope(contract) {
  const header = new Set();
  const line = new Set();
  for (const [entityName, entity] of Object.entries(contract.formState?.entities ?? {})) {
    const target = isHeaderEntity(contract, entityName) ? header : line;
    for (const field of Object.keys(entity.fields ?? {})) {
      target.add(field);
    }
  }
  return { header, line };
}

function isHeaderEntity(contract, entityName) {
  if (entityName === 'header') return true;
  const frontendEntity = contract.frontendContract?.entities?.[entityName];
  if (frontendEntity?.level) return frontendEntity.level === 'header';
  return contract.frontendContract?.window?.primaryEntity === entityName;
}

function findMissingReference(references, knownReferences) {
  return references.find(reference => !knownReferences.has(reference));
}

function collectSelectorReferences(contract) {
  return new Set((contract.apiPrediction?.selectors ?? [])
    .map(selectorContextReference)
    .filter(Boolean));
}

function selectorContextReference(selector) {
  if (typeof selector === 'string') return selector;
  if (!selector?.field) return null;
  return selector.entity ? `${selector.entity}.${selector.field}` : selector.field;
}

function agentProfileFieldViolation(artifactName, field, scope) {
  return violation(
    'F15', artifactName, 'BLOCK',
    `agentProfile.minimumCreate.${scope} references non-existent field '${field}' in that scope`,
    `Fix the agentProfile generator or curated profile to reference only existing formState fields for the same header/line scope.`,
  );
}

function agentProfileSelectorViolation(artifactName, selector) {
  return violation(
    'F15', artifactName, 'BLOCK',
    `agentProfile.selectorContexts references non-existent selector '${selector}'`,
    `Fix the agentProfile generator or curated profile to reference only existing selectors with the same entity and field.`,
  );
}

function agentProfileActionViolation(artifactName, action) {
  return violation(
    'F15', artifactName, 'BLOCK',
    `agentProfile.actions references non-existent action '${action}'`,
    `Fix the agentProfile generator or curated profile to reference only existing actions.`,
  );
}

/**
 * F16: No manual edits detected under generated directories (ETP-3959).
 * Checks that generated files still match the deterministic frontend generator
 * output for the committed contract bundle.
 */
async function ruleF16(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  const generatedDir = join(artifactDir, 'generated');

  if (!(await fileExists(contractPath))) return null;
  if (!(await dirExists(generatedDir))) return null;

  let expectedFiles;
  try {
    const contract = await readJSON(contractPath);
    if (!contract.frontendContract) return null;
    const { generateAll } = await import('./generate-frontend.js');
    expectedFiles = generateAll(contract);
  } catch {
    return skipped('F16', artifactName, 'generated frontend output could not be reproduced');
  }

  const webDir = join(generatedDir, 'web', artifactName);
  for (const [filename, expectedContent] of Object.entries(expectedFiles)) {
    const filePath = join(webDir, filename);
    if (!(await fileExists(filePath))) continue;
    const actualContent = await readFile(filePath, 'utf-8');
    if (actualContent !== expectedContent) {
      return violation(
        'F16', artifactName, 'BLOCK',
        `Generated file ${filePath.replace(artifactDir, '')} differs from generator output`,
        `Never manually edit artifacts/*/generated/. Fix the generator (generate-frontend.js, resolve-curated.js) and regenerate instead.`,
      );
    }
  }
  return null;
}

/**
 * F17: window.balanceFooter must reference real amount fields on the lines entity.
 * Guards the double-entry balance footer wiring (ETP-4244).
 */
async function ruleF17(artifactDir, artifactName) {
  const decisionsPath = join(artifactDir, 'decisions.json');
  if (!(await fileExists(decisionsPath))) return null;
  let decisions;
  try {
    decisions = JSON.parse(await readFile(decisionsPath, 'utf8'));
  } catch {
    return skipped('F17', artifactName, 'decisions.json could not be parsed — F17 check skipped');
  }
  const bf = decisions?.window?.balanceFooter;
  if (!bf) return null;
  if (!bf.debitField || !bf.creditField) {
    return violation('F17', artifactName, 'BLOCK',
      'window.balanceFooter requires both debitField and creditField',
      'Set decisions.json window.balanceFooter to { debitField, creditField }.');
  }
  const contractPath = join(artifactDir, 'contract.json');
  if (!(await fileExists(contractPath))) return skipped('F17', artifactName, 'contract.json not found — F17 check skipped');
  let contract;
  try {
    contract = JSON.parse(await readFile(contractPath, 'utf8'));
  } catch {
    return skipped('F17', artifactName, 'contract.json could not be parsed — F17 check skipped');
  }
  const lineFields = collectFrontendLineFields(contract);
  for (const field of [bf.debitField, bf.creditField]) {
    if (!lineFields.has(field)) {
      return violation('F17', artifactName, 'BLOCK',
        `window.balanceFooter references line field '${field}' which does not exist on the lines entity`,
        `Use line-entity field names that exist in the contract for window.balanceFooter (check frontendContract.entities.<lineEntity>.fields[].name).`);
    }
  }
  return null;
}

/**
 * F22: window.customTabsAfterBottom renders custom tabs in a strip below
 * bottomSection, entirely outside buildInitialTabs' sorted tab list (ETP-4415).
 * A tabOrder declared on a custom tab in that mode is a silent no-op.
 */
async function ruleF22(artifactDir, artifactName) {
  const decisionsPath = join(artifactDir, 'decisions.json');
  if (!(await fileExists(decisionsPath))) return null;
  let decisions;
  try {
    decisions = JSON.parse(await readFile(decisionsPath, 'utf8'));
  } catch {
    return skipped('F22', artifactName, 'decisions.json could not be parsed — F22 check skipped');
  }
  const win = decisions?.window;
  if (!win?.customTabsAfterBottom) return null;
  const offendingKeys = [];
  for (const pt of win.customPanelTabs ?? []) {
    if (pt.tabOrder != null) offendingKeys.push(`customPanelTabs.${pt.key}`);
  }
  for (const et of win.extraTabs ?? []) {
    if (et.tabOrder != null) offendingKeys.push(`extraTabs.${et.key}`);
  }
  if (typeof win.attachments === 'object' && win.attachments?.tabOrder != null) {
    offendingKeys.push('attachments');
  }
  if (offendingKeys.length === 0) return null;
  return violation('F22', artifactName, 'BLOCK',
    `window.customTabsAfterBottom is true, so tabOrder on ${offendingKeys.join(', ')} has no effect — those tabs render in a separate strip below bottomSection, outside the sorted tab list.`,
    'Remove window.customTabsAfterBottom, or remove tabOrder from the listed custom tab(s).');
}

// ─── F23 — ETGO_SF_FIELD visibility vs the flags it projects to ─────────────
// ETP-4793 / IMP-26 §5.3. `populateSpec` writes ISINCLUDED/ISREADONLY on every
// push but VISIBILITY only on some paths, so the same decision — stored twice
// on purpose, because neo_schema needs the curated word and the runtime needs
// the booleans — can drift apart silently. This rule reads the exported
// sourcedata and re-runs the projection over it.

/**
 * Resolve the com.etendoerp.go sourcedata directory holding the exported
 * ETGO_SF_*.xml files. Mirrors `resolveDefaultPrevXmlDir` in push-to-neo.js.
 *
 * @param {string} root - schema_forge repo root
 * @returns {string}
 */
function resolveGoSourcedataDir(root) {
  if (process.env.SF_GO_SOURCEDATA_DIR) return process.env.SF_GO_SOURCEDATA_DIR;
  const etendoRoot = process.env.ETENDO_ROOT || join(root, '..');
  return join(etendoRoot, 'modules', 'com.etendoerp.go', 'src-db', 'database', 'sourcedata');
}

// One 8 MB XML parse per process, not per artifact. Keyed by directory so a
// test pointing at a fixture never reads the cached production snapshot.
const f23SnapshotCache = new Map();

/**
 * Parse the three sourcedata XMLs and index the field rows by spec name.
 *
 * Returns `null` — not an empty index — when the directory is absent, so the
 * caller can tell "no .go checkout here" apart from "checkout present, spec has
 * no rows".
 *
 * @param {string} sourcedataDir
 * @returns {Promise<Map<string, Array<object>>|null>} spec name → field rows
 */
async function loadF23FieldsBySpec(sourcedataDir) {
  if (f23SnapshotCache.has(sourcedataDir)) return f23SnapshotCache.get(sourcedataDir);
  const pending = (async () => {
    const paths = {
      spec: join(sourcedataDir, 'ETGO_SF_SPEC.xml'),
      entity: join(sourcedataDir, 'ETGO_SF_ENTITY.xml'),
      field: join(sourcedataDir, 'ETGO_SF_FIELD.xml'),
    };
    const present = await Promise.all(Object.values(paths).map(fileExists));
    if (present.some(ok => !ok)) return null;

    const [specs, entities, fields] = await Promise.all([
      parseEtgoXmlFile(paths.spec, 'ETGO_SF_SPEC').then(r => r.rows),
      parseEtgoXmlFile(paths.entity, 'ETGO_SF_ENTITY').then(r => r.rows),
      parseEtgoXmlFile(paths.field, 'ETGO_SF_FIELD').then(r => r.rows),
    ]);

    const specNameById = new Map(specs.map(s => [s.ETGO_SF_SPEC_ID, s.NAME]));
    const entityById = new Map(entities.map(e => [e.ETGO_SF_ENTITY_ID, e]));

    const bySpec = new Map();
    for (const row of fields) {
      if (row.ISACTIVE === 'N') continue; // retired config, not a live surface
      const entity = entityById.get(row.ETGO_SF_ENTITY_ID);
      const specName = entity && specNameById.get(entity.ETGO_SF_SPEC_ID);
      if (!specName) continue; // orphan row — F23 is not the rule that owns that
      if (!bySpec.has(specName)) bySpec.set(specName, []);
      bySpec.get(specName).push({ row, entityName: entity.NAME });
    }
    return bySpec;
  })();
  f23SnapshotCache.set(sourcedataDir, pending);
  return pending;
}

/**
 * Human-readable identity for one offending field row.
 *
 * `JAVA_QUALIFIER` is only written when the curated key differs from the AD
 * column name, so `AD_COLUMN_ID` is the usual identity. Some pushed rows carry
 * neither — ETP-4793 found 105 field rows in the live export with no
 * AD_COLUMN_ID, JAVA_QUALIFIER or SEQNO at all, just the two flags. Those are
 * degenerate rows pointing at no AD column; label them by primary key and say
 * so, because "entity.undefined" tells the reader nothing.
 */
function f23FieldLabel({ row, entityName }) {
  const entity = entityName || '?';
  const name = row.JAVA_QUALIFIER || row.AD_COLUMN_ID;
  if (name) return `${entity}.${name}`;
  return `${entity}.<no AD_COLUMN_ID, field ${row.ETGO_SF_FIELD_ID}>`;
}

/**
 * F23: a pushed `ETGO_SF_FIELD` row whose `VISIBILITY` does not project to its
 * stored `ISINCLUDED`/`ISREADONLY` pair.
 *
 * Two failure modes, deliberately scored differently:
 *   - BLOCK `contradiction` — VISIBILITY holds a curated value that projects to
 *     a different pair than the one stored. Only a writer bug or a hand-edit
 *     gets you here, and it means the runtime and `neo_schema` disagree about
 *     the same field.
 *   - WARN `unwritten` — VISIBILITY is absent while the flags say the field is
 *     included. Harmless to the runtime, but `neo_schema` reports no visibility
 *     for that field, so an agent cannot tell `readOnly` from `system`.
 *     Pre-existing backfill debt; a warning so it is counted, not so it blocks.
 *
 * Inert (returns null) without a com.etendoerp.go checkout — the exported XML is
 * the only DB-free view of pushed state, and this repo can be used alone.
 *
 * @param {string} artifactDir
 * @param {string} artifactName - artifact dir name === spec name
 * @param {string} [sourcedataDir]
 * @param {string} [root]
 * @returns {Promise<object|null>}
 */
async function ruleF23(artifactDir, artifactName, sourcedataDir, root = ROOT) {
  const dir = sourcedataDir ?? resolveGoSourcedataDir(root);
  const bySpec = await loadF23FieldsBySpec(dir);
  if (bySpec === null) return null; // no runtime-module checkout — nothing to read
  const rows = bySpec.get(artifactName);
  if (!rows || rows.length === 0) return null; // never pushed, or a different spec name

  const contradictions = [];
  const unwritten = [];
  for (const entry of rows) {
    const verdict = visibilityMatchesFlags({
      visibility: entry.row.VISIBILITY,
      isIncluded: entry.row.ISINCLUDED,
      isReadOnly: entry.row.ISREADONLY,
    });
    if (verdict.ok) continue;
    (verdict.kind === 'contradiction' ? contradictions : unwritten).push({ entry, verdict });
  }

  if (contradictions.length > 0) {
    const shown = contradictions.slice(0, 3).map(({ entry, verdict }) => (
      `${f23FieldLabel(entry)} (visibility='${entry.row.VISIBILITY}' projects to `
      + `ISINCLUDED=${verdict.expected.isIncluded}/ISREADONLY=${verdict.expected.isReadOnly}, `
      + `stored ${entry.row.ISINCLUDED}/${entry.row.ISREADONLY})`
    ));
    const more = contradictions.length > shown.length ? ` (+${contradictions.length - shown.length} more)` : '';
    return violation(
      'F23', artifactName, 'BLOCK',
      `${contradictions.length} pushed ETGO_SF_FIELD row(s) store a VISIBILITY that contradicts their `
      + `ISINCLUDED/ISREADONLY flags: ${shown.join('; ')}${more}. The runtime enforces the flags while `
      + `neo_schema reports the visibility, so the two now describe the field differently.`,
      `Re-push the window (make regen ONLY=${artifactName} PUSH_TO_NEO=1) and re-run `
      + `./gradlew export.database in Etendo root. If the drift survives a clean push, the writer is `
      + `at fault — fix cli/src/neo-writer.js populateSpec, not the XML.`,
      { f23Contradictions: contradictions.length, f23Unwritten: unwritten.length },
    );
  }

  if (unwritten.length > 0) {
    const shown = unwritten.slice(0, 3).map(({ entry }) => f23FieldLabel(entry));
    const more = unwritten.length > shown.length ? ` (+${unwritten.length - shown.length} more)` : '';
    return violation(
      'F23', artifactName, 'WARN',
      `${unwritten.length} pushed ETGO_SF_FIELD row(s) are included (ISINCLUDED=Y) but carry no `
      + `VISIBILITY value: ${shown.join(', ')}${more}. neo_schema reports these fields with no `
      + `visibility, so an agent cannot distinguish readOnly from system.`,
      `Re-push the window (make regen ONLY=${artifactName} PUSH_TO_NEO=1) then `
      + `./gradlew export.database — populateSpec writes VISIBILITY on the fields it revisits.`,
      { f23Contradictions: 0, f23Unwritten: unwritten.length },
    );
  }

  return null;
}

/**
 * Collect the field names declared on the line (non-header / detail) entity of
 * the frontend contract. Real generated contracts populate
 * frontendContract.entities.<entity>.fields[].name — contract.formState is
 * never emitted, so balanceFooter validation must read from here.
 */
function collectFrontendLineFields(contract) {
  const entities = contract.frontendContract?.entities ?? {};
  const win = contract.frontendContract?.window ?? {};
  const primaryEntity = win.primaryEntity;
  const entityNames = Object.keys(entities);
  const detailEntity = 'detailEntity' in win
    ? win.detailEntity
    : entityNames.find(name => name !== primaryEntity);
  if (!detailEntity) return new Set();
  const fields = new Set();
  for (const field of entities[detailEntity]?.fields ?? []) {
    if (field?.name) fields.add(field.name);
  }
  return fields;
}

/**
 * F19: Hand-written custom table/field columns carry a local `required` flag
 * that must be manually kept in sync with the real `required` value in that
 * window's contract.json. This drifts silently whenever a field's required-ness
 * changes upstream (or a column is copy-pasted from another field) and nobody
 * updates the hardcoded copy (ETP-4609 follow-up).
 *
 * Coverage (three source locations per window, ETP-4609 follow-up round 2):
 *   1. tools/app-shell/src/windows/custom/<artifactName>/ — hand-built windows.
 *   2. artifacts/<artifactName>/custom/ — the "pipeline convention" location
 *      (sales-order, sales-invoice, purchase-order, ...); the generated
 *      HeaderPage imports from here via resolveCustomImport(), and it is the
 *      file that actually renders at runtime even when a decoy array with the
 *      same shape sits in the hand-built windows/custom/<name>/ tree.
 *   3. tools/app-shell/src/windows/custom/shared/ — components shared by more
 *      than one window (e.g. PaymentHeaderTableBase.jsx used by both
 *      payment-in and payment-out via thin prop-passing wrappers). This
 *      directory is not keyed to a single window, so it is only pulled in for
 *      a given window when one of that window's own files (#1 or #2 above)
 *      actually imports it — traced one hop: parse the wrapper's `import`
 *      statements, resolve `@/...` and relative specifiers, and if the
 *      resolved path lands inside .../windows/custom/shared/, include that
 *      file's column entries in this window's check. This correctly
 *      attributes shared/PaymentHeaderTableBase.jsx to payment-in when
 *      checking payment-in, and to payment-out when checking payment-out,
 *      without trying to understand the dir/specName runtime branching.
 *   Known limitation (by design, not a bug): only one import hop is traced,
 *   and only `@/...` and relative (`./`, `../`) specifiers are resolved —
 *   re-exports (a shared file that itself re-exports columns from another
 *   file) and non-`@/` aliases (e.g. `@generated/...`) are not followed.
 *
 * Detection: parse every non-test .js/.jsx file collected above with
 * @babel/parser, walk the AST for array literals that look like column/field
 * descriptors (at least one element is an object with both a string `key` and
 * a string `column` property — the signature shared by every known custom
 * table/panel in the codebase, regardless of variable name or how deep the
 * array literal is nested, e.g. inside a useMemo). For each element whose
 * `key` matches a contract field `name` (searched across all frontendContract
 * entities), compare the locally declared `required` (absent = false) against
 * the contract field's `required`. A statically undeterminable local value
 * (e.g. `...(cond ? { required: true } : {})`) is skipped rather than guessed.
 *
 * Suppression: some local `required` values are intentionally divergent (e.g.
 * they guard an inline-add-row save, unrelated to any AdvancedFilterBuilder).
 * `(artifact, key)` pairs listed in the F19 allowlist file (see
 * `loadF19Allowlist`) are evaluated but never reported as violations.
 *
 * Only fires for windows that actually have a custom override in location #1
 * or #2 — windows relying purely on the generated table are correct by
 * construction and skipped.
 */
async function ruleF19(artifactDir, artifactName, root = ROOT, allowlist = []) {
  const contractPath = join(artifactDir, 'contract.json');
  if (!(await fileExists(contractPath))) return null;

  const primaryFiles = collectF19PrimaryFiles(artifactDir, artifactName, root);
  if (primaryFiles.length === 0) return null; // no custom override anywhere — nothing to check

  let contract;
  try {
    contract = await readJSON(contractPath);
  } catch {
    return skipped('F19', artifactName, 'contract.json could not be parsed — F19 check skipped');
  }

  const fieldIndex = collectContractFieldIndex(contract);
  if (fieldIndex.size === 0) return null;

  const parsedCache = new Map(); // filePath -> ast | null
  const sharedFiles = await collectF19SharedFiles(primaryFiles, root, parsedCache);
  const allFiles = [...primaryFiles, ...sharedFiles];

  for (const filePath of allFiles) {
    const ast = await parseF19File(filePath, parsedCache);
    if (!ast) continue;

    const fileViolation = findF19RequiredMismatch(filePath, ast, fieldIndex, artifactName, allowlist, root);
    if (fileViolation) return fileViolation;
  }
  return null;
}

/**
 * Parse a single custom file's source into an AST, caching the result (including
 * parse failures, cached as `null`) so repeated lookups across the primary-files
 * pass and the shared-files pass do not re-read/re-parse the same file. A single
 * unparsable custom file must not fail the whole rule, so parse errors resolve to
 * `null` rather than throwing.
 */
async function parseF19File(filePath, parsedCache) {
  if (parsedCache.has(filePath)) return parsedCache.get(filePath);
  let ast = null;
  try {
    const source = await readFile(filePath, 'utf-8');
    ast = parseModuleSource(source, filePath);
  } catch {
    ast = null;
  }
  parsedCache.set(filePath, ast);
  return ast;
}

/**
 * Trace one import hop from each of the window's primary custom files (see
 * ruleF19 doc comment, location #3) and return the set of resolved files that
 * land inside tools/app-shell/src/windows/custom/shared/.
 */
async function collectF19SharedFiles(primaryFiles, root, parsedCache) {
  const sharedDir = join(root, 'tools', 'app-shell', 'src', 'windows', 'custom', 'shared');
  const sharedFiles = new Set();
  for (const filePath of primaryFiles) {
    const ast = await parseF19File(filePath, parsedCache);
    if (!ast) continue;
    for (const target of await resolveSharedImportTargets(ast, filePath, sharedDir, root)) {
      sharedFiles.add(target);
    }
  }
  return sharedFiles;
}

/**
 * Extract column/field descriptor entries from one already-parsed custom file
 * and return the first `required` mismatch against the contract as a violation,
 * or `null` when the file has no entries, no matching contract field, or is
 * fully in sync (including allowlisted divergences). A single unparsable file
 * must not fail the whole rule, so an extraction error also resolves to `null`.
 */
function findF19RequiredMismatch(filePath, ast, fieldIndex, artifactName, allowlist, root) {
  let entries;
  try {
    entries = extractColumnEntries(ast);
  } catch {
    return null;
  }

  for (const entry of entries) {
    const mismatch = evaluateF19Entry(entry, fieldIndex, artifactName, allowlist);
    if (mismatch) {
      const relFile = filePath.startsWith(root) ? filePath.slice(root.length + 1) : filePath;
      return buildF19Violation(artifactName, relFile, entry.key, entry.required, mismatch.required);
    }
  }
  return null;
}

/**
 * Decide whether a single column entry is a reportable `required` mismatch.
 * Returns the matched contract field (so the caller has its `required` value
 * for the message) when it diverges and is not allowlisted, otherwise `null`.
 */
function evaluateF19Entry(entry, fieldIndex, artifactName, allowlist) {
  if (entry.required === 'indeterminate') return null;

  const field = resolveContractField(fieldIndex, entry.key, entry.column);
  if (!field) return null; // not a real contract field — pure custom render column

  if (isF19Allowlisted(allowlist, artifactName, entry.key)) return null;

  if (entry.required === field.required) return null;

  return field;
}

function buildF19Violation(artifactName, relFile, key, localRequired, contractRequired) {
  return violation(
    'F19', artifactName, 'BLOCK',
    `Custom table column '${key}' in ${relFile} has required=${localRequired} ` +
      `but contract.json field '${key}' has required=${contractRequired}`,
    `Update the 'required' flag on column '${key}' in ${relFile} to match ` +
      `artifacts/${artifactName}/contract.json (required: ${contractRequired}), or fix the ` +
      `contract/decisions.json if the local value is the correct one. If this divergence ` +
      `is intentional, add { "artifact": "${artifactName}", "key": "${key}", "reason": "..." } ` +
      `to cli/src/validate-pipeline-f19-allowlist.json instead.`,
  );
}

const F19_CUSTOM_FILE_PREDICATE = (filePath) =>
  isJavaScriptModule(filePath) && !filePath.split(sep).includes('__tests__');

/**
 * Collect the "primary" custom files for a window — the two locations that
 * are unambiguously owned by that single window (see ruleF19 doc comment,
 * locations #1 and #2). Both are safe to scan unconditionally: a missing
 * directory just yields no files (collectSourceFiles handles that).
 */
function collectF19PrimaryFiles(artifactDir, artifactName, root) {
  const windowCustomDir = join(root, 'tools', 'app-shell', 'src', 'windows', 'custom', artifactName);
  const artifactsCustomDir = join(artifactDir, 'custom');
  return [
    ...collectSourceFiles(windowCustomDir, F19_CUSTOM_FILE_PREDICATE),
    ...collectSourceFiles(artifactsCustomDir, F19_CUSTOM_FILE_PREDICATE),
  ];
}

/**
 * Resolve a module specifier from an import statement to an absolute path,
 * without checking existence. Supports the two forms used across the
 * codebase: the `@/` alias (→ tools/app-shell/src/...) and relative
 * specifiers (resolved against the importing file's directory). Any other
 * form (bare npm specifier, `@generated/...`, etc.) returns null — it is not
 * resolved, by design (see ruleF19 doc comment "Known limitation").
 */
function resolveImportSpecifier(source, importingFilePath, root) {
  if (source.startsWith('@/')) {
    return join(root, 'tools', 'app-shell', 'src', source.slice(2));
  }
  if (source.startsWith('.')) {
    return join(dirname(importingFilePath), source);
  }
  return null;
}

/**
 * Given a resolved-but-extensionless (or already-extensioned) candidate path,
 * find the actual file on disk by trying the candidate as-is, then with
 * .jsx/.js appended, then as a directory index (index.jsx/index.js).
 */
async function resolveExistingFile(candidatePath) {
  const attempts = [
    candidatePath,
    `${candidatePath}.jsx`,
    `${candidatePath}.js`,
    join(candidatePath, 'index.jsx'),
    join(candidatePath, 'index.js'),
  ];
  for (const attempt of attempts) {
    if (await fileExists(attempt)) return attempt;
  }
  return null;
}

/**
 * Parse an already-parsed AST's top-level `import` declarations and return
 * the absolute paths of any that resolve into `sharedDir` (one hop only —
 * this does not recurse into the shared file's own imports).
 */
async function resolveSharedImportTargets(ast, importingFilePath, sharedDir, root) {
  const sharedDirPrefix = sharedDir.endsWith(sep) ? sharedDir : sharedDir + sep;
  const targets = [];
  for (const node of ast.program?.body ?? []) {
    if (node.type !== 'ImportDeclaration' || typeof node.source?.value !== 'string') continue;
    const candidate = resolveImportSpecifier(node.source.value, importingFilePath, root);
    if (!candidate) continue;
    if (candidate !== sharedDir && !candidate.startsWith(sharedDirPrefix)) continue; // not a shared/ import
    const resolved = await resolveExistingFile(candidate);
    if (resolved) targets.push(resolved);
  }
  return targets;
}

/**
 * Load the F19 suppression allowlist — a small, human-reviewable JSON file of
 * `{ artifact, key, reason }` entries for known-intentional divergences (e.g.
 * a `required` flag that guards an inline-add-row save, unrelated to any
 * contract field visibility). A missing file is an empty allowlist, not an
 * error — most repos/checkouts will never need one.
 */
async function loadF19Allowlist(path) {
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isF19Allowlisted(allowlist, artifactName, key) {
  return allowlist.some(entry => entry?.artifact === artifactName && entry?.key === key);
}

/**
 * Build an index of contract field name -> candidate matches (required + column + entity),
 * searched across every entity in frontendContract (header, lines, etc.) — a custom table
 * column may reference a field from any of them.
 */
function collectContractFieldIndex(contract) {
  const entities = contract.frontendContract?.entities ?? {};
  const index = new Map();
  for (const [entityName, entity] of Object.entries(entities)) {
    for (const field of entity.fields ?? []) {
      if (!field?.name) continue;
      const list = index.get(field.name) ?? [];
      list.push({ required: !!field.required, column: field.column ?? null, entity: entityName });
      index.set(field.name, list);
    }
  }
  return index;
}

/**
 * Resolve the contract field a local column entry refers to. When the same field
 * `name` exists on more than one entity, disambiguate using the local `column`
 * (AD column name) when available; otherwise fall back to the first match.
 */
function resolveContractField(fieldIndex, key, localColumn) {
  const candidates = fieldIndex.get(key);
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  if (localColumn) {
    const byColumn = candidates.find(c => c.column === localColumn);
    if (byColumn) return byColumn;
  }
  return candidates[0];
}

/**
 * Walk a parsed AST and collect { key, column, required } entries from every
 * array literal that looks like a column/field descriptor array (see ruleF19
 * doc comment for the exact signature). `required` is `true`/`false` when it can
 * be statically determined, `false` when the property is entirely absent, or the
 * string `'indeterminate'` when present but not a plain boolean literal (e.g. a
 * spread guarded by a runtime condition) — indeterminate entries must never be
 * compared against the contract, only skipped.
 */
function extractColumnEntries(ast) {
  const entries = [];
  walkAst(ast, (node) => {
    if (node.type !== 'ArrayExpression') return;
    const objectElements = node.elements.filter(el => el && el.type === 'ObjectExpression');
    const looksLikeColumnsArray = objectElements.some(
      obj => hasStringProp(obj, 'key') && hasStringProp(obj, 'column'),
    );
    if (!looksLikeColumnsArray) return;

    for (const obj of objectElements) {
      const keyProp = findObjectProp(obj, 'key');
      if (!keyProp || keyProp.value.type !== 'StringLiteral') continue;

      const columnProp = findObjectProp(obj, 'column');
      const column = columnProp && columnProp.value.type === 'StringLiteral' ? columnProp.value.value : null;

      entries.push({ key: keyProp.value.value, column, required: resolveLocalRequired(obj) });
    }
  });
  return entries;
}

function resolveLocalRequired(objectExpression) {
  const requiredProp = findObjectProp(objectExpression, 'required');
  if (requiredProp) {
    return requiredProp.value.type === 'BooleanLiteral' ? requiredProp.value.value : 'indeterminate';
  }
  const hasSpread = objectExpression.properties.some(p => p.type === 'SpreadElement');
  return hasSpread ? 'indeterminate' : false;
}

function hasStringProp(objectExpression, name) {
  const prop = findObjectProp(objectExpression, name);
  return !!prop && prop.value.type === 'StringLiteral';
}

function findObjectProp(objectExpression, name) {
  return objectExpression.properties.find(p => p.type === 'ObjectProperty' && !p.computed && (
    (p.key.type === 'Identifier' && p.key.name === name) ||
    (p.key.type === 'StringLiteral' && p.key.value === name)
  ));
}

/**
 * The set of fields the backend can filter/sort on for an entity: the frontend
 * contract's `searchableFields` unioned with the backend `supportedFilters`
 * (both are populated from the same source, but tolerate either being empty).
 */
function collectQueryableFields(contract, entityName, entity) {
  const set = new Set(entity?.searchableFields ?? []);
  for (const name of contract.apiPrediction?.crud?.[entityName]?.supportedFilters ?? []) {
    set.add(name);
  }
  return set;
}

/** Sibling fields a `multiField` decorator references (must EXIST on the entity). */
function multiFieldRefs(mf) {
  const refs = [];
  if (mf.subtitle) refs.push(mf.subtitle);
  if (mf.media?.field) refs.push(mf.media.field);
  for (const p of Array.isArray(mf.parts) ? mf.parts : []) {
    if (p?.field) refs.push(p.field);
  }
  return refs;
}

/** Fields a `multiField` issues a backend `_sortBy` on (must be QUERYABLE): host + sort-enabled parts. */
function multiFieldSortFields(host, mf) {
  const set = new Set([host.name]);
  for (const p of Array.isArray(mf.parts) ? mf.parts : []) {
    if (p?.field && p.sortable !== false) set.add(p.field);
  }
  return set;
}

function checkMultiFieldHost(artifactName, entityName, host, fieldNames, queryable) {
  const mf = host.multiField;
  for (const ref of multiFieldRefs(mf)) {
    if (!fieldNames.has(ref)) {
      return violation('F18', artifactName, 'BLOCK',
        `field '${host.name}' multiField references field '${ref}' which does not exist on entity '${entityName}'`,
        `Reference only fields declared on the same entity — decisions.json field.multiField subtitle/media.field/parts[].field must match frontendContract.entities.${entityName}.fields[].name.`);
    }
  }
  for (const sortField of multiFieldSortFields(host, mf)) {
    if (!queryable.has(sortField)) {
      return violation('F18', artifactName, 'BLOCK',
        `multiField sort part '${sortField}' on entity '${entityName}' is not queryable (missing from the entity's searchable/supported filters)`,
        `Mark that part 'sortable: false', or make '${sortField}' searchable so the backend accepts _sortBy on it.`);
    }
  }
  return null;
}

/**
 * F18: a `multiField` list-column decorator (ETP-4603) on a grid field must only
 * reference real, appropriately-capable sibling fields. Validated against the
 * resolved contract, where generate-contract emits the decorator onto the host
 * field. A typo in decisions.json thus fails the pipeline instead of silently
 * rendering an empty title/chip or an un-sortable header segment.
 */
async function ruleF18(artifactDir, artifactName) {
  const contractPath = join(artifactDir, 'contract.json');
  if (!(await fileExists(contractPath))) return null;
  let contract;
  try {
    contract = JSON.parse(await readFile(contractPath, 'utf8'));
  } catch {
    return skipped('F18', artifactName, 'contract.json could not be parsed — F18 check skipped');
  }
  const entities = contract.frontendContract?.entities ?? {};
  for (const [entityName, entity] of Object.entries(entities)) {
    const fields = entity?.fields ?? [];
    const fieldNames = new Set(fields.map(f => f?.name).filter(Boolean));
    const queryable = collectQueryableFields(contract, entityName, entity);
    for (const host of fields) {
      if (!host?.multiField) continue;
      const v = checkMultiFieldHost(artifactName, entityName, host, fieldNames, queryable);
      if (v) return v;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// F20 — custom grid columns must declare filterMode when the data type needs one
// ---------------------------------------------------------------------------

const F20_ALLOWLIST_PATH = join(__dirname, 'validate-pipeline-f20-allowlist.json');

/** Contract field type (or columnType) → the filterMode `resolveFilterMode` would need. */
const F20_EXPECTED_MODES = new Map([
  ['amount', 'numeric'],
  ['number', 'numeric'],
  ['integer', 'numeric'],
  ['quantity', 'numeric'],
  ['price', 'numeric'],
  ['decimal', 'numeric'],
  ['percent', 'numeric'],
  ['signedDelta', 'numeric'],
  ['date', 'date'],
  ['dateTime', 'date'],
  ['foreignKey', 'identifier'],
  ['enum', 'enumLabel'],
  ['status', 'enumLabel'],
  ['boolean', 'booleanLabel'],
]);

/** Per-process cache: path → parsed AST (or null when the file could not be parsed). */
const f20AstCache = new Map();
/** path → promise of the parsed allowlist array. */
const f20AllowlistCache = new Map();

/**
 * Load the F20 allowlist. A missing or unreadable file is an empty allowlist —
 * this rule must never throw because a side file is absent.
 *
 * @param {string} [allowlistPath]
 * @returns {Promise<Array<{artifact: string, key: string, reason?: string}>>}
 */
export function loadF20Allowlist(allowlistPath = F20_ALLOWLIST_PATH) {
  if (!f20AllowlistCache.has(allowlistPath)) {
    f20AllowlistCache.set(allowlistPath, (async () => {
      try {
        const parsed = await readJSON(allowlistPath);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })());
  }
  return f20AllowlistCache.get(allowlistPath);
}

function isF20Allowlisted(rules, artifactName, key) {
  return rules.some(rule => rule?.artifact === artifactName && rule?.key === key);
}

/** The filterMode the runtime resolver would need for a contract field. */
function f20ExpectedMode(field) {
  const mapped = F20_EXPECTED_MODES.get(field.columnType ?? field.type);
  if (mapped) return mapped;
  if (Array.isArray(field.enumValues) && field.enumValues.length > 0) return 'enumLabel';
  return 'text';
}

/**
 * Index every contract field by name across ALL entities (header, lines, …).
 * A name present on two entities keeps both candidates so the lookup can
 * disambiguate by the grid column's local `column` value.
 */
function f20IndexContractFields(contract) {
  const index = new Map();
  for (const [entity, entityDef] of Object.entries(contract.frontendContract?.entities ?? {})) {
    for (const field of entityDef?.fields ?? []) {
      if (!field?.name) continue;
      const candidates = index.get(field.name) ?? [];
      candidates.push({
        entity,
        type: field.type ?? null,
        columnType: field.columnType ?? null,
        column: field.column ?? null,
        enumValues: field.enumValues ?? null,
      });
      index.set(field.name, candidates);
    }
  }
  return index;
}

function f20LookupContractField(index, entry) {
  const candidates = index.get(entry.key);
  if (!candidates?.length) return null;
  if (candidates.length === 1) return candidates[0];
  return (entry.column && candidates.find(c => c.column === entry.column)) || candidates[0];
}

function f20LiteralString(node) {
  return node?.type === 'StringLiteral' ? node.value : null;
}

/**
 * Flatten an ObjectExpression into a name → value-node map, reporting whether it
 * carries a spread (which could inject `filterMode` from elsewhere).
 */
function f20ReadObjectProps(objectNode) {
  const props = new Map();
  let hasSpread = false;
  for (const prop of objectNode.properties ?? []) {
    if (prop?.type === 'SpreadElement' || prop?.type === 'SpreadProperty') {
      hasSpread = true;
      continue;
    }
    if (prop?.computed) continue;
    const name = prop?.key?.name ?? f20LiteralString(prop?.key);
    if (name) props.set(name, prop.value);
  }
  return { props, hasSpread };
}

/**
 * Turn an ObjectExpression into a grid column descriptor, or null when it has no
 * string-literal `key` property (i.e. it is not a statically readable column).
 */
function f20ToColumnEntry(objectNode) {
  const { props, hasSpread } = f20ReadObjectProps(objectNode);
  const key = f20LiteralString(props.get('key'));
  if (key === null) return null;

  const typeNode = props.get('type');
  const type = f20LiteralString(typeNode);
  const hasFilterMode = props.has('filterMode');
  const filterModeResolved = !hasFilterMode || f20LiteralString(props.get('filterMode')) !== null;

  return {
    key,
    column: f20LiteralString(props.get('column')),
    type,
    hasFilterMode,
    hasBackendFilterKey: props.has('backendFilterKey'),
    indeterminate: hasSpread || (typeNode !== undefined && type === null) || !filterModeResolved,
  };
}

/** Every statically readable column descriptor found in any column-array literal. */
function f20CollectColumnEntries(ast, walkAst) {
  const entries = [];
  walkAst(ast, (node) => {
    if (node.type !== 'ArrayExpression') return;
    const candidates = (node.elements ?? [])
      .filter(element => element?.type === 'ObjectExpression')
      .map(f20ToColumnEntry)
      .filter(Boolean);
    entries.push(...candidates);
  });
  return entries;
}

async function f20ParseFile(filePath, shared) {
  if (!f20AstCache.has(filePath)) {
    let ast = null;
    try {
      ast = shared.parseModuleSource(await readFile(filePath, 'utf-8'), filePath);
    } catch {
      ast = null; // unparseable custom module — not this rule's business
    }
    f20AstCache.set(filePath, ast);
  }
  return f20AstCache.get(filePath);
}

function f20CheckEntry({ entry, artifactName, index, rules, relFile }) {
  if (entry.type !== 'custom' || entry.hasFilterMode || entry.indeterminate) return null;
  // Neither `column` (AD field) nor `backendFilterKey` means a purely
  // client-rendered synthetic cell with no backend property to filter against:
  // `isFilterableColumn` in AdvancedFilterBuilder.jsx drops exactly this shape
  // from the Advanced Filter field list (ETP-4609), so there is no filter mode
  // to get wrong and demanding one would be the wrong remedy.
  if (!entry.column && !entry.hasBackendFilterKey) return null;
  const field = f20LookupContractField(index, entry);
  if (!field) return null; // purely synthetic render cell — no backing column
  const expected = f20ExpectedMode(field);
  if (expected === 'text') return null;
  // An `_ID` column (or an explicit backendFilterKey) already resolves to the
  // identifier path at runtime, so annotating it would be pure noise.
  if (expected === 'identifier' && (/_ID$/i.test(entry.column ?? '') || entry.hasBackendFilterKey)) return null;
  if (isF20Allowlisted(rules, artifactName, entry.key)) return null;

  const typeLabel = field.columnType ?? field.type ?? 'unknown';
  return violation(
    'F20', artifactName, 'BLOCK',
    `custom grid column '${entry.key}' in ${relFile} declares no filterMode, but contract field type '${typeLabel}' implies filterMode '${expected}'`,
    `Add filterMode: '${expected}' to the '${entry.key}' column, or add { "artifact": "${artifactName}", "key": "${entry.key}", "reason": "..." } to cli/src/validate-pipeline-f20-allowlist.json.`,
  );
}

async function f20CheckFile({ filePath, artifactName, index, rules, root, shared }) {
  const ast = await f20ParseFile(filePath, shared);
  if (!ast) return null;
  const relFile = shared.repoRelative(root, filePath);
  for (const entry of f20CollectColumnEntries(ast, shared.walkAst)) {
    const found = f20CheckEntry({ entry, artifactName, index, rules, relFile });
    if (found) return found;
  }
  return null;
}

async function f20CustomFiles(artifactDir, artifactName, root, shared) {
  const dirs = [
    join(root, 'tools', 'app-shell', 'src', 'windows', 'custom', artifactName),
    join(artifactDir, 'custom'),
  ];
  const files = [];
  for (const dir of dirs) {
    if (!(await dirExists(dir))) continue;
    files.push(...shared.collectSourceFiles(
      dir,
      filePath => shared.isJavaScriptModule(filePath) && !filePath.split(sep).includes('__tests__'),
    ));
  }
  return files;
}

/**
 * F20: a hand-written grid column declared `type: 'custom'` must declare an
 * explicit `filterMode` whenever the contract says the underlying field is not
 * textual (ETP-4681).
 *
 * WHY: `type: 'custom'` means the cell has a bespoke `render`, so the runtime
 * resolver (`resolveFilterMode` in app-shell-core/lib/gridQuery.js) cannot infer
 * the data type — it falls through the `_ID` foreign-key heuristic to `'text'`.
 * A numeric or date column then silently offers text-only operators, and a
 * preloaded condition such as `outstandingAmount greaterThan 0` renders with an
 * empty operator select.
 *
 * SCOPE: hand-written custom components only — both conventions
 * (`tools/app-shell/src/windows/custom/<window>/` and `artifacts/<window>/custom/`).
 * Generated tables are correct by construction (the generator emits the concrete
 * type), so a window with no custom directory is never reported. Columns are
 * matched to `frontendContract.entities.*.fields[].name`; a column with no
 * contract counterpart is a synthetic render cell and is ignored.
 *
 * LIMITATIONS (deliberate, to keep the inference noise-free):
 *   - A `custom` column that declares neither `column` nor `backendFilterKey` is
 *     never reported, even when its `key` matches a numeric/date contract field:
 *     `isFilterableColumn` (the ETP-4609 guard in AdvancedFilterBuilder.jsx) drops
 *     that exact shape from the Advanced Filter field list, so it has no backend
 *     property to filter against and no filter mode to get wrong. A column opting
 *     back in with `filterable: true` + a bespoke `buildCriteria` is skipped too.
 *   - Static analysis only. A column object carrying a spread, or whose `type` /
 *     `filterMode` is not a string literal, is treated as indeterminate and skipped —
 *     `filterMode` could be injected dynamically.
 *   - A column whose own `column` value is not a string literal loses both the
 *     `_ID` exemption and the synthetic-cell exemption above, so a `foreignKey`
 *     field may be reported; declare `filterMode: 'identifier'` or allowlist it.
 *   - Only the FIRST violation per artifact is reported (same as F18).
 *   - Runs on the committed contract, so a not-yet-regenerated contract can mask
 *     or invent a type mismatch — F1/F2 cover that staleness.
 *
 * @param {string} artifactDir
 * @param {string} artifactName
 * @param {string} [root] - repo root (for resolving app-shell custom paths)
 * @param {Array<{artifact: string, key: string}>} [allowlist] - override; empty means "load the side file"
 * @returns {Promise<object|null>}
 */
export async function ruleF20(artifactDir, artifactName, root = ROOT, allowlist = []) {
  const contractPath = join(artifactDir, 'contract.json');
  if (!(await fileExists(contractPath))) return null;

  let shared;
  try {
    shared = await import('./quality-gate/checks/shared.js');
  } catch {
    return skipped('F20', artifactName, 'JS parser unavailable — F20 check skipped');
  }

  const files = await f20CustomFiles(artifactDir, artifactName, root, shared);
  if (files.length === 0) return null; // generated tables are correct by construction

  let contract;
  try {
    contract = await readJSON(contractPath);
  } catch {
    return skipped('F20', artifactName, 'contract.json could not be parsed — F20 check skipped');
  }

  const index = f20IndexContractFields(contract);
  if (index.size === 0) return null;

  const rules = allowlist.length > 0 ? allowlist : await loadF20Allowlist();
  for (const filePath of files) {
    const found = await f20CheckFile({ filePath, artifactName, index, rules, root, shared });
    if (found) return found;
  }
  return null;
}

// ---------------------------------------------------------------------------
// F21 — declared read-only intent must match the contract's resolved methods
// ---------------------------------------------------------------------------

/**
 * Find the `decisions.entities.*` block that corresponds to a contract entity
 * name. Uses the same convention as `buildEntityPreconditionsMap` in
 * push-to-neo.js: match the decisions KEY first, then any block whose explicit
 * `name` override equals the contract entity name.
 *
 * @param {object} decisions
 * @param {string} entityName
 * @returns {object|null}
 */
function f21DecisionsEntityFor(decisions, entityName) {
  const entities = decisions?.entities;
  if (!entities || typeof entities !== 'object') return null;
  const direct = entities[entityName];
  if (direct && typeof direct === 'object') return direct;
  for (const conf of Object.values(entities)) {
    if (conf && typeof conf === 'object' && conf.name === entityName) return conf;
  }
  return null;
}

/** True when the entity block declares a RESTRICTION (not just an opt-out). */
function f21DeclaresRestriction(conf) {
  // ETP-4745 — `hideDelete: true` is a restriction too (it now drops the
  // enforced DELETE method, not just the UI affordance), so a mistyped
  // `entities.<key>.hideDelete` key must be caught by the orphan check the same
  // way a mistyped `readOnly`/`methods` key already is.
  return conf?.readOnly === true || Array.isArray(conf?.methods) || conf?.hideDelete === true;
}

/**
 * The GET-always-granted invariant, checked against the RAW contract array (so a
 * hand-edited `"methods": ["POST"]` is reported instead of silently repaired by
 * the resolver).
 */
function f21CheckReadInvariant(artifactName, entityName, rawMethods) {
  if (!Array.isArray(rawMethods)) return null;
  const canonical = new Set(rawMethods.map(canonicalizeMethod).filter(Boolean));
  const missing = NEO_READ_METHODS.filter(method => !canonical.has(method));
  if (missing.length === 0) return null;
  return violation(
    'F21', artifactName, 'BLOCK',
    `apiPrediction.crud.${entityName}.methods omits ${missing.join(' + ')} — an entity with no read access is never a valid outcome`,
    `Never hand-edit the contract. Declare the intent in decisions.json (window.readOnly, entities.${entityName}.readOnly or entities.${entityName}.methods) and regenerate — the resolver always grants GET + GETBYID.`,
  );
}

/**
 * Compare the methods the contract will push for one entity against the methods
 * the decisions declaration resolves to.
 */
function f21CheckEntityMethods({ artifactName, contract, decisions, entityName, windowReadOnly }) {
  const conf = f21DecisionsEntityFor(decisions, entityName);
  const entityReadOnly = typeof conf?.readOnly === 'boolean' ? conf.readOnly : undefined;
  let expected = resolveEntityMethods({
    windowReadOnly,
    entityReadOnly,
    entityMethods: conf?.methods,
  });
  // ETP-4745 — `hideDelete` (window- or entity-level) also drops DELETE from what
  // the push will actually enforce (see `resolveContractEntityMethods`), so the
  // "expected" side must fold it in too, via the same shared resolver, or a
  // window/entity that declares hideDelete but no methods/readOnly restriction
  // would falsely BLOCK here as a stale contract.
  if (resolveEntityHideDelete({
    windowReadOnly,
    windowHideDelete: windowReadOnly || decisions?.window?.hideDelete === true,
    entityReadOnly,
    entityHideDelete: conf?.hideDelete === true,
  })) {
    expected = expected.filter((method) => method !== 'DELETE');
  }
  const actual = resolveContractEntityMethods(contract, entityName);
  if (expected.join(',') === actual.join(',')) return null;
  return violation(
    'F21', artifactName, 'BLOCK',
    `entity '${entityName}' resolves to methods [${expected.join(', ')}] from decisions.json but the contract would push [${actual.join(', ')}]`,
    `Regenerate the contract (make regen ONLY=${artifactName}) so apiPrediction.crud.${entityName}.methods matches the declared read-only intent — push-to-neo and the XML delta both read the flags from the contract.`,
  );
}

/**
 * A declared restriction that matches no contract entity is a silent no-op —
 * usually a mistyped `entities.<key>`.
 */
function f21CheckOrphanDeclarations(artifactName, decisions, crudNames) {
  for (const [key, conf] of Object.entries(decisions?.entities ?? {})) {
    if (!f21DeclaresRestriction(conf) || conf.exclude === true) continue;
    const entityName = conf.name || key;
    if (crudNames.has(entityName)) continue;
    return violation(
      'F21', artifactName, 'BLOCK',
      `entities.${key} declares a read-only restriction but '${entityName}' is not an entity of this window's contract — the declaration does nothing`,
      `Use the contract entity name as the decisions key (see apiPrediction.crud keys in contract.json), or remove the declaration.`,
    );
  }
  return null;
}

/**
 * F21: the declared read-only intent in `decisions.json` must match the resolved
 * HTTP methods the contract carries, because BOTH write paths — the live DB push
 * (`push-to-neo.js` → `neo-writer.populateWindowSpec`) and the offline XML delta
 * (`lib/neo-delta.js`) — read `apiPrediction.crud.<entity>.methods` /
 * `apiPrediction.window.readOnly` to set `ETGO_SF_ENTITY.ISGET/ISGETBYID/ISPOST/
 * ISPUT/ISPATCH/ISDELETE` (ETP-4254). Since ETP-4745 this also covers
 * `window.hideDelete` / `entities.<key>.hideDelete`: those flags now drop the
 * enforced DELETE method too (previously they only affected the frontend's
 * `crud.<entity>.delete` — a UI-only affordance that never reached the DB row),
 * so a hideDelete declaration whose contract wasn't regenerated is exactly as
 * stale as a readOnly one, folded in via the shared `resolveEntityHideDelete()`.
 *
 * A stale contract is therefore not cosmetic: a window declared read-only in
 * decisions whose contract was not regenerated gets every write method granted
 * again on the next `make regen PUSH_TO_NEO=1`, silently re-opening a monitor/log
 * window to MCP agents.
 *
 * What it checks, per window artifact:
 *   1. GET + GETBYID appear in every emitted `crud.<entity>.methods` array.
 *   2. For every contract entity, `resolveContractEntityMethods(contract, entity)`
 *      (what the push WILL write) equals `resolveEntityMethods(decisions intent)`
 *      with `resolveEntityHideDelete(decisions intent)` folded in (what was
 *      declared). This subsumes the window-level case: `window.readOnly`
 *      with a non-regenerated contract shows up as
 *      `[GET, GETBYID]` expected vs `[GET, …, DELETE]` actual, and a declared
 *      `hideDelete` with a non-regenerated contract shows up as DELETE missing
 *      from the expected side but present in the actual side.
 *   3. Every restricting `entities.<key>` declaration maps to a real contract
 *      entity, so a mistyped key cannot silently no-op.
 *
 * Only the FIRST violation per artifact is reported (same as F18/F20).
 *
 * Not covered: the exported `ETGO_SF_ENTITY.xml` sourcedata, which lives in the
 * `com.etendoerp.go` repo and is out of this validator's reach. That side is
 * covered by `xml-regeneration-check` / `sf-push-neo --dump-delta`, and holds by
 * construction because both write paths share `lib/entity-methods.js`.
 *
 * @param {string} artifactDir
 * @param {string} artifactName
 * @returns {Promise<object|null>}
 */
export async function ruleF21(artifactDir, artifactName) {
  const decisionsPath = join(artifactDir, 'decisions.json');
  const contractPath = join(artifactDir, 'contract.json');
  const [hasDecisions, hasContract] = await Promise.all([
    fileExists(decisionsPath),
    fileExists(contractPath),
  ]);
  if (!hasDecisions || !hasContract) return null;

  let decisions;
  let contract;
  try {
    decisions = JSON.parse(await readFile(decisionsPath, 'utf8'));
    contract = JSON.parse(await readFile(contractPath, 'utf8'));
  } catch {
    return skipped('F21', artifactName, 'decisions.json or contract.json could not be parsed — F21 check skipped');
  }

  const crud = contract?.apiPrediction?.crud;
  if (!crud || typeof crud !== 'object') return null;

  const windowReadOnly = decisions?.window?.readOnly === true;
  for (const entityName of Object.keys(crud)) {
    const invariant = f21CheckReadInvariant(artifactName, entityName, crud[entityName]?.methods);
    if (invariant) return invariant;
    const mismatch = f21CheckEntityMethods({
      artifactName, contract, decisions, entityName, windowReadOnly,
    });
    if (mismatch) return mismatch;
  }

  return f21CheckOrphanDeclarations(artifactName, decisions, new Set(Object.keys(crud)));
}

// ---------------------------------------------------------------------------
// Artifact discovery
// ---------------------------------------------------------------------------

/**
 * Discover all artifact directory names under the artifacts/ root.
 * Returns only subdirectories (skips files).
 */
async function discoverArtifacts(artifactsRoot) {
  const entries = await readdir(artifactsRoot, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory())
    .map(e => e.name);
}

/**
 * Get list of artifact names changed in the git staging area.
 * Returns null if git is unavailable.
 */
async function getStagedArtifacts(root) {
  try {
    const { stdout } = await execFileAsync('git', ['diff', '--cached', '--name-only'], { cwd: root });
    const names = new Set();
    for (const line of stdout.split('\n')) {
      const m = line.match(/^artifacts\/([^/]+)\//);
      if (m) names.add(m[1]);
    }
    return Array.from(names);
  } catch {
    return null;
  }
}

async function loadRegistryContent(registryPath) {
  try {
    return await readFile(registryPath, 'utf-8');
  } catch {
    // Registry file not found or unreadable — F3/F10 checks will emit skipped entries.
    return null;
  }
}

async function resolveArtifactNames(scope, root, artifactsRoot) {
  if (scope === 'staged') {
    const staged = await getStagedArtifacts(root);
    return staged ?? [];
  }
  if (Array.isArray(scope)) return scope;
  return discoverArtifacts(artifactsRoot);
}

async function runEnabledChecks(checks, skipSet) {
  const pendingChecks = checks.map(check => (skipSet.has(check.rule) ? null : check.run()));
  return (await Promise.all(pendingChecks)).filter(Boolean);
}

async function runWindowChecks(artifactDir, artifactName, registryContent, root, skipSet, goSourcedataDir, f19Allowlist = []) {
  return runEnabledChecks([
    { rule: 'F1', run: () => ruleF1(artifactDir, artifactName) },
    { rule: 'F2', run: () => ruleF2(artifactDir, artifactName) },
    { rule: 'F3', run: () => ruleF3(artifactDir, artifactName, registryContent) },
    { rule: 'F4', run: () => ruleF4(artifactDir, artifactName) },
    { rule: 'F5', run: () => ruleF5(artifactDir, artifactName) },
    { rule: 'F6', run: () => ruleF6(artifactDir, artifactName) },
    { rule: 'F7', run: () => ruleF7(artifactDir, artifactName) },
    { rule: 'F10', run: () => ruleF10(artifactDir, artifactName, registryContent, root) },
    { rule: 'F11', run: () => ruleF11(artifactDir, artifactName) },
    { rule: 'F12', run: () => ruleF12(artifactDir, artifactName) },
    { rule: 'F13', run: () => ruleF13(artifactDir, artifactName) },
    { rule: 'F14', run: () => ruleF14(artifactDir, artifactName) },
    { rule: 'F15', run: () => ruleF15(artifactDir, artifactName) },
    { rule: 'F16', run: () => ruleF16(artifactDir, artifactName) },
    { rule: 'F17', run: () => ruleF17(artifactDir, artifactName) },
    { rule: 'F18', run: () => ruleF18(artifactDir, artifactName) },
    { rule: 'F19', run: () => ruleF19(artifactDir, artifactName, root, f19Allowlist) },
    { rule: 'F20', run: () => ruleF20(artifactDir, artifactName, root) },
    { rule: 'F21', run: () => ruleF21(artifactDir, artifactName) },
    { rule: 'F22', run: () => ruleF22(artifactDir, artifactName) },
    { rule: 'F23', run: () => ruleF23(artifactDir, artifactName, goSourcedataDir, root) },
  ], skipSet);
}

async function runSingleCheck(rule, callback, skipSet) {
  if (skipSet.has(rule)) return [];
  const result = await callback();
  return result ? [result] : [];
}

function tagArtifactKind(results, artifactKind) {
  return results.map(result => ({ ...result, artifactKind }));
}

async function runAggregateSectionChecks(artifactDir, artifactName, skipSet, root, goSourcedataDir) {
  const f9Results = await runSingleCheck('F9', () => ruleF9(artifactDir, artifactName), skipSet);
  const f4Results = await runSingleCheck('F4', () => ruleF4(artifactDir, artifactName), skipSet);
  const f23Results = await runSingleCheck(
    'F23', () => ruleF23(artifactDir, artifactName, goSourcedataDir, root), skipSet,
  );
  return [...f9Results, ...f4Results, ...f23Results];
}

async function runChecksForArtifact({ kind, artifactDir, artifactName, registryContent, root, skipSet, strict, f19Allowlist, goSourcedataDir }) {
  if (kind === 'window') {
    return tagArtifactKind(
      await runWindowChecks(artifactDir, artifactName, registryContent, root, skipSet, goSourcedataDir, f19Allowlist),
      'window',
    );
  }
  if (kind === 'report') {
    return tagArtifactKind(
      await runSingleCheck('F8', () => ruleF8(artifactDir, artifactName), skipSet),
      'report',
    );
  }
  if (kind === 'aggregate') {
    // F23 runs here too: an aggregate artifact pushes its own ETGO_SF_SPEC, so
    // its field rows can drift exactly like a window's. ETP-4793 measured 340 of
    // the 409 incoherent rows in the live export inside two aggregates
    // (return-to-vendor, return-from-customer) — registering F23 for windows
    // only would have left 83 % of the defect invisible.
    return tagArtifactKind([
      ...await runSingleCheck('F9', () => ruleF9(artifactDir, artifactName), skipSet),
      ...await runSingleCheck('F23', () => ruleF23(artifactDir, artifactName, goSourcedataDir, root), skipSet),
    ], 'aggregate');
  }
  if (kind === 'aggregate-section') {
    return tagArtifactKind(
      await runAggregateSectionChecks(artifactDir, artifactName, skipSet, root, goSourcedataDir),
      'aggregate-section',
    );
  }
  if (CUSTOM_ONLY_ARTIFACTS.has(artifactName)) {
    return [skipped('CUSTOM-ONLY', artifactName, 'Intentional custom-only artifact — no contract pipeline')];
  }
  return [violation(
    'UNKNOWN', artifactName, strict ? 'BLOCK' : 'WARN',
    `Artifact directory '${artifactName}' has no recognizable pipeline files`,
    `Investigate the directory contents and run the appropriate pipeline`,
    { artifactKind: 'unknown' },
  )];
}

function applyStrictMode(results, strict) {
  return results.map(result => {
    if (strict && result.severity === 'WARN') {
      return { ...result, severity: 'BLOCK', strictPromoted: true };
    }
    return result;
  });
}

function summarizeResults(processedResults, artifactNames) {
  const violations = processedResults.filter(r => r.kind !== 'skipped' && r.severity !== 'SKIP');
  const skippedEntries = processedResults.filter(r => r.kind === 'skipped' || r.severity === 'SKIP');
  const blocking = violations.filter(v => v.severity === 'BLOCK').length;
  const warnings = violations.filter(v => v.severity === 'WARN').length;
  const artifactStatus = new Map(artifactNames.map(name => [name, 'ok']));

  for (const entry of violations) artifactStatus.set(entry.artifact, 'violation');
  for (const entry of skippedEntries) {
    if (artifactStatus.get(entry.artifact) !== 'violation') artifactStatus.set(entry.artifact, 'skipped');
  }

  return {
    violations,
    skipped: skippedEntries,
    summary: {
      total: violations.length,
      blocking,
      warnings,
      skipped: skippedEntries.length,
      /** ok = number of artifacts with no violations and no skipped checks */
      ok: [...artifactStatus.values()].filter(status => status === 'ok').length,
    },
  };
}

/**
 * Get list of artifact names changed since a given git ref (e.g. 'origin/main').
 * Uses `git diff --name-only <ref>...HEAD` (three-dot diff — changes since branch point).
 * Returns null if git is unavailable or the ref cannot be resolved.
 *
 * @param {string} root - repo root path
 * @param {string} ref  - git ref to compare against (e.g. 'origin/main', 'HEAD~1')
 * @returns {Promise<string[]|null>}
 */
export async function getChangedArtifactsSince(root, ref) {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['diff', '--name-only', `${ref}...HEAD`],
      { cwd: root },
    );
    const names = new Set();
    for (const line of stdout.split('\n')) {
      const m = line.match(/^artifacts\/([^/]+)\//);
      if (m) names.add(m[1]);
    }
    return Array.from(names);
  } catch {
    return null;
  }
}

/**
 * Validate pipeline completeness.
 *
 * @param {object} options
 * @param {'all'|'staged'|string[]} [options.scope='all'] - scope of validation
 * @param {boolean} [options.strict=false] - treat warnings as blocking
 * @param {string[]} [options.skip=[]] - list of rule IDs to skip (e.g. ['F4', 'F7'])
 * @param {string} [options.root=ROOT] - repo root (override for testing)
 * @param {string} [options.registryPath] - override path to registry.js (for testing)
 * @param {string} [options.f19AllowlistPath] - override path to the F19 suppression allowlist (for testing)
 * @returns {Promise<{violations: Array, skipped: Array, summary: object}>}
 */
export async function validatePipeline({
  scope = 'all',
  strict = false,
  skip = [],
  root = ROOT,
  registryPath,
  f19AllowlistPath,
  // F23 reads the exported ETGO_SF_*.xml from the com.etendoerp.go checkout.
  // Injectable so tests point at a fixture instead of whatever module tree
  // happens to sit beside the developer's repo.
  goSourcedataDir,
  _artifactsRoot,
} = {}) {
  const artifactsRoot = _artifactsRoot ?? join(root, 'artifacts');
  const resolvedRegistryPath = registryPath ?? join(root, 'tools', 'app-shell', 'src', 'windows', 'registry.js');
  const registryContent = await loadRegistryContent(resolvedRegistryPath);
  const resolvedF19AllowlistPath = f19AllowlistPath ?? join(__dirname, 'validate-pipeline-f19-allowlist.json');
  const f19Allowlist = await loadF19Allowlist(resolvedF19AllowlistPath);
  const artifactNames = await resolveArtifactNames(scope, root, artifactsRoot);

  const skipSet = new Set(skip.map(s => s.toUpperCase()));
  const allResults = []; // mix of violations and skipped entries

  for (const name of artifactNames) {
    const artifactDir = join(artifactsRoot, name);
    if (!(await dirExists(artifactDir))) continue;

    const kind = await classifyArtifact(artifactDir);
    allResults.push(...await runChecksForArtifact({
      kind,
      artifactDir,
      artifactName: name,
      registryContent,
      root,
      skipSet,
      strict,
      f19Allowlist,
      goSourcedataDir,
    }));
  }

  return summarizeResults(applyStrictMode(allResults, strict), artifactNames);
}

// ---------------------------------------------------------------------------
// Reporters
// ---------------------------------------------------------------------------

/**
 * Format the result as a human-readable text report.
 */
function formatText(result) {
  const { violations, skipped, summary } = result;
  const lines = [];

  if (violations.length === 0 && skipped.length === 0) {
    lines.push('Pipeline validation: OK');
    return lines.join('\n');
  }

  if (violations.length > 0) {
    lines.push('Pipeline validation: VIOLATIONS FOUND\n');
    for (const v of violations) {
      const badge = v.severity === 'BLOCK' ? '[BLOCK]' : '[WARN] ';
      lines.push(`  ${badge} [${v.rule}] ${v.artifact}`);
      lines.push(`         ${v.message}`);
      lines.push(`         Fix: ${v.fix}`);
    }
    lines.push('');
  }

  if (skipped.length > 0) {
    lines.push(`Skipped checks (${skipped.length}):`);
    for (const s of skipped) {
      lines.push(`  [SKIP]  [${s.rule}] ${s.artifact}: ${s.message}`);
    }
    lines.push('');
  }

  lines.push(
    `Summary: ${summary.total} violation(s) — ${summary.blocking} blocking, ` +
    `${summary.warnings} warning(s), ${summary.skipped} skipped`,
  );

  return lines.join('\n');
}

/**
 * Format the result as a JSON string.
 */
function formatJSON(result) {
  return JSON.stringify(result, null, 2);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

/**
 * Parse CLI arguments for the validator.
 */
export function parseCLIArgs(argv) {
  const args = argv.slice(2);
  const options = {
    scope: null,
    staged: false,
    strict: false,
    format: 'text',
    skip: [],
    changedSince: null,
  };

  for (const arg of args) {
    if (arg.startsWith('--scope=')) {
      options.scope = arg.split('=').slice(1).join('=').split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--staged') {
      options.staged = true;
    } else if (arg === '--strict') {
      options.strict = true;
    } else if (arg.startsWith('--format=')) {
      options.format = arg.split('=')[1];
    } else if (arg.startsWith('--skip=')) {
      options.skip = arg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--changed-since=')) {
      options.changedSince = arg.split('=').slice(1).join('=');
    }
  }

  return options;
}

async function main() {
  const options = parseCLIArgs(process.argv);

  // Determine scope — precedence: --scope > --changed-since > --staged > all
  let scope;
  if (options.scope && options.scope.length > 0) {
    scope = options.scope;
  } else if (options.changedSince) {
    const changed = await getChangedArtifactsSince(ROOT, options.changedSince);
    if (changed === null) {
      process.stderr.write(`validate-pipeline: could not resolve ref '${options.changedSince}'\n`);
      process.exit(1);
    }
    scope = changed; // may be empty array → validator returns early with empty result
  } else if (options.staged) {
    scope = 'staged';
  } else {
    scope = 'all';
  }

  let result;
  try {
    result = await validatePipeline({
      scope,
      strict: options.strict,
      skip: options.skip,
    });
  } catch (err) {
    process.stderr.write(`validate-pipeline: fatal error: ${err.message}\n`);
    process.exit(1);
  }

  // Attach scope info to summary for JSON consumers (e.g. CI workflow)
  if (options.changedSince) {
    result.summary.scope = Array.isArray(scope) ? scope : [];
    result.summary.empty = result.summary.scope.length === 0;
  }

  if (options.format === 'json') {
    process.stdout.write(formatJSON(result) + '\n');
  } else {
    process.stdout.write(formatText(result) + '\n');
  }

  const hasBlocking = result.violations.some(v => v.severity === 'BLOCK');
  process.exit(hasBlocking ? 1 : 0);
}

// Only run main when executed directly
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('validate-pipeline.js') ||
  process.argv[1].endsWith('validate-pipeline')
);
if (isMainModule) {
  main().catch(err => { process.stderr.write(`${err.stack}\n`); process.exit(1); });
}
