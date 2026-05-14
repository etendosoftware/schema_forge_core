import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';
import { useCurrency } from '@/hooks/useCurrency';
import { useLabel } from '@/i18n';

// Mirrors the generated LinesTable pattern (artifacts/sales-invoice/generated/.../LinesTable.jsx):
// when linesLayout==='inlineEditable' and we're NOT in add-line mode, render via
// InlineLinesPanel so hover row actions (pencil, trash) and the inline edit flow
// work. The add-line path keeps using DataTable for its proven InlineAddRow.
const SalesInvoiceLinesTable = forwardRef(function SalesInvoiceLinesTable({ data, ...props }, ref) {
  const currencyCode = useCurrency();
  const t = useLabel();

  const columns = [
    { key: 'product',          column: 'M_Product_ID',     type: 'selector', label: t('M_Product_ID'),     lookup: true },
    { key: 'description',      column: 'Description',       type: 'string',   label: t('Description') },
    { key: 'invoicedQuantity', column: 'QtyInvoiced',       type: 'number',   label: t('QtyInvoiced'),      required: true },
    { key: 'listPrice',        column: 'PriceList',         type: 'amount',   label: t('PriceList'),        required: true },
    { key: 'etgoDiscount',     column: 'EM_Etgo_Discount',  type: 'number',   label: t('EM_Etgo_Discount') },
    { key: 'tax',              column: 'C_Tax_ID',          type: 'selector', label: t('C_Tax_ID') },
    { key: 'grossAmount',      column: 'Line_Gross_Amount', type: 'amount',   label: t('Line_Gross_Amount') },
  ];

  const enrichedData = data?.map(row => ({
    ...row,
    'currency$_identifier': row['currency$_identifier'] ?? currencyCode,
  }));
  if (props.linesLayout === 'inlineEditable' && !props.addRow?.active) {
    return <InlineLinesPanel ref={ref} columns={columns} data={enrichedData} {...props} />;
  }
  return <DataTable columns={columns} filters={[]} data={enrichedData} {...props} />;
});

export default SalesInvoiceLinesTable;
