import { describe, it, expect } from 'vitest';
import { getLayout303, applyPatch } from './fm303Layouts.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function sectionIds(layout) {
  return layout.sections.map(s => s.id);
}

function rowIds(layout, sectionId) {
  const sec = layout.sections.find(s => s.id === sectionId);
  return sec ? sec.rows.map(r => r.id) : null;
}

// ── BASE layout (no patch) ────────────────────────────────────────────────────

describe('getLayout303 — BASE layout (no patch)', () => {
  const layout = getLayout303(2026, 1);

  it('returns all six canonical sections', () => {
    expect(sectionIds(layout)).toEqual([
      'identificacion',
      'iva_devengado',
      'iva_deducible',
      'resultado',
      'info_adicional',
      'resultado_final',
    ]);
  });

  it('iva_devengado contains extended rows added in 2025 (150, 165, 168)', () => {
    const ids = rowIds(layout, 'iva_devengado');
    expect(ids).toContain('150');
    expect(ids).toContain('165');
    expect(ids).toContain('168');
  });

  it('iva_deducible contains full set of rows including regularizacion', () => {
    const ids = rowIds(layout, 'iva_deducible');
    expect(ids).toContain('regularizacion');
    expect(ids).toContain('prorrata_definitiva');
  });

  it('resultado contains diferencia row', () => {
    const ids = rowIds(layout, 'resultado');
    expect(ids).toContain('diferencia');
  });

  it('returns a new object on each call (no shared mutation)', () => {
    const a = getLayout303(2026, 1);
    const b = getLayout303(2026, 1);
    expect(a).not.toBe(b);
  });
});

// ── Period-specific lookup falls through to year patch ────────────────────────

describe('getLayout303 — period-specific key falls back to year key', () => {
  it('period key with no entry resolves to year-level patch', () => {
    const byYear   = getLayout303(2024, 1);
    const byPeriod = getLayout303(2024, 2);
    expect(sectionIds(byYear)).toEqual(sectionIds(byPeriod));
    expect(rowIds(byYear, 'iva_devengado')).toEqual(rowIds(byPeriod, 'iva_devengado'));
  });
});

// ── 2024 patch ────────────────────────────────────────────────────────────────

describe('getLayout303 — 2024 patch', () => {
  const layout = getLayout303(2024, 1);

  it('still returns six sections', () => {
    expect(layout.sections).toHaveLength(6);
  });

  it('removes row 165 (not introduced until 2025)', () => {
    expect(rowIds(layout, 'iva_devengado')).not.toContain('165');
  });

  it('removes row 168 (not introduced until 2025)', () => {
    expect(rowIds(layout, 'iva_devengado')).not.toContain('168');
  });

  it('keeps row 150 (present in 2024)', () => {
    expect(rowIds(layout, 'iva_devengado')).toContain('150');
  });

  it('keeps recargo_equiv rows (19, 22, recargo_equiv)', () => {
    const ids = rowIds(layout, 'iva_devengado');
    expect(ids).toContain('recargo_equiv');
    expect(ids).toContain('19');
    expect(ids).toContain('22');
  });
});

// ── 2023 patch ────────────────────────────────────────────────────────────────

describe('getLayout303 — 2023 patch', () => {
  const layout = getLayout303(2023, 4);

  it('removes all extended iva_devengado rows (150, 165, 153, 156, 168)', () => {
    const ids = rowIds(layout, 'iva_devengado');
    for (const removed of ['150', '165', '153', '156', '168']) {
      expect(ids).not.toContain(removed);
    }
  });

  it('removes recargo_equiv, 19, 22, mod_recargo, total_devengada', () => {
    const ids = rowIds(layout, 'iva_devengado');
    for (const removed of ['recargo_equiv', '19', '22', 'mod_recargo', 'total_devengada']) {
      expect(ids).not.toContain(removed);
    }
  });

  it('keeps base rows 4 and 7 (general rates)', () => {
    const ids = rowIds(layout, 'iva_devengado');
    expect(ids).toContain('4');
    expect(ids).toContain('7');
  });

  it('removes diferencia from resultado section', () => {
    expect(rowIds(layout, 'resultado')).not.toContain('diferencia');
  });

  it('iva_deducible only retains op_int_corrientes', () => {
    const ids = rowIds(layout, 'iva_deducible');
    expect(ids).toContain('op_int_corrientes');
    for (const removed of [
      'op_int_bienes_inv', 'importaciones', 'imp_bienes_inv',
      'adq_intracom_corr', 'adq_intracom_inv', 'regularizacion',
      'compensaciones_reag', 'reg_bienes_inv', 'prorrata_definitiva',
    ]) {
      expect(ids).not.toContain(removed);
    }
  });
});

