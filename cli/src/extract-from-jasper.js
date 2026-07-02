#!/usr/bin/env node

/**
 * extract-from-jasper.js — Parse a .jrxml Jasper template and extract
 * report structure into a report-contract.json compatible format.
 *
 * Usage:
 *   node cli/src/extract-from-jasper.js --jrxml <path-to-jrxml>
 *   node cli/src/extract-from-jasper.js --jrxml <path> --output <dir>
 *   node cli/src/extract-from-jasper.js --process-id <ad_process_id>
 *
 * Output: report-contract.json + migration-notes.md in the output directory
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { isMainModule } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = process.env.SF_ROOT || join(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// XML parsing (minimal, no dependencies)
// ---------------------------------------------------------------------------

/**
 * Extract all occurrences of a named XML element with attributes and text.
 * Handles self-closing and content-bearing tags.
 */
function extractElements(xml, tagName) {
  const results = [];
  const pattern = new RegExp(
    `<${tagName}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${tagName}>)`,
    'g'
  );
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    const attrs = parseAttributes(match[1]);
    const body = match[2] || '';
    results.push({ attrs, body, raw: match[0] });
  }
  return results;
}

function parseAttributes(attrStr) {
  const attrs = {};
  const pattern = /(\w[\w:-]*)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = pattern.exec(attrStr)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

function extractCDATA(text) {
  const m = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1].trim() : text.trim();
}

// ---------------------------------------------------------------------------
// JRXML parser
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} JasperField
 * @property {string} name
 * @property {string} javaClass
 * @property {string} type - mapped type (string, date, number, boolean)
 */

/**
 * @typedef {Object} JasperParameter
 * @property {string} name
 * @property {string} javaClass
 * @property {boolean} isForPrompting
 */

/**
 * @typedef {Object} JasperGroup
 * @property {string} name
 * @property {string} expression - e.g. "$F{orgname}"
 * @property {string[]} headerLabels - static text labels in group header
 * @property {string[]} headerFields - field expressions in group header
 */

const JAVA_TYPE_MAP = {
  'java.lang.String': 'string',
  'java.lang.Integer': 'number',
  'java.lang.Long': 'number',
  'java.lang.Double': 'number',
  'java.lang.Float': 'number',
  'java.math.BigDecimal': 'amount',
  'java.util.Date': 'date',
  'java.sql.Date': 'date',
  'java.sql.Timestamp': 'datetime',
  'java.lang.Boolean': 'boolean',
};

function mapJavaType(javaClass) {
  return JAVA_TYPE_MAP[javaClass] || 'string';
}

/**
 * Parse a .jrxml file and extract structured report metadata.
 */
export function parseJrxml(xml) {
  const result = {
    name: '',
    pageWidth: 0,
    pageHeight: 0,
    orientation: 'portrait',
    fields: [],
    parameters: [],
    groups: [],
    query: '',
    queryLanguage: 'SQL',
    detailFields: [],
    columnHeaders: [],
  };

  // Report attributes
  parseReportAttributes(xml, result);

  // Fields
  extractFieldsFromXml(xml, result);

  // Parameters
  parseParameters(xml, result);

  // Query
  const queryEls = extractElements(xml, 'queryString');
  if (queryEls.length > 0) {
    result.queryLanguage = queryEls[0].attrs.language || 'SQL';
    result.query = extractCDATA(queryEls[0].body);
  }

  // Groups
  for (const el of extractElements(xml, 'group')) {
    const groupName = el.attrs.name;
    // Extract group expression
    const exprMatch = el.body.match(/<groupExpression>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/groupExpression>/);
    const expression = exprMatch ? exprMatch[1].trim() : '';
    // Extract field reference from expression like $F{fieldname}
    const fieldRef = expression.match(/\$F\{(\w+)\}/)?.[1] || '';

    // Extract static text labels from group header
    const headerLabels = [];
    const headerFields = [];
    const groupHeaderMatch = el.body.match(/<groupHeader>([\s\S]*?)<\/groupHeader>/);
    if (groupHeaderMatch) {
      extractGroupHeaderLabels(groupHeaderMatch, headerLabels, headerFields);
    }

    result.groups.push({
      name: groupName,
      expression,
      fieldRef,
      headerLabels,
      headerFields,
    });
  }

  // Detail band — extract field expressions used in detail rows
  parseDetailFields(xml, result);

  // Also extract column headers from the last group header (detail-level headers)
  if (result.groups.length > 0) {
    const lastGroup = result.groups[result.groups.length - 1];
    // The column headers for detail rows are typically in the last group's header
    if (lastGroup.headerLabels.length > 2) {
      // First labels are the group label+value, rest are detail column headers
      // We'll capture all and let the contract builder sort them out
    }
  }

  return result;
}

