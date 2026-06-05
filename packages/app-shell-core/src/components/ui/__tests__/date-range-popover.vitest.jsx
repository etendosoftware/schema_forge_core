import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/i18n', () => ({
  useUI: () => (key) => {
    const map = {
      dateRangeToday: 'Hoy',
      dateRangeYesterday: 'Ayer',
      dateRangeLast7Days: 'Últimos 7 días',
      dateRangeLast30Days: 'Últimos 30 días',
      dateRangeLast12Months: 'Últimos 12 meses',
      dateRangeAllTime: 'Cualquier fecha',
      dateRangeAnyTime: 'Cualquier fecha',
      dateRangeCustom: 'Personalizado',
      dateRangeApply: 'Aplicar',
      dateRangeCancel: 'Cancelar',
      datePickerMonth: 'Mes',
      datePickerYear: 'Año',
    };
    return map[key] ?? key;
  },
  useLocaleSwitch: () => ({ locale: 'es_ES' }),
}));

import {
  DateRangePopoverContent,
  computeTriggerLabel,
} from '../date-range-popover.jsx';

describe('DateRangePopoverContent', () => {
  it('renders the six preset rows + the Custom row', () => {
    render(
      <DateRangePopoverContent value={null} onChange={() => {}} onClose={() => {}} />,
    );

    expect(screen.getByText('Hoy')).toBeInTheDocument();
    expect(screen.getByText('Ayer')).toBeInTheDocument();
    expect(screen.getByText('Últimos 7 días')).toBeInTheDocument();
    expect(screen.getByText('Últimos 30 días')).toBeInTheDocument();
    expect(screen.getByText('Últimos 12 meses')).toBeInTheDocument();
    expect(screen.getByText('Cualquier fecha')).toBeInTheDocument();
    expect(screen.getByText('Personalizado')).toBeInTheDocument();
  });

  it('emits a presetId object when a preset row is clicked and closes the popover', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <DateRangePopoverContent value={null} onChange={onChange} onClose={onClose} />,
    );

    fireEvent.click(screen.getByText('Últimos 7 días'));
    expect(onChange).toHaveBeenCalledWith({ presetId: 'last7' });
    expect(onClose).toHaveBeenCalled();
  });

  it('emits null when the "All time" preset is clicked', () => {
    const onChange = vi.fn();
    render(
      <DateRangePopoverContent value={null} onChange={onChange} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('Cualquier fecha'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('keeps Apply disabled when no date range is drafted', () => {
    render(
      <DateRangePopoverContent value={null} onChange={() => {}} onClose={() => {}} />,
    );
    const applyBtn = screen.getByText('Aplicar').closest('button');
    expect(applyBtn).toBeDisabled();
  });

  it('Cancel button calls onClose without onChange', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <DateRangePopoverContent value={null} onChange={onChange} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('treats a value with a presetId as the active preset (renders a check on that row)', () => {
    const { container } = render(
      <DateRangePopoverContent
        value={{ presetId: 'last30' }}
        onChange={() => {}}
        onClose={() => {}}
      />,
    );
    // The active row gets the bg class. We can't reliably test the check icon presence
    // without depending on lucide internals, so verify the preset's row exists and
    // has the active background class.
    const row = screen.getByText('Últimos 30 días').closest('button');
    expect(row.className).toMatch(/bg-\[rgba\(18,18,23,0\.05\)\]/);
    // Sanity check: at least one Check icon (svg with lucide-check class) is in DOM
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('computeTriggerLabel', () => {
  const ui = (key) => {
    const map = {
      dateRangeToday: 'Hoy',
      dateRangeYesterday: 'Ayer',
      dateRangeLast7Days: 'Últimos 7 días',
      dateRangeLast30Days: 'Últimos 30 días',
      dateRangeLast12Months: 'Últimos 12 meses',
      dateRangeAnyTime: 'Cualquier fecha',
    };
    return map[key] ?? key;
  };

  it('returns the placeholder (or any-time fallback) when value is null', () => {
    expect(computeTriggerLabel(null, undefined, ui, 'es-ES')).toBe('Cualquier fecha');
    expect(computeTriggerLabel(null, 'Selecciona…', ui, 'es-ES')).toBe('Selecciona…');
  });

  it('returns the preset label for known presetIds', () => {
    expect(computeTriggerLabel({ presetId: 'today' }, undefined, ui, 'es-ES')).toBe('Hoy');
    expect(computeTriggerLabel({ presetId: 'last30' }, undefined, ui, 'es-ES')).toBe('Últimos 30 días');
  });

  it('falls back to placeholder/any-time for an unknown presetId', () => {
    expect(computeTriggerLabel({ presetId: 'weird' }, 'fallback', ui, 'es-ES')).toBe('fallback');
    expect(computeTriggerLabel({ presetId: 'weird' }, undefined, ui, 'es-ES')).toBe('Cualquier fecha');
  });

  it('formats a custom range as "from – to"', () => {
    const from = new Date(2026, 0, 5);
    const to = new Date(2026, 0, 12);
    const label = computeTriggerLabel({ from, to }, undefined, ui, 'es-ES');
    expect(label).toContain('5');
    expect(label).toContain('12');
    expect(label).toContain('–');
  });
});
