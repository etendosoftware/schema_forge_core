import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:goodsReceipt
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true, section: 'principal' },
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
