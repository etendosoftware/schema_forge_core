/**
 * THE single definition of report row grouping, opening balances and account
 * trees — everything that turns a flat SQL result set into the `meta.groups`,
 * `meta.tbGroups` and indented-tree shapes the report templates render.
 *
 * Why this module exists: reports are rendered by TWO engines — the Vite dev
 * plugin in the functional repo (`tools/app-shell/vite-plugins/report-api.js`)
 * and the production report-server (`tools/report-server/server.js`), created in
 * 2026-04 as an explicit hand copy of the dev one. Everything below was written
 * inline in the dev plugin, so the server never had any of it: Libro Mayor's
 * opening balances, Trial Balance's dimension folding and Balance Sheet /
 * Profit & Loss's account trees all rendered correctly on a developer's machine
 * and not at all on a server.
 *
 * That is the same failure mode as ETP-4899 (`report-descriptor.js`) and the
 * i18n split fixed alongside this one (`report-i18n.js`), and the rule behind
 * all of them is identical: code that lives in a shared module reaches
 * production, code written inline in the dev plugin never does.
 *
 * Everything here is pure — rows in, rows out, no DB, no fs, no Vite. The
 * queries that FEED it (`contract.sql.openingQuery` / `operandsQuery`) are the
 * caller's job, because each engine owns its own pool.
 */

import { pickLabel } from './report-i18n.js';

/**
 * Sums an account's opening-balance rows (`contract.sql.openingQuery`'s output —
 * one row per account × dimension-breakdown combo, already aggregated in SQL) down
 * to a single {amtacctdr, amtacctcr, total} for one account. When `dimensionField`
 * is set, only rows whose dimension value matches `dimensionValue` count — mirrors
 * Classic's `AddTotals` (`ReportGeneralLedger.java`), which re-queries the opening
 * balance scoped to "this account under this dimension value" on every group break.
 * When there's no dimension (flat report), every breakdown row for the account is
 * summed — equivalent to Classic's ungrouped path, which has no per-dimension scope.
 */
export function foldOpeningBalance(openingRows, accountValue, dimensionField, dimensionValue) {
  const opening = { amtacctdr: 0, amtacctcr: 0, total: 0 };
  if (!Array.isArray(openingRows)) return opening;
  for (const r of openingRows) {
    if ((r.value || '') !== accountValue) continue;
    if (dimensionField && (r[dimensionField] || '') !== dimensionValue) continue;
    opening.amtacctdr += Number(r.openingdr) || 0;
    opening.amtacctcr += Number(r.openingcr) || 0;
    opening.total += Number(r.openingtotal) || 0;
  }
  return opening;
}

/**
 * Nests already-sorted rows into dimension → account groups, each carrying its own
 * opening balance, running (cumulative) balance per line, and closing subtotal/total —
 * the data shape both the flat and nested-card templates need, since Handlebars has no
 * per-group aggregation or running-sum of its own. `rows` must already be sorted by
 * `dimensionField` (when grouping) with each dimension's rows themselves ordered by
 * account (both already true by the time this is called — see the groupBy sort above).
 * Without a `dimensionField`, everything folds into a single group (`dimensionValue: null`)
 * so the flat (ungrouped) report reuses the exact same aggregation code path.
 *
 * Per account: `opening` = balance before the period (ETP-4898, matches Classic's
 * "Initial Balance"/Saldo inicial); `subtotal` = period movements only (what this report
 * used to mislabel "Total"); `total` = opening + subtotal (Classic's real "Total" row);
 * each row's `runningBalance` accumulates from `opening.total`, so the LAST row's
 * runningBalance always equals `total.total` — same invariant Classic's PDF holds.
 */
export function buildNestedGroups(rows, dimensionField, openingRows) {
  const groups = [];
  let group = null;
  let account = null;
  let running = 0;
  for (const r of rows) {
    const dimValue = dimensionField ? (r[dimensionField] || '') : null;
    if (!group || group.dimensionValue !== dimValue) {
      group = { dimensionValue: dimValue, accounts: [] };
      groups.push(group);
      account = null;
    }
    const acctKey = r.value || r.name || '';
    if (!account || account.key !== acctKey) {
      const opening = foldOpeningBalance(openingRows, r.value || '', dimensionField, dimValue);
      account = {
        key: acctKey, name: r.name || '', value: r.value || '', rows: [],
        opening,
        subtotal: { amtacctdr: 0, amtacctcr: 0, total: 0 },
      };
      group.accounts.push(account);
      running = opening.total;
    }
    running += Number(r.total) || 0;
    r.runningBalance = running;
    account.rows.push(r);
    account.subtotal.amtacctdr += Number(r.amtacctdr) || 0;
    account.subtotal.amtacctcr += Number(r.amtacctcr) || 0;
    account.subtotal.total += Number(r.total) || 0;
  }
  for (const g of groups) {
    for (const a of g.accounts) {
      a.total = {
        amtacctdr: a.opening.amtacctdr + a.subtotal.amtacctdr,
        amtacctcr: a.opening.amtacctcr + a.subtotal.amtacctcr,
        total: a.opening.total + a.subtotal.total,
      };
    }
  }
  return groups;
}

