#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDbPool, closePool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');

export const QUERIES = {
  'process-metadata': `
SELECT p.AD_Process_ID, p.Name, p.Description, p.Help,
       p.UIPattern, p.JavaClassName, p.ProcedureName,
       p.IsReport, p.IsBackground
FROM AD_Process p
WHERE p.AD_Process_ID = $1 AND p.IsActive = 'Y'`,

  'process-parameters': `
SELECT pp.AD_Process_Para_ID, pp.Name, pp.ColumnName, pp.Description,
       pp.AD_Reference_ID, pp.AD_Reference_Value_ID,
       pp.IsMandatory, pp.IsRange, pp.DefaultValue, pp.SeqNo,
       pp.FieldLength, pp.AD_Val_Rule_ID,
       r.Name AS reference_name
FROM AD_Process_Para pp
JOIN AD_Reference r ON r.AD_Reference_ID = pp.AD_Reference_ID
WHERE pp.AD_Process_ID = $1 AND pp.IsActive = 'Y'
ORDER BY pp.SeqNo, pp.Name, pp.AD_Process_Para_ID`,
};

export function rowsToCsv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val == null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    });
    lines.push(values.join(','));
  }
  return lines.join('\n') + '\n';
}

/**
 * Transform raw query results into the process-raw.json structure.
 */
export function buildProcessRaw(metadataRows, parameterRows) {
  if (metadataRows.length === 0) {
    throw new Error('Process not found or inactive');
  }
  const p = metadataRows[0];
  return {
    process: {
      id: p.ad_process_id,
      name: p.name,
      description: p.description || null,
      help: p.help || null,
      uiPattern: p.uipattern,
      javaClassName: p.javaclassname || null,
      procedureName: p.procedurename || null,
      isReport: p.isreport === 'Y',
      isBackground: p.isbackground === 'Y',
    },
    parameters: parameterRows.map((pp) => ({
      id: pp.ad_process_para_id,
      name: pp.name,
      column: pp.columnname,
      description: pp.description || null,
      referenceId: pp.ad_reference_id,
      referenceName: pp.reference_name,
      referenceValueId: pp.ad_reference_value_id || null,
      mandatory: pp.ismandatory === 'Y',
      isRange: pp.isrange === 'Y',
      defaultValue: pp.defaultvalue || null,
      seqNo: parseInt(pp.seqno, 10),
      fieldLength: parseInt(pp.fieldlength, 10) || 0,
      valRuleId: pp.ad_val_rule_id || null,
    })),
  };
}

export async function main(processId, processSlug) {
  const pool = createDbPool();
  const outDir = join(ROOT, 'artifacts', processSlug, 'raw-query-results');
  await mkdir(outDir, { recursive: true });

  try {
    const [metadataResult, paramsResult] = await Promise.all([
      pool.query(QUERIES['process-metadata'], [processId]),
      pool.query(QUERIES['process-parameters'], [processId]),
    ]);

    // Write CSVs
    const metaCsv = rowsToCsv(metadataResult.rows);
    await writeFile(join(outDir, 'process-metadata.csv'), metaCsv, 'utf-8');
    console.log(`  process-metadata.csv: ${metadataResult.rows.length} rows`);

    const paramsCsv = rowsToCsv(paramsResult.rows);
    await writeFile(join(outDir, 'process-parameters.csv'), paramsCsv, 'utf-8');
    console.log(`  process-parameters.csv: ${paramsResult.rows.length} rows`);

    // Build and write process-raw.json
    const processRaw = buildProcessRaw(metadataResult.rows, paramsResult.rows);
    const jsonPath = join(ROOT, 'artifacts', processSlug, 'process-raw.json');
    await writeFile(jsonPath, JSON.stringify(processRaw, null, 2) + '\n', 'utf-8');
    console.log(`  process-raw.json written`);

    console.log(`\nArtifacts written to artifacts/${processSlug}/`);
    return processRaw;
  } finally {
    await closePool(pool);
  }
}

// CLI entry point
const isCLI =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isCLI) {
  const processId = process.argv[2];
  const processSlug = process.argv[3];

  if (!processId || !processSlug) {
    console.error('Usage: node extract-from-process.js <processId> <processSlug>');
    console.error('Example: node extract-from-process.js 2AC62B61C988442882DFC742E16A5EB4 enroll-student');
    process.exit(1);
  }

  main(processId, processSlug).catch((err) => {
    console.error('Extraction failed:', err.message);
    process.exit(1);
  });
}
