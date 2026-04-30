import { DataTable } from '@/components/contract-ui';
import { useCurrency } from '@/hooks/useCurrency';

const columns = [
  { key: 'product',          column: 'M_Product_ID',       type: 'string', label: 'Product' },
  { key: 'description',      column: 'Description',         type: 'string', label: 'Description' },
  { key: 'invoicedQuantity', column: 'QtyInvoiced',         type: 'number', label: 'Invoiced Quantity' },
  { key: 'listPrice',        column: 'PriceList',            type: 'amount', label: 'Net Unit Price' },
  { key: 'etgoDiscount',     column: 'EM_Etgo_Discount',    type: 'number', label: 'Discount %' },
  { key: 'tax',              column: 'C_Tax_ID',            type: 'string', label: 'Tax' },
  { key: 'grossAmount',      column: 'Line_Gross_Amount',   type: 'amount', label: 'Line Gross Amount' },
];

export default function InvoiceLineTableCustom({ data, ...props }) {
  const currencyCode = useCurrency();
  const enrichedData = data?.map(row => ({
    ...row,
    'currency$_identifier': row['currency$_identifier'] ?? currencyCode,
  }));
  return <DataTable columns={columns} filters={[]} data={enrichedData} {...props} />;
}
