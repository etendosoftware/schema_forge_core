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

export default AmortizationLineTable;
// @sf-generated-end component:AmortizationLineTable
