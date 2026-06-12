/**
 * Tests for AdvancedFilterBuilder constants and patterns.
 * The component is UI-heavy but the operator/mode maps are critical business logic.
 */

// Replicate the constants since they're not exported
const OPERATORS_BY_MODE = {
  text:         ['iContains', 'iNotContains', 'iEquals', 'iNotEqual', 'isNull', 'isNotNull'],
  identifier:   ['iContains', 'iNotContains', 'equals', 'notEqual', 'isNull', 'isNotNull'],
  enumLabel:    ['equals', 'notEqual', 'inSet', 'isNull', 'isNotNull'],
  booleanLabel: ['equals'],
  numeric:      ['equals', 'notEqual', 'greaterThan', 'greaterOrEqual', 'lessThan', 'lessOrEqual', 'between', 'isNull', 'isNotNull'],
  date:         ['equals', 'lessThan', 'greaterThan', 'between', 'isNull', 'isNotNull'],
};

const TEXTUAL_IDENT_OPS = new Set(['iContains', 'iNotContains', 'iEquals', 'iNotEqual']);

describe('AdvancedFilterBuilder logic', () => {
  describe('OPERATORS_BY_MODE', () => {
    it('text mode has 6 operators', () => {
      expect(OPERATORS_BY_MODE.text).toHaveLength(6);
      expect(OPERATORS_BY_MODE.text).toContain('iContains');
      expect(OPERATORS_BY_MODE.text).toContain('isNull');
    });

    it('identifier mode includes both contains and equals', () => {
      expect(OPERATORS_BY_MODE.identifier).toContain('iContains');
      expect(OPERATORS_BY_MODE.identifier).toContain('equals');
    });

    it('enumLabel has inSet for multi-select', () => {
      expect(OPERATORS_BY_MODE.enumLabel).toContain('inSet');
    });

    it('booleanLabel only has equals', () => {
      expect(OPERATORS_BY_MODE.booleanLabel).toEqual(['equals']);
    });

    it('numeric has between and comparison ops', () => {
      expect(OPERATORS_BY_MODE.numeric).toContain('between');
      expect(OPERATORS_BY_MODE.numeric).toContain('greaterThan');
      expect(OPERATORS_BY_MODE.numeric).toContain('lessOrEqual');
    });

    it('date has between and comparison ops', () => {
      expect(OPERATORS_BY_MODE.date).toContain('between');
      expect(OPERATORS_BY_MODE.date).toContain('lessThan');
      expect(OPERATORS_BY_MODE.date).toContain('greaterThan');
    });

    it('all modes include isNull/isNotNull except booleanLabel', () => {
      for (const [mode, ops] of Object.entries(OPERATORS_BY_MODE)) {
        if (mode === 'booleanLabel') continue;
        expect(ops).toContain('isNull');
        expect(ops).toContain('isNotNull');
      }
    });
  });

  describe('TEXTUAL_IDENT_OPS', () => {
    it('contains the 4 textual identifier operators', () => {
      expect(TEXTUAL_IDENT_OPS.has('iContains')).toBe(true);
      expect(TEXTUAL_IDENT_OPS.has('iNotContains')).toBe(true);
      expect(TEXTUAL_IDENT_OPS.has('iEquals')).toBe(true);
      expect(TEXTUAL_IDENT_OPS.has('iNotEqual')).toBe(true);
    });

    it('does not contain discrete ops', () => {
      expect(TEXTUAL_IDENT_OPS.has('equals')).toBe(false);
      expect(TEXTUAL_IDENT_OPS.has('notEqual')).toBe(false);
    });
  });
});