// ── Unknown year / period falls back to BASE ──────────────────────────────────

describe('getLayout303 — unknown year uses BASE', () => {
  it('year with no patch entry returns BASE sections', () => {
    const base  = getLayout303(2026, 1);
    const other = getLayout303(2099, 1);
    expect(sectionIds(other)).toEqual(sectionIds(base));
    expect(rowIds(other, 'iva_devengado')).toEqual(rowIds(base, 'iva_devengado'));
  });

  it('returns sections array (not null / undefined)', () => {
    const layout = getLayout303(2099, 1);
    expect(Array.isArray(layout.sections)).toBe(true);
    expect(layout.sections.length).toBeGreaterThan(0);
  });
});

// ── Patch engine — opDeleteRow does not crash on unknown row ──────────────────

describe('getLayout303 — deleteRow with non-existent row is a no-op', () => {
  it('2024 layout is well-formed even though 165/168 patches target rows BASE has', () => {
    expect(() => getLayout303(2024, 1)).not.toThrow();
    expect(() => getLayout303(2023, 1)).not.toThrow();
  });
});

// ── applyPatch — opInsertRow ──────────────────────────────────────────────────

describe('applyPatch — opInsertRow', () => {
  it('inserts after an existing row', () => {
    const result = applyPatch([
      { op: 'insertRow', section: 'resultado', after: 'diferencia', row: { id: 'new', cells: [99] } },
    ]);
    const ids = result.sections.find(s => s.id === 'resultado').rows.map(r => r.id);
    expect(ids).toEqual(['diferencia', 'new']);
  });

  it('appends at end when `after` target does not exist (defensive branch)', () => {
    const result = applyPatch([
      { op: 'insertRow', section: 'resultado', after: 'nonexistent', row: { id: 'appended', cells: [99] } },
    ]);
    const ids = result.sections.find(s => s.id === 'resultado').rows.map(r => r.id);
    expect(ids.at(-1)).toBe('appended');
  });

  it('inserts before an existing row', () => {
    const result = applyPatch([
      { op: 'insertRow', section: 'resultado', before: 'diferencia', row: { id: 'pre', cells: [0] } },
    ]);
    const ids = result.sections.find(s => s.id === 'resultado').rows.map(r => r.id);
    expect(ids).toEqual(['pre', 'diferencia']);
  });

  it('appends at end when `before` target does not exist (defensive branch)', () => {
    const result = applyPatch([
      { op: 'insertRow', section: 'resultado', before: 'ghost', row: { id: 'fallback', cells: [0] } },
    ]);
    const ids = result.sections.find(s => s.id === 'resultado').rows.map(r => r.id);
    expect(ids.at(-1)).toBe('fallback');
  });

  it('appends at end when neither after nor before is specified', () => {
    const result = applyPatch([
      { op: 'insertRow', section: 'resultado', row: { id: 'tail', cells: [0] } },
    ]);
    const ids = result.sections.find(s => s.id === 'resultado').rows.map(r => r.id);
    expect(ids.at(-1)).toBe('tail');
  });

  it('is a no-op when the section does not exist', () => {
    const result = applyPatch([
      { op: 'insertRow', section: 'phantom', row: { id: 'x', cells: [] } },
    ]);
    expect(result.sections.find(s => s.id === 'phantom')).toBeUndefined();
  });
});

// ── applyPatch — opPatchRow ───────────────────────────────────────────────────

