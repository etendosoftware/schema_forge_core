import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'type', column: 'Type', type: 'string' },
  { key: 'subject', column: 'Subject', type: 'string' },
  { key: 'deal', column: 'CRM_Deal_ID', type: 'string' },
  { key: 'contact', column: 'C_BPartner_ID', type: 'string' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'string' },
  { key: 'dueDate', column: 'DueDate', type: 'date' },
  { key: 'status', column: 'Status', type: 'status' },
  { key: 'duration', column: 'Duration', type: 'number' },
];

const filters = ['subject', 'contact', 'type'];

export default function ActivityTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
