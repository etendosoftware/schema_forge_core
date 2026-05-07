import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:issuedInvoices
const fields = [
  { key: 'aeatsiiInvoice', column: 'EM_Aeatsii_Invoice_ID', type: 'selector', label: 'Invoice', section: 'principal', reference: 'Invoice', inputMode: 'selector' },
  { key: 'aeatsiiIssent', column: 'EM_Aeatsii_Issent', type: 'checkbox', label: 'Sent to SII', required: true, readOnly: true, section: 'other', readOnlyLogic: (record) => true },
  { key: 'aeatsiiModified', column: 'EM_Aeatsii_Modified', type: 'checkbox', label: 'Modified in SII', required: true, readOnly: true, section: 'other', readOnlyLogic: (record) => true },
  { key: 'aeatsiiEstado', column: 'EM_Aeatsii_Estado', type: 'select', label: 'SII Registration Status', readOnly: true, section: 'other', options: [{ value: 'AE', label: 'Accepted with errors' }, { value: 'AN', label: 'Annulled' }, { value: 'IN', label: 'Incorrect' }, { value: 'NR', label: 'Not Registrable to SII' }, { value: 'PE', label: 'Pending to send to SII' }, { value: 'CO', label: 'Right' }, { value: 'EE', label: 'Sending error' }, { value: 'BA', label: 'Unsubscribed' }], defaultValue: '@SQL=SELECT CASE WHEN ((SELECT c.insiisystem FROM aeatsii_config c WHERE c.ad_org_id = (SELECT ad_get_org_le_bu(@AD_Org_ID@,\'LE\') FROM dual))=\'Y\') THEN \'PE\' ELSE null END FROM dual', readOnlyLogic: (record) => true },
  { key: 'invoiceDate', column: 'DateInvoiced', type: 'date', label: 'Invoice Date', required: true, section: 'principal', readOnlyLogic: (record) => record['posted'] === 'Y' || (record['processed'] === true && (record['documentStatus'] !== 'VO')) },
  { key: 'etsgDateOperation', column: 'EM_Etsg_Date_Operation', type: 'date', label: 'Fecha operación', section: 'principal', defaultValue: '@DateInvoiced@', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'accountingDate', column: 'DateAcct', type: 'date', label: 'Accounting Date', required: true, section: 'principal', readOnlyLogic: (record) => record['posted'] === 'Y' },
  { key: 'documentStatus', column: 'DocStatus', type: 'select', label: 'Document Status', required: true, readOnly: true, section: 'other', options: [{ value: 'CL', label: 'Closed' }, { value: 'CO', label: 'Completed' }, { value: 'DR', label: 'Draft' }, { value: 'NA', label: 'Not Accepted' }, { value: 'WP', label: 'Not Paid' }, { value: 'RE', label: 'Re-Opened' }, { value: 'TEMP', label: 'Temporal' }, { value: 'IP', label: 'Under Way' }, { value: '??', label: 'Unknown' }, { value: 'VO', label: 'Voided' }], defaultValue: 'DR' },
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', label: 'Business Partner', required: true, section: 'other', reference: 'BPartner', inputMode: 'search', readOnlySource: 'server', readOnlyLogicReason: 'session-variable' },
  { key: 'grandTotalAmount', column: 'GrandTotal', type: 'number', label: 'Total Gross Amount', required: true, readOnly: true, section: 'other' },
  { key: 'aeatsiiClaveTipo', column: 'EM_Aeatsii_Clave_Tipo', type: 'select', label: 'Invoice type key', section: 'other', options: [{ value: 'R', label: 'Corrective invoice' }, { value: 'F1', label: 'Invoice' }, { value: 'F2', label: 'Simplified invoice' }, { value: 'F4', label: 'Simplified invoices summary' }], defaultValue: '@SQL=SELECT CASE WHEN ((SELECT c.insiisystem FROM aeatsii_config c WHERE c.ad_org_id = (SELECT ad_get_org_le_bu(@AD_Org_ID@,\'LE\') FROM dual))=\'Y\') THEN \'F1\' ELSE null END FROM dual', readOnlyLogic: (record) => (record['em_aeatsii_estado'] === 'CO' || record['em_aeatsii_estado'] === 'AE' || record['documentStatus'] === 'VO') && record['processed'] === true },
  { key: 'aeatsiiMotivoRectif', column: 'EM_Aeatsii_Motivo_Rectif', type: 'select', label: 'Rectification reason', section: 'other', options: [{ value: 'R1', label: 'R1 - Founded error' }, { value: 'R2', label: 'R2 - Competition' }, { value: 'R3', label: 'R3 - Bad debt' }, { value: 'R4', label: 'R4 - Rest' }, { value: 'R5', label: 'R5 - Simplified invoice' }], readOnlyLogic: (record) => (record['em_aeatsii_estado'] === 'CO' || record['em_aeatsii_estado'] === 'AE' || record['documentStatus'] === 'VO') && record['processed'] === true },
  { key: 'totalPaid', column: 'Totalpaid', type: 'number', label: 'Total Paid', required: true, readOnly: true, section: 'other', defaultValue: '0' },
  { key: 'paymentMethod', column: 'FIN_Paymentmethod_ID', type: 'selector', label: 'Payment Method', required: true, section: 'other', reference: 'Paymentmethod', inputMode: 'selector', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'salesTransaction', column: 'IsSOTrx', type: 'checkbox', label: 'Sales Transaction', required: true, readOnly: true, section: 'other', defaultValue: '@IsSOTrx@' },
  { key: 'aeatsiiErrorRegistral', column: 'EM_Aeatsii_Error_Registral', type: 'checkbox', label: 'Register Error Modified', required: true, section: 'other', readOnlyLogic: (record) => (record['em_aeatsii_estado'] !== 'CO' && record['em_aeatsii_estado'] !== 'AE') || record['em_aeatsii_modified'] === 'Y' || record['documentStatus'] === 'VO' },
  { key: 'aeatsiiErrorCode', column: 'EM_Aeatsii_Error_Code', type: 'text', label: 'SII error code', section: 'other', readOnlyLogic: (record) => true },
  { key: 'aeatsiiErrorMsg', column: 'EM_Aeatsii_Error_Msg', type: 'text', label: 'SII error message', section: 'other', readOnlyLogic: (record) => true },
  { key: 'aeatsiiInsiidate', column: 'EM_Aeatsii_Insiidate', type: 'date', label: 'SII registry date', section: 'other', readOnlyLogic: (record) => true },
];
// @sf-generated-end fields:issuedInvoices

// @sf-generated-start component:IssuedInvoicesForm
export default function IssuedInvoicesForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:IssuedInvoicesForm
