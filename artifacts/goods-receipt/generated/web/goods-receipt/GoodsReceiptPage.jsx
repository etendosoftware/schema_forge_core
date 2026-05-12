import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import GoodsReceiptTable from './GoodsReceiptTable';
import GoodsReceiptForm from './GoodsReceiptForm';
import GoodsReceiptLineTable from './GoodsReceiptLineTable';
import GoodsReceiptLineForm from './GoodsReceiptLineForm';
import RelatedDocuments from '@/windows/custom/goods-receipt/RelatedDocuments';
import { AttachmentsTab } from '@/components/attachments';
import GoodsReceiptBottomPanel from '../../../custom/GoodsReceiptBottomPanel';
import catalogs from './mockCatalogs';


const breadcrumb = 'Purchases / Goods Receipt';


// @sf-generated-start summary:goodsReceipt
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
];

const statusField = 'documentStatus';
// @sf-generated-end summary:goodsReceipt

// @sf-generated-start extraBadges:goodsReceipt
const extraBadges = [];
// @sf-generated-end extraBadges:goodsReceipt

// @sf-generated-start processes:goodsReceipt
const processes = [

];
// @sf-generated-end processes:goodsReceipt

// @sf-generated-start draftMode:goodsReceipt
const draftMode = {
  "enabled": true,
  "processField": "documentAction",
  "processValue": "CO",
  "label": "Confirmar"
};
// @sf-generated-end draftMode:goodsReceipt

// @sf-generated-start requiredHeaderFields:goodsReceipt
const requiredHeaderFields = ['documentNo', 'warehouse', 'businessPartner', 'partnerAddress', 'movementDate'];
// @sf-generated-end requiredHeaderFields:goodsReceipt

// @sf-generated-start addLineFields:goodsReceiptLine
const addLineFields = {
  entry: [
    { key: 'product', column: 'M_Product_ID', type: 'search', lookup: true, label: 'Product', reference: 'Product', inputMode: 'search' },
    { key: 'attributeSetValue', column: 'M_AttributeSetInstance_ID', type: 'text', label: 'Attribute Set Value' },
    { key: 'movementQuantity', column: 'MovementQty', type: 'number', required: true, label: 'Movement Quantity', defaultValue: 0 },
    { key: 'storageBin', column: 'M_Locator_ID', type: 'selector', label: 'Storage Bin', reference: 'Locator', inputMode: 'selector', defaultValue: '@OnHandLocatorDefault@' },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
  ],
  derived: [

  ],
  hidden: [
    { key: 'invoiceQuantity', value: '0' },
  ],
};
// @sf-generated-end addLineFields:goodsReceiptLine

