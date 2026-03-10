// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "reports",
  "label": "Reports",
  "icon": "BarChart3",
  "route": "/reports"
};

export const kpisConfig = [];

export const sections = {
  "balanceSheet": {
    "type": "data-table",
    "columns": [
      {
        "key": "category",
        "label": "Category",
        "align": "left"
      },
      {
        "key": "account",
        "label": "Account",
        "align": "left"
      },
      {
        "key": "amount",
        "label": "Amount",
        "align": "right",
        "format": "currency"
      }
    ]
  },
  "profitLoss": {
    "type": "data-table",
    "columns": [
      {
        "key": "category",
        "label": "Category",
        "align": "left"
      },
      {
        "key": "description",
        "label": "Description",
        "align": "left"
      },
      {
        "key": "amount",
        "label": "Amount",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "percentage",
        "label": "%",
        "align": "right",
        "format": "number"
      }
    ]
  },
  "agingReceivable": {
    "type": "data-table",
    "columns": [
      {
        "key": "customer",
        "label": "Customer",
        "align": "left"
      },
      {
        "key": "current",
        "label": "Current",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "days30",
        "label": "1-30 Days",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "days60",
        "label": "31-60 Days",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "days90plus",
        "label": "90+ Days",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "total",
        "label": "Total",
        "align": "right",
        "format": "currency"
      }
    ]
  },
  "agingPayable": {
    "type": "data-table",
    "columns": [
      {
        "key": "vendor",
        "label": "Vendor",
        "align": "left"
      },
      {
        "key": "current",
        "label": "Current",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "days30",
        "label": "1-30 Days",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "days60",
        "label": "31-60 Days",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "days90plus",
        "label": "90+ Days",
        "align": "right",
        "format": "currency"
      },
      {
        "key": "total",
        "label": "Total",
        "align": "right",
        "format": "currency"
      }
    ]
  }
};

export const layout = [
  {
    "section": "balanceSheet",
    "span": "full"
  },
  {
    "section": "profitLoss",
    "span": "full"
  },
  {
    "section": "agingReceivable",
    "span": "full"
  },
  {
    "section": "agingPayable",
    "span": "full"
  }
];

export const actions = [
  {
    "label": "Back to Accounting",
    "route": "/accounting",
    "variant": "outline"
  }
];
