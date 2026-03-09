import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'businessPartner', label: 'Business Partner', type: 'string' },
  { key: 'stage', label: 'Stage', type: 'string' },
  { key: 'amount', label: 'Amount', type: 'amount' },
  { key: 'currency', label: 'Currency', type: 'string' },
  { key: 'probability', label: 'Probability', type: 'number' },
  { key: 'expectedCloseDate', label: 'Expected Close Date', type: 'date' },
  { key: 'assignedTo', label: 'Assigned To', type: 'string' },
  { key: 'source', label: 'Source', type: 'string' },
];

const filters = ['name', 'businessPartner', 'stage'];

export default function DealTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
