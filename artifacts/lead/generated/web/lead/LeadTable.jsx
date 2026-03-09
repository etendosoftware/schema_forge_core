import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'company', label: 'Company', type: 'string' },
  { key: 'email', label: 'Email', type: 'string' },
  { key: 'phone', label: 'Phone', type: 'string' },
  { key: 'source', label: 'Source', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'assignedTo', label: 'Assigned To', type: 'string' },
  { key: 'estimatedValue', label: 'Estimated Value', type: 'amount' },
];

const filters = ['name', 'company', 'status'];

export default function LeadTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
