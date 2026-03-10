import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'name', column: 'Name', type: 'string' },
  { key: 'code', column: 'Code', type: 'string' },
  { key: 'client', column: 'C_BPartner_ID', type: 'string' },
  { key: 'manager', column: 'Manager_ID', type: 'string' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'startDate', column: 'StartDate', type: 'date' },
  { key: 'endDate', column: 'EndDate', type: 'date' },
  { key: 'budget', column: 'Budget', type: 'amount' },
  { key: 'priority', column: 'Priority', type: 'string' },
];

const filters = ['name', 'client', 'status'];

export default function ProjectTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
