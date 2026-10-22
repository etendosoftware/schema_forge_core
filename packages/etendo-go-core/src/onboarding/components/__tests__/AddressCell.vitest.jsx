// @covers packages/etendo-go-core/src/onboarding/components/AddressCell.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AddressCell } from '../AddressCell.jsx';

/**
 * ETP-5806 design follow-up — AddressCell is one cell of CompanyStep's compound
 * address field (Street/Number/Building Name/City rendered as a single bordered
 * block, divided internally). The cell itself is deliberately borderless; these
 * tests cover its own contract (label, required mark, error, value passthrough),
 * not the shared frame that lives in CompanyStep.jsx.
 */
describe('AddressCell', () => {
  it('renders the label and wires it to the input via htmlFor/id', () => {
    render(<AddressCell id="streetName" label="Calle" />);
    const input = screen.getByLabelText('Calle');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'streetName');
  });

  it('does not show a required mark or trailing label by default', () => {
    render(<AddressCell id="streetName" label="Calle" />);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('shows the required asterisk when required=true', () => {
    render(<AddressCell id="streetName" label="Calle" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders an optional trailing label next to the main label (e.g. "(optional)")', () => {
    render(<AddressCell id="buildingName" label="Nombre de edificio" trailingLabel="(optional)" />);
    expect(screen.getByText('(optional)')).toBeInTheDocument();
  });

  it('shows no error message and no aria-invalid when error is not set', () => {
    render(<AddressCell id="streetName" label="Calle" />);
    expect(screen.queryByTestId('AddressCell-error__79cf84')).not.toBeInTheDocument();
    expect(screen.getByTestId('AddressCell-input__79cf84')).toHaveAttribute('aria-invalid', 'false');
  });

  it('shows the inline error message and marks the input aria-invalid when error is set', () => {
    render(<AddressCell id="streetName" label="Calle" error="Este campo es obligatorio" />);
    expect(screen.getByTestId('AddressCell-error__79cf84')).toHaveTextContent('Este campo es obligatorio');
    expect(screen.getByTestId('AddressCell-input__79cf84')).toHaveAttribute('aria-invalid', 'true');
  });

  it('forwards value, placeholder, maxLength, autoComplete and onChange to the underlying input', () => {
    const onChange = vi.fn();
    render(
      <AddressCell
        id="streetName"
        label="Calle"
        value="Av. Corrientes"
        placeholder="Av. Corrientes"
        maxLength={70}
        autoComplete="address-line1"
        onChange={onChange}
      />,
    );
    const input = screen.getByTestId('AddressCell-input__79cf84');
    expect(input).toHaveValue('Av. Corrientes');
    expect(input).toHaveAttribute('placeholder', 'Av. Corrientes');
    expect(input).toHaveAttribute('maxLength', '70');
    expect(input).toHaveAttribute('autoComplete', 'address-line1');

    fireEvent.change(input, { target: { value: 'Calle Mayor' } });
    expect(onChange).toHaveBeenCalled();
  });
});
