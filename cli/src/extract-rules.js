import { readFile, mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep } from 'node:path';
import { createDbPool, closePool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

// --- SQL Queries (TDD 3.2) ---

const CALLOUTS_SQL = `
SELECT c.AD_Callout_ID, c.Classname, c.Name,
       col.ColumnName, col.AD_Table_ID
FROM AD_Callout c
JOIN AD_Column_Callout cc ON c.AD_Callout_ID = cc.AD_Callout_ID
JOIN AD_Column col ON cc.AD_Column_ID = col.AD_Column_ID
JOIN AD_Tab t ON col.AD_Table_ID = t.AD_Table_ID
WHERE t.AD_Window_ID = $1
`;

const VALIDATION_RULES_SQL = `
SELECT vr.AD_Val_Rule_ID, vr.Name, vr.Code, c.ColumnName
FROM AD_Val_Rule vr
JOIN AD_Column c ON c.AD_Val_Rule_ID = vr.AD_Val_Rule_ID
JOIN AD_Tab t ON c.AD_Table_ID = t.AD_Table_ID
WHERE t.AD_Window_ID = $1
`;

const DISPLAY_LOGIC_SQL = `
SELECT f.Name, f.DisplayLogic, f.ReadOnlyLogic, c.ColumnName
FROM AD_Field f
JOIN AD_Column c ON f.AD_Column_ID = c.AD_Column_ID
JOIN AD_Tab t ON f.AD_Tab_ID = t.AD_Tab_ID
WHERE t.AD_Window_ID = $1
  AND (f.DisplayLogic IS NOT NULL OR f.ReadOnlyLogic IS NOT NULL)
`;

const DOCUMENT_PROCESSES_SQL = `
SELECT p.AD_Process_ID, p.Name, p.Classname
FROM AD_Process p
JOIN AD_Table_Process tp ON p.AD_Process_ID = tp.AD_Process_ID
JOIN AD_Tab t ON tp.AD_Table_ID = t.AD_Table_ID
WHERE t.AD_Window_ID = $1
`;

// --- Pure functions ---

/**
 * Regex-based analysis of Java source code.
 * Detects effects, branches, LOC, and DML usage.
 */
export function analyzeJavaSource(sourceCode) {
  if (sourceCode == null) {
    return { effects: [], confidence: 'low', warning: 'Source not found' };
  }

  const effects = [];

  // Detect addResult / setFieldValue patterns
  // addResult("fieldName", ...) or setFieldValue("fieldName", ...)
  const effectPattern = /(?:addResult|setFieldValue)\s*\(\s*"([^"]+)"/g;
  let match;
  while ((match = effectPattern.exec(sourceCode)) !== null) {
    effects.push({
      field: match[1],
      action: 'setValue',
      confidence: 'high',
    });
  }

  // Count branches: if, switch, ternary (?)
  const lines = sourceCode.split('\n');
  let branches = 0;
  for (const line of lines) {
    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    // Count if statements (word boundary)
    const ifMatches = trimmed.match(/\bif\s*\(/g);
    if (ifMatches) branches += ifMatches.length;

    // Count switch statements
    const switchMatches = trimmed.match(/\bswitch\s*\(/g);
    if (switchMatches) branches += switchMatches.length;

    // Count ternary operators
    const ternaryMatches = trimmed.match(/\?/g);
    if (ternaryMatches) branches += ternaryMatches.length;
  }

  // Count LOC (non-blank, non-comment lines)
  let loc = 0;
  let inBlockComment = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      continue;
    }

    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      continue;
    }

    if (trimmed.startsWith('//')) continue;

    loc++;
  }

  // Detect DML patterns
  const dmlPattern = /OBDal|PreparedStatement|createCriteria|ConnectionProvider|executeUpdate|createQuery|getConnection/;
  const hasDml = dmlPattern.test(sourceCode);

  const confidence = effects.length > 0 ? 'high' : 'medium';

  return {
    effects,
    confidence,
    branches,
    loc,
    hasDml,
  };
}

/**
 * Fail-safe Etendo expression translator.
 * Converts Etendo display/readOnly logic expressions to JS-like syntax.
 */
