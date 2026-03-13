import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:project
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'code', column: 'Code', type: 'text', required: true, section: 'principal' },
  { key: 'client', column: 'C_BPartner_ID', type: 'search', section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'manager', column: 'Manager_ID', type: 'selector', required: true, section: 'principal', reference: 'User', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'selector', required: true, section: 'other', reference: 'ProjectStatus', inputMode: 'selector' },
  { key: 'startDate', column: 'StartDate', type: 'date', required: true, section: 'other' },
  { key: 'endDate', column: 'EndDate', type: 'date', section: 'other' },
  { key: 'budget', column: 'Budget', type: 'number', section: 'other' },
  { key: 'priority', column: 'Priority', type: 'selector', required: true, section: 'other', reference: 'Priority', inputMode: 'selector' },
];
// @sf-generated-end fields:project

// @sf-generated-start component:ProjectForm
export default function ProjectForm(props) {
  // @sf-custom-slot hooks:ProjectForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ProjectForm

// @sf-custom-slot section:ProjectForm-custom
