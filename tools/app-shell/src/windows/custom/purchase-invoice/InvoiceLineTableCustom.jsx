import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'product',          column: 'M_Product_ID',       type: 'string', label: 'Product' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced',         type: 'number', label: 'Invoiced Quantity' },
  { key: 'unitPrice',        column: 'PriceActual',         type: 'number', label: 'Net Unit Price' },
  { key: 'tax',              column: 'C_Tax_ID',            type: 'string', label: 'Tax' },
  { key: 'grossAmount',      column: 'Line_Gross_Amount',   type: 'amount', label: 'Line Gross Amount' },
];

export default function InvoiceLineTableCustom(props) {
  return <DataTable columns={columns} filters={[]} {...props} />;
}
