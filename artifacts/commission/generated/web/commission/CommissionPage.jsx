import { MasterDetailPage } from '@/components/contract-ui';
import CommissionTable from './CommissionTable';
import CommissionForm from './CommissionForm';
import CommissionLineTable from './CommissionLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'dateLastRun', label: 'Date Last Run', type: 'date' },
];

const statusField = null;

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'lineNo', label: 'Line No', type: 'number', required: true, lookup: true },
    { key: 'product', label: 'Product', type: 'search', reference: 'Product', inputMode: 'search' },
    { key: 'productCategory', label: 'Product Category', type: 'selector', reference: 'ProductCategory', inputMode: 'selector' },
    { key: 'bpGroup', label: 'Bp Group', type: 'selector', reference: 'BusinessPartnerGroup', inputMode: 'selector' },
    { key: 'commissionPercentage', label: 'Commission Percentage', type: 'number' },
    { key: 'quantityMultiplier', label: 'Quantity Multiplier', type: 'number' },
    { key: 'isActive', label: 'Is Active', type: 'checkbox', required: true },
  ],
  derived: [
    { key: 'commissionAmount', label: 'Commission Amount', type: 'number' },
  ],
};

export default function CommissionPage(props) {
  return (
    <MasterDetailPage
      entity="commission"
      detailEntity="commissionLine"
      Table={CommissionTable}
      Form={CommissionForm}
      DetailTable={CommissionLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Commission"
      detailLabel="Commission Line"
      {...props}
    />
  );
}
