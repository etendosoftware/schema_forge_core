import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:conversion
const columns = [
  { key: 'toUOM', column: 'C_UOM_To_ID', type: 'selector', label: 'To UOM', required: true },
  { key: 'multipleRateBy', column: 'MultiplyRate', type: 'string', label: 'Multiple Rate By', required: true },
  { key: 'divideRateBy', column: 'DivideRate', type: 'string', label: 'Divide Rate By', required: true },
];
// @sf-generated-end columns:conversion

const filters = ['toUOM'];

// @sf-generated-start component:ConversionTable
const ConversionTable = forwardRef(function ConversionTable(props, ref) {
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

export default ConversionTable;
// @sf-generated-end component:ConversionTable
