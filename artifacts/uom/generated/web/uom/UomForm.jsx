import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:uom
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'symbol', column: 'UOMSymbol', type: 'text', required: true, section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:uom

// @sf-generated-start component:UomForm
export default function UomForm(props) {
  // @sf-custom-slot hooks:UomForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:UomForm

// @sf-custom-slot section:UomForm-custom
