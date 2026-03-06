import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', label: 'Line No', type: 'number' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'unitPrice', label: 'Unit Price', type: 'amount' },
  { key: 'discount', label: 'Discount', type: 'number' },
  { key: 'lineNetAmount', label: 'Line Net Amount', type: 'amount' },
  { key: 'tax', label: 'Tax', type: 'string' },
];

const filters = ['product'];

export default function OrderLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
