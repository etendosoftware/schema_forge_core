import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:returnMaterialReceipt
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'principal' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', label: 'Movement Date', required: true, section: 'principal' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'search', label: 'Warehouse', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'other', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' } },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'search', label: 'RM order', readOnly: true, section: 'principal', reference: 'Order', inputMode: 'search' },
  { key: 'trackingNo', column: 'TrackingNo', type: 'text', label: 'Tracking No', section: 'other' },
];
// @sf-generated-end fields:returnMaterialReceipt

// @sf-generated-start component:ReturnMaterialReceiptForm
export default function ReturnMaterialReceiptForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
ReturnMaterialReceiptForm.hasCollapsedFields = false;
// @sf-generated-end component:ReturnMaterialReceiptForm
