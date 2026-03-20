// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const kpis = {
  "totalRevenue": 148500,
  "totalExpenses": 89200,
  "netProfit": 59300,
  "cashPosition": 234000,
  "trends": {
    "totalRevenue": 12,
    "totalExpenses": 5,
    "netProfit": 22,
    "cashPosition": 8
  }
};

export const salesInvoices = [
  {
    "id": 1,
    "invoiceNo": "SI-2026-0142",
    "customer": "Empresa ABC S.L.",
    "date": "2026-03-08",
    "amount": 12500,
    "status": "Paid"
  },
  {
    "id": 2,
    "invoiceNo": "SI-2026-0141",
    "customer": "Tech Solutions",
    "date": "2026-03-07",
    "amount": 8200,
    "status": "Pending"
  },
  {
    "id": 3,
    "invoiceNo": "SI-2026-0140",
    "customer": "Global Trade Ltd",
    "date": "2026-03-05",
    "amount": 23000,
    "status": "Paid"
  },
  {
    "id": 4,
    "invoiceNo": "SI-2026-0139",
    "customer": "Madrid Logistics",
    "date": "2026-03-03",
    "amount": 5400,
    "status": "Overdue"
  },
  {
    "id": 5,
    "invoiceNo": "SI-2026-0138",
    "customer": "Barcelona Foods",
    "date": "2026-03-01",
    "amount": 17800,
    "status": "Paid"
  },
  {
    "id": 6,
    "invoiceNo": "SI-2026-0137",
    "customer": "Sevilla Motors",
    "date": "2026-02-28",
    "amount": 9600,
    "status": "Pending"
  }
];

export const purchaseInvoices = [
  {
    "id": 1,
    "invoiceNo": "PI-2026-0098",
    "vendor": "Steel Supplies Co.",
    "date": "2026-03-07",
    "amount": 18400,
    "status": "Paid"
  },
  {
    "id": 2,
    "invoiceNo": "PI-2026-0097",
    "vendor": "Electric Components Ltd",
    "date": "2026-03-05",
    "amount": 7600,
    "status": "Pending"
  },
  {
    "id": 3,
    "invoiceNo": "PI-2026-0096",
    "vendor": "Raw Materials Inc.",
    "date": "2026-03-03",
    "amount": 31200,
    "status": "Paid"
  },
  {
    "id": 4,
    "invoiceNo": "PI-2026-0095",
    "vendor": "Office Depot Spain",
    "date": "2026-03-01",
    "amount": 2800,
    "status": "Overdue"
  },
  {
    "id": 5,
    "invoiceNo": "PI-2026-0094",
    "vendor": "Packaging Solutions",
    "date": "2026-02-27",
    "amount": 5200,
    "status": "Paid"
  }
];

export const bankSummary = [
  {
    "id": 1,
    "account": "Main Operating Account",
    "bank": "Santander",
    "balance": 156000,
    "lastTransaction": "2026-03-09"
  },
  {
    "id": 2,
    "account": "Savings Reserve",
    "bank": "BBVA",
    "balance": 72000,
    "lastTransaction": "2026-03-05"
  },
  {
    "id": 3,
    "account": "Petty Cash",
    "bank": "CaixaBank",
    "balance": 6000,
    "lastTransaction": "2026-03-08"
  }
];

export const taxSummary = [
  {
    "id": 1,
    "taxType": "VAT Q1 2026",
    "period": "Jan-Mar 2026",
    "amount": 18500,
    "dueDate": "2026-04-20",
    "status": "Pending"
  },
  {
    "id": 2,
    "taxType": "Corporate Income Tax",
    "period": "FY 2025",
    "amount": 42000,
    "dueDate": "2026-07-25",
    "status": "Estimated"
  },
  {
    "id": 3,
    "taxType": "Withholding Tax",
    "period": "Feb 2026",
    "amount": 3200,
    "dueDate": "2026-03-20",
    "status": "Due Soon"
  },
  {
    "id": 4,
    "taxType": "VAT Q4 2025",
    "period": "Oct-Dec 2025",
    "amount": 15800,
    "dueDate": "2026-01-30",
    "status": "Filed"
  }
];
