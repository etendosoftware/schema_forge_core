import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplateCsv, resolveTemplateHeaders } from '../buildTemplateCsv.js';
import { mapColumns } from '../mapColumns.js';

describe('buildTemplateCsv', () => {
  it('uses each field\'s first alias as its column header, in field order', () => {
    const fields = [
      { target: 'name', label: 'Commercial Name', aliases: ['nombre comercial', 'razon social'] },
      { target: 'etgoEmail', label: 'Email (Company)', aliases: ['email', 'correo', 'e-mail'] },
    ];
    assert.equal(buildTemplateCsv(fields), 'nombre comercial,email');
  });

  it('falls back to the field label when it has no aliases', () => {
    const fields = [{ target: 'name', label: 'Commercial Name' }];
    assert.equal(buildTemplateCsv(fields), 'Commercial Name');
  });

  it('falls back to the field label when aliases is an empty array', () => {
    const fields = [{ target: 'name', label: 'Commercial Name', aliases: [] }];
    assert.equal(buildTemplateCsv(fields), 'Commercial Name');
  });

  it('falls back to the target when neither aliases nor label are present', () => {
    const fields = [{ target: 'name' }];
    assert.equal(buildTemplateCsv(fields), 'name');
  });

  it('quotes a header containing a comma', () => {
    const fields = [{ target: 'name', label: 'Name', aliases: ['nombre, comercial'] }];
    assert.equal(buildTemplateCsv(fields), '"nombre, comercial"');
  });

  it('returns an empty string for no fields', () => {
    assert.equal(buildTemplateCsv([]), '');
  });
});

describe('buildTemplateCsv — ETP-4996: required marker, example row, session language', () => {
  it('marks required columns so the user can see what is mandatory', () => {
    const fields = [
      { target: 'searchKey', label: 'Search Key', aliases: ['codigo'], required: true },
      { target: 'description', label: 'Description', aliases: ['descripcion'] },
    ];
    assert.equal(buildTemplateCsv(fields), 'codigo *,descripcion');
  });

  it('writes headers in the session language when a resolver is supplied', () => {
    // Without this the header is always aliases[0], which is the Spanish term in every
    // window — the template came out in Spanish regardless of the session's language.
    const fields = [{ target: 'searchKey', label: 'Search Key', aliases: ['codigo'], required: true }];
    assert.equal(
      buildTemplateCsv(fields, { headerFor: (f) => f.label }),
      'Search Key *',
    );
  });

  it('falls back to the alias when the resolver returns nothing for a field', () => {
    const fields = [{ target: 'searchKey', label: 'Search Key', aliases: ['codigo'] }];
    assert.equal(buildTemplateCsv(fields, { headerFor: () => null }), 'codigo');
  });

  it('appends a sample row built from each field\'s declared example', () => {
    const fields = [
      { target: 'searchKey', aliases: ['codigo'], required: true, example: 'SKU-1001' },
      { target: 'salesPrice', aliases: ['precio'], example: '12,50' },
    ];
    // The es-ES decimal comma has to survive into the file as data, not split the row —
    // the sample row goes through the same csvField quoting every export uses.
    assert.equal(buildTemplateCsv(fields), 'codigo *,precio\nSKU-1001,"12,50"');
  });

  it('leaves a cell blank in the sample row for a field with no example', () => {
    const fields = [
      { target: 'searchKey', aliases: ['codigo'], example: 'SKU-1001' },
      { target: 'description', aliases: ['descripcion'] },
    ];
    assert.equal(buildTemplateCsv(fields), 'codigo,descripcion\nSKU-1001,');
  });

  it('omits the sample row entirely when no field declares an example', () => {
    // An all-blank row is noise, and worse, reads as a data row to anyone not counting lines.
    const fields = [{ target: 'searchKey', aliases: ['codigo'] }];
    assert.equal(buildTemplateCsv(fields), 'codigo');
  });

  it('can be asked for the header line alone', () => {
    const fields = [{ target: 'searchKey', aliases: ['codigo'], example: 'SKU-1001' }];
    assert.equal(buildTemplateCsv(fields, { includeExampleRow: false }), 'codigo');
  });
});

