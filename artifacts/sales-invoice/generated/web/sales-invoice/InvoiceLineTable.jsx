import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'quantity', column: 'QtyInvoiced', type: 'number' },
  { key: 'unitPrice', column: 'PriceActual', type: 'amount' },
  { key: 'tax', column: 'C_Tax_ID', type: 'string' },
  { key: 'discount', column: 'Discount', type: 'number' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'amount' },
  { key: 'uom', column: 'C_UOM_ID', type: 'string' },
  { key: 'taxAmount', column: 'TaxAmt', type: 'amount' },
];

const filters = ['product'];

export default function InvoiceLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
