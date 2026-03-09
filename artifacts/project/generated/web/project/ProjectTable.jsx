import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', label: 'Name', type: 'string' },
  { key: 'code', label: 'Code', type: 'string' },
  { key: 'client', label: 'Client', type: 'string' },
  { key: 'manager', label: 'Manager', type: 'string' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'startDate', label: 'Start Date', type: 'date' },
  { key: 'endDate', label: 'End Date', type: 'date' },
  { key: 'budget', label: 'Budget', type: 'amount' },
  { key: 'priority', label: 'Priority', type: 'string' },
];

const filters = ['name', 'client', 'status'];

export default function ProjectTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
