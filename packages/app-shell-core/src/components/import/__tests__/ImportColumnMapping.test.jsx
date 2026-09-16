import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ImportColumnMapping } from '../ImportColumnMapping.jsx';

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

// The bank-statement / contacts shape that produced QA's report: two file columns whose
// headers both look like a description, and a user who tried to point BOTH fields at the
// SAME column. The fix makes that unrepresentable in the editor rather than silently
// overwriting one of the two on save.
const bankFields = [
  { target: 'description', label: 'Descripción' },
  { target: 'contactName', label: 'Nombre del contacto' },
];

/** Opens one field's select and picks `header` (or "Not imported" when header is null). */
function pickSource(target, header) {
  fireEvent.click(screen.getByTestId(`ImportColumnMapping__select-${target}`));
  fireEvent.click(screen.getByTestId(header === null ? 'SelectItem__bf9e7b' : `SelectItem__${header}`));
}

describe('ImportColumnMapping — chips (column-first summary)', () => {
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

  it('never joins multiple target labels into one chip — the mapping is one-to-one', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__chip-Nombre').textContent).not.toContain(',');
    expect(screen.getByTestId('ImportColumnMapping__chip-Correo').textContent).not.toContain(',');
  });
});

describe('ImportColumnMapping — summary counts FIELDS, not columns', () => {
  it('counts the fields that have a source out of the total field count', () => {
    // Three columns, two fields, one column unused: the meaningful number is 2/2 fields
    // covered — an extra column the user does not want to import is not a shortfall.
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo', 'Telefono']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email', Telefono: null }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__summaryCount').textContent).toContain('2/2');
  });

  it('shows a warning icon while some field still has no source', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Telefono']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Telefono: null }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__summaryCount').textContent).toContain('1/2');
    expect(screen.getByTestId('ImportColumnMapping__summaryWarning')).toBeDefined();
  });

  it('does not show a warning icon when every field has a source', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.queryByTestId('ImportColumnMapping__summaryWarning')).toBeNull();
  });

  it('does not double-count: exactly one source per field means exactly one count per field', () => {
    // Fields outnumber headers is impossible to double-count by construction (one select per
    // field, one source at most), but pin it anyway with an odd header/field ratio.
    render(
      <ImportColumnMapping
        headers={['Descripción', 'Nombre del contacto']}
        importFields={bankFields}
        mapping={{ 'Descripción': 'description', 'Nombre del contacto': 'contactName' }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__summaryCount').textContent).toContain('2/2');
    expect(screen.queryByTestId('ImportColumnMapping__summaryWarning')).toBeNull();
  });
});

describe('ImportColumnMapping — the edit modal is keyed by FIELD', () => {
  it('renders exactly one select per import field, pre-filled with the column that feeds it', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    const selects = document.querySelectorAll('[data-testid^="ImportColumnMapping__select-"]');
    expect(selects.length).toBe(importFields.length);
    expect(screen.getByTestId('ImportColumnMapping__select-name').textContent).toContain('Nombre');
    expect(screen.getByTestId('ImportColumnMapping__select-email').textContent).toContain('Correo');
  });

  it('labels each row with the field, not with the file column', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    expect(screen.getByTestId('ImportColumnMapping__field-name').textContent).toContain('Name');
    expect(screen.getByTestId('ImportColumnMapping__field-email').textContent).toContain('Email');
    // The old direction keyed the selects by header — no such select may exist any more.
    expect(screen.queryByTestId('ImportColumnMapping__select-Nombre')).toBeNull();
    expect(screen.queryByTestId('ImportColumnMapping__select-Correo')).toBeNull();
  });

  it('marks a required field with an asterisk', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={[{ target: 'name', label: 'Name', required: true }]}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    expect(screen.getByTestId('ImportColumnMapping__field-name').textContent).toContain('*');
  });

  it('shows "Not imported" on a field no column feeds', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    expect(screen.getByTestId('ImportColumnMapping__select-email').textContent).toContain('Not imported');
  });

  it('renders exactly one chevron icon per select trigger (regression: no double chevron)', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    expect(screen.getByTestId('ImportColumnMapping__select-name').querySelectorAll('svg').length).toBe(1);
  });
});

