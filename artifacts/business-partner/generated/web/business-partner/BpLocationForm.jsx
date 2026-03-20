import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpLocation
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'address', column: 'Address1', type: 'text', section: 'principal' },
  { key: 'city', column: 'City', type: 'text', section: 'principal' },
  { key: 'postalCode', column: 'Postal', type: 'text', section: 'principal' },
  { key: 'country', column: 'C_Country_ID', type: 'text', section: 'other' },
  { key: 'phone', column: 'Phone', type: 'text', section: 'other' },
];
// @sf-generated-end fields:bpLocation

// @sf-generated-start component:BpLocationForm
export default function BpLocationForm(props) {
  // @sf-custom-slot hooks:BpLocationForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BpLocationForm

// @sf-custom-slot section:BpLocationForm-custom
