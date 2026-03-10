import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'code', column: 'Code', type: 'text', required: true },
  { key: 'client', column: 'C_BPartner_ID', type: 'search', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'manager', column: 'Manager_ID', type: 'selector', required: true, reference: 'User', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'selector', required: true, reference: 'ProjectStatus', inputMode: 'selector' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true },
  { key: 'endDate', column: 'EndDate', type: 'date' },
  { key: 'budget', column: 'Budget', type: 'number' },
  { key: 'priority', column: 'Priority', type: 'selector', required: true, reference: 'Priority', inputMode: 'selector' },
];

export default function ProjectForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
