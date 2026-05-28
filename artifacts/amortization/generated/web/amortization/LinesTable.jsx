import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:lines
const columns = [
  { key: 'asset', column: 'A_Asset_ID', type: 'selector', label: 'Asset', grow: true },
  { key: 'amortizationPercentage', column: 'Amortization_Percentage', type: 'number', label: 'Amortization Percentage', grow: true },
  { key: 'amortizationAmount', column: 'Amortizationamt', type: 'amount', label: 'Amortization Amount', required: true, noTrailing: true },
];
// @sf-generated-end columns:lines

const filters = [];

// @sf-generated-start component:LinesTable
const LinesTable = forwardRef(function LinesTable(props, ref) {
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

export default LinesTable;
// @sf-generated-end component:LinesTable