describe('ImportColumnMapping — saving', () => {
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

  // ETP-5223 — `label` is the ENGLISH caption declared in decisions.json. The chips and the
  // "Editar correspondencia" dropdown printed it verbatim, so both stayed English in a
  // Spanish session while the CSV template downloaded from the same dialog was translated.
  //
  // Adapted for the field-first grid (ETP-4954): a field's select no longer lists every
  // importField as an option (options are now the file's headers), so the dropdown-side
  // assertion here checks the field CAPTION in the edit modal — `ImportColumnMapping__field-*` —
  // rather than a since-removed `SelectItem__email` header-keyed option.
  it('prefers fieldLabelFn over the field\'s English label in the chips and the edit modal', () => {
    const fieldLabelFn = (field) => ({ name: 'Nombre', email: 'Correo electrónico' }[field.target]);
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
        fieldLabelFn={fieldLabelFn}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__chip-Nombre').textContent).toContain('Nombre');
    expect(screen.getByTestId('ImportColumnMapping__chip-Nombre').textContent).not.toContain('Name');

    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    expect(screen.getByTestId('ImportColumnMapping__field-name').textContent).toContain('Nombre');
    expect(screen.getByTestId('ImportColumnMapping__field-email').textContent).toContain('Correo electrónico');
  });

  // No resolver at all (every existing caller before this change, and the tests above) must
  // keep rendering the declared label rather than a blank cell.
  it('falls back to the declared label when no fieldLabelFn is given', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre']}
        importFields={importFields}
        mapping={{ Nombre: 'name' }}
        onApplyMapping={() => {}}
      />,
    );
    expect(screen.getByTestId('ImportColumnMapping__chip-Nombre').textContent).toContain('Name');
  });

  it('emits a plain string (not an array) for a field pointed at a fresh column', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: null }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    pickSource('email', 'Correo');
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    expect(onApplyMapping).toHaveBeenCalledWith({ Nombre: 'name', Correo: 'email' });
  });

  it('re-points a field at a different column, freeing the one it used to read', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: null }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    pickSource('name', 'Correo');
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    expect(onApplyMapping).toHaveBeenCalledWith({ Correo: 'name' });
  });

  it('drops a field set back to "not imported" from the emitted mapping', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: 'email' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    pickSource('email', null);
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    const emitted = onApplyMapping.mock.calls[0][0];
    expect(emitted).toEqual({ Nombre: 'name' });
    expect(Object.keys(emitted)).not.toContain('Correo');
  });
});

describe('ImportColumnMapping — a column already claimed by another field is disabled', () => {
  it('disables the option for a column another field already holds', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: null }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    // "Nombre" already feeds `name`; open `email`'s list and inspect that option.
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-email'));
    const claimedOption = screen.getByTestId('SelectItem__Nombre');
    expect(claimedOption.getAttribute('aria-disabled')).toBe('true');
    expect(claimedOption.getAttribute('data-disabled')).toBe('');
  });

  it("states which field already holds the column, using the alreadyAssigned template", () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: null }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-email'));
    // Default template: 'already fills {field}', filled in with the OWNING field's label.
    expect(screen.getByTestId('SelectItem__Nombre').textContent).toBe('Nombre — already fills Name');
  });

  it('honors a custom alreadyAssigned label template', () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: null }}
        onApplyMapping={() => {}}
        labels={{ alreadyAssigned: 'used by {field}' }}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-email'));
    expect(screen.getByTestId('SelectItem__Nombre').textContent).toBe('Nombre — used by Name');
  });

  it("never disables a field's own current selection", () => {
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: null }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    // `name` already holds "Nombre" — its own list must still let it re-select "Nombre".
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-name'));
    const ownOption = screen.getByTestId('SelectItem__Nombre');
    expect(ownOption.getAttribute('aria-disabled')).toBeNull();
    expect(ownOption.getAttribute('data-disabled')).toBeNull();
    // And its label is the plain header — no "already fills" note for its own value.
    expect(ownOption.textContent).toBe('Nombre');
  });

  it('clicking a disabled option does not reassign the column (no-op, not merely discouraged)', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Nombre', 'Correo']}
        importFields={importFields}
        mapping={{ Nombre: 'name', Correo: null }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    // Try to point `email` at "Nombre", which `name` already holds.
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-email'));
    fireEvent.click(screen.getByTestId('SelectItem__Nombre'));
    // `email`'s trigger must still read "Not imported" — the click never fired onValueChange.
    expect(screen.getByTestId('ImportColumnMapping__select-email').textContent).toContain('Not imported');
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));
    expect(onApplyMapping).toHaveBeenCalledWith({ Nombre: 'name' });
  });
});

