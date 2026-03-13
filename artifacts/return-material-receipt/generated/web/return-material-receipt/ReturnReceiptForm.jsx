import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:returnReceipt
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true, section: 'principal' },
  { key: 'dateAcct', column: 'DateAcct', type: 'date', required: true, section: 'principal' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'other', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'returnReason', column: 'M_RMA_ID', type: 'search', section: 'other', reference: 'ReturnMaterialAuthorization', inputMode: 'search' },
  { key: 'orderReference', column: 'C_Order_ID', type: 'search', section: 'other', reference: 'SalesOrder', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'poReference', column: 'POReference', type: 'text', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:returnReceipt

// @sf-generated-start component:ReturnReceiptForm
export default function ReturnReceiptForm(props) {
  // @sf-custom-slot hooks:ReturnReceiptForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ReturnReceiptForm

// @sf-custom-slot section:ReturnReceiptForm-custom
