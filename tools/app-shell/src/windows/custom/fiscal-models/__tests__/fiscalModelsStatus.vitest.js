import { describe, it, expect } from 'vitest';
import { STATUSES, STATUS_COLOR, STATUS_ICON, STATUS_ORDER } from '../fiscalModelsUtils.js';

describe('STATUSES — status unification', () => {
  it('contains pendiente for Modelo 349 compatibility', () => {
    expect(STATUSES).toContain('pendiente');
  });

  it('still contains borrador', () => {
    expect(STATUSES).toContain('borrador');
  });

  it('STATUS_COLOR has a pendiente entry (orange)', () => {
    expect(STATUS_COLOR).toHaveProperty('pendiente', 'orange');
  });

  it('STATUS_ICON has a pendiente entry', () => {
    expect(STATUS_ICON).toHaveProperty('pendiente');
  });

  it('STATUS_ORDER mirrors STATUSES', () => {
    expect(STATUS_ORDER).toEqual(STATUSES);
  });
});
