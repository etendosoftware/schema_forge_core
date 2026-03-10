import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'goodsReceiptLine', column: 'M_InOutLine_ID', type: 'string' },
  { key: 'product', column: 'M_Product_ID', type: 'string' },
  { key: 'amount', column: 'Amt', type: 'amount' },
  { key: 'quantity', column: 'Qty', type: 'number' },
  { key: 'baseAmount', column: 'Base', type: 'amount' },
];

const filters = ['goodsReceiptLine', 'product'];

export default function LandedCostAllocationTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
