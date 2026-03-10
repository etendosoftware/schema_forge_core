import { MasterDetailPage } from '@/components/contract-ui';
import PriceListTable from './PriceListTable';
import PriceListForm from './PriceListForm';
import PriceListLineTable from './PriceListLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'isSalesPrice', column: 'IsSOPriceList', type: 'boolean' },
  { key: 'isActive', column: 'IsActive', type: 'boolean' },
];

const statusField = null;

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
  ],
  derived: [
    { key: 'listPrice', column: 'PriceList', type: 'number' },
    { key: 'standardPrice', column: 'PriceStd', type: 'number' },
    { key: 'limitPrice', column: 'PriceLimit', type: 'number' },
  ],
};

export default function PriceListPage(props) {
  return (
    <MasterDetailPage
      entity="priceList"
      detailEntity="priceListLine"
      Table={PriceListTable}
      Form={PriceListForm}
      DetailTable={PriceListLineTable}
      summary={summary}
      statusField={statusField}
      processes={processes}
      addLineFields={addLineFields}
      catalogs={catalogs}
      entityLabel="Price List"
      detailLabel="Price List Line"
      {...props}
    />
  );
}