describe('resolveTemplateHeaders — a template must never carry a duplicate header', () => {
  // Reproduced from a real downloaded Contacts template: the company's and the contact
  // person's email both resolve to "Correo electrónico" through their AD column, and
  // parseDelimited REJECTS duplicate headers — so the file could not be uploaded at all.
  const contactsLike = [
    { target: 'etgoEmail', label: 'Email (Company)', aliases: ['email'], column: 'EM_Etgo_Email' },
    { target: 'etgoPhone', label: 'Phone (Company)', aliases: ['telefono'], column: 'EM_Etgo_Phone' },
    { target: 'email', label: 'Email (Contact)', aliases: ['email de contacto'], column: 'Email' },
    { target: 'phone', label: 'Phone (Contact)', aliases: ['telefono de contacto'], column: 'Phone' },
  ];
  const sameLabelForBoth = (f) => ({
    EM_Etgo_Email: 'Correo electrónico', Email: 'Correo electrónico',
    EM_Etgo_Phone: 'Teléfono', Phone: 'Teléfono',
  }[f.column]);

  it('gives the session label to the first field and the reference to the later one', () => {
    // The window declares the primary entity's fields first, so the plain name lands on the
    // field a user means by default (the company's email) and only the qualified one carries
    // a reference. Falling back on BOTH would push a perfectly good localized label out of
    // the template for no reason.
    assert.deepEqual(
      resolveTemplateHeaders(contactsLike, { headerFor: sameLabelForBoth }),
      ['Correo electrónico', 'Teléfono', 'Email (Contact)', 'Phone (Contact)'],
    );
  });

  it('keeps the session label for fields that do not collide', () => {
    const mixed = [
      { target: 'name', label: 'Commercial Name', aliases: ['nombre comercial'], column: 'Name' },
      ...contactsLike,
    ];
    const headers = resolveTemplateHeaders(mixed, {
      headerFor: (f) => (f.column === 'Name' ? 'Razón Social' : sameLabelForBoth(f)),
    });
    assert.equal(headers[0], 'Razón Social');
    assert.deepEqual(headers.slice(1), ['Correo electrónico', 'Teléfono', 'Email (Contact)', 'Phone (Contact)']);
  });

  it('suffixes with the target when even the declared labels collide', () => {
    // Last resort: the session label collides AND the fallback labels are identical too, so
    // there is nothing left to tell the two columns apart. Suffixing keeps the file
    // uploadable; a window hitting this should give the field a distinct label.
    const bothSame = [
      { target: 'a', label: 'Email', column: 'A' },
      { target: 'b', label: 'Email', column: 'B' },
    ];
    assert.deepEqual(resolveTemplateHeaders(bothSame, { headerFor: () => 'Email' }),
      ['Email', 'Email (b)']);
  });

  it('preserves the required marker while de-colliding', () => {
    const fields = [
      { target: 'etgoEmail', label: 'Email (Company)', column: 'X', required: true },
      { target: 'email', label: 'Email (Contact)', column: 'Y' },
    ];
    // Detection must ignore the marker: comparing "Correo *" against "Correo" would treat
    // them as distinct, let both through, and — since mapColumns strips the marker — send
    // both columns to the same field, silently.
    assert.deepEqual(resolveTemplateHeaders(fields, { headerFor: () => 'Correo' }),
      ['Correo *', 'Email (Contact)']);
  });

  it('keeps a shared session header when the other claimant has a column of its own', () => {
    // Contacts, verbatim: `name` owns the alias "nombre" (ETP-4995), and etgoFirstname's AD
    // column also resolves to "Nombre". Both columns are present, so `name` takes "nombre
    // comercial" and "Nombre" falls through to etgoFirstname — no fallback needed, and the
    // Spanish template gets to say "Nombre".
    const fields = [
      { target: 'name', label: 'Commercial Name', aliases: ['nombre comercial', 'nombre'] },
      { target: 'etgoFirstname', label: 'First Name', aliases: ['nombre de pila'], column: 'EM_Etgo_Firstname' },
    ];
    const headers = resolveTemplateHeaders(fields, {
      headerFor: (f) => (f.column === 'EM_Etgo_Firstname' ? 'Nombre' : null),
    });
    assert.deepEqual(headers, ['nombre comercial', 'Nombre']);

    // And it must actually round-trip: "Nombre" has to reach etgoFirstname, not `name`.
    const withOwnHeader = fields.map((f, i) => ({ ...f, aliases: [...(f.aliases ?? []), headers[i]] }));
    const { mapping } = mapColumns(headers, withOwnHeader);
    assert.deepEqual(mapping, { 'nombre comercial': 'name', Nombre: 'etgoFirstname' });
  });

  it('falls back when the other claimant has no column of its own to take', () => {
    // Same shape, but `name` has no second header to fall back on, so "Nombre" would consume
    // the only column `name` could have used. The field that would lose its column gives way.
    const fields = [
      { target: 'name', label: 'Commercial Name', aliases: ['nombre'] },
      { target: 'etgoFirstname', label: 'First Name', aliases: ['nombre de pila'], column: 'EM_Etgo_Firstname' },
    ];
    const headers = resolveTemplateHeaders(fields, {
      headerFor: (f) => (f.column === 'EM_Etgo_Firstname' ? 'Nombre' : null),
    });
    assert.deepEqual(headers, ['nombre', 'First Name']);
  });

  it('keeps a session header no other field claims', () => {
    const fields = [
      { target: 'name', label: 'Commercial Name', aliases: ['nombre comercial'], column: 'Name' },
    ];
    assert.deepEqual(
      resolveTemplateHeaders(fields, { headerFor: () => 'Razón Social' }),
      ['Razón Social'],
    );
  });
});
