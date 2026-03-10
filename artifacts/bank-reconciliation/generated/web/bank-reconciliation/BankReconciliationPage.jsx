import { MasterDetailPage } from '@/components/contract-ui';
import BankReconciliationTable from './BankReconciliationTable';
import BankReconciliationForm from './BankReconciliationForm';
import BankReconciliationLineTable from './BankReconciliationLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'startingBalance', column: 'StartingBalance', type: 'amount' },
  { key: 'difference', column: 'Difference', type: 'amount' },
];

const statusField = 'status';

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'transactionDate', column: 'TransactionDate', type: 'date', required: true, lookup: true },
    { key: 'description', column: 'Description', type: 'textarea', required: true },
    { key: 'matchedInvoice', column: 'C_Invoice_ID', type: 'search', reference: 'Invoice', inputMode: 'search' },
  ],
  derived: [
    { key: 'amount', column: 'Amount', type: 'number' },
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
