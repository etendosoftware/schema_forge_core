import { DataTable } from '@/components/contract-ui';

const columns = [
  { key: 'type', label: 'Type', type: 'string' },
  { key: 'subject', label: 'Subject', type: 'string' },
  { key: 'deal', label: 'Deal', type: 'string' },
  { key: 'contact', label: 'Contact', type: 'string' },
  { key: 'assignedTo', label: 'Assigned To', type: 'string' },
  { key: 'dueDate', label: 'Due Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'status' },
  { key: 'duration', label: 'Duration', type: 'number' },
];

const filters = ['subject', 'contact', 'type'];

export default function ActivityTable(props) {
  return <DataTable columns={columns} filters={filters} {...props} />;
}
