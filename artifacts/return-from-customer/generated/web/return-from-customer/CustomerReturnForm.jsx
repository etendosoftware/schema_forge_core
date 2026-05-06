import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:customerReturn
const fields = [
  { key: 'summedLineAmount', column: 'TotalLines', type: 'number', label: 'Total Net Amount', required: true, readOnly: true, section: 'other' },
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true || record['documentStatus'] === 'TMP' },
  { key: 'cReturnReasonID', column: 'C_Return_Reason_ID', type: 'search', label: 'Return Reason', section: 'principal', reference: 'Return_Reason', inputMode: 'search' },
  { key: 'orderDate', column: 'DateOrdered', type: 'date', label: 'Order Date', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'principal', reference: 'BPartner', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true || record['documentStatus'] === 'TMP' },
  { key: 'partnerAddress', column: 'C_BPartner_Location_ID', type: 'dependent', label: 'Partner Address', required: true, section: 'other', reference: 'BPartner_Location', inputMode: 'dependent', dependsOn: { field: 'businessPartner', filterKey: 'C_BPartner_ID' }, readOnlyLogic: (record) => record['processed'] === true || record['documentStatus'] === 'TMP' },
  { key: 'warehouse', column: 'M_Warehouse_ID', type: 'search', label: 'Warehouse', required: true, section: 'other', reference: 'Warehouse', inputMode: 'search', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'description', column: 'Description', type: 'textarea', label: 'Description', section: 'other' },
  { key: 'etvfacReversedInvoice', column: 'EM_Etvfac_Reversed_Invoice', type: 'search', label: 'Factura Rectificada', section: 'principal', reference: 'Invoice', inputMode: 'search' },
  { key: 'salesRepresentative', column: 'SalesRep_ID', type: 'selector', label: 'Sales Representative', section: 'other', reference: 'User', inputMode: 'selector' },
];
// @sf-generated-end fields:customerReturn

// @sf-generated-start component:CustomerReturnForm
export default function CustomerReturnForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:CustomerReturnForm
