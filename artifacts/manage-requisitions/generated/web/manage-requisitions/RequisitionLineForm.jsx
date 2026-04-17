import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:requisitionLine
const fields = [
  { key: 'lineNo', column: 'Line', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'product', column: 'M_Product_ID', type: 'search', required: true, readOnly: true, section: 'other', reference: 'Product', inputMode: 'search' },
  { key: 'quantity', column: 'Qty', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'unitPrice', column: 'PriceActual', type: 'number', required: true, readOnly: true, section: 'other' },
  { key: 'lineNetAmount', column: 'LineNetAmt', type: 'number', readOnly: true, section: 'other' },
  { key: 'needByDate', column: 'NeedByDate', type: 'date', readOnly: true, section: 'other' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', readOnly: true, section: 'other', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'uom', column: 'C_UOM_ID', type: 'selector', readOnly: true, section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', readOnly: true, section: 'other' },
  { key: 'matchedPOQty', column: 'Orderedqty', type: 'number', readOnly: true, section: 'other' },
  { key: 'requisitionOrder', column: 'M_Requisitionorder_ID', type: 'search', readOnly: true, section: 'other', reference: 'RequisitionOrder' },
];
// @sf-generated-end fields:requisitionLine

// @sf-generated-start component:RequisitionLineForm
export default function RequisitionLineForm(props) {
  // @sf-custom-slot hooks:RequisitionLineForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:RequisitionLineForm

// @sf-custom-slot section:RequisitionLineForm-custom
