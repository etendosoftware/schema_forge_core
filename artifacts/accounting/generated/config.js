// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "accounting",
  "label": "Accounting",
  "icon": "Calculator",
  "route": "/accounting"
};

export const kpisConfig = [
  {
    "key": "totalRevenue",
    "label": "Total Revenue",
    "format": "currency",
    "trend": 12
  },
  {
    "key": "totalExpenses",
    "label": "Total Expenses",
    "format": "currency",
    "trend": 5
  },
  {
    "key": "netProfit",
    "label": "Net Profit",
    "format": "currency",
    "trend": 22
  },
  {
    "key": "cashPosition",
    "label": "Cash Position",
    "format": "currency",
    "trend": 8
  }
];

export const sections = {
  "salesInvoices": {
    "type": "data-table",
    "label": "Recent Sales Invoices",
    "columns": [
      {
        "key": "invoiceNo",
        "label": "Invoice No"
      },
      {
        "key": "customer",
        "label": "Customer"
      },
      {
        "key": "date",
        "label": "Date"
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
      }
    ]
  },
  "purchaseInvoices": {
    "type": "data-table",
    "label": "Recent Purchase Invoices",
    "columns": [
      {
        "key": "invoiceNo",
        "label": "Invoice No"
      },
      {
        "key": "vendor",
        "label": "Vendor"
      },
      {
        "key": "date",
        "label": "Date"
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
      }
    ]
  },
  "bankSummary": {
    "type": "data-table",
    "label": "Bank Accounts Summary",
    "columns": [
      {
        "key": "account",
        "label": "Account"
      },
      {
        "key": "bank",
        "label": "Bank"
      },
      {
        "key": "balance",
        "label": "Balance",
        "type": "currency"
      },
      {
        "key": "lastTransaction",
        "label": "Last Transaction"
      }
    ]
  },
  "taxSummary": {
    "type": "data-table",
    "label": "Tax Obligations",
    "columns": [
      {
        "key": "taxType",
        "label": "Tax Type"
      },
      {
        "key": "period",
        "label": "Period"
      },
      {
        "key": "amount",
        "label": "Amount",
        "type": "currency"
      },
      {
        "key": "dueDate",
        "label": "Due Date"
      },
      {
        "key": "status",
        "label": "Status",
        "type": "status"
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
    "section": "salesInvoices",
    "width": "2/3"
  },
  {
    "section": "purchaseInvoices",
    "width": "1/3"
  },
  {
    "section": "bankSummary",
    "width": "2/3"
  },
  {
    "section": "taxSummary",
    "width": "1/3"
  }
];

export const actions = [
  {
    "label": "Sales Invoices",
    "route": "/sales-invoice",
    "variant": "outline"
  },
  {
    "label": "Purchase Invoices",
    "route": "/purchase-invoice",
    "variant": "outline"
  },
  {
    "label": "Payments",
    "route": "/payment-in",
    "variant": "default"
  }
];
