import { ListView, DetailView } from '@/components/contract-ui';
import UnitOfMeasureTable from './UnitOfMeasureTable';
import UnitOfMeasureForm from './UnitOfMeasureForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'Settings / Unit of Measure';

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

// @sf-generated-start component:UnitOfMeasurePage
export default function UnitOfMeasurePage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="unitOfMeasure"
        Form={UnitOfMeasureForm}
        catalogs={catalogs}
        entityLabel="Unit of Measure"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
        api={api}
        hidePrint
        hideMoreMenu
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="unitOfMeasure"
      Table={UnitOfMeasureTable}
      entityLabel="Unit of Measure"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      {...props}
    />
  );
}
// @sf-generated-end component:UnitOfMeasurePage
