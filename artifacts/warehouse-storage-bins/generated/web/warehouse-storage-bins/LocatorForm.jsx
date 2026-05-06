import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:locator
const fields = [
  { key: 'searchKey', column: 'Value', type: 'text', required: true, section: 'principal' },
  { key: 'x', column: 'X', type: 'text', section: 'principal' },
  { key: 'y', column: 'Y', type: 'text', section: 'principal' },
  { key: 'z', column: 'Z', type: 'text', section: 'principal' },
  { key: 'priorityNo', column: 'PriorityNo', type: 'number', section: 'other' },
  { key: 'isDefault', column: 'IsDefault', type: 'checkbox', required: true, section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:locator

// @sf-generated-start component:LocatorForm
export default function LocatorForm(props) {
  // @sf-custom-slot hooks:LocatorForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:LocatorForm

// @sf-custom-slot section:LocatorForm-custom
