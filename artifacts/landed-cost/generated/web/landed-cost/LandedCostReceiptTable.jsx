import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'goodsReceipt', column: 'M_InOut_ID', type: 'string' },
  { key: 'documentNo', column: 'M_InOut_ID$DocumentNo', type: 'string' },
];

const filters = ['goodsReceipt', 'documentNo'];

export default function LandedCostReceiptTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
