import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:tax
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'rate', column: 'Rate', type: 'number', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'validFrom', column: 'ValidFrom', type: 'date', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:tax

// @sf-generated-start component:TaxForm
export default function TaxForm(props) {
  // @sf-custom-slot hooks:TaxForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:TaxForm

// @sf-custom-slot section:TaxForm-custom
