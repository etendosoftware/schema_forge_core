import { MasterDetailPage } from '@/components/contract-ui';
import CommissionRunTable from './CommissionRunTable';
import CommissionRunForm from './CommissionRunForm';
import CommissionAmountTable from './CommissionAmountTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'grandTotal', column: 'GrandTotal', type: 'amount' },
];

const statusField = 'docStatus';

const processes = [

];

const addLineFields = {
  entry: [

  ],
  derived: [

  ],
};

export default function CommissionRunPage(props) {
  return (
    <MasterDetailPage
      entity="commissionRun"
      detailEntity="commissionAmount"
      Table={CommissionRunTable}
      Form={CommissionRunForm}
      DetailTable={CommissionAmountTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Commission Run"
      detailLabel="Commission Amount"
      {...props}
    />
  );
}
