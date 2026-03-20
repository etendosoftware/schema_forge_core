import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:requisition
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'dateRequired', column: 'DateRequired', type: 'date', required: true, section: 'principal' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'principal', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'priceList', column: 'M_PriceList_ID', type: 'selector', required: true, section: 'principal', reference: 'PriceList', inputMode: 'selector' },
  { key: 'description', column: 'Description', type: 'textarea', section: 'other' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true, section: 'other' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'totalLines', column: 'TotalLines', type: 'number', readOnly: true, section: 'other' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'number', readOnly: true, section: 'other' },
  { key: 'user', column: 'AD_User_ID', type: 'search', readOnly: true, section: 'other', reference: 'User', inputMode: 'search' },
];
// @sf-generated-end fields:requisition

// @sf-generated-start component:RequisitionForm
export default function RequisitionForm(props) {
  // @sf-custom-slot hooks:RequisitionForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:RequisitionForm

// @sf-custom-slot section:RequisitionForm-custom
