import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import GoodsShipmentTable from './GoodsShipmentTable';
import GoodsShipmentForm from './GoodsShipmentForm';
import GoodsShipmentLineTable from './GoodsShipmentLineTable';
import GoodsShipmentLineForm from './GoodsShipmentLineForm';
import RelatedDocuments from '../../../custom/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import GoodsShipmentBottomPanel from '../../../custom/GoodsShipmentBottomPanel';
import GoodsShipmentActions from '../../../custom/GoodsShipmentActions';
import BulkInvoiceFromShipment from '../../../custom/BulkInvoiceFromShipment';
import catalogs from './mockCatalogs';


const breadcrumb = 'Sales / Goods Shipment';


// @sf-generated-start summary:goodsShipment
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
  { key: 'invoiced', column: 'Iscompletelyinvoiced', type: 'boolean' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:goodsShipment

// @sf-generated-start extraBadges:goodsShipment
const extraBadges = [];
// @sf-generated-end extraBadges:goodsShipment

// @sf-generated-start processes:goodsShipment
const processes = [

];
// @sf-generated-end processes:goodsShipment

// @sf-generated-start draftMode:goodsShipment
const draftMode = null;
// @sf-generated-end draftMode:goodsShipment

// @sf-generated-start requiredHeaderFields:goodsShipment
const requiredHeaderFields = ['documentNo', 'warehouse', 'businessPartner', 'partnerAddress', 'movementDate', 'invoiced'];
// @sf-generated-end requiredHeaderFields:goodsShipment

// @sf-generated-start addLineFields:goodsShipmentLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', lookup: true, label: 'Product', reference: 'Product', inputMode: 'search' },
    { key: 'movementQuantity', column: 'MovementQty', type: 'number', required: true, label: 'Movement Quantity', defaultValue: 0 },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
  ],
  derived: [

  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:goodsShipmentLine

export const api = {
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
      "url": "/sws/neo/goods-shipment/goodsShipment/selectors/partnerAddress",
      "context": {
        "required": [
          {
            "param": "C_BPartner_ID",
            "source": "field",
            "field": "businessPartner"
          }
        ]
      }
    },
    {
      "entity": "goodsShipmentLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/selectors/product"
    }
  ],
  "actions": [
    {
      "name": "createLinesFrom",
      "entity": "goodsShipment",
      "column": "CreateFrom",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/createLinesFrom"
    },
    {
      "name": "processGoodsJava",
      "entity": "goodsShipment",
      "column": "Process_Goods_Java",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/processGoodsJava",
      "processId": "49DEE812BF0545269781FCEBF2235924",
      "processType": "classic"
    },
    {
      "name": "documentAction",
      "entity": "goodsShipment",
      "column": "DocAction",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/documentAction",
      "processId": "109",
      "processType": "classic"
    },
    {
      "name": "posted",
      "entity": "goodsShipment",
      "column": "Posted",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/posted"
    },
    {
      "name": "calculateFreight",
      "entity": "goodsShipment",
      "column": "Calculate_Freight",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/calculateFreight",
      "processId": "800141",
      "processType": "classic"
    },
    {
      "name": "invoicefromshipment",
      "entity": "goodsShipment",
      "column": "Invoicefromshipment",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/invoicefromshipment",
      "processId": "62250E8866EA4D96A66C309878DC039E",
      "processType": "obuiapp"
    },
    {
      "name": "generateTo",
      "entity": "goodsShipment",
      "column": "GenerateTo",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/generateTo",
      "processId": "154",
      "processType": "classic"
    },
    {
      "name": "updateLines",
      "entity": "goodsShipment",
      "column": "UpdateLines",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/updateLines",
      "processId": "800010",
      "processType": "classic"
    },
    {
      "name": "receiveMaterials",
      "entity": "goodsShipment",
      "column": "RM_Receipt_PickEdit",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/receiveMaterials",
      "processId": "5E9F9D7EECC24E4FBB2C60840FF613BE",
      "processType": "obuiapp"
    },
    {
      "name": "sendMaterials",
      "entity": "goodsShipment",
      "column": "RM_Shipment_Pickedit",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipment/{id}/action/sendMaterials",
      "processId": "4AD70293357245AB96E59C2CDB43A35D",
      "processType": "obuiapp"
    },
    {
      "name": "explode",
      "entity": "goodsShipmentLine",
      "column": "Explode",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/{id}/action/explode",
      "processId": "DAE719940FE9463F8A3E3C401BBAFC53",
      "processType": "classic"
    },
    {
      "name": "managePrereservation",
      "entity": "goodsShipmentLine",
      "column": "Manage_Prereservation",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-shipment/goodsShipmentLine/{id}/action/managePrereservation",
      "processId": "70E42AD47E5F4698A9ACCCAF3EB72B9E",
      "processType": "obuiapp"
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
      "example": "_sortBy=creationDate desc"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  },
  "window": {
    "category": "sales"
  }
};

// @sf-generated-start component:GoodsShipmentPage
export default function GoodsShipmentPage({ windowName, recordId, ...props }) {
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
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Goods Shipment"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        hideDeleteWhenComplete
        hidePrint
        noHeaderBorder
        notesField="description"
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "M_InOut", config: {} } }]}
        bottomSection={GoodsShipmentBottomPanel}
        topbarRight={GoodsShipmentActions}
        requiredHeaderFields={requiredHeaderFields}
        salesTheme
        linesLayout="inlineEditable"
        sendDocument
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="goodsShipment"
      Table={GoodsShipmentTable}
      entityLabel="Goods Shipment"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="movementDate"
      bulkActions={(ctx) => <BulkInvoiceFromShipment {...ctx} />}
      hidePrint
      rowQuickActions={{}}
      sendDocument
      {...props}
    />
  );
}
// @sf-generated-end component:GoodsShipmentPage
