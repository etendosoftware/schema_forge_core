// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "purchases",
  "label": "Purchases",
  "icon": "Truck",
  "route": "/purchases"
};

export const kpisConfig = [
  {
    "key": "totalOrdered",
    "label": "Total Ordered",
    "format": "currency",
    "icon": "FileText"
  },
  {
    "key": "receivedOnTime",
    "label": "Received On Time",
    "format": "percent",
    "icon": "Truck"
  },
  {
    "key": "pendingInvoices",
    "label": "Pending Invoices",
    "format": "number"
  },
  {
    "key": "overdue",
    "label": "Overdue",
    "format": "currency"
  }
];

export const sections = {
  "pipeline": {
    "type": "kanban",
    "label": "Pipeline",
    "columns": [
      {
        "id": "draft",
        "title": "Draft",
        "color": "gray"
      },
      {
        "id": "confirmed",
        "title": "Confirmed",
        "color": "blue"
      },
      {
        "id": "in-transit",
        "title": "In Transit",
        "color": "yellow"
      },
      {
        "id": "received",
        "title": "Received",
        "color": "green"
      },
      {
        "id": "invoiced",
        "title": "Invoiced",
        "color": "purple"
      }
    ]
  },
  "orders": {
    "type": "data-table",
    "label": "Purchase Orders",
    "columns": [
      {
        "key": "docNo",
        "label": "Doc No"
      },
      {
        "key": "vendor",
        "label": "Vendor"
      },
      {
        "key": "amount",
        "label": "Amount",
        "type": "currency"
      },
      {
        "key": "status",
        "label": "Status",
        "type": "status"
      },
      {
        "key": "date",
        "label": "Date"
      }
    ]
  }
};

export const layout = [
  {
    "section": "kpi-header",
    "width": "full"
  },
  {
    "section": "pipeline",
    "width": "full"
  },
  {
    "section": "orders",
    "width": "full"
  }
];

export const actions = [
  {
    "label": "+ New PO",
    "route": "/purchase-order",
    "variant": "default"
  }
];
