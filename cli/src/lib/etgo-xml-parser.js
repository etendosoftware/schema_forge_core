/**
 * etgo-xml-parser.js — Manual parser for ETGO_SF_*.xml sourcedata files.
 *
 * The XML files produced by Etendo's `export.database` follow a fixed shape:
 *
 *   <data>
 *     <!--UUID--><TABLE_NAME>
 *     <!--UUID-->  <COLUMN_NAME><![CDATA[value]]></COLUMN_NAME>
 *     ...
 *     <!--UUID--></TABLE_NAME>
 *   </data>
 *
 * No namespaces, no attributes on the record element, every value wrapped in
 * CDATA. A regex-based parser is sufficient and avoids an `xml2js`-style
 * dependency. If Etendo ever changes the format, the alternative is to add
 * a real XML library — but that day hasn't come.
 *
 * Public API:
 *   - parseEtgoXmlFile(path, tableTag) → { rows: [{ <COL>: <val>, ... }], rawText }
 *   - loadEtgoXmlSnapshot(prevDir)     → { spec: [...], entity: [...], field: [...] }
 *
 * Column names are returned as UPPERCASE strings (as they appear in the XML);
 * values are strings (CDATA contents). Null is NOT preserved separately from
 * empty string — XML doesn't carry that distinction in this format.
 */

import { readFile } from 'node:fs/promises';

/**
 * Parse a single ETGO_SF_*.xml file and return its rows.
 *
 * @param {string} path - Absolute path to the XML file
 * @param {string} tableTag - The element name wrapping each record
 *                            (e.g. "ETGO_SF_SPEC")
 * @returns {Promise<{ rows: Array<Record<string,string>>, rawText: string }>}
 */
export async function parseEtgoXmlFile(path, tableTag) {
  const text = await readFile(path, 'utf-8');
  return { rows: parseEtgoXmlText(text, tableTag), rawText: text };
}

/**
 * Pure version of parseEtgoXmlFile for unit testing.
 */
export function parseEtgoXmlText(text, tableTag) {
  const rows = [];
  // Match each <TABLE_TAG>...</TABLE_TAG> block. The opening tag may be
  // preceded by an HTML-style comment carrying the record UUID; we ignore
  // those because every field carries the same UUID inline.
  const blockRe = new RegExp(`<${tableTag}>([\\s\\S]*?)</${tableTag}>`, 'g');
  let match;
  while ((match = blockRe.exec(text)) !== null) {
    rows.push(parseBlock(match[1]));
  }
  return rows;
}

/**
 * Parse the inside of one record element into a { COL: value } object.
 * Strips comments, finds every <COL><![CDATA[...]]></COL> (or plain text).
 */
function parseBlock(inner) {
  const row = {};
  // Strip XML comments to avoid <!--UUID--> capturing junk.
  const clean = inner.replace(/<!--[\s\S]*?-->/g, '');
  // Match either <COL><![CDATA[val]]></COL> or <COL>val</COL>.
  const fieldRe = /<([A-Z0-9_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/\1>/g;
  let m;
  while ((m = fieldRe.exec(clean)) !== null) {
    const col = m[1];
    const val = m[2] !== undefined ? m[2] : (m[3] ?? '');
    row[col] = val;
  }
  return row;
}

/**
 * Load the three ETGO_SF_*.xml files from a sourcedata directory.
 * Throws with a clear message if any file is missing (no silent empty).
 *
 * @param {string} prevDir - The src-db/database/sourcedata directory
 * @returns {Promise<{ spec: Array, entity: Array, field: Array }>}
 */
export async function loadEtgoXmlSnapshot(prevDir) {
  const { join } = await import('node:path');
  const files = {
    spec:   { path: join(prevDir, 'ETGO_SF_SPEC.xml'),   tag: 'ETGO_SF_SPEC' },
    entity: { path: join(prevDir, 'ETGO_SF_ENTITY.xml'), tag: 'ETGO_SF_ENTITY' },
    field:  { path: join(prevDir, 'ETGO_SF_FIELD.xml'),  tag: 'ETGO_SF_FIELD' },
  };
  const result = {};
  for (const [key, { path, tag }] of Object.entries(files)) {
    try {
      const parsed = await parseEtgoXmlFile(path, tag);
      result[key] = parsed.rows;
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(
          `Prev-XML snapshot missing: ${path}\n` +
          `Pass --prev-xml-dir <dir> or set ETENDO_ROOT to point at a checkout\n` +
          `containing modules/com.etendoerp.go/src-db/database/sourcedata/.`
        );
      }
      throw err;
    }
  }
  return result;
}

/**
 * Build an index of prev-XML rows keyed by a natural-key function.
 * Returns a Map<naturalKey, row>. Rows whose natural key is null/undefined
 * are skipped silently — the prev-XML occasionally has half-baked test data.
 */
export function indexByNaturalKey(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (k != null && k !== '') map.set(k, row);
  }
  return map;
}
