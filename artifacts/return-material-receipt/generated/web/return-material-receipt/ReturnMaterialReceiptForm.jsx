import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:returnMaterialReceipt
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search', readOnlySource: 'server', readOnlyLogicReason: 'session-variable' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'search', label: 'Warehouse', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, readOnlyLogic: (record) => record['processed'] === true },
  { key: 'trackingNo', column: 'TrackingNo', type: 'text', label: 'Tracking No', section: 'other' },
  { key: 'sourceShipmentDocNo', column: 'sourceShipmentDocNo', type: 'text', label: 'Source Shipment', readOnly: true, section: 'principal' },
];
// @sf-generated-end fields:returnMaterialReceipt

// @sf-generated-start component:ReturnMaterialReceiptForm
export default function ReturnMaterialReceiptForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:ReturnMaterialReceiptForm
