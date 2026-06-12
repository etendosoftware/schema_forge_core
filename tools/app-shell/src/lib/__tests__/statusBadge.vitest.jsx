import { getStatusTone, getStatusBadgeProps, getStatusDotColor, getStatusPillClass, getStatusGridPillClass, statusLabel } from '../statusBadge';

describe('statusBadge', () => {
  describe('getStatusTone', () => {
    it.each([
      ['co', 'success'], ['CO', 'success'], ['completed', 'success'], ['y', 'success'], ['true', 'success'], ['pa', 'success'],
      ['ip', 'warning'], ['rpap', 'warning'], ['in process', 'warning'],
      ['vo', 'destructive'], ['cj', 'destructive'], ['voided', 'destructive'], ['rejected', 'destructive'],
      ['dr', 'neutral'], ['unknown', 'neutral'], [null, 'neutral'], [undefined, 'neutral'],
    ])('maps %s → %s', (status, expected) => {
      expect(getStatusTone(status)).toBe(expected);
    });
  });

  describe('getStatusBadgeProps', () => {
    it('returns emerald for completed statuses', () => {
      const props = getStatusBadgeProps('CO');
      expect(props.className).toContain('emerald');
    });

    it('returns secondary for draft', () => {
      expect(getStatusBadgeProps('DR').variant).toBe('secondary');
    });

    it('returns destructive for voided', () => {
      expect(getStatusBadgeProps('VO').variant).toBe('destructive');
    });

    it('returns outline for in process', () => {
      expect(getStatusBadgeProps('IP').variant).toBe('outline');
      expect(getStatusBadgeProps('IP').className).toContain('amber');
    });

    it('returns outline for under evaluation', () => {
      expect(getStatusBadgeProps('UE').className).toContain('purple');
    });

    it('returns blue for closed/paid', () => {
      expect(getStatusBadgeProps('CL').className).toContain('blue');
    });

    it('returns outline for unknown', () => {
      expect(getStatusBadgeProps('XYZ').variant).toBe('outline');
    });
  });

  describe('getStatusDotColor', () => {
    it('returns emerald for completed', () => { expect(getStatusDotColor('CO')).toContain('emerald'); });
    it('returns red for voided', () => { expect(getStatusDotColor('VO')).toContain('red'); });
    it('returns amber for in process', () => { expect(getStatusDotColor('IP')).toContain('amber'); });
    it('returns gray for unknown', () => { expect(getStatusDotColor('?')).toContain('gray'); });
    it('returns blue for closed', () => { expect(getStatusDotColor('CL')).toContain('blue'); });
  });

  describe('getStatusPillClass', () => {
    it('returns emerald for completed', () => { expect(getStatusPillClass('CO')).toContain('emerald'); });
    it('returns red for voided', () => { expect(getStatusPillClass('VO')).toContain('red'); });
    it('returns gray for draft', () => { expect(getStatusPillClass('DR')).toContain('gray'); });
  });

  describe('getStatusGridPillClass', () => {
    it('returns emerald+white for completed', () => {
      const cls = getStatusGridPillClass('CO');
      expect(cls).toContain('emerald');
      expect(cls).toContain('white');
    });
    it('returns border for draft', () => { expect(getStatusGridPillClass('DR')).toContain('border'); });
  });

  describe('statusLabel', () => {
    it('returns DB-sourced label when available', () => {
      const dict = { statuses: { CO: { label: 'Completado' } } };
      expect(statusLabel('CO', dict)).toBe('Completado');
    });

    it('falls back to genericLabels', () => {
      const dict = { genericLabels: { statusComplete: 'Complete' } };
      expect(statusLabel('CO', dict)).toBe('Complete');
    });

    it('uses translate function as third fallback', () => {
      const translate = (key) => key === 'statusComplete' ? 'Completed' : key;
      expect(statusLabel('CO', {}, translate)).toBe('Completed');
    });

    it('humanizes key name as last resort', () => {
      expect(statusLabel('CO', {})).toBe('Complete');
    });

    it('returns raw status for unmapped codes', () => {
      expect(statusLabel('UNKNOWN', {})).toBe('UNKNOWN');
    });

    it('handles null dictionary', () => {
      expect(statusLabel('DR', null)).toBe('Draft');
    });
  });
});
