import InternalConsumptionPage from './InternalConsumptionPage';

const windowMeta = { category: 'inventory', name: 'Internal Consumption' };

const api = {
  "specName": "internal-consumption",
  "baseUrl": "/sws/neo/internal-consumption",
  "crud": {
    "internalConsumption": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/internal-consumption/internalConsumption",
      "detailUrl": "/sws/neo/internal-consumption/internalConsumption/{id}",
      "supportedFilters": [
        "name"
      ]
    },
    "internalConsumptionLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/internal-consumption/internalConsumptionLine",
      "detailUrl": "/sws/neo/internal-consumption/internalConsumptionLine/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "internalConsumptionLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/internal-consumption/internalConsumptionLine/selectors/product"
    },
    {
      "entity": "internalConsumptionLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/internal-consumption/internalConsumptionLine/selectors/uOM"
    },
    {
      "entity": "internalConsumptionLine",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "inputMode": "search",
      "url": "/sws/neo/internal-consumption/internalConsumptionLine/selectors/storageBin"
    }
  ],
  "actions": [
    {
      "entity": "internalConsumption",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/internal-consumption/internalConsumption/{id}/action/processNow",
      "processId": "800131",
      "processType": "classic"
    },
    {
      "entity": "internalConsumption",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/internal-consumption/internalConsumption/{id}/action/posted"
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
      "example": "_sortBy=internal-consumptionDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <InternalConsumptionPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