export function translateExpression(expr) {
  if (expr == null || expr.trim() === '') {
    return { success: false, error: 'Empty expression' };
  }

  // Abort on framework calls
  if (/OB\.|Utilities\.|checkRule|function\s*\(/i.test(expr)) {
    return { success: false, error: 'Expression contains framework calls' };
  }

  let result = expr;

  // Replace @VAR@ with camelCase variable name
  result = result.replace(/@([A-Za-z_][A-Za-z0-9_]*)@/g, (_match, varName) => {
    // camelCase: lowercase first char
    return varName.charAt(0).toLowerCase() + varName.slice(1);
  });

  // Replace | with || and & with &&
  // Must handle carefully to not double-replace || or &&
  result = result.replace(/\|{2}/g, '__DOUBLE_PIPE__');
  result = result.replace(/&{2}/g, '__DOUBLE_AMP__');
  result = result.replace(/\|/g, '||');
  result = result.replace(/&/g, '&&');
  result = result.replace(/__DOUBLE_PIPE__/g, '||');
  result = result.replace(/__DOUBLE_AMP__/g, '&&');

  // Replace 'Y' with true, 'N' with false
  result = result.replace(/'Y'/g, 'true');
  result = result.replace(/'N'/g, 'false');

  // Replace single = with == (but preserve !=, <=, >=)
  result = result.replace(/([^!<>=])=([^=])/g, '$1==$2');

  return { success: true, result: result.trim() };
}

/**
 * Heuristic to determine if a SQL validation is simple or complex.
 */
export function isSimpleValidation(sql) {
  if (sql == null || sql.trim() === '') return true;

  const upper = sql.toUpperCase();

  // Complex indicators
  const hasMultipleJoins = (upper.match(/\bJOIN\b/g) || []).length >= 2;
  const hasExists = /\bEXISTS\s*\(/i.test(upper);
  const hasUnion = /\bUNION\b/i.test(upper);
  const hasSubqueryWithJoin = /\bEXISTS\s*\(\s*SELECT\b/i.test(upper) || hasUnion;

  if (hasMultipleJoins || hasSubqueryWithJoin || hasUnion) return false;
  if (hasExists) return false;

  return true;
}

/**
 * Build a rule object from a callout DB row and its Java source analysis.
 */
export function buildRuleFromCallout(row, sourceAnalysis) {
  const rule = {
    type: 'callout',
    source: 'AD_Callout',
    id: row.ad_callout_id,
    name: row.name,
    className: row.classname,
    triggerColumn: row.columnname,
    effects: sourceAnalysis?.effects ?? [],
    complexity: determineComplexity(sourceAnalysis),
    confidence: sourceAnalysis?.confidence ?? 'low',
  };

  if (sourceAnalysis?.hasDml) {
    rule.hasDml = true;
  }

  if (sourceAnalysis?.branches != null) {
    rule.branches = sourceAnalysis.branches;
  }

  if (sourceAnalysis?.loc != null) {
    rule.loc = sourceAnalysis.loc;
  }

  if (sourceAnalysis?.warning) {
    rule.warning = sourceAnalysis.warning;
  }

  return rule;
}

/**
 * Determine complexity from source analysis.
 */
function determineComplexity(analysis) {
  if (!analysis || analysis.confidence === 'low') return 'unknown';
  if (analysis.hasDml) return 'high';
  if (analysis.branches > 5) return 'high';
  if (analysis.branches > 2) return 'medium';
  return 'low';
}

/**
 * Walk a source directory to find a .java file matching a FQCN.
 * Returns file content string or null.
 */
export async function findSource(sourceDir, className) {
  if (!sourceDir || !className) return null;

  // Convert FQCN to path: com.example.MyClass -> com/example/MyClass.java
  const relativePath = className.replace(/\./g, sep) + '.java';
  const fullPath = join(sourceDir, relativePath);

  try {
    const content = await readFile(fullPath, 'utf-8');
    return content;
  } catch {
    // File not found at expected path, try recursive search
    try {
      const simpleClassName = className.split('.').pop() + '.java';
      const found = await walkForFile(sourceDir, simpleClassName);
      return found;
    } catch {
      return null;
    }
  }
}

/**
 * Recursively walk a directory looking for a file by name.
 */
async function walkForFile(dir, targetName) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const result = await walkForFile(fullPath, targetName);
      if (result) return result;
    } else if (entry.name === targetName) {
      return readFile(fullPath, 'utf-8');
    }
  }

  return null;
}

/**
 * Main orchestrator: queries 4 SQL sources + optional Java analysis.
 * Writes artifacts/{windowName}/rules-raw.json.
 */
