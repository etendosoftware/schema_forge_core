import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:packing
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'packDate', column: 'PackDate', type: 'date', required: true, section: 'principal' },
  { key: 'shipment', column: 'M_InOut_ID', type: 'search', required: true, section: 'principal', reference: 'Shipment', inputMode: 'search' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'carrier', column: 'Carrier', type: 'text', section: 'other' },
  { key: 'trackingNo', column: 'TrackingNo', type: 'text', section: 'other' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
];
// @sf-generated-end fields:packing

// @sf-generated-start component:PackingForm
export default function PackingForm(props) {
  // @sf-custom-slot hooks:PackingForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:PackingForm

// @sf-custom-slot section:PackingForm-custom
