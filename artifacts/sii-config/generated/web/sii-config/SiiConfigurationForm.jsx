import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:siiConfiguration
const fields = [
  { key: 'acogidaAlSII', column: 'Insiisystem', type: 'checkbox', label: 'In SII system', required: true, section: 'principal', defaultValue: 'N' },
  { key: 'fechaAcogidaSII', column: 'Insiisystemdate', type: 'date', label: 'In SII system date', section: 'principal' },
  { key: 'plazoLmiteDeEnvoASII', column: 'Plazo', type: 'number', label: 'SII sending deadline', required: true, section: 'principal', defaultValue: '8' },
  { key: 'cadenciaEnvoFacturasVentaASII', column: 'Cadencia', type: 'number', label: 'Sales Invoice SII sending Cadence', required: true, section: 'principal', defaultValue: '0' },
  { key: 'cadenciaEnvoFacturasCompraASII', column: 'Cadencia_Compra', type: 'number', label: 'Purchase Invoice SII sending Cadence', required: true, section: 'other', defaultValue: '0' },
  { key: 'entornoDeProduccin', column: 'Produccion', type: 'checkbox', label: 'Production environment', required: true, section: 'other', defaultValue: 'Y' },
  { key: 'adjuntarArchivosXML', column: 'Adjuntos', type: 'checkbox', label: 'Attach XML files', required: true, section: 'other', defaultValue: 'N' },
  { key: 'recc', column: 'Recc', type: 'checkbox', label: 'RECC affected', required: true, section: 'other', defaultValue: 'N' },
  { key: 'redeme', column: 'Redeme', type: 'checkbox', label: 'Subject in REDEME', required: true, section: 'other', defaultValue: 'N' },
  { key: 'monitordate', column: 'Monitordate', type: 'date', label: 'From date display in "SII Monitor"', section: 'other', defaultValue: '01-01-2017' },
  { key: 'postedInvoices', column: 'Posted_Invoices', type: 'checkbox', label: 'Send to SII only Posted Purchase Invoices', required: true, section: 'other', defaultValue: 'N' },
  { key: 'authorizationno', column: 'Authorizationno', type: 'text', label: 'Authorization No.', section: 'other' },
  { key: 'cIF', column: 'CIF', type: 'text', label: 'CIF', readOnly: true, section: 'other' },
  { key: 'conexiones', column: 'conexiones', type: 'number', label: 'conexiones', readOnly: true, section: 'other' },
  { key: 'cashVAT', column: 'iscashvat', type: 'checkbox', label: 'iscashvat', section: 'other' },
  { key: 'lastQueryBook', column: 'Last_Query_Book', type: 'select', label: 'Last_Query_Book', readOnly: true, section: 'other', options: [{ value: 'E', label: 'Issued' }, { value: 'R', label: 'Received' }] },
  { key: 'lastQueryExercise', column: 'Last_Query_Exercise', type: 'text', label: 'Last_Query_Exercise', readOnly: true, section: 'other' },
  { key: 'lastQueryPeriod', column: 'Last_Query_Period', type: 'select', label: 'Last_Query_Period', readOnly: true, section: 'other', options: [{ value: '1', label: '1 - January' }, { value: '10', label: '10 - October' }, { value: '11', label: '11 - November' }, { value: '12', label: '12 - December' }, { value: '2', label: '2 - February' }, { value: '3', label: '3 - March' }, { value: '4', label: '4 - April' }, { value: '5', label: '5 - May' }, { value: '6', label: '6 - June' }, { value: '7', label: '7 - July' }, { value: '8', label: '8 - August' }, { value: '9', label: '9 - September' }] },
  { key: 'sinceJanuary2017', column: 'SinceJanuary2017', type: 'checkbox', label: 'SinceJanuary2017', required: true, readOnly: true, section: 'other', defaultValue: 'N' },
];
// @sf-generated-end fields:siiConfiguration

// @sf-generated-start component:SiiConfigurationForm
export default function SiiConfigurationForm(props) {
  return <EntityForm fields={fields} {...props} />;
}
SiiConfigurationForm.hasCollapsedFields = false;
// @sf-generated-end component:SiiConfigurationForm
