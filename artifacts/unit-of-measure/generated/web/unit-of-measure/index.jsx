import UnitOfMeasurePage from './UnitOfMeasurePage';

const windowMeta = { category: 'configuracion', name: 'Unit of Measure' };

const api = {
  "specName": "unit-of-measure",
  "baseUrl": "/sws/neo/unit-of-measure",
  "crud": {
    "unitOfMeasure": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/unit-of-measure/unitOfMeasure",
      "detailUrl": "/sws/neo/unit-of-measure/unitOfMeasure/{id}",
      "supportedFilters": [
        "name"
      ]
    }
  },
  "actions": [],
  "queryParams": {
    "pagination": {
      "startRow": "_startRow",
      "endRow": "_endRow",
      "default": "0-100"
    },
    "sorting": {
      "param": "_sortBy"
    },
    "filtering": "Use field name as query param: ?fieldName=value"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  return <UnitOfMeasurePage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App
