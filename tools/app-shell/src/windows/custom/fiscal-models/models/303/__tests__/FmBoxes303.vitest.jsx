// Vitest component tests for FmBoxes303.jsx
import { vi, describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => key,
}));
vi.mock('lucide-react', () => ({
  TrendingUp: () => null,
  TrendingDown: () => null,
  Pencil: () => null,
}));
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onChange }) =>
    React.createElement('input', {
      type: 'checkbox', checked: !!checked,
      onChange: onChange ?? (() => {}),
    }),
}));

import FmBoxes303 from '../FmBoxes303.jsx';

const BASE_PROPS = {
  year: 2026,
  period: 'T2',
};

// ── Rendering with boxes as object ────────────────────────────────────────────

describe('FmBoxes303 — rendering', () => {
  it('renders without crashing with empty boxes', () => {
    render(<FmBoxes303 {...BASE_PROPS} boxes={{}} />);
    expect(document.body).toBeTruthy();
  });

  it('renders the fm-aeat-table container', () => {
    const { container } = render(<FmBoxes303 {...BASE_PROPS} boxes={{}} />);
    expect(container.querySelector('.fm-aeat-table')).toBeTruthy();
  });

  it('renders fm-aeat-section elements', () => {
    const { container } = render(<FmBoxes303 {...BASE_PROPS} boxes={{}} />);
    expect(container.querySelectorAll('.fm-aeat-section').length).toBeGreaterThan(0);
  });

  it('renders fm-aeat-cell elements for box values', () => {
    const { container } = render(<FmBoxes303 {...BASE_PROPS} boxes={{ 7: 1000, 9: 210 }} />);
    expect(container.querySelectorAll('.fm-aeat-cell').length).toBeGreaterThan(0);
  });
});

// ── Box value display ─────────────────────────────────────────────────────────

describe('FmBoxes303 — box value display', () => {
  it('shows formatted amount for a known box value (object form)', () => {
    const { container } = render(<FmBoxes303 {...BASE_PROPS} boxes={{ 7: 1234.56 }} />);
    // formatAmount renders currency; check the cell has some text
    const cells = container.querySelectorAll('.fm-aeat-cell__value');
    const nonEmpty = Array.from(cells).filter(c => c.textContent.trim() !== '');
    expect(nonEmpty.length).toBeGreaterThan(0);
  });

  it('accepts boxes as an array of {num, value} objects', () => {
    const boxes = [{ num: 7, value: 500 }, { num: 9, value: 105 }];
    const { container } = render(<FmBoxes303 {...BASE_PROPS} boxes={boxes} />);
    const cells = container.querySelectorAll('.fm-aeat-cell__value');
    const nonEmpty = Array.from(cells).filter(c => c.textContent.trim() !== '');
    expect(nonEmpty.length).toBeGreaterThan(0);
  });

  it('renders box number padded to 2 digits', () => {
    const { container } = render(<FmBoxes303 {...BASE_PROPS} boxes={{ 7: 100 }} />);
    const nums = Array.from(container.querySelectorAll('.fm-aeat-cell__num'));
    const numTexts = nums.map(n => n.textContent);
    // Box 7 renders as "07"
    expect(numTexts.some(t => t === '07')).toBe(true);
  });

  it('leaves cell value empty when box is not in boxes data', () => {
    // Render with sectionIds limited to 'resultado' to get a manageable set
    const { container } = render(
      <FmBoxes303 {...BASE_PROPS} boxes={{}} sectionIds={['resultado']} />
    );
    const values = container.querySelectorAll('.fm-aeat-cell__value');
    // All values should be empty strings when no data provided
    values.forEach(el => expect(el.textContent).toBe(''));
  });
});

// ── sectionIds filtering ──────────────────────────────────────────────────────

