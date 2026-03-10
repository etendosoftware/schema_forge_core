import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
  { key: 'packDate', column: 'PackDate', type: 'date', required: true },
  { key: 'shipment', column: 'M_InOut_ID', type: 'search', required: true, reference: 'Shipment', inputMode: 'search' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'carrier', column: 'Carrier', type: 'text' },
  { key: 'trackingNo', column: 'TrackingNo', type: 'text' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
];

export default function PackingForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
