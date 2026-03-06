import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', label: 'Line No', type: 'number' },
  { key: 'product', label: 'Product', type: 'string' },
  { key: 'productCategory', label: 'Product Category', type: 'string' },
  { key: 'bpGroup', label: 'Bp Group', type: 'string' },
  { key: 'commissionPercentage', label: 'Commission Percentage', type: 'number' },
  { key: 'commissionAmount', label: 'Commission Amount', type: 'amount' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const filters = ['product'];

export default function CommissionLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
