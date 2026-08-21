/**
 * THE single definition of the report descriptor served at `GET /api/reports`.
 *
 * Why this module exists (ETP-4899): this shape used to be copy-pasted in three
 * places — the Vite dev plugin in the functional repo, the static-manifest
 * generator (`generate-reports-manifest.js`) and the report-server
 * (`tools/report-server/server.js`). When `sections` was added to the contracts
 * so the frontend could render its sidebar as an accordion, only the DEV copy
 * learned about it. Both deploy-side copies kept their hardcoded 7-field list
 * and dropped `sections` silently — no error, no warning — so every developer
 * saw a working accordion locally while every server rendered the old flat
 * sidebar and a broken report. Same failure mode as ETP-4908 (dev diverging
 * from production and hiding the gap), so it gets the same remedy: one source of
 * truth, plus a parity test that fails if anyone rebuilds this object by hand.
 *
 * If you add a field here, also update the expected-field list in
 * `cli/test/report-descriptor.test.js` — that test deliberately pins the shape
 * so growing it is a conscious act, not an accident.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Contract `source` values that make a report listable. */
export const VALID_SOURCES = new Set(['jasper-migration', 'manual', 'sql', 'neo']);

/**
 * Whether a parsed contract belongs in the `/api/reports` list at all.
 * Documents (invoices, orders…) are printed from their own window, never listed
 * as reports, and a contract with no outputs has nothing to render. `custom`
 * contracts (ETP-4901) are internal NEO endpoints that back a specific page's
 * own data needs (e.g. financial-accounts-page powers the Cuentas landing
 * page's sidebar widgets) — real, still-served endpoints, just never meant to
 * show up as a runnable report a user picks from the catalog.
 */
export function isListableReport(contract) {
  if (!contract || !contract.reportId) return false;
  if (!Array.isArray(contract.outputs) || contract.outputs.length <= 0) return false;
  if (contract.type === 'document' || contract.type === 'custom') return false;
  return VALID_SOURCES.has(contract.source) || Boolean(contract.mockDataFile);
}

/**
 * Maps a parsed contract onto the descriptor the frontend consumes. Every field
 * the report viewer reads off a listed report must be here — it has no other
 * source for them.
 */
export function buildReportDescriptor(contract) {
  return {
    id: contract.reportId,
    title: contract.title,
    type: contract.type,
    category: contract.category || 'other',
    orientation: contract.orientation,
    outputs: contract.outputs,
    parameters: contract.parameters || [],
    // Drives `useAccordion` in ReportViewerPage — omitting it silently
    // downgrades the sidebar to the legacy flat layout.
    sections: contract.sections || [],
  };
}

/**
 * Scans an artifacts directory and returns the descriptors for every listable
 * report, skipping malformed contracts rather than failing the whole build.
 */
export function listReportDescriptors(artifactsDir) {
  const reports = [];
  for (const dir of readdirSync(artifactsDir, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const contractPath = join(artifactsDir, dir.name, 'report-contract.json');
    if (!existsSync(contractPath)) continue;
    try {
      const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
      if (isListableReport(contract)) reports.push(buildReportDescriptor(contract));
    } catch {
      // skip malformed
    }
  }
  return reports;
}
