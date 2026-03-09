// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "smart-scan",
  "label": "Smart Scan",
  "icon": "Scan",
  "route": "/smart-scan"
};

export const kpisConfig = [];

export const sections = {
  "kpis": {
    "type": "kpi",
    "kpis": [
      {
        "key": "scannedToday",
        "label": "Scanned Today",
        "format": "number",
        "icon": "Scan",
        "trend": "up"
      },
      {
        "key": "pendingReview",
        "label": "Pending Review",
        "format": "number",
        "icon": "Eye",
        "trend": "neutral"
      },
      {
        "key": "autoMatched",
        "label": "Auto-Matched",
        "format": "percent",
        "icon": "CheckCircle",
        "trend": "up"
      },
      {
        "key": "totalProcessed",
        "label": "Total Processed",
        "format": "number",
        "icon": "FileCheck",
        "trend": "up"
      }
    ]
  },
  "recentScans": {
    "type": "data-table",
    "title": "Recent Scans",
    "icon": "Scan",
    "columns": [
      {
        "key": "fileName",
        "label": "File Name",
        "align": "left"
      },
      {
        "key": "type",
        "label": "Type",
        "align": "left"
      },
      {
        "key": "vendor",
        "label": "Vendor",
        "align": "left"
      },
      {
        "key": "amount",
        "label": "Amount",
        "align": "right"
      },
      {
        "key": "date",
        "label": "Date",
        "align": "left"
      },
      {
        "key": "matchStatus",
        "label": "Match Status",
        "align": "left"
      }
    ],
    "filters": [
      "type",
      "matchStatus"
    ]
  },
  "scanActivity": {
    "type": "activity-feed",
    "title": "Scan Activity",
    "icon": "Activity",
    "fields": {
      "direction": "direction",
      "label": "label",
      "detail": "detail",
      "time": "time"
    }
  }
};

export const layout = [
  {
    "section": "kpis",
    "span": "full"
  },
  {
    "section": "recentScans",
    "span": "2/3"
  },
  {
    "section": "scanActivity",
    "span": "1/3"
  }
];

export const actions = [
  {
    "label": "Scan Document",
    "route": "/smart-scan",
    "variant": "default"
  },
  {
    "label": "Review Pending",
    "route": "/smart-scan",
    "variant": "outline"
  }
];