export const TRIAL_BALANCE_AMOUNT_FIELDS = ['opening_balance', 'activity_debit', 'activity_credit', 'closing_balance'];

/**
 * Folds `report-trial-balance`'s rows — always fetched at the fine grain
 * (account × contact × product × project, ETP-4898) so a dimension CAN be
 * selected — down to the grain the sidebar actually asked for: one row per
 * account when no dimension is chosen, or one row per (dimension value,
 * account) when one is. Sums the 4 pre-aggregated amount columns per fold key.
 *
 * This also replaces the SQL-level `HAVING` the query used to have (only
 * accounts/combos with period activity). Moving that filter here — evaluated
 * AFTER folding, at whichever grain was requested — is what keeps "no
 * dimension chosen" numerically identical to the report's original
 * per-account output: a single (contact, product, project) slice can net to
 * zero even when the account as a whole didn't (e.g. an invoice and its
 * matching credit note for the same contact), and a `HAVING` still living at
 * the fine grain in SQL would silently drop that slice before it's ever
 * summed back up to the account. Filtering post-fold, at the actual display
 * grain, is what makes the "has activity" check correct at every grain a
 * user can request — not just the finest one.
 */
export function foldAggregateRows(rows, dimensionField) {
  const folded = new Map();
  for (const r of rows) {
    const dimValue = dimensionField ? (r[dimensionField] || '') : null;
    const key = JSON.stringify([dimValue ?? '', r.account_no || '']);
    let acc = folded.get(key);
    if (!acc) {
      acc = {
        account_no: r.account_no, account_id: r.account_id, account_name: r.account_name,
        dimensionValue: dimValue,
        opening_balance: 0, activity_debit: 0, activity_credit: 0, closing_balance: 0,
      };
      folded.set(key, acc);
    }
    for (const f of TRIAL_BALANCE_AMOUNT_FIELDS) acc[f] += Number(r[f]) || 0;
  }
  return [...folded.values()]
    // Matches Classic's real "has activity" criterion (ReportTrialBalance_data.xsql:
    // "a.initialamt <>0 or a.amtacctcr <>0 or a.amtacctdr<>0") — an account with a
    // nonzero OPENING balance but zero period movement (e.g. a cash/bank account
    // untouched this period) still belongs in the report. Filtering on period
    // activity alone silently drops it, and since a Trial Balance must always net
    // to zero across all accounts, dropping it also broke the opening/closing
    // column totals (they stopped summing to 0).
    .filter(a => Math.abs(a.opening_balance) > 1e-9
      || Math.abs(a.activity_debit) > 1e-9 || Math.abs(a.activity_credit) > 1e-9)
    // Account FIRST, dimension second — matches Classic's real Trial Balance
    // layout (ReportTrialBalanceAdvancedView.jrxml): one block PER ACCOUNT,
    // with that account's dimension breakdown nested inside and the account
    // itself as the block's closing total row (ETP-5013 — corrects the
    // initial ETP-4898 implementation, which nested accounts inside a
    // dimension card instead; that inversion made every dimension's "total"
    // net to 0, since summing an unrelated set of accounts for one contact
    // has no accounting meaning — only summing one account's activity across
    // its dimension breakdown does).
    .sort((a, b) => {
      const av = (a.account_no || '').toLowerCase();
      const bv = (b.account_no || '').toLowerCase();
      if (av !== bv) return av < bv ? -1 : 1;
      if (dimensionField) {
        const dv = (a.dimensionValue || '').toLowerCase();
        const dw = (b.dimensionValue || '').toLowerCase();
        if (dv !== dw) return dv < dw ? -1 : 1;
      }
      return 0;
    });
}

