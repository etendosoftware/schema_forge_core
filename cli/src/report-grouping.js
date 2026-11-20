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
 * Strips binary floating-point accumulation noise from an amount, without
 * assuming any particular currency precision — this module never sees the
 * currency, so it cannot round to "2 decimals". Repeated `+=` on JS doubles
 * routinely produces artifacts like `32222.570000000007` or `0.1 + 0.2 =
 * 0.30000000000000004` from operands that were themselves exact to a few
 * decimals; rounding to 15 SIGNIFICANT digits (the most a double round-trips
 * exactly) removes that noise at any realistic accounting magnitude while
 * preserving legitimate precision — up to 15 significant digits in total, so
 * a 2-decimal amount stays exact up to 999,999,999,999.99 (a value needing
 * more digits than that would lose its last one). Rounding to a fixed number
 * of decimal places instead
 * (`Math.round(n * 1e10) / 1e10`) silently stops working above ~900,000,
 * where `n * 1e10` exceeds Number.MAX_SAFE_INTEGER — `1500000.3 + 0.1` would
 * still come out as 1500000.4000000001. Raw per-line amounts read
 * straight from SQL are already clean and never need this — it is only for
 * values THIS module accumulates or derives (subtotals, totals, running
 * balances, formula roll-ups).
 *
 * Non-numbers (including NaN) pass through unchanged, so a caller that feeds
 * this something other than a number sees no behavior change. `-0` is
 * normalized to `0` so it never renders as a spurious negative zero.
 */
export function cleanAmount(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return n;
  const cleaned = Number(n.toPrecision(15));
  return Object.is(cleaned, -0) ? 0 : cleaned;
}

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
  opening.amtacctdr = cleanAmount(opening.amtacctdr);
  opening.amtacctcr = cleanAmount(opening.amtacctcr);
  opening.total = cleanAmount(opening.total);
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
    // `running` itself stays a raw (unclean) accumulator on purpose: only the
    // DISPLAYED value is cleaned. Feeding a cleaned value back in every
    // iteration would round-trip a fresh 1e-10 clamp at every row, and over
    // many rows that repeated clamping can drift from the final total by more
    // than one clamp's worth — cleaning once per row, from a raw running sum,
    // keeps the last row's displayed runningBalance exactly equal to the
    // account's own cleaned `total.total` below (same two raw terms, same
    // single rounding).
    running += Number(r.total) || 0;
    r.runningBalance = cleanAmount(running);
    account.rows.push(r);
    account.subtotal.amtacctdr += Number(r.amtacctdr) || 0;
    account.subtotal.amtacctcr += Number(r.amtacctcr) || 0;
    account.subtotal.total += Number(r.total) || 0;
  }
  for (const g of groups) {
    for (const a of g.accounts) {
      a.subtotal.amtacctdr = cleanAmount(a.subtotal.amtacctdr);
      a.subtotal.amtacctcr = cleanAmount(a.subtotal.amtacctcr);
      a.subtotal.total = cleanAmount(a.subtotal.total);
      a.total = {
        amtacctdr: cleanAmount(a.opening.amtacctdr + a.subtotal.amtacctdr),
        amtacctcr: cleanAmount(a.opening.amtacctcr + a.subtotal.amtacctcr),
        total: cleanAmount(a.opening.total + a.subtotal.total),
      };
    }
  }
  return groups;
}

