import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTemplateCsv } from '../buildTemplateCsv.js';

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
