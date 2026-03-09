import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
  { key: 'frequency', label: 'Frequency', type: 'string' },
  { key: 'nextDate', label: 'Next Date', type: 'date' },
  { key: 'amount', label: 'Amount', type: 'amount' },
  { key: 'currency', label: 'Currency', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'startDate', label: 'Start Date', type: 'date' },
  { key: 'endDate', label: 'End Date', type: 'date' },
  { key: 'lastGenerated', label: 'Last Generated', type: 'date' },
];

const filters = ['name', 'businessPartner', 'status'];

export default function RecurringInvoiceTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
