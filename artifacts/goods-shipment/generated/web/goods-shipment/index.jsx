import GoodsShipmentPage from './GoodsShipmentPage';

const windowMeta = { category: 'sales', name: 'Goods Shipment' };

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
        "documentNo",
        "warehouse",
        "businessPartner",
        "movementDate",
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
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/warehouse"
    },
    {
      "entity": "goodsShipment",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/businessPartner"
    },
    {
      "entity": "goodsShipment",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/partnerAddress"
    },
    {
      "entity": "goodsShipment",
      "field": "salesOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/salesOrder"
    },
    {
      "entity": "goodsShipment",
      "field": "shippingCompany",
      "column": "M_Shipper_ID",
      "reference": "Shipper",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/shippingCompany"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/product"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/uOM"
    }
  ],
  "actions": [
    {
      "entity": "goodsShipment",
      "field": "createLinesFrom",
      "column": "CreateFrom",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/createLinesFrom"
    },
    {
      "entity": "goodsShipment",
      "field": "documentAction",
      "column": "DocAction",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/documentAction"
    },
    {
      "entity": "goodsShipment",
      "field": "processGoodsJava",
      "column": "Process_Goods_Java",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/processGoodsJava"
    },
    {
      "entity": "goodsShipment",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/posted"
    },
    {
      "entity": "goodsShipment",
      "field": "calculateFreight",
      "column": "Calculate_Freight",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/calculateFreight"
    },
    {
      "entity": "goodsShipment",
      "field": "invoicefromshipment",
      "column": "Invoicefromshipment",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/invoicefromshipment"
    },
    {
      "entity": "goodsShipment",
      "field": "receiveMaterials",
      "column": "RM_Receipt_PickEdit",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/receiveMaterials"
    },
    {
      "entity": "goodsShipment",
      "field": "updateLines",
      "column": "UpdateLines",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/updateLines"
    },
    {
      "entity": "goodsShipment",
      "field": "generateTo",
      "column": "GenerateTo",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/generateTo"
    },
    {
      "entity": "goodsShipment",
      "field": "sendMaterials",
      "column": "RM_Shipment_Pickedit",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/sendMaterials"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "explode",
      "column": "Explode",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/{id}/action/explode"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "managePrereservation",
      "column": "Manage_Prereservation",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/{id}/action/managePrereservation"
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
      "example": "_sortBy=goods-shipmentDate"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  }
};

// @sf-generated-start component:App
export default function App({ windowName, recordId, token, apiBaseUrl, window, ...rest }) {
  // @sf-custom-slot hooks:App
  return <GoodsShipmentPage windowName={windowName} recordId={recordId} token={token} apiBaseUrl={apiBaseUrl} window={window || windowMeta} api={api} {...rest} />;
}
// @sf-generated-end component:App

// @sf-custom-slot section:App-custom
