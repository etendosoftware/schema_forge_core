import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';
import { Tag } from '@/components/ui/tag';
import { useUI } from '@/i18n';

function renderTaxRate(row) {
  const val = row?.rate;
  if (val == null) return '';
  return <Tag variant="green" label={`+${val} %`} />;
}

function TaxScopeCell({ row, fieldKey }) {
  const ui = useUI();
  const value = fieldKey ? row?.[fieldKey] : (row?.applicableTo ?? row?.salesPurchaseType);
  const showSales    = value === 'B' || value === 'S';
  const showPurchase = value === 'B' || value === 'P';
  if (!showSales && !showPurchase) return value ?? '';
  return (
    <span className="inline-flex items-center gap-1">
      {showSales    && <Tag variant="blue"   label={ui('taxScopeSales')} />}
      {showPurchase && <Tag variant="purple" label={ui('taxScopePurchase')} />}
    </span>
  );
}

// @sf-generated-start columns:tax
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name', required: true },
  { key: 'rate', column: 'Rate', type: 'number', label: 'Rate', render: renderTaxRate, required: true },
  { key: 'salesPurchaseType', column: 'SOPOType', type: 'enum', label: 'Sales/Purchase Type', enumLabels: { 'B': 'Both', 'P': 'Purchase Tax', 'S': 'Sales Tax' }, render: (row) => <TaxScopeCell row={row} fieldKey="salesPurchaseType" />, required: true },
];
// @sf-generated-end columns:tax

const filters = ['name'];

// @sf-generated-start component:TaxTable
const TaxTable = forwardRef(function TaxTable(props, ref) {
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

export default TaxTable;
// @sf-generated-end component:TaxTable