/**
 * Nests already-folded, already-account-sorted `foldAggregateRows` output
 * into `{account_no, account_id, account_name, dimensionRows, ...totals}`
 * containers (ETP-5013) — ONE BLOCK PER ACCOUNT, its dimension breakdown
 * nested inside, closing with that account's own totals. This is the
 * account-outer / dimension-inner shape Classic's real Trial Balance report
 * renders (verified against a real Classic PDF export) — the exact inverse
 * of the dimension-outer / account-inner shape this function replaced
 * (formerly `groupAggregateRowsByDimension`), which is what made every
 * dimension's own "total" row net to 0 (summing unrelated accounts has no
 * accounting meaning).
 *
 * Each account's totals are the sum of its `dimensionRows` — the same
 * `TRIAL_BALANCE_AMOUNT_FIELDS` `foldAggregateRows` already folds by, summed
 * one level up. A `dimensionValue` of `''` (rows with no dimension value set,
 * e.g. movements never assigned a contact) is its own row, not merged into
 * another — Classic renders it as a blank-name row, never dropped.
 */
export function groupAggregateRowsByAccount(rows) {
  const groups = [];
  let current = null;
  for (const r of rows) {
    if (!current || current.account_no !== r.account_no) {
      current = {
        account_no: r.account_no, account_id: r.account_id, account_name: r.account_name,
        dimensionRows: [],
        opening_balance: 0, activity_debit: 0, activity_credit: 0, closing_balance: 0,
      };
      groups.push(current);
    }
    current.dimensionRows.push({
      dimensionValue: r.dimensionValue ?? '',
      opening_balance: r.opening_balance, activity_debit: r.activity_debit,
      activity_credit: r.activity_credit, closing_balance: r.closing_balance,
    });
    for (const f of TRIAL_BALANCE_AMOUNT_FIELDS) current[f] += r[f];
  }
  return groups;
}

// Chart-of-accounts depth ranking (ETP-4899). Etendo's `C_ElementValue.ELEMENTLEVEL`
// list — Heading, Account, Breakdown, Subaccount — is a hierarchy, coarsest first:
// e.g. P.G.1 (E) -> 700 (C) -> 7000 (D) -> 70000000 (S).
export const ELEMENT_LEVEL_RANK = { E: 0, C: 1, D: 2, S: 3 };

// Classic's ACCOUNTSIGN convention: 'C' (credit-normal) displays credit - debit,
// 'D' (debit-normal, the default when unset/unknown) displays debit - credit as-is.
// `own_amt` is always the raw debit - credit; this multiplier is what flips it.
export function accountSignMultiplier(sign) {
  return sign === 'C' ? -1 : 1;
}

/**
 * Builds the indented account-report tree Profit & Loss AND Balance Sheet render
 * (ETP-4899), mirroring Classic's `AccountTree` engine (`GeneralAccountingReports`) —
 * the SAME Java class drives both reports, differing only in which `C_ACCT_RPT`
 * (REPORTTYPE 'N' vs 'Y') feeds the SQL, exactly like this one function now does.
 *
 * `nodeRows` is the flat tree the contract's `sql.query` returns — one row per
 * node reachable from the accounting report's root(s), carrying `node_id`,
 * `parent_id`, `sort_path` (zero-padded seqno chain, so plain string sort gives
 * document order), `elementlevel`, `accountsign`, `group_name` (which
 * `c_acct_rpt_group`/root this node's branch belongs to), and its OWN raw
 * debit-credit posted amount for the main and reference periods. `operandRows`
 * is `sql.operandsQuery`'s output: the formula edges from
 * `C_ELEMENTVALUE_OPERAND` (`owner_id`, `operand_id`, `sign`).
 *
 * Four Classic behaviours this reproduces, all verified against real PDFs:
 *  - A node's value is the roll-up of its children; a node with NO children but
 *    WITH operands is a *formula* node instead (Classic's `hasOperand` ->
 *    `operandsCalculate`), e.g. "A) RESULTADO DE EXPLOTACIÓN (1+2+...+12)".
 *    Formulas nest (C = A+B), hence the recursion + cycle guard.
 *  - Every node's OWN amount is displayed in its branch's inherited sign, not a
 *    fixed per-report rule (Classic's `applySignAsPerParent`): a node's sign is
 *    forced to match its root's `accountsign`, regardless of what its own row
 *    carries — e.g. Balance Sheet's `A` (Activo) root is debit-normal while `P`
 *    (Patrimonio Neto y Pasivo) is credit-normal, so the SAME `600`-style
 *    account would print with opposite polarity depending which branch it's
 *    filed under. Profit & Loss happens to have a single credit-normal root, so
 *    this generalization must reproduce its previous hardcoded `cr - dr` output
 *    byte-for-byte (verified by a dedicated regression test).
 *  - `accountLevel` is a CUMULATIVE DEPTH CUTOFF, not an equality filter:
 *    everything from the root down to and including that level is shown, and
 *    the walk stops there (Classic's `levelFilter` sticky `found` flag).
 *  - `showOnlyWithValue` keeps a node when EITHER period is non-zero (Classic
 *    ORs `qty`/`qtyRef`), and never hides an `isalwaysshown='Y'` node.
 *
 * Returns the flattened, document-ordered rows the template renders, with
 * `indent`/`indentClass`/`isHeading`/`group`/`isGroupStart` precomputed here
 * rather than in Handlebars (which has no arithmetic, and where every new
 * helper must be hand-duplicated into JSREPORT_HELPER_SOURCES — see
 * report-html-helpers.js). `isGroupStart` only ever flips to true beyond the
 * very first row when the report has more than one `c_acct_rpt_group` (Balance
 * Sheet's "Activo"/"Patrimonio Neto y Pasivo") — a single-group report like
 * Profit & Loss never sees it turn true past the first row, so its template
 * output is unaffected by this addition.
 */