function parseDetailFields(xml, result) {
  const detailMatch = xml.match(/<detail>([\s\S]*?)<\/detail>/);
  if (detailMatch) {
    const detailXml = detailMatch[1];

    // Extract static text (column headers sometimes live here)
    for (const st of extractElements(detailXml, 'staticText')) {
      const textMatch = st.body.match(/<text>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/text>/);
      if (textMatch) result.columnHeaders.push(textMatch[1].trim());
    }

    // Extract field references from textFieldExpression
    const tfExprs = detailXml.match(/<textFieldExpression>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/textFieldExpression>/g) || [];
    for (const expr of tfExprs) {
      const val = expr.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]?.trim() || '';
      const ref = val.match(/\$F\{(\w+)\}/)?.[1];
      if (ref) result.detailFields.push(ref);
    }
  }
}

function parseParameters(xml, result) {
  for (const el of extractElements(xml, 'parameter')) {
    result.parameters.push({
      name: el.attrs.name,
      javaClass: el.attrs.class || 'java.lang.String',
      isForPrompting: el.attrs.isForPrompting !== 'false',
      type: mapJavaType(el.attrs.class || 'java.lang.String'),
    });
  }
}

function parseReportAttributes(xml, result) {
  const reportMatch = xml.match(/<jasperReport\b([^>]*?)>/);
  if (reportMatch) {
    const attrs = parseAttributes(reportMatch[1]);
    result.name = attrs.name || '';
    result.pageWidth = parseInt(attrs.pageWidth) || 0;
    result.pageHeight = parseInt(attrs.pageHeight) || 0;
    result.orientation = result.pageWidth > result.pageHeight ? 'landscape' : 'portrait';
  }
}

function extractFieldsFromXml(xml, result) {
  for (const el of extractElements(xml, 'field')) {
    result.fields.push({
      name: el.attrs.name,
      javaClass: el.attrs.class || 'java.lang.String',
      type: mapJavaType(el.attrs.class || 'java.lang.String'),
    });
  }
}

function extractGroupHeaderLabels(groupHeaderMatch, headerLabels, headerFields) {
  const headerXml = groupHeaderMatch[1];
  for (const st of extractElements(headerXml, 'staticText')) {
    const textMatch = st.body.match(/<text>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/text>/);
    if (textMatch) headerLabels.push(textMatch[1].trim());
  }
  const tfExprs = headerXml.match(/<textFieldExpression>[\s\S]*?<!\[CDATA\[([\s\S]*?)\]\]>[\s\S]*?<\/textFieldExpression>/g) || [];
  for (const expr of tfExprs) {
    const val = expr.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)?.[1]?.trim() || '';
    const ref = val.match(/\$F\{(\w+)\}/)?.[1];
    if (ref) headerFields.push(ref);
  }
}

// ---------------------------------------------------------------------------
// Contract generation
// ---------------------------------------------------------------------------

