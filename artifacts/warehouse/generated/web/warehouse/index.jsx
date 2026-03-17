import WarehousePage from './WarehousePage';

const windowMeta = { category: 'inventory', name: 'Warehouse and Storage Bins' };

const api = {
  "specName": "warehouse-and-storage-bins",
  "baseUrl": "/sws/neo/warehouse-and-storage-bins",
  "crud": {
    "warehouse": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/warehouse-and-storage-bins/warehouse",
      "detailUrl": "/sws/neo/warehouse-and-storage-bins/warehouse/{id}",
      "supportedFilters": [
        "searchKey",
        "name"
      ]
    },
    "storageBin": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/warehouse-and-storage-bins/storageBin",
      "detailUrl": "/sws/neo/warehouse-and-storage-bins/storageBin/{id}",
      "supportedFilters": [
        "searchKey",
        "barcode"
      ]
    },
    "productTransaction": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/warehouse-and-storage-bins/productTransaction",
      "detailUrl": "/sws/neo/warehouse-and-storage-bins/productTransaction/{id}",
      "supportedFilters": [
        "product",
        "movementDate",
        "movementType"
      ]
    },
    "binContent": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/warehouse-and-storage-bins/binContent",
      "detailUrl": "/sws/neo/warehouse-and-storage-bins/binContent/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "warehouse",
      "field": "location",
      "column": "C_Location_ID",
      "reference": "Location",
      "url": "/sws/neo/warehouse-and-storage-bins/warehouse/selectors/location"
    },
    {
      "entity": "warehouse",
      "field": "returnLocator",
      "column": "M_Returnlocator_ID",
      "reference": "Locator",
      "url": "/sws/neo/warehouse-and-storage-bins/warehouse/selectors/returnLocator"
    },
    {
      "entity": "warehouse",
      "field": "warehouseRule",
      "column": "M_Warehouse_Rule_ID",
      "reference": "WarehouseRule",
      "url": "/sws/neo/warehouse-and-storage-bins/warehouse/selectors/warehouseRule"
    },
    {
      "entity": "storageBin",
      "field": "inventoryStatus",
      "column": "M_InventoryStatus_ID",
      "reference": "InventoryStatus",
      "url": "/sws/neo/warehouse-and-storage-bins/storageBin/selectors/inventoryStatus"
    },
    {
      "entity": "productTransaction",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "url": "/sws/neo/warehouse-and-storage-bins/productTransaction/selectors/product"
    },
    {
      "entity": "productTransaction",
      "field": "goodsShipmentLine",
      "column": "M_InOutLine_ID",
      "reference": "GoodsShipmentLine",
      "url": "/sws/neo/warehouse-and-storage-bins/productTransaction/selectors/goodsShipmentLine"
    },
    {
      "entity": "productTransaction",
      "field": "inventoryLine",
      "column": "M_InventoryLine_ID",
      "reference": "InventoryLine",
      "url": "/sws/neo/warehouse-and-storage-bins/productTransaction/selectors/inventoryLine"
    },
    {
      "entity": "productTransaction",
      "field": "movementLine",
      "column": "M_MovementLine_ID",
      "reference": "MovementLine",
      "url": "/sws/neo/warehouse-and-storage-bins/productTransaction/selectors/movementLine"
    },
    {
      "entity": "productTransaction",
      "field": "productionLine",
      "column": "M_ProductionLine_ID",
      "reference": "ProductionLine",
      "url": "/sws/neo/warehouse-and-storage-bins/productTransaction/selectors/productionLine"
    },
    {
      "entity": "productTransaction",
      "field": "projectIssue",
      "column": "C_ProjectIssue_ID",
      "reference": "ProjectIssue",
      "url": "/sws/neo/warehouse-and-storage-bins/productTransaction/selectors/projectIssue"
    },
    {
      "entity": "binContent",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "url": "/sws/neo/warehouse-and-storage-bins/binContent/selectors/product"
    },
    {
      "entity": "binContent",
      "field": "uom",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "url": "/sws/neo/warehouse-and-storage-bins/binContent/selectors/uom"
    },
    {
      "entity": "binContent",
      "field": "productUom",
      "column": "M_Product_Uom_Id",
      "reference": "ProductUOM",
      "url": "/sws/neo/warehouse-and-storage-bins/binContent/selectors/productUom"
    },
    {
      "entity": "binContent",
      "field": "referenceInventory",
      "column": "M_RefInventory_ID",
      "reference": "ReferenceInventory",
      "url": "/sws/neo/warehouse-and-storage-bins/binContent/selectors/referenceInventory"
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
      "example": "_sortBy=warehouse-and-storage-binsDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  // @sf-custom-slot hooks:App
  return <WarehousePage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App

// @sf-custom-slot section:App-custom
