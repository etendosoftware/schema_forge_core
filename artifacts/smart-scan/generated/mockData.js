// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const kpis = {
  "scannedToday": 14,
  "pendingReview": 5,
  "autoMatched": 87,
  "totalProcessed": 1243,
  "trends": {
    "scannedToday": 3,
    "pendingReview": -2,
    "autoMatched": 4,
    "totalProcessed": 56
  }
};

export const recentScans = [
  {
    "fileName": "INV-2026-0341.pdf",
    "type": "Invoice",
    "vendor": "Acme Supplies",
    "amount": 4520,
    "date": "2026-03-09",
    "matchStatus": "Matched"
  },
  {
    "fileName": "RCT-20260308-001.jpg",
    "type": "Receipt",
    "vendor": "Office Depot",
    "amount": 187.5,
    "date": "2026-03-08",
    "matchStatus": "Matched"
  },
  {
    "fileName": "CN-2026-0089.pdf",
    "type": "Credit Note",
    "vendor": "TechParts Ltd",
    "amount": 1200,
    "date": "2026-03-08",
    "matchStatus": "Pending"
  },
  {
    "fileName": "INV-2026-0340.pdf",
    "type": "Invoice",
    "vendor": "Global Logistics",
    "amount": 8750,
    "date": "2026-03-07",
    "matchStatus": "Matched"
  },
  {
    "fileName": "RCT-20260307-003.jpg",
    "type": "Receipt",
    "vendor": "QuickShip Co",
    "amount": 342,
    "date": "2026-03-07",
    "matchStatus": "Unmatched"
  },
  {
    "fileName": "INV-2026-0339.pdf",
    "type": "Invoice",
    "vendor": "FreshFoods Co",
    "amount": 2100,
    "date": "2026-03-06",
    "matchStatus": "Matched"
  },
  {
    "fileName": "CN-2026-0088.pdf",
    "type": "Credit Note",
    "vendor": "Acme Supplies",
    "amount": 560,
    "date": "2026-03-06",
    "matchStatus": "Pending"
  },
  {
    "fileName": "INV-2026-0338.pdf",
    "type": "Invoice",
    "vendor": "DataDriven Co",
    "amount": 3200,
    "date": "2026-03-05",
    "matchStatus": "Matched"
  }
];

export const scanActivity = [
  {
    "id": 1,
    "direction": "in",
    "label": "Auto-matched INV-2026-0341 to PO-4521",
    "detail": "Acme Supplies — $4,520.00",
    "time": "10 min ago"
  },
  {
    "id": 2,
    "direction": "in",
    "label": "New scan uploaded: RCT-20260308-001",
    "detail": "Office Depot receipt",
    "time": "1 hour ago"
  },
  {
    "id": 3,
    "label": "Credit note CN-2026-0089 needs manual review",
    "detail": "TechParts Ltd — amount mismatch",
    "time": "2 hours ago"
  },
  {
    "id": 4,
    "direction": "out",
    "label": "Batch processed 6 invoices",
    "detail": "All matched successfully",
    "time": "4 hours ago"
  },
  {
    "id": 5,
    "direction": "in",
    "label": "OCR confidence low on RCT-20260307-003",
    "detail": "QuickShip Co — manual review required",
    "time": "1 day ago"
  }
];
