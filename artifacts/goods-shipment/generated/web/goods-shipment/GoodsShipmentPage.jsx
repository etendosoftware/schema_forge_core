import { ListView, DetailView } from '@/components/contract-ui';
import GoodsShipmentTable from './GoodsShipmentTable';
import GoodsShipmentForm from './GoodsShipmentForm';
import GoodsShipmentLineTable from './GoodsShipmentLineTable';
import GoodsShipmentLineForm from './GoodsShipmentLineForm';
import catalogs from './mockCatalogs';
import RelatedDocuments from './RelatedDocuments';


const breadcrumb = 'Sales / Goods Shipment';

// @sf-generated-start summary:goodsShipment
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:goodsShipment

// @sf-custom-slot extraBadges:goodsShipment
// @sf-generated-start extraBadges:goodsShipment
const extraBadges = [];
// @sf-generated-end extraBadges:goodsShipment

// @sf-generated-start processes:goodsShipment
const processes = [
  { name: 'Process Shipment', label: 'Process  Shipment', style: 'positive' },
];
// @sf-generated-end processes:goodsShipment

// @sf-generated-start addLineFields:goodsShipmentLine
const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true, lookup: true, label: 'Line No.' },
    { key: 'product', column: 'M_Product_ID', type: 'search', label: 'Product', reference: 'Product', inputMode: 'search' },
    { key: 'movementQuantity', column: 'MovementQty', type: 'text', required: true, label: 'Movement Quantity' },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
  ],
  derived: [

  ],
  hidden: [

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
        extraBadges={extraBadges}
        processes={processes}
        documentPreview={{ titlePrefix: 'Shipment', pdfUrl: null }}
        customTabs={[
          { key: 'related', label: 'Related Documents', Component: RelatedDocuments },
        ]}
        notesField="description"
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