function humanizeFieldName(name) {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Build a report-contract.json from parsed JRXML metadata.
 */
export function buildContract(parsed, options = {}) {
  const reportId = options.reportId || parsed.name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  const title = options.title || humanizeFieldName(parsed.name);

  // Build columns from detail fields (these are what appear in the table rows)
  const detailFieldNames = parsed.detailFields.length > 0
    ? parsed.detailFields
    : parsed.fields.map(f => f.name);

  const fieldMap = new Map(parsed.fields.map(f => [f.name, f]));

  // Try to match column headers to detail fields
  // The last group's headerLabels typically contain the column headers
  const lastGroup = parsed.groups[parsed.groups.length - 1];
  const columnLabels = lastGroup?.headerLabels || [];
  // Filter out group-level labels (first 1-2 are usually the group name label)
  const detailColumnLabels = columnLabels.length > detailFieldNames.length
    ? columnLabels.slice(columnLabels.length - detailFieldNames.length)
    : columnLabels;

  const columns = detailFieldNames.map((fieldName, i) => {
    const field = fieldMap.get(fieldName);
    const label = detailColumnLabels[i] || humanizeFieldName(fieldName);
    return {
      field: fieldName,
      label: { en_US: label, es_ES: label },
      type: field?.type || 'string',
      width: 'auto',
      sortable: true,
    };
  });

  // Build groups
  const groups = parsed.groups.map(g => ({
    field: g.fieldRef,
    label: { en_US: g.headerLabels[0] || humanizeFieldName(g.fieldRef), es_ES: g.headerLabels[0] || humanizeFieldName(g.fieldRef) },
  }));

  // Build parameters (only user-prompted ones)
  const filters = parsed.parameters
    .filter(p => p.isForPrompting)
    .map(p => ({
      field: p.name,
      label: { en_US: humanizeFieldName(p.name), es_ES: humanizeFieldName(p.name) },
      type: p.type === 'date' ? 'date' : p.type === 'boolean' ? 'boolean' : 'text',
    }));

  return {
    version: 1,
    reportId,
    type: groups.length > 0 ? 'grouped-listing' : 'listing',
    source: 'jasper-migration',
    jasper: {
      originalFile: options.jrxmlPath || '',
      processId: options.processId || '',
      processValue: options.processValue || '',
      queryLanguage: parsed.queryLanguage,
    },
    title: { en_US: title, es_ES: title },
    orientation: parsed.orientation,
    columns,
    groups,
    filters,
    defaultSort: columns.length > 0 ? { field: columns[0].field, direction: 'asc' } : null,
    outputs: ['pdf', 'xlsx', 'csv', 'html'],
    summary: { totalRows: true },
  };
}

// ---------------------------------------------------------------------------
// Migration notes generation
// ---------------------------------------------------------------------------

export function buildMigrationNotes(parsed, contract) {
  const lines = [
    `# Migration Notes: ${parsed.name}`,
    '',
    `**Source:** \`${parsed.name}.jrxml\``,
    `**Orientation:** ${parsed.orientation} (${parsed.pageWidth}x${parsed.pageHeight})`,
    `**Query Language:** ${parsed.queryLanguage}`,
    '',
    '## Fields',
    '',
    '| Field | Java Type | Mapped Type |',
    '|-------|-----------|-------------|',
    ...parsed.fields.map(f => `| ${f.name} | ${f.javaClass} | ${f.type} |`),
    '',
    '## Parameters',
    '',
    parsed.parameters.length > 0
      ? [
          '| Parameter | Type | Prompted |',
          '|-----------|------|----------|',
          ...parsed.parameters.map(p => `| ${p.name} | ${p.javaClass} | ${p.isForPrompting} |`),
        ].join('\n')
      : '_No user-facing parameters_',
    '',
    '## Groups (Hierarchy)',
    '',
    parsed.groups.length > 0
      ? parsed.groups.map((g, i) => `${i + 1}. **${g.name}** → \`${g.fieldRef}\` (labels: ${g.headerLabels.join(', ')})`).join('\n')
      : '_No grouping_',
    '',
    '## Detail Columns',
    '',
    contract.columns.map(c => `- **${c.label.en_US}** → \`${c.field}\` (${c.type})`).join('\n'),
    '',
    '## SQL Query',
    '',
    '```sql',
    parsed.query,
    '```',
    '',
    '## Migration TODO',
    '',
    '- [ ] Create NEO Headless endpoint or custom data source for this report',
    '- [ ] Map SQL query columns to NEO API response fields',
    '- [ ] Generate Handlebars template with group headers',
    '- [ ] Test with real data via jsreport',
    '- [ ] Add to menu / window print button',
    '',
  ];

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { jrxml: null, output: null, processId: null };
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === '--jrxml' && argv[i + 1]) { opts.jrxml = argv[i + 1]; i += 2; }
    else if (argv[i] === '--output' && argv[i + 1]) { opts.output = argv[i + 1]; i += 2; }
    else if (argv[i] === '--process-id' && argv[i + 1]) { opts.processId = argv[i + 1]; i += 2; }
    else { i += 1; }
  }
  return opts;
}

const isMain = isMainModule(import.meta.url);

if (isMain) {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.jrxml) {
    console.error('Usage: extract-from-jasper.js --jrxml <path> [--output <dir>] [--process-id <id>]');
    process.exit(1);
  }

  if (!existsSync(opts.jrxml)) {
    console.error(`[extract-from-jasper] File not found: ${opts.jrxml}`);
    process.exit(1);
  }

  const xml = await readFile(opts.jrxml, 'utf8');
  const parsed = parseJrxml(xml);

  console.log(`[extract-from-jasper] Parsed: ${parsed.name}`);
  console.log(`  Fields: ${parsed.fields.length}`);
  console.log(`  Parameters: ${parsed.parameters.length}`);
  console.log(`  Groups: ${parsed.groups.length}`);
  console.log(`  Detail fields: ${parsed.detailFields.length}`);
  console.log(`  Orientation: ${parsed.orientation}`);
  console.log(`  Query: ${parsed.query ? 'yes (' + parsed.query.length + ' chars)' : 'none'}`);

  const contract = buildContract(parsed, {
    jrxmlPath: opts.jrxml,
    processId: opts.processId || '',
  });

  const notes = buildMigrationNotes(parsed, contract);

  // Determine output dir
  const outputDir = opts.output || join(ROOT, 'artifacts', contract.reportId);
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const contractPath = join(outputDir, 'report-contract.json');
  const notesPath = join(outputDir, 'migration-notes.md');

  await writeFile(contractPath, JSON.stringify(contract, null, 2) + '\n');
  await writeFile(notesPath, notes);

  console.log(`\n  Contract: ${contractPath}`);
  console.log(`  Notes:    ${notesPath}`);
}
