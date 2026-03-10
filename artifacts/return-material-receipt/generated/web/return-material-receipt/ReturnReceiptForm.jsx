import { EntityForm } from '@/components/contract-ui';

const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, reference: 'BusinessPartner', inputMode: 'search' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', required: true, reference: 'BusinessPartnerLocation', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'businessPartnerId' } },
  { key: 'movementDate', column: 'MovementDate', type: 'date', required: true },
  { key: 'dateAcct', column: 'DateAcct', type: 'date', required: true },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'selector', required: true, reference: 'Warehouse', inputMode: 'selector' },
  { key: 'returnReason', column: 'M_RMA_ID', type: 'search', reference: 'ReturnMaterialAuthorization', inputMode: 'search' },
  { key: 'orderReference', column: 'C_Order_ID', type: 'search', reference: 'SalesOrder', inputMode: 'search' },
  { key: 'description', column: 'Description', type: 'textarea' },
  { key: 'poReference', column: 'POReference', type: 'text' },
  { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', required: true, readOnly: true },
  { key: 'docStatus', column: 'DocStatus', type: 'text', required: true, readOnly: true },
];

export default function ReturnReceiptForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
