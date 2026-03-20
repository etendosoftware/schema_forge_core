import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'invoiceLine', column: 'C_InvoiceLine_ID', type: 'string' },
  { key: 'commissionAmount', column: 'CommissionAmt', type: 'amount' },
  { key: 'actualQuantity', column: 'ActualQty', type: 'number' },
  { key: 'actualAmount', column: 'ActualAmt', type: 'amount' },
  { key: 'convertedAmount', column: 'ConvertedAmt', type: 'amount' },
  { key: 'lineNo', column: 'Line', type: 'number' },
];

const filters = ['invoiceLine'];

export default function CommissionAmountTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
