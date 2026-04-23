import PriceListPage from './PriceListPage';

const windowMeta = { category: 'reference', name: 'Price List' };

const api = {
  "specName": "price-list",
  "baseUrl": "/sws/neo/price-list",
  "crud": {
    "priceList": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/price-list/priceList",
      "detailUrl": "/sws/neo/price-list/priceList/{id}",
      "supportedFilters": [
        "name"
      ]
    },
    "priceListVersion": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/price-list/priceListVersion",
      "detailUrl": "/sws/neo/price-list/priceListVersion/{id}",
      "supportedFilters": []
    },
    "productPrice": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/price-list/productPrice",
      "detailUrl": "/sws/neo/price-list/productPrice/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "priceList",
      "field": "currency",
      "column": "C_Currency_ID",
      "reference": "Currency",
      "inputMode": "selector",
      "url": "/sws/neo/price-list/priceList/selectors/currency"
    },
    {
      "entity": "priceListVersion",
      "field": "priceListSchema",
      "column": "M_DiscountSchema_ID",
      "reference": "DiscountSchema",
      "inputMode": "selector",
      "url": "/sws/neo/price-list/priceListVersion/selectors/priceListSchema"
    },
    {
      "entity": "priceListVersion",
      "field": "basePriceListVersion",
      "column": "M_Pricelist_Version_Base_ID",
      "reference": "PriceList_Version",
      "inputMode": "search",
      "url": "/sws/neo/price-list/priceListVersion/selectors/basePriceListVersion"
    },
    {
      "entity": "productPrice",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "selector",
      "url": "/sws/neo/price-list/productPrice/selectors/product"
    }
  ],
  "actions": [
    {
      "entity": "priceListVersion",
      "field": "create",
      "column": "ProcCreate",
      "url": "/sws/neo/price-list/priceListVersion/{id}/action/create",
      "processId": "103",
      "processType": "classic"
    },
    {
      "entity": "priceListVersion",
      "field": "generatePriceListVersion",
      "column": "M_Pricelist_Version_Generate",
      "url": "/sws/neo/price-list/priceListVersion/{id}/action/generatePriceListVersion",
      "processId": "800069",
      "processType": "classic"
    }
  ],
  "queryParams": {
    "pagination": {
      "startRow": "_startRow",
      "endRow": "_endRow",
      "default": "0-100"
    },
    "sorting": {
      "param": "_sortBy",
      "example": "_sortBy=price-listDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  },
  "window": {
    "category": "reference"
  },
  "labelOverrides": {
    "es_ES": {
      "Name": "Nombre",
      "C_Currency_ID": "Moneda",
      "Costbased": "Basado en coste",
      "IsTaxIncluded": "Precio incluye impuesto",
      "IsDefault": "Por defecto"
    }
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <PriceListPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
