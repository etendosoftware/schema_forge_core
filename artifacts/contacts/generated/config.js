// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "contacts",
  "label": "Contacts",
  "icon": "Users",
  "route": "/contacts"
};

export const kpisConfig = [];

export const sections = {
  "kpis": {
    "type": "kpi",
    "kpis": [
      {
        "key": "totalContacts",
        "label": "Total Contacts",
        "format": "number",
        "icon": "Users"
      },
      {
        "key": "customers",
        "label": "Customers",
        "format": "number"
      },
      {
        "key": "vendors",
        "label": "Vendors",
        "format": "number"
      },
      {
        "key": "pendingBalance",
        "label": "Pending Balance",
        "format": "currency"
      }
    ]
  },
  "directory": {
    "type": "kanban",
    "columns": [
      {
        "id": "customer",
        "title": "Customers",
        "color": "blue"
      },
      {
        "id": "vendor",
        "title": "Vendors",
        "color": "green"
      },
      {
        "id": "both",
        "title": "Customer & Vendor",
        "color": "purple"
      },
      {
        "id": "prospect",
        "title": "Prospects",
        "color": "yellow"
      }
    ]
  },
  "contactList": {
    "type": "data-table",
    "columns": [
      {
        "key": "name",
        "label": "Name",
        "align": "left"
      },
      {
        "key": "category",
        "label": "Category",
        "align": "left"
      },
      {
        "key": "location",
        "label": "Location",
        "align": "left"
      },
      {
        "key": "email",
        "label": "Email",
        "align": "left"
      },
      {
        "key": "totalInvoiced",
        "label": "Total Invoiced",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "pendingBalance",
        "label": "Pending Balance",
        "align": "right",
        "format": "currency"
      }
    ]
  },
  "notes": {
    "type": "chatter",
    "entityType": "contact"
  }
};

export const layout = [
  {
    "section": "kpis",
    "span": "full"
  },
  {
    "section": "directory",
    "span": "full"
  },
  {
    "section": "contactList",
    "span": "full"
  },
  {
    "section": "notes",
    "span": "1/3"
  }
];

export const actions = [
  {
    "label": "+ New Contact",
    "route": "/business-partner",
    "default": true
  }
];
