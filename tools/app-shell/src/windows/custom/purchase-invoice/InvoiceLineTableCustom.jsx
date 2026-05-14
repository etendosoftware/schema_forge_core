import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';
import { useCurrency } from '@/hooks/useCurrency';
import { useLabel } from '@/i18n';

// forwardRef so DetailView can imperatively clear the selection / flush
// pending edits via inlineLinesRef. Mirrors the generated LinesTable pattern:
// when linesLayout='inlineEditable' and not in add-row mode, hand off to
// InlineLinesPanel for hover actions, inline edit, and clearSelection.
const InvoiceLineTableCustom = forwardRef(function InvoiceLineTableCustom({ data, ...props }, ref) {
  const currencyCode = useCurrency();
  const t = useLabel();

  // product/tax are `selector` (not `string`) so InlineLinesPanel renders a
  // lookup / dropdown in edit mode instead of showing the raw FK id.
  const columns = [
    { key: 'product',          column: 'M_Product_ID',     type: 'selector', label: t('M_Product_ID'),     required: true, lookup: true },
    { key: 'description',      column: 'Description',       type: 'string',   label: t('Description') },
    { key: 'invoicedQuantity', column: 'QtyInvoiced',       type: 'number',   label: t('QtyInvoiced'),      required: true },
    { key: 'listPrice',        column: 'PriceList',         type: 'amount',   label: t('PriceList'),        required: true },
    { key: 'etgoDiscount',     column: 'EM_Etgo_Discount',  type: 'number',   label: t('EM_Etgo_Discount') },
    { key: 'tax',              column: 'C_Tax_ID',          type: 'selector', label: t('C_Tax_ID'),         required: true },
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

export default InvoiceLineTableCustom;
