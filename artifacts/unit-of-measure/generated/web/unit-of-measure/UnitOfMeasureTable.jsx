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
  // Inline-editable layout always uses InlineLinesPanel for existing rows so column
  // widths (flex layout) never shift when the add-row form opens. When addRow is
  // active we render a header-hidden, data-hidden DataTable below for just the
  // add-row form — it owns callouts, selectors, validation and the imperative flush
  // ref. The ref is forwarded to InlineLinesPanel so DetailView can flush pending
  // inline edits on global save.
  if (props.linesLayout === 'inlineEditable') {
    if (props.addRow?.active) {
      return (
        <>
          <InlineLinesPanel ref={ref} columns={columns} {...props} addRow={undefined} />
          <DataTable columns={columns} filters={filters} {...props} hideHeader hideDataRows />
        </>
      );
    }
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default UnitOfMeasureTable;
// @sf-generated-end component:UnitOfMeasureTable
