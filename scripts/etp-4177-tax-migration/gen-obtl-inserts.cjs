#!/usr/bin/env node
/*
 * ETP-4177 — Generate SQL INSERTs for the OBTL (303/349) dataset tables.
 *
 * GOClient is promoted in place by 00-promote-goclient.sql, but it has ZERO
 * OBTL rows — the 303/349 model structure only exists in the dataset XML. This
 * script parses that XML and emits INSERTs (at ad_client_id='0', ad_org_id='0')
 * for the 5 OBTL tables, producing 00b-insert-obtl.sql.
 *
 * Usage:
 *   node gen-obtl-inserts.js <dataset.xml> > 00b-insert-obtl.sql
 */
const fs = require('fs');

const SRC = process.argv[2];
if (!SRC) { console.error('usage: gen-obtl-inserts.js <dataset.xml>'); process.exit(1); }
const xml = fs.readFileSync(SRC, 'utf8');

// entity -> { table, pk, fields:[{tag, col, kind}] }  kind: scalar|bool|fk
// order matters for FK dependencies (insert parents before children)
const ENTITIES = [
  { tag: 'OBTL_TributaryKey', table: 'obtl_tributarykey', pk: 'obtl_tributarykey_id', fields: [
    { tag: 'searchKey', col: 'value', kind: 'scalar' },
    { tag: 'name', col: 'name', kind: 'scalar' },
    { tag: 'description', col: 'description', kind: 'scalar' },
  ]},
  { tag: 'OBTL_Tax_Report', table: 'obtl_tax_report', pk: 'obtl_tax_report_id', fields: [
    { tag: 'searchKey', col: 'value', kind: 'scalar' },
    { tag: 'name', col: 'name', kind: 'scalar' },
    { tag: 'period', col: 'period', kind: 'scalar' },
    { tag: 'description', col: 'description', kind: 'scalar' },
    { tag: 'javaClassName', col: 'classname', kind: 'scalar' },
  ]},
  { tag: 'OBTL_Tax_Report_Group', table: 'obtl_tax_report_group', pk: 'obtl_tax_report_group_id', fields: [
    { tag: 'taxReport', col: 'obtl_tax_report_id', kind: 'fk' },
    { tag: 'searchKey', col: 'value', kind: 'scalar' },
    { tag: 'name', col: 'name', kind: 'scalar' },
    { tag: 'sequenceNumber', col: 'seqno', kind: 'scalar' },
    { tag: 'description', col: 'description', kind: 'scalar' },
    { tag: 'aeat390Factorymethod', col: 'em_aeat390_factorymethod', kind: 'scalar' },
  ]},
  { tag: 'OBTL_Tax_Report_Parameter', table: 'obtl_tax_report_parameter', pk: 'obtl_tax_report_parameter_id', fields: [
    { tag: 'searchKey', col: 'value', kind: 'scalar' },
    { tag: 'name', col: 'name', kind: 'scalar' },
    { tag: 'sequenceNumber', col: 'seqno', kind: 'scalar' },
    { tag: 'type', col: 'type', kind: 'scalar' },
    { tag: 'inputtype', col: 'inputtype', kind: 'scalar' },
    { tag: 'description', col: 'description', kind: 'scalar' },
    { tag: 'constantValue', col: 'constantvalue', kind: 'scalar' },
    { tag: 'taxReportGroup', col: 'obtl_tax_report_group_id', kind: 'fk' },
    { tag: 'tributaryKey', col: 'obtl_tributarykey_id', kind: 'fk' },
    { tag: 'tributarySubkey', col: 'obtl_tributarysubkey_id', kind: 'fk' },
    { tag: 'obtlTransactioncode', col: 'obtl_transactioncode_id', kind: 'fk' },
    { tag: 'aeat390Issplit', col: 'em_aeat390_issplit', kind: 'bool' },
    { tag: 'aeat390XmlElement', col: 'em_aeat390_xml_element', kind: 'scalar' },
    { tag: 'aeat390Box', col: 'em_aeat390_box', kind: 'scalar' },
    { tag: 'aeat390Istotal', col: 'em_aeat390_istotal', kind: 'bool' },
    { tag: 'aeat390IsCashVATPayment', col: 'em_aeat390_iscashvatpayment', kind: 'bool' },
    { tag: 'aeat390DocumentType', col: 'em_aeat390_documenttype', kind: 'scalar' },
    { tag: 'aeat390IsBIAndCuota', col: 'em_aeat390_is_bi_and_cuota', kind: 'bool' },
  ]},
  { tag: 'OBTL_Tax_Parameter', table: 'obtl_tax_parameter', pk: 'obtl_tax_parameter_id', fields: [
    { tag: 'tax', col: 'c_tax_id', kind: 'fk' },
    { tag: 'taxReportParameter', col: 'obtl_tax_report_parameter_id', kind: 'fk' },
  ]},
];

