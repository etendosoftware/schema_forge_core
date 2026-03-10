import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'company', column: 'Company', type: 'string' },
  { key: 'email', column: 'Email', type: 'string' },
  { key: 'phone', column: 'Phone', type: 'string' },
  { key: 'source', column: 'Source', type: 'string' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'string' },
  { key: 'estimatedValue', column: 'EstimatedValue', type: 'amount' },
];

const filters = ['name', 'company', 'status'];

export default function LeadTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
