import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'string' },
  { key: 'frequency', column: 'Frequency', type: 'string' },
  { key: 'nextDate', column: 'NextDate', type: 'date' },
  { key: 'amount', column: 'Amount', type: 'amount' },
  { key: 'currency', column: 'C_Currency_ID', type: 'string' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'startDate', column: 'StartDate', type: 'date' },
  { key: 'endDate', column: 'EndDate', type: 'date' },
  { key: 'lastGenerated', column: 'LastGenerated', type: 'date' },
];

const filters = ['name', 'businessPartner', 'status'];

export default function RecurringInvoiceTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
