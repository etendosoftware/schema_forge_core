// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "inventory",
  "label": "Inventory",
  "icon": "Package",
  "route": "/inventory"
};

export const kpisConfig = [
  {
    "key": "totalSkus",
    "label": "Total SKUs",
    "format": "number",
    "icon": "Package"
  },
  {
    "key": "stockValue",
    "label": "Stock Value",
    "format": "currency"
  },
  {
    "key": "lowStockAlerts",
    "label": "Low Stock Alerts",
    "format": "number",
    "icon": "AlertTriangle"
  },
  {
    "key": "movementsToday",
    "label": "Movements Today",
    "format": "number"
  }
];

export const sections = {
  "stock-levels": {
    "type": "data-table",
    "label": "Stock Levels",
    "columns": [
      {
        "key": "sku",
        "label": "SKU"
      },
      {
        "key": "name",
        "label": "Product Name"
      },
      {
        "key": "warehouse",
        "label": "Warehouse"
      },
      {
        "key": "available",
        "label": "Available",
        "type": "amount"
      },
      {
        "key": "reserved",
        "label": "Reserved",
        "type": "amount"
      },
      {
        "key": "minimum",
        "label": "Minimum",
        "type": "amount"
      },
      {
        "key": "status",
        "label": "Status",
        "type": "status"
      }
    ],
    "filters": [
      "name",
      "warehouse"
    ]
  },
  "low-stock": {
    "type": "alerts",
    "label": "Low Stock Alerts",
    "severities": [
      "red",
      "amber"
    ],
    "fields": {
      "label": "name",
      "current": "current",
      "threshold": "minimum"
    }
  },
  "recent-movements": {
    "type": "activity-feed",
    "label": "Recent Movements",
    "fields": {
      "direction": "direction",
      "label": "product",
      "detail": "qty",
      "location": "warehouse",
      "time": "time"
    }
  }
};

export const layout = [
  {
    "section": "kpi-header",
    "width": "full"
  },
  {
    "section": "stock-levels",
    "width": "2/3"
  },
  {
    "section": "low-stock",
    "width": "1/3"
  },
  {
    "section": "recent-movements",
    "width": "1/3"
  }
];

export const actions = [
  {
    "label": "Physical Inventory",
    "route": "/physical-inventory",
    "variant": "outline"
  },
  {
    "label": "Goods Movements",
    "route": "/goods-movements",
    "variant": "default"
  }
];