/** Classic's "has activity" criterion for a Trial Balance row (opening-only rows stay, ETP-4898). One definition: the old fold and the chart tree share it. */
export function hasTrialBalanceActivity(a) {
  return Math.abs(a.opening_balance) > 1e-9 || Math.abs(a.activity_debit) > 1e-9 || Math.abs(a.activity_credit) > 1e-9;
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
export function foldAggregateRows(rows, dimensionField, dimensionIdField) {
  const folded = new Map();
  for (const r of rows) {
    const dimValue = dimensionField ? (r[dimensionField] || '') : null;
    const key = JSON.stringify([dimValue ?? '', r.account_no || '']);
    let acc = folded.get(key);
    if (!acc) {
      acc = {
        account_no: r.account_no, account_id: r.account_id, account_name: r.account_name,
        dimensionValue: dimValue,
        // Only set when the dimension declares a `groupByIdField` (ETP-5013
        // follow-up — currently just bPartnerId/bpartner_id) — the id that
        // lets a group's own value ("Blanquiceleste S.A.") become a
        // drill-down link, same as Classic's Trial Balance. A dimension
        // without one (Product/Project/Cost Center for now) keeps its value
        // as plain, non-navigable text.
        dimensionId: dimensionIdField ? (r[dimensionIdField] || '') : null,
        // ETP-5401 — the template's grand Total sums only is_root rows (an
        // Epígrafe nested under another Epígrafe would otherwise be counted
        // twice). is_root is a property of the ACCOUNT, identical on every
        // fine-grain row folded here, so it must survive the fold — dropping it
        // made every row look non-root and the Total rendered 0,00.
        is_root: r.is_root,
        opening_balance: 0, activity_debit: 0, activity_credit: 0, closing_balance: 0,
      };
      folded.set(key, acc);
    }
    for (const f of TRIAL_BALANCE_AMOUNT_FIELDS) acc[f] += Number(r[f]) || 0;
  }
  for (const acc of folded.values()) {
    for (const f of TRIAL_BALANCE_AMOUNT_FIELDS) acc[f] = cleanAmount(acc[f]);
  }
  return [...folded.values()]
    // Matches Classic's real "has activity" criterion (ReportTrialBalance_data.xsql:
    // "a.initialamt <>0 or a.amtacctcr <>0 or a.amtacctdr<>0") — an account with a
    // nonzero OPENING balance but zero period movement (e.g. a cash/bank account
    // untouched this period) still belongs in the report. Filtering on period
    // activity alone silently drops it, and since a Trial Balance must always net
    // to zero across all accounts, dropping it also broke the opening/closing
    // column totals (they stopped summing to 0).
    .filter(hasTrialBalanceActivity)
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
      dimensionId: r.dimensionId ?? '',
      opening_balance: r.opening_balance, activity_debit: r.activity_debit,
      activity_credit: r.activity_credit, closing_balance: r.closing_balance,
    });
    for (const f of TRIAL_BALANCE_AMOUNT_FIELDS) current[f] += r[f];
  }
  for (const g of groups) {
    for (const f of TRIAL_BALANCE_AMOUNT_FIELDS) g[f] = cleanAmount(g[f]);
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

export const hasResult = (v) => v !== undefined && v !== null && v !== '';

/**
 * ETP-6083: the on-the-fly / posted split of an amount that includes an unregularized result (the
 * income-summary account of a Balance Sheet). `onTheFlyRaw` is the raw debit - credit the query
 * reports; the split is in DISPLAYED sign (`multiplier`, the row's), and `posted = amount - onTheFly`.
 */
export function resultSplit(amount, onTheFlyRaw, multiplier) {
  const onTheFly = cleanAmount((Number(onTheFlyRaw) || 0) * multiplier);
  return { onTheFly, posted: cleanAmount((Number(amount) || 0) - onTheFly) };
}

/** `{ result, resultRef }` for a row whose query carried `result_onthefly` / `result_onthefly_ref`; `{}` otherwise (P&L et al. unchanged). */
export function resultFields(row, amount, amountRef, multiplier) {
  const out = {};
  if (hasResult(row.result_onthefly)) out.result = resultSplit(amount, row.result_onthefly, multiplier);
  if (hasResult(row.result_onthefly_ref)) out.resultRef = resultSplit(amountRef, row.result_onthefly_ref, multiplier);
  return out;
}

/**
 * ETP-6083: the balance check of a two-sided report (Balance Sheet): the roots of each report group
 * summed in the displayed sign, the first group (Activo) against the second (Patrimonio Neto y
 * Pasivo; named `activo` / `pnPasivo` for the UI, they are just the first / second group). A group's top
 * formula row (its TOTAL) is the side's value when there is one. `pick(row)` reads the amount to total. Not exactly two root groups -> null.
 * Structural: names no report.
 */
export function buildBalanceBlock(rows, pick = (r) => r.amount) {
  const byGroup = new Map();
  for (const r of (rows || []).filter((x) => !x.parentId)) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, { formula: 0, hasFormula: false, plain: 0 });
    const g = byGroup.get(r.group);
    const v = Number(pick(r)) || 0;
    // A side's top rows may include its own TOTAL (a formula over its siblings): that row IS the side, summing both would double it.
    if (r.isFormula) { g.formula += v; g.hasFormula = true; } else g.plain += v;
  }
  if (byGroup.size !== 2) return null;
  const [activo, pnPasivo] = [...byGroup.values()].map((g) => cleanAmount(g.hasFormula ? g.formula : g.plain));
  const diff = cleanAmount(activo - pnPasivo);
  return { balanced: Math.abs(diff) < 0.005, activo, pnPasivo, diff };
}

/**
 * ETP-6083: `{ balance, balanceRef }` for a tree answer, only for a contract with `balanceCheck: true`
 * (`{}` otherwise). A period tree reads bucket 0: `balance` = current, `balanceRef` = `{ sly, prev }`;
 * a plain tree's `balanceRef` is the comparison period's, present only with a comparison.
 */
