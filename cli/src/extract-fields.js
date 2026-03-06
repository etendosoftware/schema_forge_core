import { createReadStream } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDbPool, closePool } from './db.js';
import { toCamelCase, computeChecksum, generateVersion } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..', '..');

/**
 * Load a JSON file from the core-maps directory.
 */
async function loadCoreMap(filename) {
  const raw = await readFile(join(ROOT, 'core-maps', filename), 'utf-8');
  return JSON.parse(raw);
}

/**
 * Priority-based classification of a field row (TDD 3.1).
 *
 * Priority order:
 * 1. Primary key (columnName === tableName + '_ID')
 * 2. Known system column (present in systemColumns map)
 * 3. Audit columns (Created/CreatedBy/Updated/UpdatedBy)
 * 4. Not displayed (isDisplayed === 'N')
 * 5. Read-only or not updateable
 * 6. Everything else → editable
 */
export function classifyField(fieldRow, systemColumns) {
  const { columnname, tablename, isdisplayed, isreadonly, isupdateable, defaultvalue } = fieldRow;

  // 1. Primary key
  if (columnname === tablename + '_ID') {
    return {
      visibility: 'system',
      systemCategory: 'internal',
      derivation: { type: 'sequence' },
    };
  }

  // 2. Known system column
  if (systemColumns[columnname]) {
    const entry = systemColumns[columnname];
    return {
      visibility: 'system',
      systemCategory: entry.systemCategory,
      derivation: entry.derivation ?? inferDerivation(defaultvalue),
    };
  }

  // 3. Audit columns
  const auditColumns = ['Created', 'CreatedBy', 'Updated', 'UpdatedBy'];
  if (auditColumns.includes(columnname)) {
    return {
      visibility: 'system',
      systemCategory: 'audit',
    };
  }

  // 4. Not displayed
  if (isdisplayed === 'N') {
    return {
      visibility: 'system',
      ...(inferCategoryFromColumn(columnname) && {
        systemCategory: inferCategoryFromColumn(columnname),
      }),
    };
  }

  // 5. Read-only or not updateable
  if (isreadonly === 'Y' || isupdateable === 'N') {
    return {
      visibility: 'readOnly',
    };
  }

  // 6. Default: editable
  return {
    visibility: 'editable',
  };
}

/**
 * Attempt to infer a system category from a column name for hidden fields.
 */
function inferCategoryFromColumn(columnName) {
  if (columnName.endsWith('_ID')) return 'internal';
  if (/^(Is|Has)/.test(columnName)) return 'internal';
  return null;
}

/**
 * Parse Etendo default values into derivation objects.
 *
 * - null → null
 * - @VAR@ pattern → { type: 'fromConfig', source: 'context.varName' }
 * - @SQL=... → { type: 'lookup', source: sqlString }
 * - Other → { type: 'computed', source: defaultValue }
 */
export function inferDerivation(defaultValue) {
  if (defaultValue == null) return null;

  // @SQL=... pattern
  if (defaultValue.startsWith('@SQL=')) {
    return {
      type: 'lookup',
      source: defaultValue.slice(5),
    };
  }

  // @VAR@ pattern — match the full string being a single @...@ token
  const varMatch = defaultValue.match(/^@([A-Za-z_][A-Za-z0-9_]*)@$/);
  if (varMatch) {
    const varName = toCamelCase(varMatch[1]);
    return {
      type: 'fromConfig',
      source: `context.${varName}`,
    };
  }

  // Plain value
  return {
    type: 'computed',
    source: defaultValue,
  };
}

/**
 * Build reference metadata for foreign key fields.
 * Resolves target table, display column, and filters from AD config tables.
 * Falls back to TableDir convention (column name minus '_ID') when no explicit config exists.
 */
export function buildReference(row) {
  const refName = row.reference_name;

  // Table or TableDir with explicit AD_Ref_Table config
  if (row.ref_table_target) {
    return {
      type: refName,  // 'Table' or 'TableDir'
      targetTable: row.ref_table_target,
      keyColumn: row.ref_table_key || null,
      displayColumn: row.ref_table_display || 'Name',
      filterExpression: row.ref_table_filter || null,
      orderBy: row.ref_table_orderby || null,
    };
  }

  // Search with AD_Ref_Search config
  if (row.ref_search_target) {
    return {
      type: 'Search',
      targetTable: row.ref_search_target,
      keyColumn: row.ref_search_column || null,
      displayColumn: null,  // Search doesn't store display column in ad_ref_search
      filterExpression: null,
    };
  }

  // OBUISEL Selector
  if (row.ref_selector_target) {
    return {
      type: 'Selector',
      targetTable: row.ref_selector_target,
      selectorName: row.ref_selector_name,
      filterExpression: row.ref_selector_filter || null,
      hql: row.ref_selector_hql || null,
      displayColumn: null,  // Comes from obuisel_selector_field, not extracted here yet
    };
  }

  // TableDir convention fallback: infer from column name
  if (refName === 'TableDir' && row.columnname?.endsWith('_ID')) {
    return {
      type: 'TableDir',
      targetTable: row.columnname.slice(0, -3),  // Strip '_ID'
      keyColumn: row.columnname,
      displayColumn: 'Name',
      filterExpression: null,
    };
  }

  return null;
}