function decodeXml(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'").replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
          .replace(/&amp;/g, '&'); // amp last
}
const sqlStr = (v) => v === null ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'";

// extract a scalar child element value (null if nil/absent/empty)
function scalar(block, tag) {
  // <tag .../> self-closing (incl. xsi:nil) -> null
  if (new RegExp(`<${tag}\\b[^>]*/>`).test(block)) return null;
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return null;
  const raw = m[1];
  if (raw === '') return null;
  return decodeXml(raw);
}
// extract FK id (the id="..." attribute of a self-closing ref), null if nil/absent
function fk(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*?\\bid="([0-9A-Fa-f]+)"[^>]*/>`));
  return m ? m[1] : null;
}
function bool(block, tag) {
  const v = scalar(block, tag);
  if (v === null) return null;
  return v === 'true' ? 'Y' : 'N';
}

const AUDIT = "'0','0',now(),'0',now(),'0'";  // ad_client_id, ad_org_id, created, createdby, updated, updatedby
const out = [];
out.push("-- ============================================================================");
out.push("-- ETP-4177 — STEP 0b : INSERT OBTL (303/349) system dataset");
out.push("-- Generated from the dataset XML by gen-obtl-inserts.js — DO NOT edit by hand.");
out.push("-- Run AFTER 00-promote-goclient.sql (obtl_tax_parameter.c_tax_id references the");
out.push("-- promoted system taxes). Transactional; dry-run by default, -v do_commit=1 to apply.");
out.push("-- ============================================================================");
out.push("\\set ON_ERROR_STOP on");
out.push("\\if :{?do_commit} \\else \\set do_commit 0 \\endif");
out.push("BEGIN;");
out.push("SELECT ad_disable_triggers();");
out.push("");

let totals = {};
for (const ent of ENTITIES) {
  const re = new RegExp(`<${ent.tag}\\b[^>]*>[\\s\\S]*?</${ent.tag}>`, 'g');
  const blocks = xml.match(re) || [];
  totals[ent.table] = blocks.length;
  const cols = ['' + ent.pk, 'ad_client_id', 'ad_org_id', 'created', 'createdby', 'updated', 'updatedby', 'isactive',
                ...ent.fields.map(f => f.col)];
  out.push(`-- ${ent.table} : ${blocks.length} rows`);
  for (const b of blocks) {
    const idm = b.match(/\bid="([0-9A-Fa-f]+)"/);
    if (!idm) continue;
    const id = idm[1];
    const active = bool(b, 'active') || 'Y';
    const vals = ent.fields.map(f => {
      if (f.kind === 'fk') return sqlStr(fk(b, f.tag));
      if (f.kind === 'bool') { const x = bool(b, f.tag); return x === null ? 'NULL' : sqlStr(x); }
      return sqlStr(scalar(b, f.tag));
    });
    out.push(`INSERT INTO ${ent.table} (${cols.join(',')}) VALUES (${sqlStr(id)},${AUDIT},${sqlStr(active)},${vals.join(',')});`);
  }
  out.push("");
}

out.push("SELECT ad_enable_triggers();");
out.push("\\echo ''");
out.push("\\echo 'OBTL rows now at client 0:'");
out.push("SELECT 'obtl_tributarykey' t, count(*) FROM obtl_tributarykey WHERE ad_client_id='0'");
out.push("UNION ALL SELECT 'obtl_tax_report', count(*) FROM obtl_tax_report WHERE ad_client_id='0'");
out.push("UNION ALL SELECT 'obtl_tax_report_group', count(*) FROM obtl_tax_report_group WHERE ad_client_id='0'");
out.push("UNION ALL SELECT 'obtl_tax_report_parameter', count(*) FROM obtl_tax_report_parameter WHERE ad_client_id='0'");
out.push("UNION ALL SELECT 'obtl_tax_parameter', count(*) FROM obtl_tax_parameter WHERE ad_client_id='0' ORDER BY t;");
out.push("\\if :do_commit");
out.push("  \\echo '>>> do_commit=1 : COMMITTING OBTL inserts.'");
out.push("  COMMIT;");
out.push("\\else");
out.push("  \\echo '>>> dry run : ROLLING BACK. Re-run with -v do_commit=1 to apply.'");
out.push("  ROLLBACK;");
out.push("\\endif");

process.stdout.write(out.join('\n') + '\n');
console.error('Generated rows: ' + JSON.stringify(totals));