describe('applyPatch — opPatchRow', () => {
  it('merges patch fields onto an existing row', () => {
    const result = applyPatch([
      { op: 'patchRow', section: 'resultado', row: 'diferencia', patch: { total: false } },
    ]);
    const row = result.sections.find(s => s.id === 'resultado').rows.find(r => r.id === 'diferencia');
    expect(row.total).toBe(false);
    expect(row.cells).toEqual([46]);
  });

  it('is a no-op when the row does not exist', () => {
    expect(() => applyPatch([
      { op: 'patchRow', section: 'resultado', row: 'ghost', patch: { total: true } },
    ])).not.toThrow();
  });

  it('is a no-op when the section does not exist', () => {
    expect(() => applyPatch([
      { op: 'patchRow', section: 'phantom', row: 'diferencia', patch: {} },
    ])).not.toThrow();
  });
});

// ── applyPatch — opReorderRows ────────────────────────────────────────────────

describe('applyPatch — opReorderRows', () => {
  it('reorders rows to the specified sequence', () => {
    const result = applyPatch([
      {
        op: 'reorderRows',
        section: 'iva_deducible',
        order: ['total_deducir', 'op_int_corrientes'],
      },
    ]);
    const ids = result.sections.find(s => s.id === 'iva_deducible').rows.map(r => r.id);
    expect(ids[0]).toBe('total_deducir');
    expect(ids[1]).toBe('op_int_corrientes');
  });

  it('drops rows not listed in order', () => {
    const result = applyPatch([
      { op: 'reorderRows', section: 'resultado', order: ['diferencia'] },
    ]);
    const ids = result.sections.find(s => s.id === 'resultado').rows.map(r => r.id);
    expect(ids).toEqual(['diferencia']);
  });

  it('is a no-op when section does not exist', () => {
    expect(() => applyPatch([
      { op: 'reorderRows', section: 'phantom', order: [] },
    ])).not.toThrow();
  });
});

// ── applyPatch — opDeleteSection ──────────────────────────────────────────────

describe('applyPatch — opDeleteSection', () => {
  it('removes the specified section from the output', () => {
    const result = applyPatch([
      { op: 'deleteSection', section: 'info_adicional' },
    ]);
    expect(result.sections.find(s => s.id === 'info_adicional')).toBeUndefined();
  });

  it('is a no-op when section does not exist (defensive idx !== -1 guard)', () => {
    expect(() => applyPatch([
      { op: 'deleteSection', section: 'phantom' },
    ])).not.toThrow();
  });
});

// ── applyPatch — opInsertSection ──────────────────────────────────────────────

describe('applyPatch — opInsertSection', () => {
  const newSec = {
    titleKey: 'fm.test.section',
    colHeaderKeys: [],
    rows: [{ id: 'r1', cells: [200] }],
  };

  it('inserts a new section after an existing one', () => {
    const result = applyPatch([
      { op: 'insertSection', after: 'resultado', section: 'extra', section_def: newSec },
    ]);
    const ids = sectionIds(result);
    const resultIdx = ids.indexOf('resultado');
    expect(ids[resultIdx + 1]).toBe('extra');
  });

  it('inserts a new section before an existing one', () => {
    const result = applyPatch([
      { op: 'insertSection', before: 'resultado', section: 'extra', section_def: newSec },
    ]);
    const ids = sectionIds(result);
    const extraIdx = ids.indexOf('extra');
    expect(ids[extraIdx + 1]).toBe('resultado');
  });

  it('appends section at end when neither after nor before is given', () => {
    const result = applyPatch([
      { op: 'insertSection', section: 'tail_section', section_def: newSec },
    ]);
    expect(sectionIds(result).at(-1)).toBe('tail_section');
  });
});

// ── applyPatch — opPatchSection ───────────────────────────────────────────────

describe('applyPatch — opPatchSection', () => {
  it('merges patch fields onto an existing section (excluding rows)', () => {
    const result = applyPatch([
      { op: 'patchSection', section: 'resultado', patch: { titleKey: 'fm.test.override', rows: ['ignored'] } },
    ]);
    const sec = result.sections.find(s => s.id === 'resultado');
    expect(sec.titleKey).toBe('fm.test.override');
    expect(sec.rows.map(r => r.id)).toContain('diferencia');
  });

  it('is a no-op when section does not exist', () => {
    expect(() => applyPatch([
      { op: 'patchSection', section: 'phantom', patch: { titleKey: 'x' } },
    ])).not.toThrow();
  });
});
