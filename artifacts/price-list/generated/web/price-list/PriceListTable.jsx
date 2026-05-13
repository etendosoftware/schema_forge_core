import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:priceList
const columns = [
  { key: 'name', column: 'Name', type: 'string', label: 'Name', required: true },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', label: 'Currency', required: true },
  { key: 'salesPriceList', column: 'IsSOPriceList', type: 'boolean', labels: {"es_ES":"Tipo","en_US":"Type"}, label: 'Sales Price List', badge: true, badgeLabels: {"true":{"es_ES":"Venta","en_US":"Sales"},"false":{"es_ES":"Compra","en_US":"Purchase"}}, badgeVariants: {"true":"blue","false":"purple"}, required: true },
];
// @sf-generated-end columns:priceList

const filters = ['name'];

// @sf-generated-start component:PriceListTable
const PriceListTable = forwardRef(function PriceListTable(props, ref) {
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

export default PriceListTable;
// @sf-generated-end component:PriceListTable
