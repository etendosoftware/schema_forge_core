import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpLocation
const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal' },
  { key: 'address', column: 'Address1', type: 'text', section: 'principal' },
  { key: 'city', column: 'City', type: 'text', section: 'principal' },
  { key: 'postalCode', column: 'Postal', type: 'text', section: 'principal' },
  { key: 'country', column: 'C_Country_ID', type: 'text', section: 'other' },
  { key: 'phone', column: 'Phone', type: 'text', section: 'other' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'other', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'region', column: 'C_Region_ID', type: 'text', section: 'other' },
  { key: 'address2', column: 'Address2', type: 'text', section: 'other' },
];
// @sf-generated-end fields:bpLocation

// @sf-generated-start component:BpLocationForm
export default function BpLocationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
BpLocationForm.hasCollapsedFields = false;
// @sf-generated-end component:BpLocationForm
