import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:unitOfMeasure
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name', required: true },
  { key: 'symbol', column: 'UOMSymbol', type: 'string', label: 'Symbol' },
  { key: 'uOMType', column: 'UOM_Type', type: 'enum', label: 'UOM Type', enumLabels: { 'A': 'Area', 'L': 'Length', 'T': 'Time', 'V': 'Volume', 'W': 'Weight' }, enumVariants: {"A":"orange","L":"blue","T":"purple","V":"teal","W":"yellow"} },
];
// @sf-generated-end columns:unitOfMeasure

const filters = ['name'];

// @sf-generated-start component:UnitOfMeasureTable
const UnitOfMeasureTable = forwardRef(function UnitOfMeasureTable(props, ref) {
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

export default UnitOfMeasureTable;
// @sf-generated-end component:UnitOfMeasureTable
