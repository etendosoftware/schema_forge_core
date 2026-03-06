import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'commission', label: 'Commission', type: 'string' },
  { key: 'startDate', label: 'Start Date', type: 'date' },
  { key: 'endDate', label: 'End Date', type: 'date' },
  { key: 'grandTotal', label: 'Grand Total', type: 'amount' },
  { key: 'docStatus', label: 'Doc Status', type: 'status' },
];

const filters = ['documentNo', 'commission', 'startDate', 'docStatus'];

export default function CommissionRunTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
