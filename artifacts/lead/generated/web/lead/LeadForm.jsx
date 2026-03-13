import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:lead
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'company', column: 'Company', type: 'text', section: 'principal' },
  { key: 'email', column: 'Email', type: 'text', section: 'principal' },
  { key: 'phone', column: 'Phone', type: 'text', section: 'principal' },
  { key: 'source', column: 'Source', type: 'selector', section: 'other', reference: 'LeadSource', inputMode: 'selector' },
  { key: 'status', column: 'Status', type: 'selector', required: true, section: 'other', reference: 'LeadStatus', inputMode: 'selector' },
  { key: 'assignedTo', column: 'AssignedTo_ID', type: 'selector', section: 'other', reference: 'User', inputMode: 'selector' },
  { key: 'estimatedValue', column: 'EstimatedValue', type: 'number', section: 'other' },
  { key: 'notes', column: 'Notes', type: 'textarea', section: 'other' },
];
// @sf-generated-end fields:lead

// @sf-generated-start component:LeadForm
export default function LeadForm(props) {
  // @sf-custom-slot hooks:LeadForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LeadForm

// @sf-custom-slot section:LeadForm-custom