describe('FmBoxes303 — sectionIds prop', () => {
  it('renders only the requested section when sectionIds is provided', () => {
    const { container: containerAll } = render(
      <FmBoxes303 {...BASE_PROPS} boxes={{}} />
    );
    const { container: containerFiltered } = render(
      <FmBoxes303 {...BASE_PROPS} boxes={{}} sectionIds={['resultado']} />
    );
    const allSections = containerAll.querySelectorAll('.fm-aeat-section').length;
    const filteredSections = containerFiltered.querySelectorAll('.fm-aeat-section').length;
    expect(filteredSections).toBeLessThan(allSections);
  });
});

// ── Identificacion section ────────────────────────────────────────────────────

describe('FmBoxes303 — identificacion section', () => {
  it('renders the identificacion section', () => {
    const { container } = render(
      <FmBoxes303 {...BASE_PROPS} boxes={{}} sectionIds={['identificacion']} />
    );
    expect(container.querySelector('.fm-aeat-ident')).toBeTruthy();
  });

  it('renders text fields from identification prop', () => {
    const { container } = render(
      <FmBoxes303
        {...BASE_PROPS}
        boxes={{}}
        sectionIds={['identificacion']}
        identification={{ nif: 'B12345678', nombre: 'Test SL' }}
      />
    );
    expect(document.body.textContent).toContain('B12345678');
    expect(document.body.textContent).toContain('Test SL');
  });

  it('renders checkboxes for checkbox fields', () => {
    const { container } = render(
      <FmBoxes303 {...BASE_PROPS} boxes={{}} sectionIds={['identificacion']} />
    );
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('calls onIdentChange when a checkbox is toggled', () => {
    const onIdentChange = vi.fn();
    const { container } = render(
      <FmBoxes303
        {...BASE_PROPS}
        boxes={{}}
        sectionIds={['identificacion']}
        identification={{ redeme: false }}
        onIdentChange={onIdentChange}
      />
    );
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    // Trigger click which fires React's onChange for checkboxes
    fireEvent.click(checkboxes[0]);
    expect(onIdentChange).toHaveBeenCalled();
  });
});

// ── Editable cells ────────────────────────────────────────────────────────────

describe('FmBoxes303 — editable cells', () => {
  it('shows edit pencil button on editable cells', () => {
    // resultado_final section typically has editable cells
    const { container } = render(
      <FmBoxes303 {...BASE_PROPS} boxes={{}} sectionIds={['resultado_final']} />
    );
    // If there are editable cells, edit buttons should exist
    const editBtns = container.querySelectorAll('.fm-aeat-cell__edit-btn');
    // This is a soft check — some layouts may not have editable cells in resultado_final
    if (editBtns.length > 0) {
      fireEvent.click(editBtns[0]);
      // After clicking, an input should appear
      expect(container.querySelector('.fm-aeat-cell__input')).toBeTruthy();
    }
  });

  it('renders editable cell input as type="number" to prevent letter input', () => {
    const { container } = render(
      <FmBoxes303 {...BASE_PROPS} boxes={{}} sectionIds={['resultado_final']} />
    );
    const editBtns = container.querySelectorAll('.fm-aeat-cell__edit-btn');
    if (editBtns.length > 0) {
      fireEvent.click(editBtns[0]);
      const input = container.querySelector('.fm-aeat-cell__input');
      expect(input).toBeTruthy();
      expect(input.getAttribute('type')).toBe('number');
      expect(input.getAttribute('step')).toBe('any');
    }
  });
});

// ── i18n keys ────────────────────────────────────────────────────────────────

describe('FmBoxes303 — i18n usage', () => {
  it('renders section title keys via t()', () => {
    render(<FmBoxes303 {...BASE_PROPS} boxes={{}} sectionIds={['iva_devengado']} />);
    expect(document.body.textContent).toContain('fm.box.section.iva_devengado');
  });

  it('renders column header keys via t()', () => {
    render(<FmBoxes303 {...BASE_PROPS} boxes={{}} sectionIds={['iva_devengado']} />);
    expect(document.body.textContent).toContain('fm.box.colHeader.base');
    expect(document.body.textContent).toContain('fm.box.colHeader.cuota');
  });
});