export async function main(windowId, windowName) {
  const pool = createDbPool();
  const sourceDir = process.env.ETENDO_SOURCE_DIR ?? null;

  try {
    // Run all 4 queries in parallel
    const [calloutsRes, validationsRes, displayLogicRes, processesRes] = await Promise.all([
      pool.query(CALLOUTS_SQL, [windowId]),
      pool.query(VALIDATION_RULES_SQL, [windowId]),
      pool.query(DISPLAY_LOGIC_SQL, [windowId]),
      pool.query(DOCUMENT_PROCESSES_SQL, [windowId]),
    ]);

    const rules = [];

    // Process callouts with optional source analysis
    for (const row of calloutsRes.rows) {
      let sourceAnalysis = null;
      if (sourceDir && row.classname) {
        const source = await findSource(sourceDir, row.classname);
        sourceAnalysis = analyzeJavaSource(source);
      } else {
        sourceAnalysis = analyzeJavaSource(null);
      }
      rules.push(buildRuleFromCallout(row, sourceAnalysis));
    }

    // Process validation rules
    for (const row of validationsRes.rows) {
      rules.push({
        type: 'validation',
        source: 'AD_Val_Rule',
        id: row.ad_val_rule_id,
        name: row.name,
        column: row.columnname,
        code: row.code,
        isSimple: isSimpleValidation(row.code),
      });
    }

    // Process display/readOnly logic
    for (const row of displayLogicRes.rows) {
      if (row.displaylogic) {
        const translated = translateExpression(row.displaylogic);
        rules.push({
          type: 'displayLogic',
          source: 'AD_Field',
          fieldName: row.name,
          column: row.columnname,
          rawExpression: row.displaylogic,
          translated: translated.success ? translated.result : null,
          translationError: translated.success ? undefined : translated.error,
        });
      }

      if (row.readonlylogic) {
        const translated = translateExpression(row.readonlylogic);
        rules.push({
          type: 'readOnlyLogic',
          source: 'AD_Field',
          fieldName: row.name,
          column: row.columnname,
          rawExpression: row.readonlylogic,
          translated: translated.success ? translated.result : null,
          translationError: translated.success ? undefined : translated.error,
        });
      }
    }

    // Process document processes
    for (const row of processesRes.rows) {
      let sourceAnalysis = null;
      if (sourceDir && row.classname) {
        const source = await findSource(sourceDir, row.classname);
        sourceAnalysis = analyzeJavaSource(source);
      }

      rules.push({
        type: 'process',
        source: 'AD_Process',
        id: row.ad_process_id,
        name: row.name,
        className: row.classname,
        ...(sourceAnalysis && {
          hasDml: sourceAnalysis.hasDml,
          loc: sourceAnalysis.loc,
          complexity: determineComplexity(sourceAnalysis),
        }),
      });
    }

    const output = {
      windowId,
      windowName,
      extractedAt: new Date().toISOString(),
      rules,
      summary: {
        callouts: calloutsRes.rows.length,
        validations: validationsRes.rows.length,
        displayLogic: displayLogicRes.rows.filter((r) => r.displaylogic).length,
        readOnlyLogic: displayLogicRes.rows.filter((r) => r.readonlylogic).length,
        processes: processesRes.rows.length,
        total: rules.length,
      },
    };

    // Write to artifacts directory
    const artifactsDir = join(ROOT, 'artifacts', windowName);
    await mkdir(artifactsDir, { recursive: true });
    const outputPath = join(artifactsDir, 'rules-raw.json');
    await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`Rules written to ${outputPath}`);
    console.log(`  Total rules: ${rules.length}`);
    console.log(`  Callouts: ${calloutsRes.rows.length}`);
    console.log(`  Validations: ${validationsRes.rows.length}`);
    console.log(`  Display Logic: ${output.summary.displayLogic}`);
    console.log(`  ReadOnly Logic: ${output.summary.readOnlyLogic}`);
    console.log(`  Processes: ${processesRes.rows.length}`);

    return output;
  } finally {
    await closePool(pool);
  }
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const windowId = process.argv[2];
  const windowName = process.argv[3];

  if (!windowId || !windowName) {
    console.error('Usage: node extract-rules.js <windowId> <windowName>');
    process.exit(1);
  }

  main(windowId, windowName).catch((err) => {
    console.error('Rule extraction failed:', err.message);
    process.exit(1);
  });
}