export function buildAccountReportTree(nodeRows, operandRows, options = {}) {
  const { accountLevel = 'S', showOnlyWithValue = false } = options;
  const byId = new Map();
  for (const r of nodeRows || []) {
    byId.set(r.node_id, {
      ...r,
      children: [],
      amount: null,
      amount_ref: null,
      sign: null,
    });
  }
  for (const node of byId.values()) {
    const parent = node.parent_id && byId.get(node.parent_id);
    if (parent) parent.children.push(node);
  }

  const byPath = (a, b) => {
    if (a.sort_path < b.sort_path) return -1;
    return a.sort_path > b.sort_path ? 1 : 0;
  };
  const roots = [...byId.values()].filter((n) => !n.parent_id || !byId.has(n.parent_id));

  // applySignAsPerParent: every node in a branch inherits its ROOT's sign,
  // overriding whatever its own row carries.
  const propagateSign = (node, sign) => {
    node.sign = sign;
    for (const child of node.children) propagateSign(child, sign);
  };
  for (const root of roots) propagateSign(root, root.accountsign);

  const operandsByOwner = new Map();
  for (const o of operandRows || []) {
    if (!operandsByOwner.has(o.owner_id)) operandsByOwner.set(o.owner_id, []);
    operandsByOwner.get(o.owner_id).push(o);
  }

  const inProgress = new Set();
  const resolve = (node) => {
    if (node.amount !== null) return node;
    if (inProgress.has(node.node_id)) { // malformed data: a formula referencing itself
      node.amount = 0;
      node.amount_ref = 0;
      return node;
    }
    inProgress.add(node.node_id);
    const multiplier = accountSignMultiplier(node.sign);
    const own = (Number(node.own_amt) || 0) * multiplier;
    const ownRef = (Number(node.own_amt_ref) || 0) * multiplier;
    if (!node.children.length && operandsByOwner.has(node.node_id)) {
      // Formula nodes sum their operands' already sign-adjusted values
      // directly — Classic's operandsCalculate never re-flips by the owner's
      // own accountsign, only the operands contribute their own polarity.
      let sum = 0;
      let sumRef = 0;
      for (const o of operandsByOwner.get(node.node_id)) {
        const target = byId.get(o.operand_id);
        if (!target) continue;
        const sign = Number(o.sign) || 0;
        resolve(target);
        sum += sign * target.amount;
        sumRef += sign * target.amount_ref;
      }
      node.amount = sum;
      node.amount_ref = sumRef;
    } else if (node.children.length) {
      let sum = own;
      let sumRef = ownRef;
      for (const child of node.children) {
        resolve(child);
        sum += child.amount;
        sumRef += child.amount_ref;
      }
      node.amount = sum;
      node.amount_ref = sumRef;
    } else {
      node.amount = own;
      node.amount_ref = ownRef;
    }
    inProgress.delete(node.node_id);
    return node;
  };
  for (const node of byId.values()) resolve(node);

  const cutoffRank = ELEMENT_LEVEL_RANK[accountLevel] ?? ELEMENT_LEVEL_RANK.S;
  const out = [];
  let lastGroup;
  const visit = (node, indent, isRoot) => {
    let withinCutoff = true;
    if (!isRoot) {
      // An unknown/blank elementlevel is never a reason to drop a row.
      const rank = ELEMENT_LEVEL_RANK[node.elementlevel];
      withinCutoff = rank === undefined || rank <= cutoffRank;
      const hasValue = Math.abs(node.amount) > 0.005 || Math.abs(node.amount_ref) > 0.005;
      const alwaysShown = node.isalwaysshown === 'Y';
      if (withinCutoff && (!showOnlyWithValue || hasValue || alwaysShown)) {
        const isGroupStart = out.length > 0 && node.group_name !== lastGroup;
        lastGroup = node.group_name;
        out.push({
          node_id: node.node_id,
          value: node.value,
          name: node.name,
          element: `${node.value} - ${node.name}`,
          elementlevel: node.elementlevel,
          amount: node.amount,
          amount_ref: node.amount_ref,
          indent,
          indentClass: `ind-${Math.min(indent, 6)}`,
          isHeading: node.elementlevel === 'E',
          group: node.group_name,
          isGroupStart,
        });
      }
      if (!withinCutoff) return; // cutoff reached: do not descend further
    }
    // The report's root node is a container (the accounting report's own node),
    // never a row — so its children start the visible tree at indent 0.
    const sortedChildren = [...node.children].sort(byPath);
    for (const child of sortedChildren) {
      visit(child, isRoot ? 0 : indent + 1, false);
    }
  };
  // toSorted (not sort): `roots` is a view into the caller's node list —
  // mutating it in place would silently reorder data the caller still holds.
  for (const root of roots.toSorted(byPath)) visit(root, 0, true);
  // The first row never flips `isGroupStart` (there's no previous row to
  // differ from) — but a report with more than one `c_acct_rpt_group` (Balance
  // Sheet's "Activo"/"Patrimonio Neto y Pasivo") still needs its very first
  // group's header rendered, so force it on iff the report actually has more
  // than one group. A single-group report (Profit & Loss) never has more than
  // one distinct `group` value here, so this is a no-op for it.
  if (out.length && new Set(out.map((r) => r.group)).size > 1) {
    out[0].isGroupStart = true;
  }
  return out;
}

