import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:user
const fields = [
  // @sf-custom-slot callout:SL_User_Name
  { key: 'firstName', column: 'Firstname', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:SL_User_Name
  { key: 'lastName', column: 'Lastname', type: 'text', section: 'principal' },
  // @sf-custom-slot callout:SL_User_Name
  { key: 'name', column: 'Name', type: 'text', required: true, readOnly: true, section: 'principal' },
  { key: 'email', column: 'Email', type: 'text', section: 'principal' },
  { key: 'phone', column: 'Phone', type: 'text', section: 'principal' },
  { key: 'alternativePhone', column: 'Phone2', type: 'text', section: 'principal' },
  { key: 'position', column: 'Title', type: 'text', section: 'principal' },
  { key: 'comments', column: 'Comments', type: 'textarea', section: 'principal' },
  { key: 'active', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  { key: 'grantPortalAccess', column: 'Grant_Portal_Access', type: 'text', required: true, section: 'principal', defaultValue: 'N' },
  { key: 'commercialauth', column: 'Commercialauth', type: 'checkbox', required: true, section: 'principal', defaultValue: 'N' },
  { key: 'viasms', column: 'Viasms', type: 'checkbox', required: true, section: 'other', defaultValue: 'N' },
  { key: 'viaemail', column: 'Viaemail', type: 'checkbox', required: true, section: 'other', defaultValue: 'N' },
];
// @sf-generated-end fields:user

// @sf-generated-start component:UserForm
export default function UserForm(props) {
  // @sf-custom-slot hooks:UserForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:UserForm

// @sf-custom-slot section:UserForm-custom
