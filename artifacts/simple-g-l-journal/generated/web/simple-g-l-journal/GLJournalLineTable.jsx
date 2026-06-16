import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:gLJournalLine
const columns = [
  { key: 'gLItems', column: 'Account_ID', type: 'selector', label: 'GL Item', lookup: true },
  { key: 'description', column: 'Description', type: 'string', label: 'Description' },
  { key: 'foreignCurrencyDebit', column: 'AmtSourceDr', type: 'amount', label: 'Debit', required: true },
  { key: 'foreignCurrencyCredit', column: 'AmtSourceCr', type: 'amount', label: 'Credit', required: true },
];
// @sf-generated-end columns:gLJournalLine

const filters = ['gLItems'];

// @sf-generated-start component:GLJournalLineTable
const GLJournalLineTable = forwardRef(function GLJournalLineTable(props, ref) {
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

export default GLJournalLineTable;
// @sf-generated-end component:GLJournalLineTable
