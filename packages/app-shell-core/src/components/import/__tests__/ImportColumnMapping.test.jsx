import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ImportColumnMapping } from '../ImportColumnMapping.jsx';

afterEach(() => {
  cleanup();
});

const importFields = [
  { target: 'name', label: 'Name' },
  { target: 'email', label: 'Email' },
];

describe('ImportColumnMapping', () => {
  it('renders one chip per header', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onMappingChange={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__header-Nombre')).toBeDefined();
    expect(screen.getByTestId('ImportColumnMapping__header-Correo')).toBeDefined();
  });

  it('shows the currently mapped target for each header', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onMappingChange={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__select-Nombre').textContent).toContain('Name');
  });

  it('shows "Not imported" for an unmapped header', () => {
    render(
      <ImportColumnMapping
        headers={['Telefono']}
        importFields={importFields}
        mapping={{ Telefono: null }}
        onMappingChange={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__select-Telefono').textContent).toContain('Not imported');
  });
});
