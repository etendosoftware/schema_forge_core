import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', label: 'Name', type: 'text', required: true },
  { key: 'code', label: 'Code', type: 'text', required: true },
  { key: 'client', label: 'Client', type: 'search', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'manager', label: 'Manager', type: 'selector', required: true, reference: 'User', inputMode: 'selector' },
  { key: 'status', label: 'Status', type: 'selector', required: true, reference: 'ProjectStatus', inputMode: 'selector' },
  { key: 'startDate', label: 'Start Date', type: 'date', required: true },
  { key: 'endDate', label: 'End Date', type: 'date' },
  { key: 'budget', label: 'Budget', type: 'number' },
  { key: 'priority', label: 'Priority', type: 'selector', required: true, reference: 'Priority', inputMode: 'selector' },
];

export default function ProjectForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
