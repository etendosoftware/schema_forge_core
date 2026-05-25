import React from 'react';
import { useUI } from '@schema-forge/app-shell-core';
import { getLayout303 } from './fm303Layouts.js';
import { formatAmount, formatPercent } from '../../fiscalModelsUtils.js';

function formatCell(val, colType) {
  return colType === 'percent' ? formatPercent(val) : formatAmount(val);
}

export default function FmBoxes303({ boxes, year, period, sectionIds, identification, onIdentChange }) {
  const ui = useUI();
  const t = ui;
  const layout = getLayout303(year, period);

  // Normalize boxes to { [boxNum]: value } regardless of input format
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
        if (section.sectionType === 'identificacion') {
          const textFields = section.fields.filter(f => f.type === 'text');
          const checkboxFields = section.fields.filter(f => f.type === 'checkbox');
          return (
            <div key={section.id} className="fm-aeat-section">
              <div className="fm-aeat-section__title">{t(section.titleKey)}</div>
              <div className="fm-aeat-ident">
                <div className="fm-aeat-ident-fields">
                  {textFields.map(f => (
                    <div key={f.id} className="fm-aeat-ident-field">
                      <span className="fm-aeat-ident-field__label">{t(f.labelKey)}</span>
                      <div className="fm-aeat-ident-field__value">{identification?.[f.id] ?? ''}</div>
                    </div>
                  ))}
                </div>
                {checkboxFields.map(f => (
                  <div key={f.id} className="fm-aeat-ident-cb">
                    <span className="fm-aeat-ident-cb__label">{t(f.labelKey)}</span>
                    <input
                      type="checkbox"
                      className={`fm-aeat-ident-cb__check${f.readOnly ? ' fm-aeat-ident-cb__check--readonly' : ''}`}
                      checked={identification?.[f.id] ?? false}
                      disabled={f.readOnly}
                      onChange={f.readOnly ? undefined : e => onIdentChange?.(f.id, e.target.checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        }

        const cols = section.colHeaderKeys?.length || 1;
        return (
          <div key={section.id} className="fm-aeat-section">
            <div className="fm-aeat-section__title">{t(section.titleKey)}</div>

            {cols > 0 && section.colHeaderKeys?.length > 0 && (
              <div className="fm-aeat-col-headers">
                <span className="fm-aeat-col-headers__label" />
                {section.colHeaderKeys.map((k) => (
                  <span key={k} className="fm-aeat-col-headers__cell">{t(k)}</span>
                ))}
              </div>
            )}

            {section.rows.map((row) => (
              <div key={row.cells?.[0] ?? row.labelKey} className={`fm-aeat-row${row.total ? ' fm-aeat-row--total' : ''}`}>
                <span className="fm-aeat-row__label">
                  {row.labelKey ? t(row.labelKey) : ''}
                  {row.formula && (
                    <span className="fm-aeat-row__formula">{row.formula}</span>
                  )}
                </span>
                {Array.from({ length: cols }, (_, ci) => {
                  const boxNum = row.cells?.[ci] ?? null;
                  if (boxNum === null) {
                    return <div key={ci} className="fm-aeat-cell fm-aeat-cell--empty" />;
                  }
                  const isFixed = row.fixedValues != null && Object.prototype.hasOwnProperty.call(row.fixedValues, boxNum);
                  const val = isFixed ? row.fixedValues[boxNum] : (valueMap[boxNum] ?? null);
                  const colType = row.cellTypes?.[ci] ?? section.colTypes?.[ci] ?? 'amount';
                  return (
                    <div key={ci} className={`fm-aeat-cell${isFixed ? ' fm-aeat-cell--fixed' : ''}`}>
                      <span className="fm-aeat-cell__num">{String(boxNum).padStart(2, '0')}</span>
                      <span className="fm-aeat-cell__value">
                        {val != null ? formatCell(val, colType) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
