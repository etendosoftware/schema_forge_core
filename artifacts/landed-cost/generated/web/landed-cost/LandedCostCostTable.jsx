import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'landedCostType', column: 'M_LandedCostType_ID', type: 'string' },
  { key: 'amount', column: 'Amt', type: 'amount' },
  { key: 'landedCostDistribution', column: 'LandedCostDistribution', type: 'string' },
  { key: 'goodsReceipt', column: 'M_InOut_ID', type: 'string' },
  { key: 'goodsReceiptLine', column: 'M_InOutLine_ID', type: 'string' },
  { key: 'lineNo', column: 'Line', type: 'number' },
  { key: 'accountingDate', column: 'DateAcct', type: 'date' },
];

const filters = ['landedCostType', 'goodsReceipt'];

export default function LandedCostCostTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
