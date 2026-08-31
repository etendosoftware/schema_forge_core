import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplateXlsx } from '../buildTemplateXlsx.js';
import { buildTemplateCsv, resolveTemplateHeaders } from '../buildTemplateCsv.js';
import { parseXlsx } from '../parseXlsx.js';
import { mapColumns } from '../mapColumns.js';

/**
 * Shaped after the real Contacts import: `email` appears twice with a colliding AD label, which
 * is the case `resolveTemplateHeaders`' collision fallback exists for and the one a
 * hand-rolled header pass would break.
 */
const FIELDS = [
  { target: 'name', aliases: ['nombre comercial'], label: 'Commercial Name', required: true, example: 'Distribuciones García S.L.' },
  { target: 'taxID', aliases: ['cif/nif'], label: 'Tax ID', required: true, example: 'B10000101' },
  { target: 'etgoEmail', aliases: ['email'], label: 'Email (Company)', example: 'info@garcia.es' },
  { target: 'email', aliases: ['email de contacto'], label: 'Email (Contact)', headerScope: 'contact', example: 'compras@garcia.es' },
  { target: 'postal', aliases: ['codigo postal'], label: 'Postal Code', headerScope: 'address', example: '08018' },
];

/** The AD label resolver ImportDialog injects — deliberately made to collide on "email". */
const headerFor = (field) => (
  field.target === 'etgoEmail' || field.target === 'email' ? 'Correo electrónico' : field.label
);

async function readTemplate(fields, options) {
  return parseXlsx(await buildTemplateXlsx(fields, options));
}

describe('buildTemplateXlsx', () => {
  /**
   * The parity that matters: whichever format the user downloads, the headers are the same, so
   * a file started as CSV and re-saved as XLSX (or the reverse) still maps. Asserted against
   * `buildTemplateCsv` itself rather than a literal list, so the two cannot drift.
   */
  it('writes byte-identical headers to the CSV template', async () => {
    const { headers } = await readTemplate(FIELDS, { headerFor });
    const csvHeaderLine = buildTemplateCsv(FIELDS, { headerFor, includeExampleRow: false });

    assert.deepEqual(headers, resolveTemplateHeaders(FIELDS, { headerFor }));
    // And the same headers the CSV template's first line actually carries.
    assert.deepEqual(headers.map((h) => h.replace(/^"|"$/g, '')), csvHeaderLine.split(',').map((h) => h.replace(/^"|"$/g, '')));
  });

  /**
   * The real end-to-end property: a downloaded template, filled in as-is and uploaded, maps
   * every column back onto the field it was written for. This is what makes the template
   * useful rather than merely well-formed — and it exercises the collision fallback, since
   * two of these fields want the same header.
   */
  it('round-trips: every column of the generated template maps back to its own field', async () => {
    const { headers } = await readTemplate(FIELDS, { headerFor });
    const withOwnHeader = FIELDS.map((field, i) => (
      { ...field, aliases: [...field.aliases, headers[i]] }
    ));

    const { mapping } = mapColumns(headers, withOwnHeader);

    FIELDS.forEach((field, i) => {
      assert.equal(mapping[headers[i]], field.target,
        `header "${headers[i]}" mapped to ${mapping[headers[i]]}, not ${field.target}`);
    });
  });

  it('keeps the required marker on required columns', async () => {
    const { headers } = await readTemplate(FIELDS, { headerFor });
    assert.ok(headers[0].endsWith(' *'), `expected a required marker on "${headers[0]}"`);
    assert.ok(headers[1].endsWith(' *'), `expected a required marker on "${headers[1]}"`);
    assert.ok(!headers[4].endsWith(' *'), `did not expect a required marker on "${headers[4]}"`);
  });

  it('writes the example row as text, so a leading zero survives the round trip', async () => {
    const { rows, headers } = await readTemplate(FIELDS, { headerFor });
    assert.equal(rows.length, 1);
    assert.equal(rows[0][headers[4]], '08018');
  });

  it('emits the header row alone when no field declares an example', async () => {
    const bare = FIELDS.map(({ example, ...rest }) => rest);
    const { rows } = await readTemplate(bare, { headerFor });
    assert.deepEqual(rows, []);
  });

  it('emits the header row alone when the example row is switched off', async () => {
    const { rows } = await readTemplate(FIELDS, { headerFor, includeExampleRow: false });
    assert.deepEqual(rows, []);
  });

  it('writes a single sheet, which is the only shape parseXlsx accepts', async () => {
    // parseXlsx rejects a workbook with more than one sheet holding data, so a template that
    // grew a second sheet could not be uploaded back. Reading it through parseXlsx at all is
    // the assertion — it would have thrown.
    const { headers } = await readTemplate(FIELDS, { headerFor });
    assert.equal(headers.length, FIELDS.length);
  });
});