/**
 * Resolves everything the `groupBy` parameter implies for one render: the band
 * labels, which row field the report is grouped by, the dimension-folded rows
 * and (for Trial Balance-shaped reports) the `tbGroups` structure.
 *
 * This used to be two inline blocks in the dev plugin's request handler with a
 * partial, subtly different reimplementation in the report-server. The server's
 * copy also did `rows.map(r => ({ ...r, name: r[sourceField], value: '' }))`,
 * overwriting each row's account name and code — the dev side deliberately never
 * touches those, because the template needs them intact to keep rendering the
 * Account band nested inside the dimension's own band. Folding both into one
 * function makes that class of "almost the same" divergence impossible.
 */
export function resolveGrouping(contract, params, rows, locale = 'en_US') {
  let groupLabel = pickLabel(contract.groups?.[0]?.label, locale, 'Account');
  let descriptionLabel = pickLabel(
    (contract.columns || []).find((c) => c.field === 'groupbyname')?.label, locale, 'Description');
  let dimensionLabel = null;
  let dimensionField = null;

  if (params.groupBy && rows) {
    const dimensionParam = (contract.parameters || []).find(
      (p) => p.groupByValue === params.groupBy && p.groupByField,
    );
    if (dimensionParam) {
      const sourceField = dimensionParam.groupByField;
      dimensionLabel = pickLabel(dimensionParam.label, locale, params.groupBy);
      dimensionField = sourceField;
      // Sort is stable (guaranteed since ES2019), so rows tied on the dimension value
      // keep the relative order the SQL query already gave them (account, then date) —
      // nesting Account inside the dimension comes for free, no secondary key needed.
      rows = [...rows].sort((a, b) => {
        const va = (a[sourceField] || '').toLowerCase();
        const vb = (b[sourceField] || '').toLowerCase();
        if (va < vb) return -1;
        return va > vb ? 1 : 0;
      });
    }
  }

  // report-trial-balance (ETP-4898): its SQL always returns the fine
  // account×contact×product×project grain (needed so ANY dimension can be
  // chosen), so it must always be folded back down — to one row per account
  // when no dimension is picked, or one row per (dimension, account) when one
  // is. Gated on `type !== 'grouped-listing'` so this never runs for Libro
  // Mayor, which already has its own per-movement `buildNestedGroups` path.
  let tbGroups = null;
  if (contract.type !== 'grouped-listing' && rows
      && (contract.parameters || []).some((p) => p.name === 'groupBy')) {
    rows = foldAggregateRows(rows, dimensionField);
    // account-outer / dimension-inner — see groupAggregateRowsByAccount's
    // docstring (ETP-5013).
    if (dimensionField) tbGroups = groupAggregateRowsByAccount(rows);
  }

  return { groupLabel, descriptionLabel, dimensionLabel, dimensionField, tbGroups, rows };
}
