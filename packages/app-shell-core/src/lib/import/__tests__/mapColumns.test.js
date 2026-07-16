import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHeader, mapColumns } from '../mapColumns.js';

describe('normalizeHeader', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizeHeader('  Email  '), 'email');
  });

  it('strips accents', () => {
    assert.equal(normalizeHeader('Teléfono'), 'telefono');
    assert.equal(normalizeHeader('País'), 'pais');
  });

  it('collapses internal whitespace', () => {
    assert.equal(normalizeHeader('Nombre   Comercial'), 'nombre comercial');
  });
});

describe('mapColumns', () => {
  const importFields = [
    { target: 'name', label: 'Nombre' },
    { target: 'etgoEmail', label: 'Email', aliases: ['correo', 'e-mail'] },
    { target: 'commercialName', label: 'Nombre comercial' },
  ];

  it('maps a header to a target by exact label match', () => {
    const { mapping } = mapColumns(['Nombre', 'Email'], importFields);
    assert.equal(mapping['Nombre'], 'name');
    assert.equal(mapping['Email'], 'etgoEmail');
  });

  it('matches case- and accent-insensitively', () => {
    const { mapping } = mapColumns(['NOMBRE COMERCIAL'], importFields);
    assert.equal(mapping['NOMBRE COMERCIAL'], 'commercialName');
  });

  it('matches via an alias when the header does not match the label', () => {
    const { mapping } = mapColumns(['Correo'], importFields);
    assert.equal(mapping['Correo'], 'etgoEmail');
  });

  it('maps unrecognized headers to null', () => {
    const { mapping } = mapColumns(['Teléfono'], importFields);
    assert.equal(mapping['Teléfono'], null);
  });

  it('reports targets that no header matched', () => {
    const { unmappedTargets } = mapColumns(['Nombre'], importFields);
    assert.deepEqual(unmappedTargets, ['etgoEmail', 'commercialName']);
  });

  it('reports no unmapped targets once every field has a matching header', () => {
    const { unmappedTargets } = mapColumns(['Nombre', 'Email', 'Nombre comercial'], importFields);
    assert.deepEqual(unmappedTargets, []);
  });
});