describe('ImportColumnMapping — ETP-4954: a field can never be fed by two columns', () => {
  // QA's report: with the old column-first editor the user mapped "Descripción → Descripción"
  // AND "Nombre del contacto → Descripción". The second column silently overwrote the first,
  // so after saving the *Nombre del contacto* column came back empty while *Descripción*
  // carried the contact data. Keying the editor by field, and disabling a column everywhere
  // it is already claimed, makes that unrepresentable: a field has exactly one select,
  // therefore exactly one source, and no other field's select can pick the same column.

  it('exposes exactly one source select per field, so no field can be given a second source', () => {
    render(
      <ImportColumnMapping
        headers={['Descripción', 'Nombre del contacto']}
        importFields={bankFields}
        mapping={{ 'Descripción': 'description', 'Nombre del contacto': 'contactName' }}
        onApplyMapping={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    for (const field of bankFields) {
      expect(
        document.querySelectorAll(`[data-testid="ImportColumnMapping__select-${field.target}"]`).length,
      ).toBe(1);
    }
    expect(document.querySelectorAll('[data-testid^="ImportColumnMapping__select-"]').length)
      .toBe(bankFields.length);
  });

  it('blocks pointing two different fields at the same column via the disabled option, keeping the mapping one-to-one', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Descripción', 'Nombre del contacto']}
        importFields={bankFields}
        mapping={{ 'Descripción': 'description', 'Nombre del contacto': 'contactName' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    // Reproduce the user's attempt from QA's report: try to point BOTH destinations at the
    // "Descripción" column. `contactName`'s own list disables it because `description` already
    // holds it, so the click is a no-op.
    fireEvent.click(screen.getByTestId('ImportColumnMapping__select-contactName'));
    fireEvent.click(screen.getByTestId('SelectItem__Descripción'));
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));

    const emitted = onApplyMapping.mock.calls[0][0];
    // Every header maps to exactly one target, and every target appears at most once —
    // the invariant a "column feeds two fields" bug would break.
    const targets = Object.values(emitted).filter(Boolean);
    expect(new Set(targets).size).toBe(targets.length);
    // Nothing was overwritten: each column keeps the field it started with.
    expect(emitted).toEqual({
      'Descripción': 'description',
      'Nombre del contacto': 'contactName',
    });
  });

  it('re-pointing a field at a column its sibling field held frees that column for the sibling to pick something else', () => {
    const onApplyMapping = vi.fn();
    render(
      <ImportColumnMapping
        headers={['Descripción', 'Nombre del contacto']}
        importFields={bankFields}
        mapping={{ 'Descripción': 'description', 'Nombre del contacto': 'contactName' }}
        onApplyMapping={onApplyMapping}
      />,
    );
    fireEvent.click(screen.getByTestId('ImportColumnMapping__editButton'));
    // Free "Descripción" first by un-mapping the field that holds it...
    pickSource('description', null);
    // ...only then can `contactName` legally claim it (no longer disabled).
    pickSource('contactName', 'Descripción');
    fireEvent.click(screen.getByTestId('ImportColumnMapping__saveButton'));

    const emitted = onApplyMapping.mock.calls[0][0];
    const targets = Object.values(emitted).filter(Boolean);
    expect(new Set(targets).size).toBe(targets.length);
    expect(emitted).toEqual({ 'Descripción': 'contactName' });
  });
});
