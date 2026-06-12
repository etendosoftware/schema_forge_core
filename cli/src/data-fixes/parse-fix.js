/**
 * parse-fix.js
 *
 * Parser for tenant data-fix `.sql` files.
 *
 * A fix file has a metadata header (`-- @key: value` lines) followed by two
 * labeled sections introduced by bare marker lines `-- @check` and `-- @apply`:
 *
 *   -- @id: R3-periodcontrol
 *   -- @gap: C2
 *   -- @risk: medium
 *   -- @type: sql                 (default; or "webhook")
 *   -- @description: one-line human description
 *
 *   -- @check
 *   -- Returns >=1 row when the fix IS needed. 0 rows => SKIPPED_NOT_NEEDED.
 *   SELECT 1 FROM ... WHERE ad_client_id = :client_id AND NOT EXISTS (...);
 *
 *   -- @apply
 *   INSERT INTO ... SELECT ... WHERE ad_client_id = :client_id AND NOT EXISTS (...);
 *
 * The `fix_id` is the file name without the `.sql` extension (the leading
 * `<YYYYMMDDThhmmssZ>` prefix makes lexical sort == chronological order).
 */

const SECTION_MARKER = /^--\s*@(check|apply)\s*$/i;
const HEADER_LINE = /^--\s*@([A-Za-z_]+)\s*:\s*(.*)$/;

function validations(type, check, fixId, apply, meta) {
  if (type === 'sql') {
    if (!check) throw new Error(`${fixId}: missing or empty @check section`);
    if (!apply) throw new Error(`${fixId}: missing or empty @apply section`);
  } else if (!meta.webhook) {
    throw new Error(`${fixId}: @type webhook requires a "@webhook: <Name>" header`);
  }
}

/**
 * Parse the raw text of a fix file.
 *
 * @param {string} text  - file contents
 * @param {string} fixId - file name without `.sql`
 * @returns {{
 *   fixId: string, id: string, gap: string|null, risk: string|null,
 *   type: 'sql'|'webhook', description: string|null,
 *   webhook: string|null, check: string, apply: string
 * }}
 */
export function parseFix(text, fixId) {
  const lines = text.split('\n');

  const meta = {};
  const checkLines = [];
  const applyLines = [];
  let section = 'header'; // 'header' | 'check' | 'apply'

  for (const line of lines) {
    const marker = line.match(SECTION_MARKER);
    if (marker) {
      section = marker[1].toLowerCase();
      continue;
    }

    if (section === 'header') {
      const h = line.match(HEADER_LINE);
      if (h) meta[h[1].toLowerCase()] = h[2].trim();
      // non-header lines in the header region (blank lines, free comments) are ignored
      continue;
    }

    if (section === 'check') checkLines.push(line);
    else if (section === 'apply') applyLines.push(line);
  }

  const type = (meta.type || 'sql').toLowerCase();
  if (type !== 'sql' && type !== 'webhook') {
    throw new Error(`${fixId}: invalid @type "${meta.type}" (expected sql|webhook)`);
  }

  const check = checkLines.join('\n').trim();
  const apply = applyLines.join('\n').trim();

  validations(type, check, fixId, apply, meta);



  return {
    fixId,
    id: meta.id || fixId,
    gap: meta.gap || null,
    risk: meta.risk || null,
    type,
    description: meta.description || null,
    webhook: meta.webhook || null,
    check,
    apply,
  };
}

/**
 * Parse the `<YYYYMMDDThhmmssZ>` timestamp prefix of a fix_id into a Date (UTC).
 * Returns null when the fix_id has no parseable timestamp prefix (e.g. the
 * `__baseline__` sentinel).
 *
 * @param {string} fixId
 * @returns {Date|null}
 */
export function parseFixTimestamp(fixId) {
  const m = fixId.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
}

// AD ids are either the System sentinel '0', the org wildcard '*', or 32 hex chars.
const AD_ID = /^([0-9A-Fa-f]{32}|0|\*)$/;

/**
 * Inline validated AD ids into a SQL body in place of `:client_id` / `:org_id`.
 *
 * node-postgres cannot run a multi-statement body with bind parameters
 * (extended protocol is single-statement only), and an `@apply` may contain
 * several statements. Since the ids are tightly controlled AD ids, we validate
 * them strictly against {@link AD_ID} and inline them as quoted literals.
 *
 * @param {string} sql
 * @param {{client_id: string, org_id?: string}} binds
 * @returns {string}
 */
export function inlineParams(sql, binds) {
  const { client_id, org_id } = binds;
  if (!AD_ID.test(client_id)) {
    throw new Error(`inlineParams: refusing to inline unsafe client_id "${client_id}"`);
  }
  if (org_id != null && !AD_ID.test(org_id)) {
    throw new Error(`inlineParams: refusing to inline unsafe org_id "${org_id}"`);
  }
  let out = sql.replace(/:client_id\b/g, `'${client_id}'`);
  if (org_id != null) out = out.replace(/:org_id\b/g, `'${org_id}'`);
  return out;
}
