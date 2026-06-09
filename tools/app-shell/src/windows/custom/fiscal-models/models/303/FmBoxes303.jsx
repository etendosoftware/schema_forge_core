import React, { useState } from 'react';
import { useUI } from '@/i18n';
import { Checkbox } from '@/components/ui/checkbox';
import { TrendingUp, TrendingDown, Pencil } from 'lucide-react';
import { getLayout303 } from './fm303Layouts.js';
import { formatAmount, formatPercent } from '../../fiscalModelsUtils.js';

const SECTION_ICON = {
  iva_devengado: <TrendingUp  size={20} strokeWidth={1.75} style={{ color: '#121217' }} />,
  iva_deducible: <TrendingDown size={20} strokeWidth={1.75} style={{ color: '#121217' }} />,
};

function formatCell(val, colType) {
  return colType === 'percent' ? formatPercent(val) : formatAmount(val);
}

const COMPACT_SECTIONS = new Set(['iva_devengado', 'iva_deducible', 'resultado', 'info_adicional', 'resultado_final']);
const TITLED_SECTIONS  = new Set(['iva_devengado', 'iva_deducible']);


export default function FmBoxes303({ boxes, year, period, sectionIds, identification, onIdentChange, onBoxChange }) {
  const ui = useUI();
  const t = ui;
  const layout = getLayout303(year, period);
  const [editingCell, setEditingCell] = useState(null);
  const [pendingValues, setPendingValues] = useState({});

  const valueMap = {};
  if (Array.isArray(boxes)) {
    boxes.forEach(b => { valueMap[b.num] = b.value; });
  } else if (boxes && typeof boxes === 'object') {
    Object.assign(valueMap, boxes);
  }

  const sections = sectionIds
    ? layout.sections.filter(s => sectionIds.includes(s.id))
    : layout.sections;

  return (
    <div className="fm-aeat-table">
      {sections.map((section) => {

        // ── Identificación ──────────────────────────────────────────
        if (section.sectionType === 'identificacion') {
          const textFields    = section.fields.filter(f => f.type === 'text');
          const checkboxFields = section.fields.filter(f => f.type === 'checkbox');
          return (
            <div key={section.id} className="fm-aeat-section">
              <div className="fm-aeat-ident">
                <div className="fm-aeat-ident-fields">
                  {textFields.map(f => (
                    <div key={f.id} className="fm-aeat-ident-field">
                      <span className="fm-aeat-ident-field__label">{t(f.labelKey)}</span>
                      <div
                        className="fm-aeat-ident-field__value"
                        style={f.readOnly ? { color: '#9096AD' } : undefined}
                      >{identification?.[f.id] ?? ''}</div>
                    </div>
                  ))}
                </div>
                {checkboxFields.map(f => (
                  <div key={f.id} className="fm-aeat-ident-cb">
                    <Checkbox
                      checked={identification?.[f.id] ?? false}
                      onChange={() => onIdentChange?.(f.id, !(identification?.[f.id] ?? false))}
                    />
                    <span className="fm-aeat-ident-cb__label">{t(f.labelKey)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // ── Grid sections (IVA devengado, deducible, resultado…) ────
        const cols = section.colHeaderKeys?.length || 1;

        return (
          <div key={section.id} className={`fm-aeat-section${COMPACT_SECTIONS.has(section.id) ? ' fm-aeat-section--compact' : ''}${section.id === 'iva_deducible' ? ' fm-aeat-section--divided' : ''}`}>

            {/* Section title — only for IVA Devengado and IVA Deducible */}
            {TITLED_SECTIONS.has(section.id) && (
              <div className="fm-aeat-section__title">
                {SECTION_ICON[section.id] && (
                  <span className="fm-aeat-section__icon">{SECTION_ICON[section.id]}</span>
                )}
                {t(section.titleKey)}
              </div>
            )}

            {/* Column headers */}
            {cols > 0 && section.colHeaderKeys?.length > 0 && (
              <div className="fm-aeat-col-headers">
                <span className="fm-aeat-col-headers__label" />
                {section.colHeaderKeys.map((k) => (
                  <span key={k} className="fm-aeat-col-headers__cell">{t(k)}</span>
                ))}
              </div>
            )}

            {/* Rows — group consecutive group rows into bracket containers */}
            {(() => {
              const items = [];
              let buf = null;
              section.rows.forEach((row, i) => {
                if (row.group) {
                  if (!buf) { buf = []; items.push({ isBracket: true, rows: buf }); }
                  buf.push([row, i]);
                } else {
                  buf = null;
                  items.push({ isBracket: false, row, i });
                }
              });

              const renderRow = (row, i) => {
                if (row.type === 'heading') {
                  return (
                    <div key={row.id ?? `heading-${i}`} className={`fm-aeat-subheading${row.separator ? ' fm-aeat-subheading--sep' : ''}`}>
                      {t(row.titleKey)}
                    </div>
                  );
                }

                if (row.type === 'bicolumn') {
                  return (
                    <div key={row.id} className="fm-aeat-bicolumn">
                      <div className="fm-aeat-bicolumn__left">
                        {row.infoboxes.map(box => {
                          const val = box.cells?.[0] != null ? (valueMap[box.cells[0]] ?? null) : null;
                          return (
                            <div key={box.id} className="fm-aeat-infobox">
                              <p className="fm-aeat-infobox__text">{t(box.labelKey)}</p>
                              {box.cells?.[0] != null && (
                                <div className="fm-aeat-cell">
                                  <span className="fm-aeat-cell__num">{String(box.cells[0]).padStart(2, '0')}</span>
                                  <span className="fm-aeat-cell__value">{val != null ? formatCell(val, 'amount') : ''}</span>
                                  <span className="fm-aeat-cell__unit fm-aeat-cell__unit--dark">{t('fm.unit.euros')}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="fm-aeat-bicolumn__right">
                        {row.rows.map((r, ri) => renderRow(r, ri))}
                      </div>
                    </div>
                  );
                }

                if (row.type === 'terrbox') {
                  return (
                    <div key={row.id} className="fm-aeat-terrbox">
                      <div className="fm-aeat-terrbox__header">
                        <span className="fm-aeat-terrbox__title">{t(row.titleKey)}</span>
                        {row.subtitleKey && <span className="fm-aeat-terrbox__subtitle">{t(row.subtitleKey)}</span>}
                      </div>
                      <div className="fm-aeat-terrbox__rows">
                        {row.territories.map(terr => {
                          const val = valueMap[terr.cell] ?? null;
                          return (
                            <div key={terr.id} className="fm-aeat-terrbox__row">
                              <span className="fm-aeat-terrbox__label">{t(terr.labelKey)}</span>
                              <div className="fm-aeat-cell">
                                <span className="fm-aeat-cell__num">{String(terr.cell).padStart(2, '0')}</span>
                                <span className="fm-aeat-cell__value">{val != null ? formatPercent(val) : ''}</span>
                              </div>
                              <span className="fm-aeat-terrbox__unit">%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const rowCols = row.rowColHeaders
                  ? (row.cells?.length ?? cols)
                  : Math.max(cols, row.cells?.length ?? 0);
                const rowClass = [
                  'fm-aeat-row',
                  row.total ? 'fm-aeat-row--total' : '',
                  row.labelKey ? 'fm-aeat-row--labeled' : '',
                ].filter(Boolean).join(' ');
                const key = row.cells?.[0] ?? row.labelKey ?? i;

                const rowContent = (
                  <>
                    <span className="fm-aeat-row__label">
                      {row.labelKey ? t(row.labelKey) : ''}
                      {row.formula && <span className="fm-aeat-row__formula">{row.formula}</span>}
                    </span>
                    {Array.from({ length: rowCols }, (_, ci) => {
                      const boxNum = row.cells?.[ci] ?? null;
                      if (boxNum === null) return row.total ? null : <div key={ci} className="fm-aeat-cell fm-aeat-cell--empty" />;
                      const isFixed = row.fixedValues != null &&
                        Object.prototype.hasOwnProperty.call(row.fixedValues, boxNum);
                      const val = isFixed ? row.fixedValues[boxNum] : (valueMap[boxNum] ?? null);
                      const colType = row.cellTypes?.[ci] ?? section.colTypes?.[ci] ?? 'amount';
                      const unit = row.cellUnits?.[ci];
                      const isCellEditing = row.editable && editingCell === boxNum;
                      return (
                        <div key={ci} className={`fm-aeat-cell${isFixed ? ' fm-aeat-cell--fixed' : ''}${row.editable ? ' fm-aeat-cell--editable' : ''}`}>
                          <span className="fm-aeat-cell__num">{String(boxNum).padStart(2, '0')}</span>
                          {isCellEditing ? (
                            <input
                              className="fm-aeat-cell__input"
                              value={pendingValues[boxNum] ?? (val != null ? String(val) : '')}
                              onChange={e => setPendingValues(prev => ({ ...prev, [boxNum]: e.target.value }))}
                              onBlur={() => { onBoxChange?.(boxNum, pendingValues[boxNum]); setEditingCell(null); }}
                              onKeyDown={e => { if (e.key === 'Enter') { onBoxChange?.(boxNum, pendingValues[boxNum]); setEditingCell(null); e.target.blur(); } if (e.key === 'Escape') setEditingCell(null); }}
                              autoFocus
                            />
                          ) : (
                            <>
                              <span className="fm-aeat-cell__value">{val != null ? formatCell(val, colType) : ''}</span>
                              {unit && <span className="fm-aeat-cell__unit">{unit}</span>}
                              {row.editable && (
                                <button className="fm-aeat-cell__edit-btn" onClick={() => setEditingCell(boxNum)}>
                                  <Pencil size={12} strokeWidth={1.5} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </>
                );

                if (row.rowColHeaders) {
                  return (
                    <React.Fragment key={`row-${key}`}>
                      <div className="fm-aeat-col-headers">
                        <span className="fm-aeat-col-headers__label" />
                        {row.rowColHeaders.map((k) => (
                          <span key={k} className="fm-aeat-col-headers__cell">{t(k)}</span>
                        ))}
                      </div>
                      <div className={rowClass}>{rowContent}</div>
                    </React.Fragment>
                  );
                }

                return <div key={key} className={rowClass}>{rowContent}</div>;
              };

              return items.map((item, idx) =>
                item.isBracket
                  ? <div key={`bracket-${idx}`} className="fm-aeat-group-bracket">{item.rows.map(([r, i]) => renderRow(r, i))}</div>
                  : renderRow(item.row, item.i)
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
