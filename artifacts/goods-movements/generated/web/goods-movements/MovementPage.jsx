import { useEffect } from 'react';
import { ListView, DetailView } from '@/components/contract-ui';
import { toast } from 'sonner';
import MovementTable from './MovementTable';
import MovementForm from './MovementForm';
import MovementLineTable from './MovementLineTable';
import MovementLineForm from './MovementLineForm';
import { AttachmentsTab } from '@/components/attachments';
import GoodsMovementsBottomPanel from '../../../custom/GoodsMovementsBottomPanel';
import catalogs from './mockCatalogs';

import { useUI } from '@/i18n';
import { BookOpen } from 'lucide-react';

const breadcrumb = 'Inventory / Goods Movements';

// @sf-generated-start statusBar:movement
function MovementStatusBar({ data }) {
  const ui = useUI();
  if (!data) return null;
  const fmt = (v) => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const colorMap = {
    blue:   { bg: 'bg-blue-100',   border: 'border-l-blue-500',    text: 'text-blue-800',    sub: 'text-blue-500',    icon: 'text-blue-500',    bar: 'bg-blue-500',    barTrack: 'bg-blue-200'    },
    teal:   { bg: 'bg-teal-50',    border: 'border-l-teal-500',    text: 'text-teal-800',    sub: 'text-teal-500',    icon: 'text-teal-500',    bar: 'bg-teal-500',    barTrack: 'bg-teal-200'    },
    orange: { bg: 'bg-orange-50',  border: 'border-l-orange-500',  text: 'text-orange-700',  sub: 'text-orange-500',  icon: 'text-orange-500',  bar: 'bg-orange-500',  barTrack: 'bg-orange-200'  },
    green:  { bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-800', sub: 'text-emerald-500', icon: 'text-emerald-500', bar: 'bg-emerald-500', barTrack: 'bg-emerald-200' },
  };
  const cards = [
    { label: ui('accountingStatus'), value: ((data.posted === true || data.posted === 'Y') ? ui('postedStatus') : (data.posted === false || data.posted === 'N') ? ui('notPostedStatus') : '—'), color: ((data.posted === true || data.posted === 'Y') ? 'green' : 'orange'),  Icon: BookOpen },
  ];
  return (
    <div className="flex flex-wrap gap-3 pt-2 pb-3 mb-2 border-b border-gray-100">
      {cards.map(({ label, value, color, Icon }) => {
        const c = colorMap[color];
        return (
          <div key={label} className={`flex items-center gap-3 ${c.bg} border-l-4 ${c.border} rounded-lg px-4 py-2.5 min-w-[160px]`}>
            <Icon size={18} className={c.icon} />
            <div>
              <div className={`text-lg font-semibold leading-tight ${c.text}`}>{value}</div>
              <div className={`text-xs ${c.sub} mt-0.5`}>{ui(label)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
// @sf-generated-end statusBar:movement


// @sf-generated-start summary:movement
const summary = [
  { key: 'documentNo', column: 'DocumentNo', type: 'string' },
];

const statusField = 'processed';
// @sf-generated-end summary:movement

// @sf-generated-start extraBadges:movement
const extraBadges = [];
// @sf-generated-end extraBadges:movement

// @sf-generated-start processes:movement
const processes = [
  { name: 'processNow', label: 'Process Movements', style: 'positive',
    displayLogicRaw: "@Processed@='N'", requiresLines: true },
];
// @sf-generated-end processes:movement

// @sf-generated-start draftMode:movement
const draftMode = null;
// @sf-generated-end draftMode:movement

// @sf-generated-start requiredHeaderFields:movement
const requiredHeaderFields = ['name', 'movementDate', 'documentNo'];
// @sf-generated-end requiredHeaderFields:movement

// @sf-generated-start addLineFields:movementLine
const addLineFields = {
  entry: [
    { key: 'lineNo', column: 'Line', type: 'number', required: true, label: 'Line No.', defaultValue: '@SQL=SELECT COALESCE(MAX(Line),0)+10 AS DefaultValue FROM M_MovementLine WHERE M_Movement_ID=@M_Movement_ID@' },
    { key: 'product', column: 'M_Product_ID', type: 'search', required: true, lookup: true, label: 'Product', reference: 'Product', inputMode: 'search' },
    { key: 'description', column: 'Description', type: 'textarea', label: 'Description' },
    { key: 'movementQuantity', column: 'MovementQty', type: 'number', required: true, label: 'Movement Quantity', defaultValue: 1 },
    { key: 'storageBin', column: 'M_Locator_ID', type: 'selector', required: true, label: 'Storage Bin', reference: 'Locator', inputMode: 'selector' },
    { key: 'newStorageBin', column: 'M_LocatorTo_ID', type: 'selector', required: true, label: 'New Storage Bin', reference: 'Locator', inputMode: 'selector' },
  ],
  derived: [

  ],
  hidden: [

  ],
};
// @sf-generated-end addLineFields:movementLine

export const api = {
  "specName": "goods-movements",
  "baseUrl": "/sws/neo/goods-movements",
  "crud": {
    "movement": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/goods-movements/movement",
      "detailUrl": "/sws/neo/goods-movements/movement/{id}",
      "supportedFilters": [
        "name",
        "movementDate"
      ]
    },
    "movementLine": {
      "get": true,
      "getById": true,
      "post": true,
      "put": true,
      "patch": true,
      "delete": true,
      "listUrl": "/sws/neo/goods-movements/movementLine",
      "detailUrl": "/sws/neo/goods-movements/movementLine/{id}",
      "supportedFilters": [
        "product"
      ]
    }
  },
  "selectors": [
    {
      "entity": "movementLine",
      "field": "product",
      "column": "M_Product_ID",
      "reference": "Product",
      "inputMode": "search",
      "url": "/sws/neo/goods-movements/movementLine/selectors/product"
    },
    {
      "entity": "movementLine",
      "field": "uOM",
      "column": "C_UOM_ID",
      "reference": "UOM",
      "inputMode": "selector",
      "url": "/sws/neo/goods-movements/movementLine/selectors/uOM"
    },
    {
      "entity": "movementLine",
      "field": "storageBin",
      "column": "M_Locator_ID",
      "reference": "Locator",
      "inputMode": "selector",
      "url": "/sws/neo/goods-movements/movementLine/selectors/storageBin"
    },
    {
      "entity": "movementLine",
      "field": "newStorageBin",
      "column": "M_LocatorTo_ID",
      "reference": "Locator",
      "inputMode": "selector",
      "url": "/sws/neo/goods-movements/movementLine/selectors/newStorageBin"
    }
  ],
  "actions": [
    {
      "entity": "movement",
      "field": "moveBetweenLocators",
      "column": "Move_FromTo_Locator",
      "url": "/sws/neo/goods-movements/movement/{id}/action/moveBetweenLocators",
      "processId": "800048",
      "processType": "classic"
    },
    {
      "entity": "movement",
      "field": "processNow",
      "column": "Processing",
      "url": "/sws/neo/goods-movements/movement/{id}/action/processNow",
      "processId": "122",
      "processType": "classic"
    },
    {
      "entity": "movement",
      "field": "posted",
      "column": "Posted",
      "url": "/sws/neo/goods-movements/movement/{id}/action/posted"
    },
    {
      "entity": "movement",
      "field": "etblkpBulkposting",
      "column": "EM_Etblkp_Bulkposting",
      "url": "/sws/neo/goods-movements/movement/{id}/action/etblkpBulkposting",
      "processId": "57496FB9CF9E4E8F847224017941570E",
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
    "category": "inventory"
  }
};

// @sf-generated-start component:MovementPage
export default function MovementPage({ windowName, recordId, ...props }) {
  if (recordId) {
    return (
      <DetailView
        entity="movement"
        detailEntity="movementLine"
        Form={MovementForm}
        DetailTable={MovementLineTable}
        DetailForm={MovementLineForm}
        summary={summary}
        statusField={statusField}
        extraBadges={extraBadges}
        processes={processes}
        addLineFields={addLineFields}
        catalogs={catalogs}
        entityLabel="Movement"
        detailLabel="Lines"
        windowName={windowName}
        recordId={recordId}
        breadcrumb={breadcrumb}
      api={api}
        customTabs={[{ key: 'attachments', labelKey: 'attachments', Component: AttachmentsTab, placement: 'tab', props: { tableName: "M_Movement", config: {} } }]}
        bottomSection={GoodsMovementsBottomPanel}
        menuActions={({ data, status }) => [
          { key: 'post', label: 'Post', visible: !(data?.posted === 'Y' || data?.posted === true) && (data?.processed === 'Y' || data?.processed === true), labelKey: 'post', successKey: 'documentPosted', neoAction: 'post',  },
          { key: 'unpost', label: 'Unpost', destructive: true, visible: (data?.posted === 'Y' || data?.posted === true), labelKey: 'unpost', successKey: 'documentUnposted', neoAction: 'unpost',  }
        ]}
        requiredHeaderFields={requiredHeaderFields}
        headerContent={(data) => <MovementStatusBar data={data} />}
        linesLayout="inlineEditable"
        sendDocument
        {...props}
      />
    );
  }

  return (
    <ListView
      entity="movement"
      Table={MovementTable}
      entityLabel="Goods Movements"
      windowName={windowName}
      breadcrumb={breadcrumb}
      api={api}
      dateFilterKey="movementDate"
      rowQuickActions={{}}
      sendDocument
      {...props}
    />
  );
}
// @sf-generated-end component:MovementPage
