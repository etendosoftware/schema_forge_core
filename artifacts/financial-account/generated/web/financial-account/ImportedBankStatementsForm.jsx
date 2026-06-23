import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:importedBankStatements
const fields = [
  { key: 'documentNo', column: 'DocumentNo', type: 'text', label: 'Document No.', required: true, readOnly: true, section: 'other', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'name', column: 'Name', type: 'text', label: 'Name', required: true, section: 'principal', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'active', column: 'Isactive', type: 'checkbox', label: 'Active', section: 'principal', defaultValue: 'Y', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'importdate', column: 'Importdate', type: 'date', label: 'Import Date', required: true, readOnly: true, section: 'other', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'transactionDate', column: 'Statementdate', type: 'date', label: 'Transaction Date', required: true, readOnly: true, section: 'other', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'fileName', column: 'Filename', type: 'text', label: 'File Name', readOnly: true, section: 'other', readOnlyLogic: (record) => record['processed'] === true },
  { key: 'notes', column: 'Notes', type: 'textarea', label: 'Notes', section: 'principal' },
];
// @sf-generated-end fields:importedBankStatements

// @sf-generated-start component:ImportedBankStatementsForm
export default function ImportedBankStatementsForm(props) {
  return <EntityForm fields={fields} {...props} />;
}

// @sf-generated-end component:ImportedBankStatementsForm
