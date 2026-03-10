import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'documentDate', column: 'DateOrdered', type: 'date', required: true },
  { key: 'returnDate', column: 'DateDelivered', type: 'date' },
  { key: 'originalShipment', column: 'InOut_ID', type: 'search', required: true, reference: 'Shipment', inputMode: 'search' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'returnReason', column: 'Description', type: 'text' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'search', reference: 'User', inputMode: 'search' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
  { key: 'totalAmount', column: 'Amt', type: 'number', readOnly: true },
  { key: 'isApproved', column: 'IsApproved', type: 'checkbox', readOnly: true },
];

export default function CustomerReturnForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
