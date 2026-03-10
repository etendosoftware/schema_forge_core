// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "sales",
  "label": "Sales",
  "icon": "ShoppingCart",
  "route": "/sales"
};

export const kpisConfig = [];

export const sections = {
  "kpis": {
    "type": "kpi",
    "kpis": [
      {
        "key": "totalQuoted",
        "label": "Total Quoted",
        "format": "currency",
        "icon": "FileText"
      },
      {
        "key": "totalInvoiced",
        "label": "Total Invoiced",
        "format": "currency",
        "icon": "TrendingUp"
      },
      {
        "key": "pendingCollection",
        "label": "Pending Collection",
        "format": "currency",
        "icon": "ShoppingCart"
      },
      {
        "key": "ordersThisMonth",
        "label": "Orders This Month",
        "format": "number"
      }
    ]
  },
  "pipeline": {
    "type": "kanban",
    "columns": [
      {
        "id": "draft",
        "title": "Draft",
        "color": "gray"
      },
      {
        "id": "sent",
        "title": "Sent",
        "color": "blue"
      },
      {
        "id": "negotiation",
        "title": "Negotiation",
        "color": "yellow"
      },
      {
        "id": "won",
        "title": "Won",
        "color": "green"
      },
      {
        "id": "lost",
        "title": "Lost",
        "color": "red"
      }
    ]
  },
  "quotations": {
    "type": "data-table",
    "columns": [
      {
        "key": "documentNo",
        "label": "Document No",
        "align": "left"
      },
      {
        "key": "customer",
        "label": "Customer",
        "align": "left"
      },
      {
        "key": "amount",
        "label": "Amount",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "status",
        "label": "Status",
        "align": "left"
      },
      {
        "key": "date",
        "label": "Date",
        "align": "left"
      }
    ]
  }
};

export const layout = [
  {
    "section": "kpis",
    "span": "full"
  },
  {
    "section": "pipeline",
    "span": "full"
  },
  {
    "section": "quotations",
    "span": "full"
  }
];

export const actions = [
  {
    "label": "+ New Quotation",
    "route": "/sales-quotation",
    "default": true
  }
];
