import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:bpartnerLocation
const fields = [
  // @sf-custom-slot callout:SL_BPartnerLocation
  { key: 'locationAddress', column: 'C_Location_ID', type: 'search', required: true, section: 'principal', reference: 'Location', inputMode: 'search' },
  { key: 'phone', column: 'Phone', type: 'text', section: 'other' },
  { key: 'alternativePhone', column: 'Phone2', type: 'text', section: 'principal' },
  { key: 'name', column: 'Name', type: 'text', required: true, section: 'principal', defaultValue: '.' },
  { key: 'fax', column: 'Fax', type: 'text', section: 'principal' },
  { key: 'shipToAddress', column: 'IsShipTo', type: 'checkbox', required: true, section: 'principal', defaultValue: 'Y' },
  { key: 'invoiceToAddress', column: 'IsBillTo', type: 'checkbox', required: true, section: 'other', defaultValue: 'Y' },
  { key: 'active', column: 'IsActive', type: 'checkbox', required: true, readOnly: true, section: 'other' },
  // @sf-custom-slot callout:SL_BPartnerLocation
  { key: 'taxLocation', column: 'IsTaxLocation', type: 'checkbox', required: true, section: 'other', defaultValue: 'N' },
];
// @sf-generated-end fields:bpartnerLocation

// @sf-generated-start component:BpartnerLocationForm
export default function BpartnerLocationForm(props) {
  // @sf-custom-slot hooks:BpartnerLocationForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:BpartnerLocationForm

// @sf-custom-slot section:BpartnerLocationForm-custom
