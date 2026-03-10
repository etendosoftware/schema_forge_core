import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'name', column: 'Name', type: 'text', required: true },
  { key: 'address', column: 'Address1', type: 'text' },
  { key: 'city', column: 'City', type: 'text' },
  { key: 'postalCode', column: 'Postal', type: 'text' },
  { key: 'country', column: 'C_Country_ID', type: 'text' },
  { key: 'phone', column: 'Phone', type: 'text' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
];

export default function BpLocationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
