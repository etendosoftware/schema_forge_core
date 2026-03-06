import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'invoiceLine', label: 'Invoice Line', type: 'string' },
  { key: 'commissionAmount', label: 'Commission Amount', type: 'amount' },
  { key: 'actualQuantity', label: 'Actual Quantity', type: 'number' },
  { key: 'actualAmount', label: 'Actual Amount', type: 'amount' },
  { key: 'convertedAmount', label: 'Converted Amount', type: 'amount' },
  { key: 'lineNo', label: 'Line No', type: 'number' },
];

const filters = ['invoiceLine'];

export default function CommissionAmountTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
