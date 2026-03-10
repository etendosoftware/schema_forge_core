import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'commission', column: 'C_Commission_ID', type: 'string' },
  { key: 'startDate', column: 'StartDate', type: 'date' },
  { key: 'endDate', column: 'EndDate', type: 'date' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'amount' },
  { key: 'docStatus', column: 'DocStatus', type: 'status' },
];

const filters = ['documentNo', 'commission', 'startDate', 'docStatus'];

export default function CommissionRunTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