/**
 * Build the full schema structure from DB rows.
 *
 * Groups rows by tab, maps AD_Reference_IDs to schema types, and produces
 * the schema-raw.json structure per TDD 2.1.
 */
export function buildSchema(rows, systemColumns, refMap) {
  if (!rows || rows.length === 0) {
    return { window: null, entities: [] };
  }

  const windowName = rows[0].window_name;
  const windowId = rows[0].ad_window_id;

  // Group rows by tab
  const tabMap = new Map();
  for (const row of rows) {
    const tabId = row.ad_tab_id;
    if (!tabMap.has(tabId)) {
      tabMap.set(tabId, {
        tabId,
        tabName: row.tab_name,
        tabLevel: row.tablevel,
        tabSeq: row.tab_seq,
        tableName: row.tablename,
        entityClassname: row.entity_classname,
        entityAlias: row.entity_alias,
        entityJavaPackage: row.entity_javapackage,
        whereClause: row.whereclause,
        orderByClause: row.orderbyclause,
        filterClause: row.filterclause,
        hqlWhereClause: row.hqlwhereclause,
        hqlOrderByClause: row.hqlorderbyclause,
        hqlFilterClause: row.hqlfiltclause,
        fields: [],
      });
    }
    tabMap.get(tabId).fields.push(row);
  }

  // Convert tabs to entities
  const entities = [];
  for (const tab of tabMap.values()) {
    const fields = tab.fields.map((row) => {
      const classification = classifyField(row, systemColumns);
      const schemaType = refMap[String(row.ad_reference_id)] ?? 'string';
      const fieldDef = {
        name: toCamelCase(row.columnname),
        columnName: row.columnname,
        label: row.field_name,
        type: schemaType,
        mandatory: row.ismandatory === 'Y',
        ...classification,
      };

      // Add derivation from inferDerivation if not already set by classification
      if (!fieldDef.derivation && row.defaultvalue) {
        const derivation = inferDerivation(row.defaultvalue);
        if (derivation) {
          fieldDef.derivation = derivation;
        }
      }

      // Add constraints if present
      if (row.fieldlength) fieldDef.maxLength = row.fieldlength;
      if (row.valuemin != null) fieldDef.valueMin = row.valuemin;
      if (row.valuemax != null) fieldDef.valueMax = row.valuemax;

      // Add display/readOnly logic if present (convention #6: omit key if null)
      if (row.displaylogic) fieldDef.displayLogic = row.displaylogic;
      if (row.displaylogic_server) fieldDef.displayLogicServer = row.displaylogic_server;
      if (row.displaylogicgrid) fieldDef.displayLogicGrid = row.displaylogicgrid;
      if (row.readonlylogic) fieldDef.readOnlyLogic = row.readonlylogic;

      // Add callout if present
      if (row.callout_class) fieldDef.callout = row.callout_class;

      // Add validation rule reference if present
      if (row.ad_val_rule_id) fieldDef.validationRuleId = row.ad_val_rule_id;

      // Add reference metadata for foreign key fields
      if (schemaType === 'foreignKey') {
        const reference = buildReference(row);
        if (reference) {
          fieldDef.reference = reference;
        }
      }

      return fieldDef;
    });

    const entityClassname = tab.entityClassname || tab.entityAlias || toCamelCase(tab.tableName);
    const entityJavaPackage = tab.entityJavaPackage || null;

    const entity = {
      name: toCamelCase(tab.tableName),
      tableName: tab.tableName,
      entityClassname,
      entityJavaPackage,
      tabName: tab.tabName,
      level: tab.tabLevel,
      sequence: tab.tabSeq,
      fields,
    };

    // Full qualified Java class: package + classname
    if (entityJavaPackage && entityClassname) {
      entity.entityFullClass = `${entityJavaPackage}.${entityClassname}`;
    }

    // Add tab clauses if present (convention #6: omit key if null)
    if (tab.whereClause) entity.whereClause = tab.whereClause;
    if (tab.orderByClause) entity.orderByClause = tab.orderByClause;
    if (tab.filterClause) entity.filterClause = tab.filterClause;
    if (tab.hqlWhereClause) entity.hqlWhereClause = tab.hqlWhereClause;
    if (tab.hqlOrderByClause) entity.hqlOrderByClause = tab.hqlOrderByClause;
    if (tab.hqlFilterClause) entity.hqlFilterClause = tab.hqlFilterClause;

    entities.push(entity);
  }

  return {
    window: {
      id: windowId,
      name: windowName,
    },
    entities,
    meta: {
      version: generateVersion(),
      checksum: computeChecksum({ windowId, entities }),
      extractedAt: new Date().toISOString(),
    },
  };
}

/**
 * SQL query to extract all fields for a window (TDD 3.1).
 */
