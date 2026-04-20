import { ListView, DetailView } from '@/components/contract-ui';
import PriceListTable from './PriceListTable';
import PriceListForm from './PriceListForm';
import PriceListLineTable from './PriceListLineTable';
import PriceListLineForm from './PriceListLineForm';
import catalogs from './mockCatalogs';


const breadcrumb = 'Settings / Price List';

const labelOverrides = {
  "es_ES": {
    "Name": "Nombre",
    "C_Currency_ID": "Moneda",
    "Costbased": "Basado en coste",
    "IsTaxIncluded": "Precio incluye impuesto",
    "IsDefault": "Por defecto"
  }
};


// @sf-generated-start summary:priceList
const summary = [

];

const statusField = null;
// @sf-generated-end summary:priceList

// @sf-generated-start extraBadges:priceList
const extraBadges = [];
// @sf-generated-end extraBadges:priceList

// @sf-generated-start processes:priceList
const processes = [

];
// @sf-generated-end processes:priceList

// @sf-generated-start draftMode:priceList
const draftMode = null;
// @sf-generated-end draftMode:priceList

// @sf-generated-start addLineFields:priceListLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'listPrice', column: 'PriceList', type: 'number', required: true },
    { key: 'standardPrice', column: 'PriceStd', type: 'number', required: true },
  ],
  derived: [
    { key: 'limitPrice', column: 'PriceLimit', type: 'number' },
  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:priceListLine

// @sf-generated-start component:PriceListPage
export default function PriceListPage({ windowName, recordId, ...props }) {

  if (recordId) {
    return (
      <DetailView
        entity="priceList"
        detailEntity="priceListLine"
        Form={PriceListForm}
        DetailTable={PriceListLineTable}
        DetailForm={PriceListLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Price List"
        detailLabel="Price List Line"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
        showDetailFooterTotals={false}
        hidePrint
        hideMoreMenu
        labelOverrides={labelOverrides}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="priceList"
      Table={PriceListTable}
      entityLabel="Price List"
      windowName={windowName}
      breadcrumb={breadcrumb}
      labelOverrides={labelOverrides}
      {...props}
    />
  );
}
// @sf-generated-end component:PriceListPage
