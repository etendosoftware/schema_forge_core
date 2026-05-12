import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:alternateUom
const columns = [
  { key: 'uOM', column: 'C_Uom_ID', type: 'selector', label: 'UOM', required: true },
  { key: 'conversionRate', column: 'Conversionrate', type: 'number', label: 'Conversion Rate', required: true },
  { key: 'sales', column: 'Sales', type: 'enum', label: 'Sales', enumLabels: { 'P': 'Primary', 'S': 'Secondary', 'NA': 'Not Applicable' }, required: true },
  { key: 'purchase', column: 'Purchase', type: 'enum', label: 'Purchase', enumLabels: { 'P': 'Primary', 'S': 'Secondary', 'NA': 'Not Applicable' }, required: true },
  { key: 'logistics', column: 'Logistics', type: 'enum', label: 'Logistics', enumLabels: { 'P': 'Primary', 'S': 'Secondary', 'NA': 'Not Applicable' }, required: true },
];
// @sf-generated-end columns:alternateUom

const filters = [];

// @sf-generated-start component:AlternateUomTable
const AlternateUomTable = forwardRef(function AlternateUomTable(props, ref) {
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

export default AlternateUomTable;
// @sf-generated-end component:AlternateUomTable
