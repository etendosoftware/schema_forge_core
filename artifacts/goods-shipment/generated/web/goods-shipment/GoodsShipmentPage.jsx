import { ListView, DetailView } from '@/components/contract-ui';
import GoodsShipmentTable from './GoodsShipmentTable';
import GoodsShipmentForm from './GoodsShipmentForm';
import GoodsShipmentLineTable from './GoodsShipmentLineTable';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Goods Shipment';

// @sf-generated-start summary:goodsShipment
const summary = [

];

const statusField = 'documentStatus';
// @sf-generated-end summary:goodsShipment

// @sf-generated-start processes:goodsShipment
const processes = [

];
// @sf-generated-end processes:goodsShipment

// @sf-generated-start addLineFields:goodsShipmentLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, reference: 'Product', inputMode: 'search' },
    { key: 'movementQuantity', column: 'MovementQty', type: 'number', required: true },
    { key: 'storageBin', column: 'M_Locator_ID', type: 'selector', required: true, reference: 'Locator', inputMode: 'selector' },
    { key: 'lineNo', column: 'Line', type: 'number', required: true },
    { key: 'description', column: 'Description', type: 'textarea' },
  ],
  derived: [

  ],
};
// @sf-generated-end addLineFields:goodsShipmentLine

const api = {
  "specName": "goods-shipment",
  "baseUrl": "/sws/neo/goods-shipment",
  "crud": {
    "goodsShipment": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/goods-shipment/goodsShipment",
      "detailUrl": "/sws/neo/goods-shipment/goodsShipment/{id}",
      "supportedFilters": [
        "businessPartner",
        "movementDate",
        "warehouse",
        "orderReference",
        "documentNo",
        "documentStatus"
      ]
    },
    "goodsShipmentLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/goods-shipment/goodsShipmentLine",
      "detailUrl": "/sws/neo/goods-shipment/goodsShipmentLine/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "goodsShipment",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/businessPartner"
    },
    {
      "entity": "goodsShipment",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/partnerAddress"
    },
    {
      "entity": "goodsShipment",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/warehouse"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/product"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/storageBin"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/uOM"
    }
  ],
  "actions": [],
  "queryParams": {
    "pagination": {
      "startRow": "_startRow",
      "endRow": "_endRow",
      "default": "0-100"
    },
    "sorting": {
      "param": "_sortBy",
      "example": "_sortBy=goods-shipmentDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:GoodsShipmentPage
export default function GoodsShipmentPage({ windowName, recordId, ...props }) {
  // @sf-custom-slot hooks:GoodsShipmentPage
  if (recordId) {
    return (
      <DetailView
        entity="goodsShipment"
        detailEntity="goodsShipmentLine"
        Form={GoodsShipmentForm}
        DetailTable={GoodsShipmentLineTable}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Goods Shipment"
        detailLabel="Goods Shipment Line"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="goodsShipment"
      Table={GoodsShipmentTable}
      entityLabel="Goods Shipments"
      windowName={windowName}
      breadcrumb={breadcrumb}
      {...props}
    />
  );
}
// @sf-generated-end component:GoodsShipmentPage

// @sf-custom-slot section:GoodsShipmentPage-custom
