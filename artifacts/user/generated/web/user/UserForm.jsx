import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:user
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'email', column: 'EMail', type: 'text', section: 'principal' },
  { key: 'phone', column: 'Phone', type: 'text', section: 'principal' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'principal' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:user

// @sf-generated-start component:UserForm
export default function UserForm(props) {
  // @sf-custom-slot hooks:UserForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:UserForm

// @sf-custom-slot section:UserForm-custom
