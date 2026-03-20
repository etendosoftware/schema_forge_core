import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:customerReturn
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, section: 'principal', reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'documentDate', column: 'DateOrdered', type: 'date', required: true, section: 'principal' },
  { key: 'returnDate', column: 'DateDelivered', type: 'date', section: 'principal' },
  { key: 'originalShipment', column: 'InOut_ID', type: 'search', required: true, section: 'principal', reference: 'Shipment', inputMode: 'search' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, section: 'other', reference: 'Warehouse', inputMode: 'selector' },
  { key: 'returnReason', column: 'Description', type: 'text', section: 'other' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', section: 'other', reference: 'User', inputMode: 'search' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true, section: 'other' },
  { key: 'totalAmount', column: 'Amt', type: 'number', readOnly: true, section: 'other' },
  { key: 'isApproved', column: 'IsApproved', type: 'checkbox', readOnly: true, section: 'other' },
];
// @sf-generated-end fields:customerReturn

// @sf-generated-start component:CustomerReturnForm
export default function CustomerReturnForm(props) {
  // @sf-custom-slot hooks:CustomerReturnForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:CustomerReturnForm

// @sf-custom-slot section:CustomerReturnForm-custom