export const api = {
  "specName": "goods-receipt",
  "baseUrl": "/sws/neo/goods-receipt",
  "crud": {
    "goodsReceipt": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/goods-receipt/goodsReceipt",
      "detailUrl": "/sws/neo/goods-receipt/goodsReceipt/{id}",
      "supportedFilters": [
        "documentNo",
        "businessPartner",
        "movementDate",
        "orderReference",
        "documentStatus"
      ]
    },
    "goodsReceiptLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/goods-receipt/goodsReceiptLine",
      "detailUrl": "/sws/neo/goods-receipt/goodsReceiptLine/{id}",
      "supportedFilters": []
    }
  },
  "selectors": [
    {
      "entity": "goodsReceipt",
      "field": "warehouse",
      "column": "M_Warehouse_ID",
      "reference": "Warehouse",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/warehouse"
    },
    {
      "entity": "goodsReceipt",
      "field": "businessPartner",
      "column": "C_BPartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/businessPartner"
    },
    {
      "entity": "goodsReceipt",
      "field": "partnerAddress",
      "column": "C_BPartner_Location_ID",
      "reference": "BusinessPartnerLocation",
      "inputMode": "dependent",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/partnerAddress",
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
      "entity": "goodsReceipt",
      "field": "salesOrder",
      "column": "C_Order_ID",
      "reference": "Order",
      "inputMode": "search",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/salesOrder"
    },
    {
      "entity": "goodsReceipt",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/project",
      "context": {
        "required": [
          {
            "param": "IsSOTrx",
            "source": "windowCategory"
          },
          {
            "param": "C_BPartner_ID",
            "source": "parentField",
            "field": "businessPartner"
          }
        ]
      }
    },
    {
      "entity": "goodsReceipt",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/costcenter"
    },
    {
      "entity": "goodsReceipt",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/asset"
    },
    {
      "entity": "goodsReceipt",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "UserDimension1",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/stDimension"
    },
    {
      "entity": "goodsReceipt",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "UserDimension2",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceipt/selectors/ndDimension"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/product"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "operativeUOM",
      "column": "C_Aum",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/operativeUOM",
      "context": {
        "required": [
          {
            "param": "IsSOTrx",
            "source": "windowCategory"
          }
        ]
      }
    },
    {
      "entity": "goodsReceiptLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/uOM"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/storageBin"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "salesOrderLine",
      "column": "C_OrderLine_ID",
      "reference": "OrderLine",
      "inputMode": "search",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/salesOrderLine"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "businessPartner",
      "column": "C_Bpartner_ID",
      "reference": "BusinessPartner",
      "inputMode": "search",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/businessPartner"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "project",
      "column": "C_Project_ID",
      "reference": "Project",
      "inputMode": "search",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/project"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "costcenter",
      "column": "C_Costcenter_ID",
      "reference": "CostCenter",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/costcenter"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "asset",
      "column": "A_Asset_ID",
      "reference": "Asset",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/asset"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "stDimension",
      "column": "User1_ID",
      "reference": "UserDimension1",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/stDimension"
    },
    {
      "entity": "goodsReceiptLine",
      "field": "ndDimension",
      "column": "User2_ID",
      "reference": "UserDimension2",
      "inputMode": "selector",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/selectors/ndDimension"
    }
  ],
  "actions": [
    {
      "name": "createLinesFrom",
      "entity": "goodsReceipt",
      "column": "CreateFrom",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/createLinesFrom"
    },
    {
      "name": "generateTo",
      "entity": "goodsReceipt",
      "column": "GenerateTo",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/generateTo",
      "processId": "154",
      "processType": "classic"
    },
    {
      "name": "documentAction",
      "entity": "goodsReceipt",
      "column": "DocAction",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/documentAction",
      "processId": "109",
      "processType": "classic"
    },
    {
      "name": "processGoodsJava",
      "entity": "goodsReceipt",
      "column": "Process_Goods_Java",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/processGoodsJava",
      "processId": "49DEE812BF0545269781FCEBF2235924",
      "processType": "classic"
    },
    {
      "name": "posted",
      "entity": "goodsReceipt",
      "column": "Posted",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/posted"
    },
    {
      "name": "calculateFreight",
      "entity": "goodsReceipt",
      "column": "Calculate_Freight",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/calculateFreight",
      "processId": "800141",
      "processType": "classic"
    },
    {
      "name": "receiveMaterials",
      "entity": "goodsReceipt",
      "column": "RM_Receipt_PickEdit",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/receiveMaterials",
      "processId": "5E9F9D7EECC24E4FBB2C60840FF613BE",
      "processType": "obuiapp"
    },
    {
      "name": "updateLines",
      "entity": "goodsReceipt",
      "column": "UpdateLines",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/updateLines",
      "processId": "800010",
      "processType": "classic"
    },
    {
      "name": "sendMaterials",
      "entity": "goodsReceipt",
      "column": "RM_Shipment_Pickedit",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/sendMaterials",
      "processId": "4AD70293357245AB96E59C2CDB43A35D",
      "processType": "obuiapp"
    },
    {
      "name": "invoicefromshipment",
      "entity": "goodsReceipt",
      "column": "Invoicefromshipment",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceipt/{id}/action/invoicefromshipment",
      "processId": "62250E8866EA4D96A66C309878DC039E",
      "processType": "obuiapp"
    },
    {
      "name": "managePrereservation",
      "entity": "goodsReceiptLine",
      "column": "Manage_Prereservation",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/{id}/action/managePrereservation",
      "processId": "70E42AD47E5F4698A9ACCCAF3EB72B9E",
      "processType": "obuiapp"
    },
    {
      "name": "explode",
      "entity": "goodsReceiptLine",
      "column": "Explode",
      "requiresRecord": true,
      "method": "POST",
      "url": "/sws/neo/goods-receipt/goodsReceiptLine/{id}/action/explode",
      "processId": "DAE719940FE9463F8A3E3C401BBAFC53",
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
      "example": "_sortBy=creationDate desc"
    },
    "filtering": "Use field name as query param: ?fieldName=value",
    "parentFilter": "parentId={id} for child entities"
  },
  "window": {
    "category": "purchases"
  }
};

// @sf-generated-start component:GoodsReceiptPage
export default function GoodsReceiptPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="goodsReceipt"
        detailEntity="goodsReceiptLine"
        Form={GoodsReceiptForm}
        DetailTable={GoodsReceiptLineTable}
        DetailForm={GoodsReceiptLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Goods Receipt"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        customTabs={[{ key: 'related', label: 'Related Documents', Component: RelatedDocuments }, { key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "M_InOut", config: {} } }]}
        bottomSection={GoodsReceiptBottomPanel}
        draftMode={draftMode}
        requiredHeaderFields={requiredHeaderFields}
        linesLayout="inlineEditable"
        sendDocument={{"enabled":true,"allowEmail":false}}
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="goodsReceipt"
      Table={GoodsReceiptTable}
      entityLabel="Goods Receipt"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="movementDate"
      rowQuickActions={{}}
      sendDocument={{"enabled":true,"allowEmail":false}}
      {...props}
    />
  );
}
// @sf-generated-end component:GoodsReceiptPage
