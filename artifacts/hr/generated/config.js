// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "hr",
  "label": "HR",
  "icon": "Users",
  "route": "/hr"
};

export const kpisConfig = [];

export const sections = {
  "kpis": {
    "type": "kpi",
    "kpis": [
      {
        "key": "totalEmployees",
        "label": "Total Employees",
        "format": "number",
        "icon": "Users",
        "trend": "up"
      },
      {
        "key": "activeAbsences",
        "label": "On Leave Today",
        "format": "number",
        "icon": "Calendar",
        "trend": "neutral"
      },
      {
        "key": "openPositions",
        "label": "Open Positions",
        "format": "number",
        "icon": "UserPlus",
        "trend": "up"
      },
      {
        "key": "avgTenure",
        "label": "Avg. Tenure",
        "format": "number",
        "icon": "Clock",
        "trend": "up"
      }
    ]
  },
  "employeeDirectory": {
    "type": "data-table",
    "title": "Employee Directory",
    "icon": "Users",
    "columns": [
      {
        "key": "name",
        "label": "Name",
        "align": "left"
      },
      {
        "key": "department",
        "label": "Department",
        "align": "left"
      },
      {
        "key": "position",
        "label": "Position",
        "align": "left"
      },
      {
        "key": "email",
        "label": "Email",
        "align": "left"
      },
      {
        "key": "status",
        "label": "Status",
        "align": "left"
      }
    ],
    "filters": [
      "department",
      "status"
    ]
  },
  "absenceCalendar": {
    "type": "kanban",
    "title": "Current Absences",
    "icon": "Calendar",
    "columns": [
      {
        "id": "pending",
        "title": "Pending",
        "color": "yellow"
      },
      {
        "id": "approved",
        "title": "Approved",
        "color": "green"
      },
      {
        "id": "on-leave",
        "title": "On Leave",
        "color": "blue"
      },
      {
        "id": "returned",
        "title": "Returned",
        "color": "gray"
      }
    ]
  },
  "hrUpdates": {
    "type": "activity-feed",
    "title": "HR Updates",
    "icon": "Bell",
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
    "section": "employeeDirectory",
    "span": "2/3"
  },
  {
    "section": "absenceCalendar",
    "span": "1/3"
  },
  {
    "section": "hrUpdates",
    "span": "full"
  }
];

export const actions = [
  {
    "label": "Add Employee",
    "route": "/employee",
    "variant": "default"
  },
  {
    "label": "Request Absence",
    "route": "/absence",
    "variant": "outline"
  }
];