export function balanceFields(contract, rows, { periods = false, compare = false } = {}) {
  if (!contract?.balanceCheck) return {};
  if (periods) {
    return { balance: buildBalanceBlock(rows, (r) => r.cells[0].amount),
      balanceRef: { sly: buildBalanceBlock(rows, (r) => r.cells[0].sly.amount), prev: buildBalanceBlock(rows, (r) => r.cells[0].prev.amount) } };
  }
  return { balance: buildBalanceBlock(rows), ...(compare ? { balanceRef: buildBalanceBlock(rows, (r) => r.amount_ref) } : {}) };
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
 * Five Classic behaviours this reproduces, all verified against real PDFs:
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
 *  - `ShowValueCond` (ETP-5662, Classic's `applyShowValueCond`/`filterSVC`): a
 *    SUMMARY node (`issummary='Y'`) with `showvaluecond` 'P' keeps its value only
 *    when strictly positive ('N': strictly negative), otherwise it becomes 0 and
 *    that 0 is what rolls up to its parent. Every descendant of such a "reset"
 *    node displays 0. A formula node reads its operand's RAW value (after the
 *    operand's descendants' clamp, before its own clamp) — that is how a mirror
 *    account such as `(551)` shows the balance on the side where it is
 *    positive. Main and reference periods reset independently. MUST stay in
 *    sync with the Java twin `AccountReportTree` (com.etendoerp.go).
 *    Deliberate deviation: `reset` = "the clamp changed the value", so a KEPT
 *    P/N node's descendants stay visible. Classic resets on any failed
 *    condition (0 too) with the ref period overwriting the main flag, so with
 *    Compare To off it hides them. Totals are identical.
 *
 * Returns the flattened, document-ordered rows the template renders, with
 * `indent`/`indentClass`/`isHeading`/`isFormula`/`group`/`isGroupStart` precomputed here
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
  // ETP-6080: when given, the set of EXPANDED node ids replaces the level
  // cutoff — a node is listed when its parent is expanded (the report's root
  // container always is). Used by the exports to print what the interactive
  // view shows. Values never depend on it: they are resolved before the walk.
  const expanded = options.expandedNodeIds ? new Set(options.expandedNodeIds) : null;
  const byId = new Map();
  for (const r of nodeRows || []) {
    byId.set(r.node_id, {
      ...r,
      children: [],
      amount: null,
      amount_ref: null,
      raw: null,
      raw_ref: null,
      reset: false,
      reset_ref: false,
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

  // Classic's hasOperand: no children but operands. Same definition as the Java
  // twin's formula node. Exposed on the row as `isFormula`: the Excel/CSV
  // exports label a formula HEADING "Total" (ETP-5663).
  const isFormulaNode = (node) => !node.children.length && operandsByOwner.has(node.node_id);

  // Classic's applyShowValueCond: only a SUMMARY node with 'P' / 'N' is clamped.
  const applyShowValueCond = (node, value) => {
    if (node.issummary !== 'Y') return value;
    if (node.showvaluecond === 'P') return value > 0 ? value : 0;
    if (node.showvaluecond === 'N') return value < 0 ? value : 0;
    return value;
  };

  const inProgress = new Set();
  const resolve = (node) => {
    if (node.amount !== null) return node;
    if (inProgress.has(node.node_id)) { // malformed data: a formula referencing itself
      node.amount = 0;
      node.amount_ref = 0;
      node.raw = 0;
      node.raw_ref = 0;
      return node;
    }
    inProgress.add(node.node_id);
    const multiplier = accountSignMultiplier(node.sign);
    const own = (Number(node.own_amt) || 0) * multiplier;
    const ownRef = (Number(node.own_amt_ref) || 0) * multiplier;
    if (isFormulaNode(node)) {
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
        // A formula reads the operand's RAW value (see ShowValueCond above).
        sum += sign * target.raw;
        sumRef += sign * target.raw_ref;
      }
      node.raw = cleanAmount(sum);
      node.raw_ref = cleanAmount(sumRef);
    } else if (node.children.length) {
      let sum = own;
      let sumRef = ownRef;
      for (const child of node.children) {
        resolve(child);
        sum += child.amount;
        sumRef += child.amount_ref;
      }
      node.raw = cleanAmount(sum);
      node.raw_ref = cleanAmount(sumRef);
    } else {
      node.raw = cleanAmount(own);
      node.raw_ref = cleanAmount(ownRef);
    }
    // raw is cleaned before the clamp: vs Java's BigDecimal, only sub-cent values differ (epsilon hides).
    node.amount = applyShowValueCond(node, node.raw);
    node.amount_ref = applyShowValueCond(node, node.raw_ref);
    node.reset = node.amount !== node.raw;
    node.reset_ref = node.amount_ref !== node.raw_ref;
    inProgress.delete(node.node_id);
    return node;
  };
  for (const node of byId.values()) resolve(node);

  const cutoffRank = ELEMENT_LEVEL_RANK[accountLevel] ?? ELEMENT_LEVEL_RANK.S;
  const out = [];
  let lastGroup;
  // Lists one non-root node (or not) and says whether to descend into its children.
  const listNode = (node, indent, underReset, underResetRef, visibleParentId) => {
    let childParentId = visibleParentId;
    // Display: a descendant of a reset node shows 0 (filterSVC); every row
    // re-applies its own clamp (filterStructure). Periods reset independently.
    const amount = underReset ? 0 : applyShowValueCond(node, node.amount);
    const amountRef = underResetRef ? 0 : applyShowValueCond(node, node.amount_ref);
    // An unknown/blank elementlevel is never a reason to drop a row.
    const rank = ELEMENT_LEVEL_RANK[node.elementlevel];
    const withinCutoff = expanded ? true : (rank === undefined || rank <= cutoffRank);
    const hasValue = Math.abs(amount) > 0.005 || Math.abs(amountRef) > 0.005;
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
        amount,
        amount_ref: amountRef,
        indent,
        indentClass: `ind-${Math.min(indent, 6)}`,
        isHeading: node.elementlevel === 'E',
        isFormula: isFormulaNode(node),
        group: node.group_name,
        isGroupStart,
        // ETP-6080: the nearest LISTED ancestor (a row hidden by
        // showOnlyWithValue is skipped), so a client can fold the rows; and
        // the branch's effective sign the amounts were computed with.
        parentId: visibleParentId,
        sign: node.sign,
        ...resultFields(node, amount, amountRef, accountSignMultiplier(node.sign)),
      });
      childParentId = node.node_id;
    }
    if (!withinCutoff) return { descend: false }; // cutoff reached: do not descend further
    // Collapsed: children not listed. Only a LISTED node can collapse — one
    // hidden by showOnlyWithValue is transparent, as it is for parentId, or
    // the export would drop rows the screen shows under the listed ancestor.
    const listed = childParentId === node.node_id;
    return { descend: !(expanded && listed && !expanded.has(node.node_id)), childParentId };
  };
  const visit = (node, indent, isRoot, underReset = false, underResetRef = false, visibleParentId = null) => {
    let childParentId = visibleParentId;
    if (!isRoot) {
      const step = listNode(node, indent, underReset, underResetRef, visibleParentId);
      if (!step.descend) return;
      childParentId = step.childParentId;
    }
    // The report's root node is a container (the accounting report's own node),
    // never a row — so its children start the visible tree at indent 0.
    const sortedChildren = [...node.children].sort(byPath);
    for (const child of sortedChildren) {
      visit(child, isRoot ? 0 : indent + 1, false, underReset || node.reset,
        underResetRef || node.reset_ref, childParentId);
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
  // ETP-5662: counted over the report's ROOTS, not the visible rows — when
  // ShowValueCond/only-with-value leaves a single group visible (e.g. only
  // Pasivo), its header must still say which side the rows belong to. Differs
  // from Classic (which prints those rows headerless) on purpose; display only.
  if (out.length && new Set(roots.map((r) => r.group_name)).size > 1) {
    out[0].isGroupStart = true;
  }
  return out;
}

/**
 * ETP-6080: per-row variation against the comparison period, computed once
 * here so the interactive view and the PDF/Excel/CSV exports show the same
 * numbers. Returns new rows; the input is not mutated.
 *
 *  - `variationAmount` = amount − amount_ref;
 *  - `variationPct` = variationAmount / |amount_ref| × 100, `null` when the
 *    reference is zero (never ∞, never 0);
 *  - `trend`: 'improves' / 'worsens' / null. Amounts are already displayed in
 *    the branch's effective sign (`row.sign`, see applySignAsPerParent), so in
 *    a credit-normal branch (Profit & Loss: revenue positive, expenses
 *    negative) a higher amount is always the better result — revenue up and
 *    expense down both raise it. A debit-normal branch reads the other way
 *    (an unset sign counts as debit-normal, as in accountSignMultiplier). That
 *    reading fits a result; Balance Sheet's asset side will need its own rule.
 *
 * With `compare` false every field is null: there is no comparison to show.
 * `trend` is computed only when asked (`trend: true`, the contract's
 * `trend: 'result'`): the rule above is wrong for a balance (ETP-6080 review).
 */
export function addVariation(rows, { compare = true, trend: withTrend = false } = {}) {
  return (rows || []).map((row) => {
    if (!compare) return { ...row, variationAmount: null, variationPct: null, trend: null };
    const amount = Number(row.amount) || 0;
    const ref = Number(row.amount_ref) || 0;
    const variationAmount = cleanAmount(amount - ref);
    const variationPct = Math.abs(ref) < 0.005 ? null : cleanAmount((variationAmount / Math.abs(ref)) * 100);
    let trend = null;
    if (withTrend && Math.abs(variationAmount) >= 0.005) {
      // Same default as accountSignMultiplier: an unset sign is debit-normal.
      const better = row.sign === 'C' ? variationAmount > 0 : variationAmount < 0;
      trend = better ? 'improves' : 'worsens';
    }
    return { ...row, variationAmount, variationPct, trend };
  });
}

/**
 * ETP-6239: one period column's numbers: the amount in the period, and the
 * same period last year (`sly`) / the previous period (`prev`), each with its
 * variation. Built with `addVariation`, so a cell reads like a single report's
 * row. `sign` is the row's effective branch sign (it drives `trend`).
 */
export function buildPeriodCell(amount, slyAmount, prevAmount, { sign, trend = false } = {}) {
  const side = (ref) => {
    const [r] = addVariation([{ amount, amount_ref: ref, sign }], { compare: true, trend });
    return { amount: cleanAmount(ref), variationAmount: r.variationAmount, variationPct: r.variationPct, trend: r.trend };
  };
  return { amount: cleanAmount(amount), sly: side(slyAmount), prev: side(prevAmount) };
}

const COMPARE_MODES = ['none', 'sly', 'prev'];
const cellShows = { none: () => 0, sly: (c) => c.sly.amount, prev: (c) => c.prev.amount };

/** `periodRows` indexed `idx -> account_id -> row`. */
function amountsByPeriodIdx(periodRows) {
  const byPeriod = new Map();
  for (const r of periodRows || []) {
    const idx = Number(r.idx);
    if (!byPeriod.has(idx)) byPeriod.set(idx, new Map());
    byPeriod.get(idx).set(r.account_id, r);
  }
  return byPeriod;
}

/** Per period: the tree against same-period-last-year, and both trees' rows by node_id. */
function runPeriodTrees(nodeRows, operandRows, periods, amountsByPeriod, treeOpts) {
  return periods.map((period) => {
    const amounts = amountsByPeriod.get(period.idx);
    const feed = (refKey) => nodeRows.map((n) => {
      const a = amounts?.get(n.node_id);
      return { ...n, own_amt: a?.own_amt ?? 0, own_amt_ref: a?.[refKey] ?? 0,
        result_onthefly: a?.own_result ?? null, result_onthefly_ref: a?.[`own_result${refKey.slice('own_amt'.length)}`] ?? null };
    });
    const byId = (rows) => new Map(rows.map((r) => [r.node_id, r]));
    const sly = buildAccountReportTree(feed('own_amt_sly'), operandRows, treeOpts);
    return { sly, slyById: byId(sly), prevById: byId(buildAccountReportTree(feed('own_amt_prev'), operandRows, treeOpts)) };
  });
}

const isNonZero = (v) => Math.abs(v) > 0.005;
const defaultCellActive = (c, mode) => isNonZero(c.amount) || isNonZero(cellShows[mode](c));

/**
 * `{none, sly, prev}`: whether a row shows in each comparison mode. `none` looks at every cell; a
 * comparison mode only at the cells in `shown` (the periods its columns show), so a row never
 * appears with every visible column empty.
 */
function visibilityByMode(cells, always, shown, active = defaultCellActive) {
  const visible = {};
  for (const mode of COMPARE_MODES) {
    const seen = mode === 'none' ? cells : cells.filter((_, i) => shown.has(i));
    visible[mode] = always || seen.some((c) => active(c, mode));
  }
  return visible;
}

/** The nearest ancestor of `row` visible in each mode (null when none). */
function nearestVisibleParents(row, rowById) {
  const parentIds = {};
  for (const mode of COMPARE_MODES) {
    let parent = row.parentId ? rowById.get(row.parentId) : null;
    while (parent && !parent.visible[mode]) parent = parent.parentId ? rowById.get(parent.parentId) : null;
    parentIds[mode] = parent ? parent.node_id : null;
  }
  return parentIds;
}

/**
 * ETP-6239: the account tree with one column per period. For each period the
 * existing `buildAccountReportTree` runs twice (amount vs same-period-last-year,
 * amount vs previous period) fed with that period's own amounts from
 * `periodRows` (`account_id`, `idx`, `own_amt`, `own_amt_sly`, `own_amt_prev`),
 * so roll-ups, formulas and ShowValueCond behave exactly as in a single report.
 * Rows are joined on `node_id` into `cells[]` (index = position in `periods`,
 * the first one being the whole range).
 *
 * Which rows show depends on the comparison mode, so core answers it for all
 * three: `visible = {none, sly, prev}` and `parentIds` (the nearest ancestor
 * visible in that mode). A row is visible in a mode when one of its cells for
 * that mode is non-zero or `isalwaysshown` is set (everything is visible when
 * `showOnlyWithValue` is off). With `comparedPeriods` (the query's, for the screen) the
 * comparison modes only look at the range total and that many last periods, the columns the
 * screen shows with a comparison; without it (a render: the PDF asks for just those periods, and
 * Excel / CSV print every one) every period counts. The client and the exports then pick a mode
 * without asking again. `parentId` is the unfiltered listed parent.
 *
 * The top-level `amount` / `amount_ref` / variation fields are the first
 * period's current / same-period-last-year values, so a reader of the old
 * shape still gets the range total.
 */
export function buildPeriodAccountTree(nodeRows, operandRows, periodRows, opts = {}) {
  const { periods = [], accountLevel = 'S', showOnlyWithValue = false, expandedNodeIds, trend = false, comparedPeriods = Infinity } = opts;
  const treeOpts = { accountLevel, showOnlyWithValue: false, expandedNodeIds };
  const runs = runPeriodTrees(nodeRows, operandRows, periods, amountsByPeriodIdx(periodRows), treeOpts);
  if (!runs.length) return [];

  // Positions in `cells` (= in `periods`) the comparison modes look at: the range total and the last N periods.
  const shown = new Set(periods.map((_, i) => i).filter((i) => i === 0 || i >= periods.length - comparedPeriods));
  const alwaysShown = new Set(nodeRows.filter((n) => n.isalwaysshown === 'Y').map((n) => n.node_id));
  const rows = runs[0].sly.map((base) => {
    const cells = runs.map((run) => {
      const s = run.slyById.get(base.node_id);
      const p = run.prevById.get(base.node_id);
      const cell = buildPeriodCell(s.amount, s.amount_ref, p.amount_ref, { sign: base.sign, trend });
      // ETP-6083: the result split of the income-summary account, per comparison.
      if (s.result) {
        cell.result = { ...s.result, sly: s.resultRef ?? { onTheFly: 0, posted: s.amount_ref }, prev: p.resultRef ?? { onTheFly: 0, posted: p.amount_ref } };
      }
      return cell;
    });
    const visible = visibilityByMode(cells, !showOnlyWithValue || alwaysShown.has(base.node_id), shown);
    const [first] = cells;
    return { ...base, amount: first.amount, amount_ref: first.sly.amount, variationAmount: first.sly.variationAmount,
      variationPct: first.sly.variationPct, trend: first.sly.trend, cells, visible };
  });

  const rowById = new Map(rows.map((r) => [r.node_id, r]));
  for (const row of rows) row.parentIds = nearestVisibleParents(row, rowById);
  return rows;
}

/**
 * ETP-6239: the rows of a period tree one comparison mode shows (the exports),
 * parented to the nearest ancestor shown in that mode. The first row of a
 * multi-group report keeps its group header.
 */
export function selectPeriodMode(rows, mode) {
  const multiGroup = new Set(rows.map((r) => r.group)).size > 1;
  let lastGroup;
  return rows.filter((r) => r.visible[mode]).map((r, i) => {
    const isGroupStart = i > 0 ? r.group !== lastGroup : multiGroup;
    lastGroup = r.group;
    return { ...r, parentId: r.parentIds[mode], isGroupStart };
  });
}

/** The `expandedNodeIds` value for "no row open": the interactive view sends it when everything is collapsed. */
export const NO_EXPANDED_NODES = 'none';

/**
 * `expandedNodeIds` arrives as a comma-joined string. Absent or blank = not sent (the level cutoff
 * applies): the old viewer sends '' for every parameter it has no value for, so '' cannot mean
 * "everything collapsed" — `NO_EXPANDED_NODES` does.
 */
export function parseExpandedNodeIds(value) {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  if (String(value).trim() === NO_EXPANDED_NODES) return [];
  return String(value).split(',').map((id) => id.trim()).filter(Boolean);
}

/**
 * The account tree a RENDER prints, from the render params: the level cutoff,
 * or (ETP-6080) the interactive view's expanded nodes when it sends them, plus
 * the variation (trend only for a contract with `trend: 'result'`). One
 * definition for both engines (dev plugin + report-server), so the printed
 * tree cannot drift from one to the other.
 */
export function buildRenderAccountTree(rows, operandRows, params = {}, contract = {}, period = null) {
  if (period?.periodRows) {
    // ETP-6239: columns by period. The rows shown are the ones the export's
    // comparison mode shows; `cells[]` carries the per-period numbers.
    const tree = buildPeriodAccountTree(rows, operandRows, period.periodRows, {
      periods: period.spec.periods,
      accountLevel: params.accountLevel || 'S',
      showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
      expandedNodeIds: parseExpandedNodeIds(params.expandedNodeIds),
      trend: contract.trend === 'result',
    });
    return selectPeriodMode(tree, period.compareMode || 'none');
  }
  const tree = buildAccountReportTree(rows, operandRows, {
    accountLevel: params.accountLevel || 'S',
    showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
    expandedNodeIds: parseExpandedNodeIds(params.expandedNodeIds),
  });
  return addVariation(tree, { compare: params.compareTo === 'true', trend: contract.trend === 'result' });
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
  let dimensionIdField = null;

  if (params.groupBy && rows) {
    const dimensionParam = (contract.parameters || []).find(
      (p) => p.groupByValue === params.groupBy && p.groupByField,
    );
    if (dimensionParam) {
      const sourceField = dimensionParam.groupByField;
      dimensionLabel = pickLabel(dimensionParam.label, locale, params.groupBy);
      dimensionField = sourceField;
      // Optional (ETP-5013 follow-up) — only bPartnerId declares one so far.
      dimensionIdField = dimensionParam.groupByIdField || null;
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
    rows = foldAggregateRows(rows, dimensionField, dimensionIdField);
    // account-outer / dimension-inner — see groupAggregateRowsByAccount's
    // docstring (ETP-5013).
    if (dimensionField) tbGroups = groupAggregateRowsByAccount(rows);
  }

  return { groupLabel, descriptionLabel, dimensionLabel, dimensionField, tbGroups, rows };
}

// ---------------------------------------------------------------------------
// ETP-6084: the chart-of-accounts tree (Trial Balance), 4 amounts per row.
// ---------------------------------------------------------------------------

/** The 4 Trial Balance amounts: the name on a cell / row -> the SQL column (current side; `_sly` / `_prev` for the compared ones). */
export const CHART_AMOUNT_FIELDS = Object.freeze({
  opening: 'opening_balance', debit: 'activity_debit', credit: 'activity_credit', closing: 'closing_balance',
});
const CHART_AMOUNTS = Object.keys(CHART_AMOUNT_FIELDS);
const CHART_ROOT_ID = '__chart_root__';
const BALANCE_TOLERANCE = 0.005;
/** A sum of many roots can leave float noise (1.8e-12) that `cleanAmount` keeps: below a millionth it is zero. */
const denoise = (v) => cleanAmount(Math.abs(v) < 1e-6 ? 0 : v);

const isDimensionRow = (r) => r.dimension_id !== undefined && r.dimension_id !== null;
/** Composite id of a dimension row: unique per (S leaf, dimension value); a missing value ('') is its own row. */
export const chartDimensionNodeId = (accountId, dimensionId) => `${accountId}|${dimensionId ?? ''}`;

/** Per period idx, node_id -> `{own_amt, own_amt_sly, own_amt_prev}` for one amount (the shape `runPeriodTrees` reads). */
function chartFeed(sources, field, periods) {
  const byPeriod = new Map(periods.map((p) => [p.idx, new Map()]));
  for (const { idx, target, row } of sources) {
    byPeriod.get(idx)?.set(target, {
      own_amt: Number(row[field]) || 0, own_amt_sly: Number(row[`${field}_sly`]) || 0, own_amt_prev: Number(row[`${field}_prev`]) || 0,
    });
  }
  return byPeriod;
}

/**
 * Nodes for `buildAccountReportTree`: chart rows (a `parent_id` that is null, '0' or unknown hangs from a
 * synthetic container root, which the walk never lists), `accountsign` forced to 'D' (raw dr - cr), no
 * operands, no ShowValueCond; plus one child per dimension row under its S leaf, with a composite id.
 * `extras` is what `listNode` drops, re-attached by node_id.
 */
function chartNodes(chartRows, dimensionRows) {
  const ids = new Set(chartRows.map((r) => r.node_id));
  const nodes = [{ node_id: CHART_ROOT_ID, parent_id: null, sort_path: '', accountsign: 'D', issummary: 'Y', elementlevel: 'E' }];
  const extras = new Map();
  for (const r of chartRows) {
    const parentKnown = r.parent_id && r.parent_id !== '0' && ids.has(r.parent_id);
    nodes.push({ node_id: r.node_id, parent_id: parentKnown ? r.parent_id : CHART_ROOT_ID, sort_path: r.sort_path ?? '',
      value: r.value, name: r.name, elementlevel: r.elementlevel, accountsign: 'D', issummary: 'N', isalwaysshown: 'N' });
    extras.set(r.node_id, { account_id: r.account_id || r.node_id, account_value: r.value, isDimension: false, dimension_id: null });
  }
  const byId = new Map(chartRows.map((r) => [r.node_id, r]));
  for (const r of dimensionRows) {
    const parent = byId.get(r.account_id);
    const id = chartDimensionNodeId(r.account_id, r.dimension_id);
    if (!parent || extras.has(id)) continue; // an amount on a node the chart does not list cannot be shown
    const name = r.dimension_name || '';
    nodes.push({ node_id: id, parent_id: r.account_id, sort_path: `${name.toLowerCase()}\u0000${id}`, value: '', name,
      elementlevel: 'DIM', accountsign: 'D', issummary: 'N', isalwaysshown: 'N' });
    extras.set(id, { account_id: r.account_id, account_value: parent.value, isDimension: true,
      dimension_id: r.dimension_id || '', dimension_name: name });
  }
  return { nodes, extras };
}

/**
 * ETP-6084: the Trial Balance tree over the chart of accounts (`tree: 'chart'` contracts).
 *
 * Not a new tree builder: `buildAccountReportTree` runs once per amount (opening, debit, credit,
 * closing) through the same `runPeriodTrees` the period tree uses (current vs same period last year,
 * and vs previous period) with `showOnlyWithValue: false`, and the runs are joined on `node_id`.
 * Roll-up is by `parent_id` only, so mixed-level charts (E>S, C>S, D>D...) work. The has-activity rule
 * (`hasTrialBalanceActivity`: opening, debit or credit; opening-only rows stay) is applied once, after
 * the join, per comparison mode, like the period tree does for Profit & Loss. A parent whose own
 * rolled-up figures cancel is hidden and its visible children re-parent to the nearest visible ancestor.
 *
 * Input rows (the row contract of `sql.treeQuery` / `sql.periodQuery`, see report-query.js):
 *  - `treeRows`: chart rows (`node_id`, `parent_id`, `value`, `name`, `elementlevel`, `sort_path`,
 *    `dimension_id` null) with their OWN amounts, plus, with a grouping active, dimension rows
 *    (`account_id` = the S leaf, `dimension_id` (may be ''), `dimension_name`). A leaf that has dimension
 *    rows takes its amounts from them (they must add up to it).
 *  - `periodRows` (optional): `idx`, `account_id`, `dimension_id` (null = no grouping), `dimension_name`,
 *    and each amount column plus `_sly` / `_prev`. Without them: one range, no comparison. Dimension nodes
 *    are the union of the periods' rows, so a contact active only in a compared range still exists.
 *
 * Returns `{rows, totals, balance}`. Each row: `opening` / `debit` / `credit` / `closing` (the first
 * period's), `cells[i]` = `{opening, debit, credit, closing}` each a `buildPeriodCell`, `visible` /
 * `parentIds` per mode, `account_id`, `account_value`, `isDimension`, `dimension_id`, `dimension_name`.
 * `totals[i]` = the sum of the roots as cells; `balance` checks the first period (sum debit = sum credit,
 * sum closing = 0).
 */
export function buildChartAccountTree(treeRows, periodRows, opts = {}) {
  const { periods: given, showOnlyWithValue = false, expandedNodeIds, trend = false, comparedPeriods = Infinity } = opts;
  const periods = given?.length ? given : [{ idx: 0 }];
  const all = treeRows || [];
  const dimSource = (periodRows || all).filter(isDimensionRow);
  const { nodes, extras } = chartNodes(all.filter((r) => !isDimensionRow(r)), dimSource);
  const withDims = new Set(dimSource.map((r) => r.account_id));

  // Where each amount row lands: a dimension row on its composite node; a chart row on its node unless dimensions replace it.
  const sources = [];
  for (const row of periodRows || all) {
    const dim = isDimensionRow(row);
    const target = dim ? chartDimensionNodeId(row.account_id, row.dimension_id) : (row.account_id || row.node_id);
    if (extras.has(target) && (dim || !withDims.has(target))) sources.push({ idx: periodRows ? Number(row.idx) : 0, target, row });
  }

  const treeOpts = { accountLevel: 'S', showOnlyWithValue: false, expandedNodeIds };
  const feeds = Object.fromEntries(CHART_AMOUNTS.map((a) => [a, chartFeed(sources, CHART_AMOUNT_FIELDS[a], periods)]));
  const runs = Object.fromEntries(CHART_AMOUNTS.map((a) => [a, runPeriodTrees(nodes, [], periods, feeds[a], treeOpts)]));
  const totals = periods.map((p) => Object.fromEntries(CHART_AMOUNTS.map((a) => {
    const sum = (k) => [...feeds[a].get(p.idx).values()].reduce((acc, v) => acc + v[k], 0);
    return [a, buildPeriodCell(denoise(sum('own_amt')), denoise(sum('own_amt_sly')), denoise(sum('own_amt_prev')), { sign: 'D', trend })];
  })));

  const shown = new Set(periods.map((_, i) => i).filter((i) => i === 0 || i >= periods.length - comparedPeriods));
  const pickers = { none: (c) => c.amount, sly: (c) => c.sly.amount, prev: (c) => c.prev.amount };
  const activeIn = (cell, pick) => hasTrialBalanceActivity({
    opening_balance: pick(cell.opening), activity_debit: pick(cell.debit), activity_credit: pick(cell.credit) });
  const active = (cell, mode) => activeIn(cell, pickers.none) || (mode !== 'none' && activeIn(cell, pickers[mode]));

  const rows = runs.closing[0].sly.map((base) => {
    const cells = periods.map((_, i) => Object.fromEntries(CHART_AMOUNTS.map((a) => {
      const s = runs[a][i].slyById.get(base.node_id);
      const p = runs[a][i].prevById.get(base.node_id);
      return [a, buildPeriodCell(s.amount, s.amount_ref, p.amount_ref, { sign: 'D', trend })];
    })));
    const row = { ...base, ...extras.get(base.node_id) };
    delete row.amount; // the closing run's: every amount lives in `cells`
    delete row.amount_ref;
    const [first] = cells;
    return { ...row, opening: first.opening.amount, debit: first.debit.amount, credit: first.credit.amount,
      closing: first.closing.amount, cells, visible: visibilityByMode(cells, !showOnlyWithValue, shown, active) };
  });
  const rowById = new Map(rows.map((r) => [r.node_id, r]));
  for (const row of rows) row.parentIds = nearestVisibleParents(row, rowById);

  const debitCreditDiff = cleanAmount(totals[0].debit.amount - totals[0].credit.amount);
  const closingDiff = totals[0].closing.amount;
  const balanced = Math.abs(debitCreditDiff) < BALANCE_TOLERANCE && Math.abs(closingDiff) < BALANCE_TOLERANCE;
  return { rows, totals, balance: { balanced, debitCreditDiff, closingDiff } };
}

/**
 * ETP-6084: what a /render prints for a `tree: 'chart'` report when the interactive view sends its
 * expanded nodes (the counterpart of `buildRenderAccountTree`; one definition for both engines).
 * `period` is `{periodRows, spec, compareMode}` or null. Returns the rows the comparison mode shows
 * (parented to the nearest row shown in it) and the `meta` the template needs: `chartTotals`
 * (per period) and `chartBalance`.
 */
export function buildRenderChartTree(rows, params = {}, period = null) {
  // `visibleNodeIds` (comma-joined node_ids, as /query returned them): the exact rows the screen shows,
  // which `expandedNodeIds` cannot express (a level fold shows nested same-level nodes and folds deeper
  // children). It wins over `expandedNodeIds` for row selection.
  const visible = parseExpandedNodeIds(params.visibleNodeIds);
  const tree = buildChartAccountTree(rows, period?.periodRows ?? null, {
    periods: period?.spec?.periods,
    expandedNodeIds: visible ? undefined : parseExpandedNodeIds(params.expandedNodeIds),
    showOnlyWithValue: params.showOnlyAccountsWithValue === 'true',
  });
  const meta = { chartTotals: tree.totals, chartBalance: tree.balance, compareMovements: params.compareMovements === 'true' };
  if (visible) return { rows: pickVisibleNodes(tree.rows, new Set(visible)), meta };
  return { rows: selectPeriodMode(tree.rows, period?.periodRows ? (period.compareMode || 'none') : 'none'), meta };
}

/** The rows whose node_id is in `ids`, in tree order, parented (and indented) to the nearest row kept. */
function pickVisibleNodes(rows, ids) {
  const byId = new Map(rows.map((r) => [r.node_id, r]));
  const depth = new Map();
  const nearest = (r) => {
    let p = r.parentId ? byId.get(r.parentId) : null;
    while (p && !ids.has(p.node_id)) p = p.parentId ? byId.get(p.parentId) : null;
    return p;
  };
  return rows.filter((r) => ids.has(r.node_id)).map((r) => {
    const parent = nearest(r);
    const indent = parent ? depth.get(parent.node_id) + 1 : 0;
    depth.set(r.node_id, indent);
    return { ...r, parentId: parent ? parent.node_id : null, indent, indentClass: `ind-${Math.min(indent, 6)}` };
  });
}
