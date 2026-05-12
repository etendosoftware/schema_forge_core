import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:amortizationLine
const columns = [
  { key: 'sEQNoAsset', column: 'SEQ_No_Asset', type: 'number', label: 'Line No.' },
  { key: 'amortization', column: 'A_Amortization_ID', type: 'selector', label: 'Amortization' },
  { key: 'amortizationPercentage', column: 'Amortization_Percentage', type: 'number', label: 'Amortization Percentage' },
  { key: 'amortizationAmount', column: 'Amortizationamt', type: 'amount', label: 'Amortization Amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: 'Currency' },
];
// @sf-generated-end columns:amortizationLine

const filters = [];

// @sf-generated-start component:AmortizationLineTable
const AmortizationLineTable = forwardRef(function AmortizationLineTable(props, ref) {
  // Inline-editable layout owns rendering of the existing rows. The add-line flow keeps
  // using the proven DataTable inline-add row (callouts, focus management, defaults) —
  // when addRow.active flips on, we hand off to DataTable so the user can fill the new
  // line, then return to InlineLinesPanel once addRow.active flips off again. The ref
  // is forwarded so DetailView can imperatively flush pending edits on global save.
  if (props.linesLayout === 'inlineEditable' && !props.addRow?.active) {
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default AmortizationLineTable;
// @sf-generated-end component:AmortizationLineTable
