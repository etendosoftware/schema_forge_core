import { forwardRef } from 'react';
import { DataTable, InlineLinesPanel } from '@/components/contract-ui';

// @sf-generated-start columns:emailConfiguration
const columns = [
  { key: 'active', column: 'Isactive', type: 'boolean', label: 'Active', required: true },
  { key: 'smtpServer', column: 'Smtpserver', type: 'string', label: 'Smtp Server', required: true },
  { key: 'sMTPAuthentification', column: 'IsSmtpAuthorization', type: 'boolean', label: 'SMTP Authentification', required: true },
  { key: 'smtpServerAccount', column: 'Smtpserveraccount', type: 'string', label: 'Smtp Server Account' },
  { key: 'smtpConnectionSecurity', column: 'Smtpconnectionsecurity', type: 'enum', label: 'SMTP Connection Security', enumLabels: { 'N': 'None', 'STARTTLS': 'STARTTLS', 'SSL': 'SSL' }, required: true },
  { key: 'smtpPort', column: 'Smtpport', type: 'number', label: 'Smtp Port', required: true },
  { key: 'testSuccessful', column: 'Istestsuccessful', type: 'boolean', label: 'Test Successful', required: true },
  { key: 'defaultConfiguration', column: 'Isdefaultconfig', type: 'boolean', label: 'Default', required: true },
];
// @sf-generated-end columns:emailConfiguration

const filters = ['smtpServer'];

// @sf-generated-start component:EmailConfigurationTable
const EmailConfigurationTable = forwardRef(function EmailConfigurationTable(props, ref) {
  // Inline-editable layout owns rendering of the existing rows. The add-line flow keeps
  // using the proven DataTable inline-add row (callouts, focus management, defaults) —
  // when addRow.active flips on, we hand off to DataTable so the user can fill the new
  // line, then return to InlineLinesPanel once addRow.active flips off again. The ref
  // is forwarded so DetailView can imperatively flush pending edits on global save.
  if (props.linesLayout === 'inlineEditable' && !props.addRow?.active) {
    return <InlineLinesPanel ref={ref} columns={columns} {...props} />;
  }
  return <DataTable columns={columns} filters={filters} {...props} />;
});

export default EmailConfigurationTable;
// @sf-generated-end component:EmailConfigurationTable
