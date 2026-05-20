import { createDbPool, closePool } from './db.js';
import { searchMenu } from './menu-cache.js';

/**
 * SQL query to resolve a menu entry from AD_Menu by ID.
 * LEFT JOINs AD_Form to get the classname for form source file hints.
 */
export const MENU_QUERY = `
  SELECT m.AD_Menu_ID, m.Name, m.Action, m.AD_Window_ID, m.AD_Process_ID, m.IsSummary,
         f.ClassName AS form_classname
  FROM AD_Menu m
  LEFT JOIN AD_Form f ON f.AD_Form_ID = m.AD_Form_ID AND f.IsActive = 'Y'
  WHERE m.AD_Menu_ID = $1 AND m.IsActive = 'Y'
`;

/**
 * SQL query to resolve a menu entry from AD_Menu by name (case-insensitive).
 * LEFT JOINs AD_Form to get the classname for form source file hints.
 */
export const MENU_QUERY_BY_NAME = `
  SELECT m.AD_Menu_ID, m.Name, m.Action, m.AD_Window_ID, m.AD_Process_ID, m.IsSummary,
         f.ClassName AS form_classname
  FROM AD_Menu m
  LEFT JOIN AD_Form f ON f.AD_Form_ID = m.AD_Form_ID AND f.IsActive = 'Y'
  WHERE LOWER(m.Name) = LOWER($1) AND m.IsActive = 'Y'
`;

/**
 * Convert a name to kebab-case.
 * Lowercases, replaces spaces/underscores with hyphens,
 * removes non-alphanumeric chars except hyphens, collapses multiple hyphens, trims hyphens.
 */
export function toKebabCase(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/(^-)|(-$)/g, '');
}

/**
 * Map cache entry type to AD_Menu action code.
 */
const TYPE_TO_ACTION = { window: 'W', process: 'P', report: 'R', form: 'X', folder: null };

/**
 * Resolve a single menu row into a result object.
 * Accepts both DB rows (from MENU_QUERY) and cache entries (from menu-cache.js).
 *
 * @param {object} row - DB row or cache entry
 * @returns {{action: string, menuName: string, windowId: string|null, processId: string|null, resolvedMode: string, resolvedName: string}}
 */
export function resolveFromRow(row) {
  // Normalize: support both DB row format and cache entry format
  const action = row.action || TYPE_TO_ACTION[row.type] || null;
  const menuName = row.name;
  const windowId = row.ad_window_id || row.windowId || null;
  const processId = row.ad_process_id || row.processId || null;
  const isSummary = row.issummary || (row.type === 'folder' ? 'Y' : 'N');

  if (isSummary === 'Y') {
    throw new Error('Menu entry is a folder, not an actionable item');
  }

  if (action === 'R') {
    return {
      action,
      menuName,
      windowId,
      processId,
      resolvedMode: 'report',
      resolvedName: toKebabCase(menuName),
    };
  }

  if (action === 'X') {
    const formClassname = row.form_classname || null;
    const classSimpleName = formClassname
      ? formClassname.split('.').pop()
      : null;
    const sourceHint = classSimpleName
      ? `\n  Java: src/org/openbravo/erpCommon/ad_forms/${classSimpleName}.java` +
        `\n  HTML: src/org/openbravo/erpCommon/ad_forms/${classSimpleName}.html`
      : '';

    throw new Error(
      `'${menuName}' is an AD_Form. Forms have no extractable metadata and cannot be processed by the pipeline. This must be built manually.${sourceHint}`
    );
  }

  let resolvedMode;
  if (action === 'W') {
    resolvedMode = 'window';
  } else if (action === 'P') {
    resolvedMode = 'process';
  } else {
    throw new Error(`Unsupported menu action '${action}' for menu '${menuName}'`);
  }

  return {
    action,
    menuName,
    windowId,
    processId,
    resolvedMode,
    resolvedName: toKebabCase(menuName),
  };
}

/**
 * Resolve a menu entry from AD_Menu by ID.
 * Tries cache first, falls back to DB.
 *
 * @param {string} menuId - AD_Menu_ID to look up
 */
export async function resolveMenuEntry(menuId) {
  // Try cache first (search by ID is an exact match on the id field)
  const { loadCache } = await import('./menu-cache.js');
  const cache = await loadCache();
  if (cache) {
    const entry = cache.entries.find(e => e.id === menuId);
    if (entry) return resolveFromRow(entry);
  }

  // Fall back to DB
  const pool = createDbPool();
  try {
    const { rows } = await pool.query(MENU_QUERY, [menuId]);

    if (rows.length === 0) {
      throw new Error(`Menu entry not found: ${menuId}`);
    }

    return resolveFromRow(rows[0]);
  } finally {
    await closePool(pool);
  }
}

/**
 * Resolve a menu entry from AD_Menu by name.
 * Uses the menu cache with fuzzy search and auto-refresh.
 * Falls back to exact DB match if cache produces ambiguous results.
 *
 * @param {string} menuName - Menu name to look up
 */
export async function resolveMenuByName(menuName) {
  // Use cache with fuzzy search (auto-refreshes on miss)
  const results = await searchMenu(menuName);

  if (results.length === 1) {
    return resolveFromRow(results[0]);
  }

  if (results.length > 1) {
    // Check for exact match first
    const exact = results.find(r => r.name.toLowerCase() === menuName.toLowerCase());
    if (exact) return resolveFromRow(exact);

    // Multiple fuzzy matches — show them to the user
    const list = results.slice(0, 10).map(r => `  [${r.type}] ${r.name} (ID: ${r.id})`).join('\n');
    throw new Error(
      `Multiple menu entries match '${menuName}':\n${list}\n\nUse --menu-id with a specific ID, or use the exact name.`
    );
  }

  // Cache miss even after refresh — try DB as last resort
  const pool = createDbPool();
  try {
    const { rows } = await pool.query(MENU_QUERY_BY_NAME, [menuName]);

    if (rows.length === 0) {
      throw new Error(`Menu entry not found: '${menuName}'. Use 'node cli/src/menu-cache.js search <term>' to browse available entries.`);
    }

    if (rows.length > 1) {
      const list = rows.map(r => `${r.name} (ID: ${r.ad_menu_id})`).join(', ');
      throw new Error(
        `Multiple menu entries found for '${menuName}': ${list}. Use --menu-id with a specific ID.`
      );
    }

    return resolveFromRow(rows[0]);
  } finally {
    await closePool(pool);
  }
}
