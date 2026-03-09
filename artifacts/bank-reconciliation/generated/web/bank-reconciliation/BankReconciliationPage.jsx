import { MasterDetailPage } from '@/components/contract-ui';
import BankReconciliationTable from './BankReconciliationTable';
import BankReconciliationForm from './BankReconciliationForm';
import BankReconciliationLineTable from './BankReconciliationLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', label: 'Document No', type: 'string' },
  { key: 'startingBalance', label: 'Starting Balance', type: 'amount' },
  { key: 'difference', label: 'Difference', type: 'amount' },
];

const statusField = 'status';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'transactionDate', label: 'Transaction Date', type: 'date', required: true, lookup: true },
    { key: 'description', label: 'Description', type: 'textarea', required: true },
    { key: 'matchedInvoice', label: 'Matched Invoice', type: 'search', reference: 'Invoice', inputMode: 'search' },
  ],
  derived: [
    { key: 'amount', label: 'Amount', type: 'number' },
  ],
};

export default function BankReconciliationPage(props) {
  return (
    <MasterDetailPage
      entity="bankReconciliation"
      detailEntity="bankReconciliationLine"
      Table={BankReconciliationTable}
      Form={BankReconciliationForm}
      DetailTable={BankReconciliationLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Bank Reconciliation"
      detailLabel="Bank Reconciliation Line"
      {...props}
    />
  );
}
