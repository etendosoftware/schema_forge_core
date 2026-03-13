import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsReceipt
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, section: 'principal', reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true, section: 'principal' },
  { key: 'dateAcct', column: 'DateAcct', type: 'date', required: true, section: 'principal' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'other', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'poReference', column: 'POReference', type: 'text', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
];
// @sf-generated-end fields:goodsReceipt

// @sf-generated-start component:GoodsReceiptForm
export default function GoodsReceiptForm(props) {
  // @sf-custom-slot hooks:GoodsReceiptForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:GoodsReceiptForm

// @sf-custom-slot section:GoodsReceiptForm-custom
