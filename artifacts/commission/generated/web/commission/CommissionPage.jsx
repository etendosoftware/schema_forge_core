import { MasterDetailPage } from '@/components/contract-ui';
import CommissionTable from './CommissionTable';
import CommissionForm from './CommissionForm';
import CommissionLineTable from './CommissionLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'dateLastRun', column: 'DateLastRun', type: 'date' },
];

const statusField = null;

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true, lookup: true },
    { key: 'product', column: 'M_Product_ID', type: 'search', reference: 'Product', inputMode: 'search' },
    { key: 'productCategory', column: 'M_Product_Category_ID', type: 'selector', reference: 'ProductCategory', inputMode: 'selector' },
    { key: 'bpGroup', column: 'C_BP_Group_ID', type: 'selector', reference: 'BusinessPartnerGroup', inputMode: 'selector' },
    { key: 'commissionPercentage', column: 'CommissionPercentage', type: 'number' },
    { key: 'quantityMultiplier', column: 'QtyMultiplier', type: 'number' },
    { key: 'isActive', column: 'IsActive', type: 'checkbox', required: true },
  ],
  derived: [
    { key: 'commissionAmount', column: 'CommissionAmt', type: 'number' },
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
