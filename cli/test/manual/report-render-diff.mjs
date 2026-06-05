#!/usr/bin/env node
/**
 * Manual end-to-end check: renders every report's real template.hbs with its
 * mock data using BOTH the old `new Function` extraction and the new trusted
 * module, and diffs the HTML output byte-for-byte.
 *
 * Run:  node cli/test/manual/report-render-diff.mjs
 *
 * Expected: every report that rendered HTML before produces IDENTICAL output.
 * `print-*` reports were already broken in HTML (they use a qrCode helper that
 * only exists in the jsreport PDF path) — they stay broken in both, no regression.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { registerReportHelpers } from '../../../templates/reports/helpers/report-html-helpers.js';

const _require = createRequire(import.meta.url);
const Handlebars = _require('handlebars');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ART = join(ROOT, 'artifacts');

const WHITELIST = ['isGroupBreak', 'resetGroupTracking', 'formatDate', 'formatCurrency',
  'formatBoolean', 'formatNumber', 'ifCond', 'eq', 'sumField', 'formatDateDisplay', 'sumRowsByCategory'];

// OLD extraction — verbatim from the pre-change consumers.
function oldHelpers(code) {
  // eslint-disable-next-line no-new-func
  const fn = new Function(code + `
    var _out = {};
    ['${WHITELIST.join("','")}']
    .forEach(function(n){ try{ var f=eval(n); if(typeof f==='function') _out[n]=f; }catch(e){} });
    return _out;`);
  return fn();
}
function renderOld(tpl, code, data) {
  const hb = Handlebars.create();
  const h = oldHelpers(code);
  if (typeof h.resetGroupTracking === 'function') h.resetGroupTracking();
  Object.entries(h).forEach(([n, f]) => { if (typeof f === 'function') hb.registerHelper(n, f); });
  return hb.compile(tpl)(data);
}
function renderNew(tpl, code, data) {
  const hb = Handlebars.create();
  registerReportHelpers(hb, code);
  return hb.compile(tpl)(data);
}

const dirs = readdirSync(ART).filter(d => existsSync(join(ART, d, 'helpers.js')) && existsSync(join(ART, d, 'template.hbs')));
let ok = 0, diff = 0, oldBroke = 0;
for (const d of dirs) {
  const code = readFileSync(join(ART, d, 'helpers.js'), 'utf8');
  const tpl = readFileSync(join(ART, d, 'template.hbs'), 'utf8');
  const mockPath = join(ART, d, 'mock-data.json');
  let data = {};
  if (existsSync(mockPath)) { try { data = JSON.parse(readFileSync(mockPath, 'utf8')); } catch { /* ignore */ } }
  const ctx = { ...data, meta: data.meta || { title: d, params: {}, filters: [] }, rows: data.rows || data.data || [], css: '' };

  let hOld;
  try { hOld = renderOld(tpl, code, ctx); }
  catch (e) { oldBroke++; console.log(`OLD-BROKE  ${d}: ${e.message.split('\n')[0]}`); continue; }

  const hNew = renderNew(tpl, code, ctx);
  if (hOld === hNew) { ok++; console.log(`IDENTICAL  ${d}  (${hNew.length} chars)`); }
  else {
    diff++;
    let i = 0; while (i < hOld.length && hOld[i] === hNew[i]) i++;
    console.log(`DIFF       ${d}  @${i}: old="...${hOld.slice(i - 20, i + 20)}..." new="...${hNew.slice(i - 20, i + 20)}..."`);
  }
}
console.log(`\nRESUMEN: identical=${ok}  diff=${diff}  old-broke=${oldBroke}  total=${dirs.length}`);
process.exit(diff === 0 ? 0 : 1);
