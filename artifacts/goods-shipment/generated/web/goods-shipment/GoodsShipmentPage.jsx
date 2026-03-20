import { ListView, DetailView } from '@/components/contract-ui';
import GoodsShipmentTable from './GoodsShipmentTable';
import GoodsShipmentForm from './GoodsShipmentForm';
import GoodsShipmentLineTable from './GoodsShipmentLineTable';
import GoodsShipmentLineForm from './GoodsShipmentLineForm';
import catalogs from './mockCatalogs';

const breadcrumb = 'Sales / Goods Shipment';

// @sf-generated-start summary:goodsShipment
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'salesOrder', column: 'C_Order_ID', type: 'string' },
  { key: 'isnettingshipment', column: 'Isnettingshipment', type: 'boolean' },
  { key: 'externalBusinessPartnerReference', column: 'Bpartner_Extref', type: 'string' },
  { key: 'invoiceStatus', column: 'InvoiceStatus', type: 'status' },
  { key: 'completelyInvoiced', column: 'Iscompletelyinvoiced', type: 'boolean' },
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
    { key: 'lineNo', column: 'Line', type: 'number', required: true, lookup: true },
    { key: 'product', column: 'M_Product_ID', type: 'search', reference: 'Product', inputMode: 'search' },
    { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text' },
    { key: 'operativeQuantity', column: 'Aumqty', type: 'text' },
    { key: 'operativeUOM', column: 'C_Aum', type: 'dependent', reference: 'UOM', inputMode: 'dependent', dependsOn: { field: 'product', filterKey: 'M_Product_ID' } },
    { key: 'movementQuantity', column: 'MovementQty', type: 'text', required: true },
    { key: 'storageBin', column: 'M_Locator_ID', type: 'dependent', reference: 'Locator', inputMode: 'dependent', dependsOn: { field: 'warehouse', filterKey: 'M_Warehouse_ID' } },
    { key: 'description', column: 'Description', type: 'textarea' },
    { key: 'project', column: 'C_Project_ID', type: 'search', reference: 'Project', inputMode: 'search' },
    { key: 'asset', column: 'A_Asset_ID', type: 'selector', reference: 'Asset', inputMode: 'selector' },
    { key: 'stDimension', column: 'User1_ID', type: 'selector', reference: 'User1', inputMode: 'selector' },
    { key: 'ndDimension', column: 'User2_ID', type: 'selector', reference: 'User2', inputMode: 'selector' },
    { key: 'explode', column: 'Explode', type: 'text', required: true },
  ],
  derived: [
    { key: 'costcenter', column: 'C_Costcenter_ID', type: 'selector', reference: 'Costcenter', inputMode: 'selector' },
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
        "documentNo",
        "warehouse",
        "businessPartner",
        "movementDate",
        "documentStatus",
        "orderReference"
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
      "inputMode": "selector",
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
      "field": "deliveryLocation",
      "column": "Delivery_Location_ID",
      "reference": "BPartner_Location",
      "inputMode": "dependent",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/deliveryLocation"
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
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "dependent",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/project"
    },
    {
      "entity": "goodsShipment",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/costcenter"
    },
    {
      "entity": "goodsShipment",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/asset"
    },
    {
      "entity": "goodsShipment",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/stDimension"
    },
    {
      "entity": "goodsShipment",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/ndDimension"
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
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "dependent",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/operativeUOM"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/uOM"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "inputMode": "dependent",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/storageBin"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "salesOrderLine",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/salesOrderLine"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/project"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "Costcenter",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/costcenter"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/asset"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "User1",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/stDimension"
    },
    {
      "entity": "goodsShipmentLine",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "User2",
      "inputMode": "selector",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/ndDimension"
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
      "field": "receiveMaterials",
      "column": "RM_Receipt_PickEdit",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/receiveMaterials"
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
        DetailForm={GoodsShipmentLineForm}
        summary={summary}
        statusField={statusField}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Goods Shipment"
        detailLabel="Lines"
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
      api={api}
      {...props}
    />
  );
}
// @sf-generated-end component:GoodsShipmentPage

// @sf-custom-slot section:GoodsShipmentPage-custom
