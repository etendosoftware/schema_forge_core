import { MasterDetailPage } from '@/components/contract-ui';
import PriceListTable from './PriceListTable';
import PriceListForm from './PriceListForm';
import PriceListLineTable from './PriceListLineTable';
import catalogs from './mockCatalogs';

const summary = [
  { key: 'isSalesPrice', label: 'Is Sales Price', type: 'boolean' },
  { key: 'isActive', label: 'Is Active', type: 'boolean' },
];

const statusField = null;

const processes = [

];

const addLineFields = {
  entry: [
    { key: 'product', label: 'Product', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
  ],
  derived: [
    { key: 'listPrice', label: 'List Price', type: 'number' },
    { key: 'standardPrice', label: 'Standard Price', type: 'number' },
    { key: 'limitPrice', label: 'Limit Price', type: 'number' },
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
