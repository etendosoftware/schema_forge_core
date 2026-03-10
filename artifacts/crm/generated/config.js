// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "crm",
  "label": "CRM",
  "icon": "Target",
  "route": "/crm"
};

export const kpisConfig = [];

export const sections = {
  "kpis": {
    "type": "kpi",
    "kpis": [
      {
        "key": "openDeals",
        "label": "Open Deals",
        "format": "number",
        "icon": "Target",
        "trend": "up"
      },
      {
        "key": "pipelineValue",
        "label": "Pipeline Value",
        "format": "currency",
        "icon": "DollarSign",
        "trend": "up"
      },
      {
        "key": "wonThisMonth",
        "label": "Won This Month",
        "format": "number",
        "icon": "Trophy",
        "trend": "up"
      },
      {
        "key": "conversionRate",
        "label": "Conversion Rate",
        "format": "percent",
        "icon": "TrendingUp",
        "trend": "up"
      }
    ]
  },
  "dealPipeline": {
    "type": "kanban",
    "title": "Deal Pipeline",
    "icon": "Kanban",
    "columns": [
      {
        "id": "lead",
        "title": "Lead",
        "color": "gray"
      },
      {
        "id": "qualification",
        "title": "Qualification",
        "color": "blue"
      },
      {
        "id": "proposal",
        "title": "Proposal",
        "color": "yellow"
      },
      {
        "id": "negotiation",
        "title": "Negotiation",
        "color": "orange"
      },
      {
        "id": "closed-won",
        "title": "Closed Won",
        "color": "green"
      },
      {
        "id": "closed-lost",
        "title": "Closed Lost",
        "color": "red"
      }
    ]
  },
  "recentActivities": {
    "type": "data-table",
    "title": "Recent Activities",
    "icon": "Activity",
    "columns": [
      {
        "key": "type",
        "label": "Type",
        "align": "left"
      },
      {
        "key": "subject",
        "label": "Subject",
        "align": "left"
      },
      {
        "key": "contact",
        "label": "Contact",
        "align": "left"
      },
      {
        "key": "deal",
        "label": "Deal",
        "align": "left"
      },
      {
        "key": "dueDate",
        "label": "Due Date",
        "align": "left"
      },
      {
        "key": "status",
        "label": "Status",
        "align": "left"
      }
    ],
    "filters": [
      "type",
      "status"
    ]
  },
  "teamFeed": {
    "type": "activity-feed",
    "title": "Team Activity",
    "icon": "Users",
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
    "section": "dealPipeline",
    "span": "full"
  },
  {
    "section": "recentActivities",
    "span": "2/3"
  },
  {
    "section": "teamFeed",
    "span": "1/3"
  }
];

export const actions = [
  {
    "label": "New Deal",
    "route": "/deal",
    "variant": "default"
  },
  {
    "label": "Log Activity",
    "route": "/activity",
    "variant": "outline"
  },
  {
    "label": "Add Lead",
    "route": "/lead",
    "variant": "outline"
  }
];