const EXTRACT_SQL = `
SELECT
  w.AD_Window_ID, w.Name AS window_name,
  t.AD_Tab_ID, t.Name AS tab_name, t.TabLevel, t.SeqNo AS tab_seq,
  t.WhereClause, t.OrderByClause, t.FilterClause,
  t.HQLWhereClause, t.HQLOrderByClause, t.HQLFilterClause,
  tbl.TableName, tbl.Classname AS entity_classname, tbl.Entity_Alias,
  pkg.JavaPackage AS entity_javapackage,
  f.AD_Field_ID, f.Name AS field_name,
  f.IsDisplayed, f.IsReadOnly,
  f.DisplayLogic, f.DisplayLogic_Server, f.DisplayLogicGrid,
  f.SeqNo AS field_seq,
  c.ColumnName, c.AD_Reference_ID, c.IsMandatory, c.IsUpdateable,
  c.DefaultValue, c.FieldLength, c.ValueMin, c.ValueMax,
  c.AD_Val_Rule_ID, c.ReadOnlyLogic,
  c.AD_Reference_Value_ID,
  r.Name AS reference_name,
  mo.Classname AS callout_class,
  -- Table/TableDir reference config
  rt_tgt.TableName AS ref_table_target,
  rt_disp.ColumnName AS ref_table_display,
  rt_key.ColumnName AS ref_table_key,
  rt.WhereClause AS ref_table_filter,
  rt.OrderByClause AS ref_table_orderby,
  -- Search reference config
  rs_tgt.TableName AS ref_search_target,
  rs_col.ColumnName AS ref_search_column,
  -- Selector reference config
  sel.Name AS ref_selector_name,
  sel_tgt.TableName AS ref_selector_target,
  sel.WhereClause AS ref_selector_filter,
  sel.HQL AS ref_selector_hql
FROM AD_Field f
JOIN AD_Tab t ON f.AD_Tab_ID = t.AD_Tab_ID
JOIN AD_Window w ON t.AD_Window_ID = w.AD_Window_ID
JOIN AD_Column c ON f.AD_Column_ID = c.AD_Column_ID
JOIN AD_Table tbl ON c.AD_Table_ID = tbl.AD_Table_ID
LEFT JOIN AD_Package pkg ON tbl.AD_Package_ID = pkg.AD_Package_ID
JOIN AD_Reference r ON c.AD_Reference_ID = r.AD_Reference_ID
LEFT JOIN AD_Model_Object mo ON mo.AD_Callout_ID = c.AD_Callout_ID
LEFT JOIN ad_ref_table rt ON c.ad_reference_value_id = rt.ad_reference_id
LEFT JOIN ad_table rt_tgt ON rt.ad_table_id = rt_tgt.ad_table_id
LEFT JOIN ad_column rt_key ON rt.ad_key = rt_key.ad_column_id
LEFT JOIN ad_column rt_disp ON rt.ad_display = rt_disp.ad_column_id
LEFT JOIN ad_ref_search rs ON c.ad_reference_value_id = rs.ad_reference_id
LEFT JOIN ad_table rs_tgt ON rs.ad_table_id = rs_tgt.ad_table_id
LEFT JOIN ad_column rs_col ON rs.ad_column_id = rs_col.ad_column_id
LEFT JOIN obuisel_selector sel ON sel.ad_reference_id = c.ad_reference_value_id
LEFT JOIN ad_table sel_tgt ON sel.ad_table_id = sel_tgt.ad_table_id
WHERE w.AD_Window_ID = $1
  AND f.IsActive = 'Y' AND t.IsActive = 'Y'
ORDER BY t.SeqNo, f.SeqNo
`;

/**
 * Main entry point: connects to DB, queries fields for a window,
 * builds the schema, and writes schema-raw.json.
 *
 * Can be called programmatically (returns the schema object) or via CLI.
 */
export async function main(windowId, windowName) {
  const systemColumns = await loadCoreMap('system-columns.json');
  const refMap = await loadCoreMap('ad-reference-map.json');

  const pool = createDbPool();
  try {
    const result = await pool.query(EXTRACT_SQL, [windowId]);
    const rows = result.rows;

    if (rows.length === 0) {
      console.warn(`No fields found for window ID ${windowId}`);
      return { window: null, entities: [] };
    }

    // Use window name from DB if not provided
    const resolvedName = windowName ?? rows[0].window_name;
    const schema = buildSchema(rows, systemColumns, refMap);

    // Write to artifacts directory
    const artifactsDir = join(ROOT, 'artifacts', resolvedName);
    await mkdir(artifactsDir, { recursive: true });
    const outputPath = join(artifactsDir, 'schema-raw.json');
    await writeFile(outputPath, JSON.stringify(schema, null, 2), 'utf-8');

    console.log(`Schema written to ${outputPath}`);
    console.log(`  Entities: ${schema.entities.length}`);
    console.log(`  Total fields: ${schema.entities.reduce((sum, e) => sum + e.fields.length, 0)}`);

    return schema;
  } finally {
    await closePool(pool);
  }
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const windowId = process.argv[2];
  const windowName = process.argv[3];

  if (!windowId) {
    console.error('Usage: node extract-fields.js <windowId> [windowName]');
    process.exit(1);
  }

  main(windowId, windowName).catch((err) => {
    console.error('Extraction failed:', err.message);
    process.exit(1);
  });
}
