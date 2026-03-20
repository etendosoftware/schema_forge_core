import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'productCategory', column: 'M_Product_Category_ID', type: 'string' },
  { key: 'bpGroup', column: 'C_BP_Group_ID', type: 'string' },
  { key: 'commissionPercentage', column: 'CommissionPercentage', type: 'number' },
  { key: 'commissionAmount', column: 'CommissionAmt', type: 'amount' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const filters = ['product'];

export default function CommissionLineTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
