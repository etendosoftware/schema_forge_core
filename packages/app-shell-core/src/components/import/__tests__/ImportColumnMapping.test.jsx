import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportColumnMapping } from '../ImportColumnMapping.jsx';

// Radix Select needs these polyfilled in jsdom to open/select — same idiom as the
// ResizeObserver/scrollIntoView polyfills already used for the FK-mismatch popover
// (cmdk) in ImportReviewQueue.test.jsx.
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
});

const importFields = [
  { target: 'name', label: 'Name' },
  { target: 'email', label: 'Email' },
];

describe('ImportColumnMapping', () => {
  it('renders a compact chip per header showing "header → target label"', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__chip-Nombre').textContent).toContain('Name');
    expect(screen.getByTestId('ImportColumnMapping__chip-Correo').textContent).toContain('Email');
  });

  it('shows "Not imported" in the chip for an unmapped header', () => {
    render(
      <ImportColumnMapping
        headers={['Telefono']}
        importFields={importFields}
        mapping={{ Telefono: null }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__chip-Telefono').textContent).toContain('Not imported');
  });

  it('shows the mapped/total summary count', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo', 'Telefono']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email', Telefono: null }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__summaryCount').textContent).toContain('2/3');
  });

  it('shows a warning icon when not every header is mapped', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Telefono']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Telefono: null }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__summaryWarning')).toBeDefined();
  });

  it('does not show a warning icon when every header is mapped', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.queryByTestId('ImportColumnMapping__summaryWarning')).toBeNull();
  });

  it('opens the edit modal showing one select per header, pre-filled with the current mapping', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    expect(screen.getByTestId('ImportColumnMapping__select-Nombre').textContent).toContain('Name');
  });

  it('renders exactly one chevron icon per select trigger inside the edit modal (regression: no double chevron)', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    const trigger = screen.getByTestId('ImportColumnMapping__select-Nombre');
    expect(trigger.querySelectorAll('svg').length).toBe(1);
  });

  it('does not call onApplyMapping when the modal is cancelled', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__cancelButton'));
    expect(onApplyMapping).not.toHaveBeenCalled();
  });

  it('calls onApplyMapping with the unchanged mapping when Save is clicked without edits', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    expect(onApplyMapping).toHaveBeenCalledWith({ Nombre: 'name' });
  });

  it('calls onApplyMapping with the updated mapping after changing a select and clicking Save', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-Nombre'));
    fireEvent.click(screen.getByText('Email'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    expect(onApplyMapping).toHaveBeenCalledWith({ Nombre: 'email' });
  });
});
