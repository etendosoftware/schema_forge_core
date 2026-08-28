/**
 * THE single definition of the active-filters summary shown at the top of a
 * rendered report — resolves every filled request param into a
 * `{ label, value }` pair, in the requested locale.
 *
 * Why this module exists: this logic lived inline in the Vite dev plugin's
 * request handler (never a standalone function, so never importable) with an
 * independent copy — `filterAndTransformParams` — in the production
 * report-server. They had already drifted: the dev copy resolves a select
 * param's stored option code (`'S'`, `'acct'`) to its human label via
 * `paramDef.options`; the server copy did not, so any report using a plain
 * `options` select (Balance Sheet's/Profit & Loss's/Trial Balance's
 * `accountLevel`, and originally Tax Report's own hardcoded `dateType`/
 * `transactionType`/`taxType`/`bpNameType`) showed the raw code server-side
 * instead of the label.
 *
 * Same rule as report-i18n.js / report-grouping.js / report-sql.js: code that
 * lives in a shared module reaches production, code written inline in the dev
 * plugin never does. Do not re-add a local copy — extend this module.
 */

import { pickLabel, pickUiStrings } from './report-i18n.js';

/**
 * Builds the ordered list of active filters for a render, in contract
 * parameter declaration order, skipping anything empty/undefined and any
 * `_display_*` shadow key.
 *
 * @param {Record<string, unknown>} params - the render request's raw params
 * @param {object} contract - the report contract (for parameter labels/options)
 * @param {string} [locale] - defaults to en_US, same as every other shared helper
 * @returns {Array<{label: string, value: string}>}
 */
export function filterAndTransformParams(params, contract, locale = 'en_US') {
  return Object.entries(params)
    .filter(([k, v]) => {
      if (!v || v === '' || k.startsWith('_display_')) return false;
      // A `hidden: true` param (acctSchemaId auto-resolved from the session,
      // or an internal-only toggle like showDetails/groupByBp) is never
      // presented as a choosable control in the sidebar, so it was never
      // something the user "filtered by" — showing it in the summary reads
      // as a choice the user made when it's really just session context or
      // plumbing (ETP-5013: "General Ledger: Esquema GO" appearing on every
      // render, unasked).
      //
      // `orgId` is the one deliberate exception (ETP-5013 follow-up): every
      // report is scoped to an organization whether the user picked one or
      // not, and the user asked for that scope to always be visible in the
      // summary — not "the org I happened to filter by" but "which org this
      // report is FOR", closer to a document header than a filter choice.
      // Relies on the caller populating `_display_orgId` with the org's real
      // name (ReportViewerPage.jsx) — without it this would show the raw
      // UUID, exactly the "Organization: <uuid>" problem that got orgId
      // hidden here in the first place.
      const paramDef = contract.parameters?.find((p) => p.name === k);
      return !paramDef?.hidden || k === 'orgId';
    })
    .map(([k, v]) => {
      const paramDef = contract.parameters?.find((p) => p.name === k);
      // Use display name if available (for search selectors that send UUIDs)
      let displayValue = params[`_display_${k}`] || v;

      if (k === 'groupBy') {
        // groupBy stores the dimension's own key ('bpartner', 'product') — resolve
        // it to that dimension parameter's human label.
        const dimParam = (contract.parameters || []).find((p) => p.groupByValue === v);
        displayValue = pickLabel(dimParam?.label, locale, v);
      } else if (paramDef?.options) {
        // Any select with a literal `options` list stores the raw option value
        // ('S', 'acct', 'B'…). Resolve it to the human label so the filter reads
        // "Account Level: Subcuenta", not "Account Level: S".
        const opt = paramDef.options.find((o) => String(o.value) === String(v));
        if (opt) displayValue = pickLabel(opt.label, locale, v);
      } else if (paramDef?.type === 'toggle') {
        // A `false` toggle never reaches here (filtered out above, since it's the
        // "off" default and clutters nothing); an "on" toggle otherwise showed the
        // raw JS/string value ("true") verbatim in the filter grid.
        const ui = pickUiStrings(locale);
        displayValue = (v === true || v === 'true') ? ui.yes : ui.no;
      }

      if (typeof displayValue === 'string' && displayValue.includes(' | ')) {
        displayValue = displayValue.split(' | ').filter(Boolean).join(', ');
      }

      // Format date values from ISO (YYYY-MM-DD) to DD/MM/YYYY
      if (paramDef?.type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(displayValue)) {
        const [y, m, d] = displayValue.split('-');
        displayValue = `${d}/${m}/${y}`;
      }

      return { label: pickLabel(paramDef?.label, locale, k), value: displayValue };
    });
}
