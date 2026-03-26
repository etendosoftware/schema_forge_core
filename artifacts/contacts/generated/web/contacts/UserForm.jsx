import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:user
const fields = [
  // @sf-custom-slot callout:SL_User_Name
  { key: 'firstName', column: 'Firstname', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:SL_User_Name
  { key: 'lastName', column: 'Lastname', type: 'text', section: 'principal' },
  { key: 'phone', column: 'Phone', type: 'text', section: 'principal' },
  { key: 'alternativePhone', column: 'Phone2', type: 'text', section: 'other' },
  { key: 'position', column: 'Title', type: 'text', section: 'other' },
  { key: 'comments', column: 'Comments', type: 'textarea', section: 'other' },
];
// @sf-generated-end fields:user

// @sf-generated-start component:UserForm
export default function UserForm(props) {
  // @sf-custom-slot hooks:UserForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:UserForm

// @sf-custom-slot section:UserForm-custom
