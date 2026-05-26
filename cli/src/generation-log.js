import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Parse a columns or fields array from a JSX source string.
 * Returns an array of { key, label, type, ...extras }.
 */
export function parseFieldArray(source, arrayName) {
  const pattern = new RegExp(`const ${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const match = source.match(pattern);
  if (!match) return [];

  const body = match[1];
  const fields = [];
  const fieldPattern = /\{([^}]+)\}/g;
  let m;
  while ((m = fieldPattern.exec(body)) !== null) {
    const obj = {};
    const propPattern = /(\w+):\s*(?:'([^']*)'|"([^"]*)"|(true|false|\d+(?:\.\d+)?))/g;
    let pm;
    while ((pm = propPattern.exec(m[1])) !== null) {
      const key = pm[1];
      const value = pm[2] ?? pm[3] ?? pm[4];
      obj[key] = value;
    }
    if (obj.key) fields.push(obj);
  }
  return fields;
}

/**
 * Classify a file as 'table', 'form', 'page', 'index', or 'other'.
 */
export function classifyFile(filename) {
  if (filename.endsWith('Table.jsx')) return 'table';
  if (filename.endsWith('Form.jsx')) return 'form';
  if (filename.endsWith('Page.jsx')) return 'page';
  if (filename === 'index.jsx') return 'index';
  return 'other';
}

/**
 * Extract entity name from a filename like "OrderTable.jsx" -> "order".
 */
function extractEntityFromFilename(filename) {
  const base = filename.replace(/\.(jsx|js)$/, '');
  const stripped = base.replace(/(Table|Form|Page)$/, '');
  if (!stripped) return null;
  return stripped.charAt(0).toLowerCase() + stripped.slice(1);
}

/**
 * Compare two sets of parsed fields and return change entries.
 */
function diffFields(oldFields, newFields, file, entity, arrayType) {
  const changes = [];
  const oldMap = new Map(oldFields.map(f => [f.key, f]));
  const newMap = new Map(newFields.map(f => [f.key, f]));

  // Removed fields
  for (const [key, oldF] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        entity,
        field: key,
        file,
        change: 'field-removed',
        before: `${arrayType}: ${oldF.type}`,
        after: null,
      });
    }
  }

  // Added fields
  for (const [key, newF] of newMap) {
    if (!oldMap.has(key)) {
      changes.push({
        entity,
        field: key,
        file,
        change: 'field-added',
        before: null,
        after: `${arrayType}: ${newF.type}`,
      });
    }
  }

  // Type changes
  for (const [key, newF] of newMap) {
    const oldF = oldMap.get(key);
    if (oldF && oldF.type !== newF.type) {
      changes.push({
        entity,
        field: key,
        file,
        change: 'field-type',
        before: oldF.type,
        after: newF.type,
      });
    }
  }

  return changes;
}

/**
 * Compare generated files (old vs new) and return raw change entries (no run metadata).
 */
export function compareGenerated(windowName, oldFiles, newFiles) {
  const changes = [];
  const allFilenames = new Set([...Object.keys(oldFiles), ...Object.keys(newFiles)]);

  for (const filename of allFilenames) {
    const oldContent = oldFiles[filename];
    const newContent = newFiles[filename];

    // New file
    if (hasFileBeenAdded(oldContent, newContent)) {
      changes.push({
        entity: extractEntityFromFilename(filename),
        field: null,
        file: filename,
        change: 'new-file',
        before: null,
        after: `${newContent.length} bytes`,
      });
      continue;
    }

    // Removed file
    if (hasFileBeenRemoved(oldContent, newContent)) {
      changes.push({
        entity: extractEntityFromFilename(filename),
        field: null,
        file: filename,
        change: 'file-removed',
        before: `${oldContent.length} bytes`,
        after: null,
      });
      continue;
    }

    // Both exist — compare
    if (oldContent === newContent) continue;

    const type = classifyFile(filename);
    const entity = extractEntityFromFilename(filename);

    if (type === 'table') {
      const oldCols = parseFieldArray(oldContent, 'columns');
      const newCols = parseFieldArray(newContent, 'columns');
      const fieldChanges = diffFields(oldCols, newCols, filename, entity, 'column');
      handleFieldChanges(fieldChanges, changes, entity, filename);
    } else if (type === 'form') {
      const oldFields = parseFieldArray(oldContent, 'fields');
      const newFields = parseFieldArray(newContent, 'fields');
      const fieldChanges = diffFields(oldFields, newFields, filename, entity, 'form');
      handleFormFieldChanges(fieldChanges, changes, entity, filename);
    } else {
      // Page, index, other
      changes.push({
        entity,
        field: null,
        file: filename,
        change: 'component-changed',
        before: null,
        after: `${type} content changed`,
      });
    }
  }

  return changes;
}

function handleFormFieldChanges(fieldChanges, changes, entity, filename) {
  if (fieldChanges.length > 0) {
    changes.push(...fieldChanges);
  } else {
    changes.push({
      entity,
      field: null,
      file: filename,
      change: 'component-changed',
      before: null,
      after: 'form structure changed',
    });
  }
}

function handleFieldChanges(fieldChanges, changes, entity, filename) {
  if (fieldChanges.length > 0) {
    changes.push(...fieldChanges);
  } else {
    // Content changed but not columns — structural change
    changes.push({
      entity,
      field: null,
      file: filename,
      change: 'component-changed',
      before: null,
      after: 'table structure changed',
    });
  }
}

function hasFileBeenRemoved(oldContent, newContent) {
  return oldContent && !newContent;
}

function hasFileBeenAdded(oldContent, newContent) {
  return !oldContent && newContent;
}

/**
 * Create full log entries with run metadata.
 */
export function createLogEntries(windowName, trigger, oldFiles, newFiles, existingLog = []) {
  const rawChanges = compareGenerated(windowName, oldFiles, newFiles);

  // Auto-increment runId
  const existingRunIds = existingLog
    .map(e => e.runId)
    .filter(id => id?.startsWith('run-'))
    .map(id => Number.parseInt(id.replace('run-', ''), 10))
    .filter(n => !Number.isNaN(n));
  const nextRun = existingRunIds.length > 0 ? Math.max(...existingRunIds) + 1 : 1;
  const runId = `run-${String(nextRun).padStart(3, '0')}`;
  const run = new Date().toISOString();

  if (rawChanges.length === 0) {
    return [{
      run,
      runId,
      trigger,
      window: windowName,
      entity: null,
      field: null,
      file: null,
      change: 'no-changes',
      before: null,
      after: null,
    }];
  }

  return rawChanges.map(change => ({
    run,
    runId,
    trigger,
    window: windowName,
    entity: change.entity,
    field: change.field,
    file: change.file,
    change: change.change,
    before: change.before,
    after: change.after,
  }));
}

/**
 * Append entries to a JSON log file.
 */
export function appendToLog(entries, logPath) {
  let existing = [];
  if (existsSync(logPath)) {
    try {
      existing = JSON.parse(readFileSync(logPath, 'utf-8'));
    } catch {
      existing = [];
    }
  } else {
    mkdirSync(dirname(logPath), { recursive: true });
  }

  const updated = [...existing, ...entries];
  writeFileSync(logPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
}

/**
 * Generate per-window markdown view.
 */
export function generateWindowView(windowName, logPath, outPath) {
  let log = [];
  if (existsSync(logPath)) {
    log = JSON.parse(readFileSync(logPath, 'utf-8'));
  }

  const windowEntries = log.filter(e => e.window === windowName);
  if (windowEntries.length === 0) {
    writeFileSync(outPath, `# Generation Log: ${windowName}\n\nNo changes recorded.\n`, 'utf-8');
    return;
  }

  // Group by runId
  const runs = new Map();
  for (const entry of windowEntries) {
    if (!runs.has(entry.runId)) runs.set(entry.runId, []);
    runs.get(entry.runId).push(entry);
  }

  const lines = [`# Generation Log: ${windowName}`, ''];

  for (const [runId, entries] of runs) {
    const first = entries[0];
    lines.push(`## ${runId} (${first.run})`, '', `**Trigger:** ${first.trigger}`, '', '| File | Field | Change | Before | After |', '|------|-------|--------|--------|-------|');
    for (const e of entries) {
      const field = e.field ?? '-';
      const before = e.before ?? '-';
      const after = e.after ?? '-';
      lines.push(`| ${e.file} | ${field} | ${e.change} | ${before} | ${after} |`);
    }
    lines.push('');
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
}

/**
 * Generate transversal (all-windows) markdown view.
 */
export function generateRunsView(logPath, outPath) {
  let log = [];
  if (existsSync(logPath)) {
    log = JSON.parse(readFileSync(logPath, 'utf-8'));
  }

  if (log.length === 0) {
    writeFileSync(outPath, '# Generation Runs\n\nNo runs recorded.\n', 'utf-8');
    return;
  }

  // Group by runId
  const runs = new Map();
  for (const entry of log) {
    if (!runs.has(entry.runId)) runs.set(entry.runId, []);
    runs.get(entry.runId).push(entry);
  }

  const lines = ['# Generation Runs', ''];

  for (const [runId, entries] of runs) {
    const first = entries[0];
    const windows = [...new Set(entries.map(e => e.window))];
    const changeCounts = {};
    for (const e of entries) {
      changeCounts[e.change] = (changeCounts[e.change] || 0) + 1;
    }
    const summary = Object.entries(changeCounts)
      .map(([k, v]) => `${v} ${k}`)
      .join(', ');

    lines.push(`## ${runId} - ${first.run}`, '', `- **Trigger:** ${first.trigger}`, `- **Windows:** ${windows.join(', ')}`, `- **Changes:** ${summary}`, '', '| Window | File | Field | Change | Before | After |', '|--------|------|-------|--------|--------|-------|');
    for (const e of entries) {
      const field = e.field ?? '-';
      const before = e.before ?? '-';
      const after = e.after ?? '-';
      lines.push(`| ${e.window} | ${e.file} | ${field} | ${e.change} | ${before} | ${after} |`);
    }
    lines.push('', '<!-- AI Summary: TODO -->', '');
  }

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
}

/**
 * Read the "before" state from git HEAD for a window's generated files.
 */
export function readFromGit(windowName, repoRoot) {
  const webDir = `artifacts/${windowName}/generated/web/${windowName}`;
  const files = {};

  try {
    const lsOutput = execSync(
      `git ls-tree --name-only HEAD "${webDir}"`,
      { cwd: repoRoot, encoding: 'utf-8' }
    ).trim();
    if (!lsOutput) return files;

    for (const filename of lsOutput.split('\n')) {
      const basename = filename.split('/').pop();
      try {
        const content = execSync(
          `git show "HEAD:${webDir}/${basename}"`,
          { cwd: repoRoot, encoding: 'utf-8' }
        );
        files[basename] = content;
      } catch {
        // File might not exist in HEAD
      }
    }
  } catch {
    // No files tracked in git for this window
  }

  return files;
}

/**
 * Read current filesystem state for a window's generated files.
 */
export function readFromDisk(windowName, repoRoot) {
  const webDir = resolve(repoRoot, `artifacts/${windowName}/generated/web/${windowName}`);
  const files = {};

  if (!existsSync(webDir)) return files;

  for (const filename of readdirSync(webDir)) {
    if (filename.endsWith('.jsx') || filename.endsWith('.js')) {
      files[filename] = readFileSync(resolve(webDir, filename), 'utf-8');
    }
  }

  return files;
}

// CLI entry point
const isDirectRun = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/.*\//, ''));
if (isDirectRun) {
  const windowName = process.argv[2];
  const trigger = process.argv[3] || 'manual run';

  if (!windowName) {
    console.error('Usage: node cli/src/generation-log.js <window-name> <trigger-description>');
    process.exit(1);
  }

  const repoRoot = resolve(dirname(import.meta.url.replace('file://', '')), '..', '..');
  const logPath = resolve(repoRoot, 'artifacts/generation-log.json');

  // Read before (git) and after (disk)
  const oldFiles = readFromGit(windowName, repoRoot);
  const newFiles = readFromDisk(windowName, repoRoot);

  // Load existing log
  let existingLog = [];
  if (existsSync(logPath)) {
    try { existingLog = JSON.parse(readFileSync(logPath, 'utf-8')); } catch { existingLog = []; }
  }

  // Create entries
  const entries = createLogEntries(windowName, trigger, oldFiles, newFiles, existingLog);

  const isNoChanges = entries.length === 1 && entries[0].change === 'no-changes';
  if (isNoChanges) {
    console.log(`No changes detected for ${windowName} (logged as no-changes)`);
  }

  // Append
  appendToLog(entries, logPath);
  console.log(`Appended ${entries.length} entries to ${logPath}`);

  // Generate views
  const windowViewPath = resolve(repoRoot, `artifacts/${windowName}/GENERATION-LOG.md`);
  generateWindowView(windowName, logPath, windowViewPath);
  console.log(`Window view: ${windowViewPath}`);

  const runsViewPath = resolve(repoRoot, 'artifacts/GENERATION-RUNS.md');
  generateRunsView(logPath, runsViewPath);
  console.log(`Runs view: ${runsViewPath}`);
}
