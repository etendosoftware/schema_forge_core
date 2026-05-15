#!/usr/bin/env node
/**
 * Compare original module XML against export.database output.
 *
 * The checker normalizes child element order and attributes to avoid false
 * positives from non-significant reordering. It intentionally uses only Node.js
 * built-ins so CI and local runs do not need Python, virtualenv, or pip packages.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_INCLUDE_DIRS = [
  'model/tables',
  'model/modifiedTables',
  'model/functions',
  'sourcedata',
];

const UNSAFE_XML_DECLARATIONS = ['<!DOCTYPE', '<!ENTITY'];

class XmlParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'XmlParseError';
  }
}

class XmlNode {
  constructor(tag, attributes = {}) {
    this.tag = tag;
    this.attributes = attributes;
    this.children = [];
    this.text = '';
  }
}

class XmlScanner {
  constructor(xmlText) {
    this.xmlText = xmlText;
    this.position = 0;
  }

  parseDocument() {
    this.skipMisc();
    const root = this.readElement();
    this.skipMisc();
    if (!this.isAtEnd()) {
      throw this.error('Unexpected content after root element');
    }
    return root;
  }

  readElement() {
    this.expect('<');
    if (this.peek('/')) {
      throw this.error('Unexpected closing tag');
    }

    const tag = this.readName();
    const attributes = this.readAttributes();
    const node = new XmlNode(tag, attributes);

    if (this.consume('/>')) {
      return node;
    }

    this.expect('>');
    this.readElementContent(node);
    return node;
  }

  readElementContent(node) {
    while (!this.isAtEnd()) {
      if (this.consumeClosingTag(node.tag)) {
        return;
      }
      if (this.consumeComment() || this.consumeProcessingInstruction()) {
        continue;
      }
      if (this.startsWith('<![CDATA[')) {
        node.text += this.readCdata();
        continue;
      }
      if (this.peek('<')) {
        node.children.push(this.readElement());
        continue;
      }
      node.text += this.readText();
    }
    throw this.error(`Missing closing tag for <${node.tag}>`);
  }

  readAttributes() {
    const attributes = {};
    while (!this.isAtEnd()) {
      this.skipWhitespace();
      if (this.startsWith('>') || this.startsWith('/>')) {
        return attributes;
      }
      const name = this.readName();
      this.skipWhitespace();
      this.expect('=');
      this.skipWhitespace();
      attributes[name] = decodeXmlEntities(this.readQuotedValue());
    }
    throw this.error('Unexpected end while reading attributes');
  }

  readQuotedValue() {
    const quote = this.current();
    if (quote !== '"' && quote !== "'") {
      throw this.error('Expected quoted attribute value');
    }
    this.position += 1;
    const start = this.position;
    while (!this.isAtEnd() && this.current() !== quote) {
      this.position += 1;
    }
    if (this.isAtEnd()) {
      throw this.error('Unterminated attribute value');
    }
    const value = this.xmlText.slice(start, this.position);
    this.position += 1;
    return value;
  }

  readName() {
    const start = this.position;
    while (!this.isAtEnd() && isNameCharacter(this.current())) {
      this.position += 1;
    }
    if (start === this.position) {
      throw this.error('Expected XML name');
    }
    return this.xmlText.slice(start, this.position);
  }

  readText() {
    const start = this.position;
    while (!this.isAtEnd() && !this.peek('<')) {
      this.position += 1;
    }
    return decodeXmlEntities(this.xmlText.slice(start, this.position));
  }

  readCdata() {
    this.position += '<![CDATA['.length;
    const end = this.xmlText.indexOf(']]>', this.position);
    if (end === -1) {
      throw this.error('Unterminated CDATA section');
    }
    const value = this.xmlText.slice(this.position, end);
    this.position = end + ']]>'.length;
    return value;
  }

  consumeClosingTag(expectedTag) {
    if (!this.startsWith('</')) {
      return false;
    }
    this.position += 2;
    const tag = this.readName();
    this.skipWhitespace();
    this.expect('>');
    if (tag !== expectedTag) {
      throw this.error(`Expected closing tag </${expectedTag}> but found </${tag}>`);
    }
    return true;
  }

  consumeComment() {
    return this.consumeDelimited('<!--', '-->');
  }

  consumeProcessingInstruction() {
    return this.consumeDelimited('<?', '?>');
  }

  consumeDelimited(startToken, endToken) {
    if (!this.startsWith(startToken)) {
      return false;
    }
    const end = this.xmlText.indexOf(endToken, this.position + startToken.length);
    if (end === -1) {
      throw this.error(`Unterminated ${startToken} section`);
    }
    this.position = end + endToken.length;
    return true;
  }

  skipMisc() {
    let consumed = true;
    while (consumed) {
      this.skipWhitespace();
      consumed = this.consumeComment() || this.consumeProcessingInstruction();
    }
  }

  skipWhitespace() {
    while (!this.isAtEnd() && /\s/.test(this.current())) {
      this.position += 1;
    }
  }

  consume(token) {
    if (!this.startsWith(token)) {
      return false;
    }
    this.position += token.length;
    return true;
  }

  expect(token) {
    if (!this.consume(token)) {
      throw this.error(`Expected "${token}"`);
    }
  }

  startsWith(token) {
    return this.xmlText.startsWith(token, this.position);
  }

  peek(token) {
    return this.startsWith(token);
  }

  current() {
    return this.xmlText[this.position];
  }

  isAtEnd() {
    return this.position >= this.xmlText.length;
  }

  error(message) {
    return new XmlParseError(`${message} at character ${this.position}`);
  }
}

function isNameCharacter(character) {
  return /[A-Za-z0-9_.:-]/.test(character);
}

function decodeXmlEntities(value) {
  return value.replace(/&(#x[\da-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, entity) => {
    if (entity === 'amp') return '&';
    if (entity === 'lt') return '<';
    if (entity === 'gt') return '>';
    if (entity === 'quot') return '"';
    if (entity === 'apos') return "'";
    return decodeNumericEntity(entity);
  });
}

function decodeNumericEntity(entity) {
  const codePoint = entity.startsWith('#x')
    ? Number.parseInt(entity.slice(2), 16)
    : Number.parseInt(entity.slice(1), 10);
  if (!Number.isFinite(codePoint)) {
    throw new XmlParseError(`Invalid XML entity &${entity};`);
  }
  return String.fromCodePoint(codePoint);
}

function escapeXmlText(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function escapeXmlAttribute(value) {
  return escapeXmlText(value).replaceAll('"', '&quot;');
}

function assertSafeXml(xmlText, xmlPath) {
  const normalized = xmlText.toUpperCase();
  for (const declaration of UNSAFE_XML_DECLARATIONS) {
    if (normalized.includes(declaration)) {
      throw new XmlParseError(`Unsafe XML declaration ${declaration} is not allowed in ${xmlPath}`);
    }
  }
}

function stripBom(xmlText) {
  return xmlText.charCodeAt(0) === 0xfeff ? xmlText.slice(1) : xmlText;
}

export function parseXml(xmlText, xmlPath = '<xml>') {
  const safeText = stripBom(xmlText);
  assertSafeXml(safeText, xmlPath);
  return new XmlScanner(safeText).parseDocument();
}

export function normalizeElement(element) {
  const trimmedText = element.text.trim();
  element.text = trimmedText === '' ? '' : trimmedText;
  element.attributes = Object.fromEntries(Object.entries(element.attributes).sort(([a], [b]) => a.localeCompare(b)));
  element.children = element.children.map(normalizeElement).sort(compareChildren);
  return element;
}

function compareChildren(left, right) {
  return childSignature(left).localeCompare(childSignature(right));
}

function childSignature(child) {
  return JSON.stringify([
    child.tag,
    Object.entries(child.attributes),
    child.text || '',
    child.children.map(childSignature),
  ]);
}

export function canonicalizeXml(xmlPath) {
  const xmlText = readFileSync(xmlPath, 'utf8');
  const root = normalizeElement(parseXml(xmlText, xmlPath));
  return serializeElement(root);
}

function serializeElement(element) {
  const attributes = Object.entries(element.attributes)
    .map(([key, value]) => ` ${key}="${escapeXmlAttribute(value)}"`)
    .join('');
  const content = `${escapeXmlText(element.text)}${element.children.map(serializeElement).join('')}`;
  return content === ''
    ? `<${element.tag}${attributes}/>`
    : `<${element.tag}${attributes}>${content}</${element.tag}>`;
}

export function collectXmlFiles(baseDir, includeDirs) {
  const files = {};
  const base = resolve(baseDir);
  for (const relSubdir of includeDirs) {
    const subdir = resolve(base, relSubdir);
    if (!existsSync(subdir) || !statSync(subdir).isDirectory()) {
      continue;
    }
    collectXmlFilesFromDirectory(base, subdir, files);
  }
  return files;
}

function collectXmlFilesFromDirectory(baseDir, directory, files) {
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) => {
    return left.name.localeCompare(right.name);
  });
  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      collectXmlFilesFromDirectory(baseDir, entryPath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.xml')) {
      files[toPosixPath(relative(baseDir, entryPath))] = entryPath;
    }
  }
}

function toPosixPath(filePath) {
  return filePath.split(sep).join('/');
}

export function compareXmlFiles(originalDir, exportedDir, includeDirs) {
  const originalFiles = collectXmlFiles(originalDir, includeDirs);
  const exportedFiles = collectXmlFiles(exportedDir, includeDirs);
  const originalSet = new Set(Object.keys(originalFiles));
  const exportedSet = new Set(Object.keys(exportedFiles));
  const missing = sortedDifference(originalSet, exportedSet);
  const extra = sortedDifference(exportedSet, originalSet);
  const common = sortedIntersection(originalSet, exportedSet);
  const ok = [];
  const changed = [];
  const errors = [];
  const driftDetails = {};

  for (const relPath of common) {
    compareCommonFile(relPath, originalFiles, exportedFiles, ok, changed, errors, driftDetails);
  }

  return { ok, changed, missing, extra, errors, driftDetails };
}

function compareCommonFile(relPath, originalFiles, exportedFiles, ok, changed, errors, driftDetails) {
  try {
    const originalText = readFileSync(originalFiles[relPath], 'utf8');
    const exportedText = readFileSync(exportedFiles[relPath], 'utf8');
    const originalRoot = normalizeElement(parseXml(originalText, originalFiles[relPath]));
    const exportedRoot = normalizeElement(parseXml(exportedText, exportedFiles[relPath]));
    if (serializeElement(originalRoot) === serializeElement(exportedRoot)) {
      ok.push(relPath);
      return;
    }
    changed.push(relPath);
    const summary = summarizeDataDrift(originalRoot, exportedRoot);
    if (summary) {
      driftDetails[relPath] = summary;
    }
  } catch (error) {
    errors.push([relPath, error.message]);
  }
}

// ---------------------------------------------------------------------------
// Structured drift report (per-row, per-field) for Etendo `<data>` XMLs.
//
// Etendo's `export.database` writes table data as:
//   <data>
//     <TABLE_TAG>
//       <PK_COL>...</PK_COL>
//       <COL_A>...</COL_A>
//       ...
//     </TABLE_TAG>
//     ...
//   </data>
//
// When both files follow this shape AND every row has an `*_ID` PK column,
// we can produce a semantic diff (added / removed / changed rows + per-field
// before/after) that is far easier to read than `diff -ru` on the raw XML.
// For any other shape we return null and callers fall back to the file-level
// "changed" listing.
// ---------------------------------------------------------------------------
function summarizeDataDrift(originalRoot, exportedRoot) {
  if (originalRoot.tag !== 'data' || exportedRoot.tag !== 'data') return null;
  const originalRows = indexRowsByPk(originalRoot);
  const exportedRows = indexRowsByPk(exportedRoot);
  if (!originalRows || !exportedRows) return null;
  const added = [];
  const removed = [];
  const changed = [];
  for (const [pk, predRow] of exportedRows) {
    if (!originalRows.has(pk)) added.push({ pk, tag: predRow.tag, fields: rowToFieldMap(predRow) });
  }
  for (const [pk, prevRow] of originalRows) {
    if (!exportedRows.has(pk)) removed.push({ pk, tag: prevRow.tag, fields: rowToFieldMap(prevRow) });
  }
  for (const [pk, prevRow] of originalRows) {
    const predRow = exportedRows.get(pk);
    if (!predRow) continue;
    const prevFields = rowToFieldMap(prevRow);
    const predFields = rowToFieldMap(predRow);
    const allKeys = new Set([...Object.keys(prevFields), ...Object.keys(predFields)]);
    const diffs = {};
    for (const k of allKeys) {
      if (prevFields[k] !== predFields[k]) {
        diffs[k] = { prev: prevFields[k] ?? null, pred: predFields[k] ?? null };
      }
    }
    if (Object.keys(diffs).length > 0) {
      changed.push({ pk, tag: prevRow.tag, diffs });
    }
  }
  added.sort((a, b) => compareStrings(a.pk, b.pk));
  removed.sort((a, b) => compareStrings(a.pk, b.pk));
  changed.sort((a, b) => compareStrings(a.pk, b.pk));
  return { added, removed, changed };
}

function indexRowsByPk(dataRoot) {
  const out = new Map();
  for (const row of dataRoot.children) {
    const pk = pickRowPk(row);
    if (!pk) return null;
    out.set(pk, row);
  }
  return out;
}

function pickRowPk(rowElement) {
  // Etendo convention: the primary key column matches the row tag suffixed
  // with `_ID` (e.g. <ETGO_SF_SPEC> → <ETGO_SF_SPEC_ID>). Prefer that when
  // available — falling back to the first `*_ID` child is wrong because
  // `normalizeElement` sorts children alphabetically, so the first match is
  // usually `AD_CLIENT_ID` ("0" for every row) which collapses all rows
  // under the same key.
  const expectedPkTag = `${rowElement.tag}_ID`;
  for (const child of rowElement.children) {
    if (child.tag === expectedPkTag && child.children.length === 0 && child.text) {
      return child.text;
    }
  }
  for (const child of rowElement.children) {
    if (child.tag.endsWith('_ID') && child.children.length === 0 && child.text) {
      return child.text;
    }
  }
  return null;
}

function rowToFieldMap(rowElement) {
  const fields = {};
  for (const child of rowElement.children) {
    if (child.children.length === 0) {
      fields[child.tag] = child.text || '';
    }
  }
  return fields;
}

const DRIFT_HINT_KEYS = ['NAME', 'AD_TAB_ID', 'AD_COLUMN_ID', 'ETGO_SF_ENTITY_ID', 'ETGO_SF_SPEC_ID'];

function rowHint(fields) {
  const parts = [];
  for (const key of DRIFT_HINT_KEYS) {
    if (fields[key]) parts.push(`${key}=${fields[key]}`);
  }
  return parts.length > 0 ? `  (${parts.join(', ')})` : '';
}

function truncate(value, max = 160) {
  if (value === null || value === undefined) return '<none>';
  const str = String(value);
  if (str.length <= max) return JSON.stringify(str);
  return JSON.stringify(str.slice(0, max - 1) + '…');
}

function printDriftDetails(driftDetails) {
  const paths = Object.keys(driftDetails).sort((a, b) => a.localeCompare(b));
  if (paths.length === 0) return;
  console.log('Drift detail (per-row, per-field):');
  console.log('-'.repeat(60));
  for (const filePath of paths) {
    const { added, removed, changed } = driftDetails[filePath];
    console.log(`File: ${filePath}`);
    console.log(`  + added:   ${added.length}`);
    console.log(`  - removed: ${removed.length}`);
    console.log(`  ~ changed: ${changed.length}`);
    if (added.length > 0) {
      console.log('  Added rows:');
      for (const row of added) {
        console.log(`    + ${row.tag} ${row.pk}${rowHint(row.fields)}`);
      }
    }
    if (removed.length > 0) {
      console.log('  Removed rows:');
      for (const row of removed) {
        console.log(`    - ${row.tag} ${row.pk}${rowHint(row.fields)}`);
      }
    }
    if (changed.length > 0) {
      console.log('  Changed rows:');
      for (const row of changed) {
        console.log(`    ~ ${row.tag} ${row.pk}${rowHint(rowToFieldMapFromDiffs(row.diffs))}`);
        for (const [col, { prev, pred }] of Object.entries(row.diffs)) {
          console.log(`        ${col}: ${truncate(prev)} → ${truncate(pred)}`);
        }
      }
    }
    console.log();
  }
}

function rowToFieldMapFromDiffs(diffs) {
  const fields = {};
  for (const [k, { pred, prev }] of Object.entries(diffs)) {
    fields[k] = pred ?? prev ?? '';
  }
  return fields;
}

function sortedDifference(left, right) {
  return [...left].filter((item) => !right.has(item)).sort(compareStrings);
}

function sortedIntersection(left, right) {
  return [...left].filter((item) => right.has(item)).sort(compareStrings);
}

function compareStrings(left, right) {
  return left.localeCompare(right);
}

function printSummaryCounts(ok, changed, missing, extra, errors) {
  const total = ok.length + changed.length + missing.length + extra.length;
  console.log(`Total files compared: ${total}`);
  console.log(`  OK:       ${ok.length}`);
  console.log(`  Changed:  ${changed.length}`);
  console.log(`  Missing:  ${missing.length}`);
  console.log(`  Extra:    ${extra.length}`);
  if (errors.length > 0) {
    console.log(`  Errors:   ${errors.length}`);
  }
}

function printPathSection(title, paths) {
  if (paths.length === 0) {
    return;
  }
  console.log(`${title}:`);
  for (const filePath of paths) {
    console.log(`  - ${filePath}`);
  }
  console.log();
}

function printErrorSection(errors) {
  if (errors.length === 0) {
    return;
  }
  console.log('XML parse errors:');
  for (const [filePath, message] of errors) {
    console.log(`  - ${filePath}: ${message}`);
  }
  console.log();
}

function hasInconsistencies(changed, missing, extra, errors) {
  return changed.length > 0 || missing.length > 0 || extra.length > 0 || errors.length > 0;
}

export function printTextReport(ok, changed, missing, extra, errors, driftDetails = {}) {
  console.log('='.repeat(60));
  console.log('XML Regeneration Check Report');
  console.log('='.repeat(60));
  printSummaryCounts(ok, changed, missing, extra, errors);
  console.log();
  printPathSection('Changed files', changed);
  printPathSection('Missing from export', missing);
  printPathSection('Extra in export', extra);
  printErrorSection(errors);
  printDriftDetails(driftDetails);
  const result = hasInconsistencies(changed, missing, extra, errors)
    ? 'FAIL — Inconsistencies detected.'
    : 'OK — All files match.';
  console.log(`Result: ${result}`);
}

export function printJsonReport(ok, changed, missing, extra, errors, driftDetails = {}) {
  const report = {
    summary: {
      total: ok.length + changed.length + missing.length + extra.length,
      ok: ok.length,
      changed: changed.length,
      missing: missing.length,
      extra: extra.length,
      errors: errors.length,
    },
    changed,
    missing,
    extra,
    errors: errors.map(([file, message]) => ({ file, message })),
    driftDetails,
    status: hasInconsistencies(changed, missing, extra, errors) ? 'FAIL' : 'OK',
  };
  console.log(JSON.stringify(report, null, 2));
}

function parseArgs(argv) {
  const options = { format: 'text', includeDirs: [] };
  const positional = [];
  let index = 0;
  while (index < argv.length) {
    index = parseArg(argv, index, options, positional);
  }
  return {
    originalDir: positional[0],
    exportedDir: positional[1],
    includeDirs: options.includeDirs.length > 0 ? options.includeDirs : DEFAULT_INCLUDE_DIRS,
    format: options.format,
    positionalCount: positional.length,
  };
}

function parseArg(argv, index, options, positional) {
  const arg = argv[index];
  if (arg === '--format') {
    options.format = readOptionValue(argv, index, '--format');
    validateFormat(options.format);
    return index + 2;
  }
  if (arg.startsWith('--format=')) {
    options.format = arg.slice('--format='.length);
    validateFormat(options.format);
    return index + 1;
  }
  if (arg === '--include-dir') {
    options.includeDirs.push(readOptionValue(argv, index, '--include-dir'));
    return index + 2;
  }
  if (arg.startsWith('--include-dir=')) {
    options.includeDirs.push(arg.slice('--include-dir='.length));
    return index + 1;
  }
  if (arg.startsWith('-')) {
    throw new XmlParseError(`Unknown option: ${arg}`);
  }
  positional.push(arg);
  return index + 1;
}

function readOptionValue(argv, index, optionName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new XmlParseError(`Missing value for ${optionName}`);
  }
  return value;
}

function validateFormat(format) {
  if (format !== 'text' && format !== 'json') {
    throw new XmlParseError(`Invalid format "${format}". Expected "text" or "json".`);
  }
}

function validateInput(args) {
  if (args.positionalCount !== 2) {
    throw new XmlParseError('Usage: node cli/src/xml-regeneration-check.js <original_dir> <exported_dir>');
  }
  if (!isDirectory(args.originalDir)) {
    throw new XmlParseError(`Error: original_dir '${args.originalDir}' is not a valid directory.`);
  }
  if (!isDirectory(args.exportedDir)) {
    throw new XmlParseError(`Error: exported_dir '${args.exportedDir}' is not a valid directory.`);
  }
}

function isDirectory(filePath) {
  return existsSync(filePath) && statSync(filePath).isDirectory();
}

export function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
    validateInput(args);
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  const { ok, changed, missing, extra, errors, driftDetails } = compareXmlFiles(
    args.originalDir,
    args.exportedDir,
    args.includeDirs,
  );

  if (args.format === 'json') {
    printJsonReport(ok, changed, missing, extra, errors, driftDetails);
  } else {
    printTextReport(ok, changed, missing, extra, errors, driftDetails);
  }

  return hasInconsistencies(changed, missing, extra, errors) ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
