// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const meta = {
  "module": "projects",
  "label": "Projects",
  "icon": "FolderKanban",
  "route": "/projects"
};

export const kpisConfig = [];

export const sections = {
  "kpis": {
    "type": "kpi",
    "kpis": [
      {
        "key": "activeProjects",
        "label": "Active Projects",
        "format": "number",
        "icon": "FolderKanban",
        "trend": "up"
      },
      {
        "key": "totalHoursMonth",
        "label": "Hours This Month",
        "format": "number",
        "icon": "Clock",
        "trend": "up"
      },
      {
        "key": "budgetUtilization",
        "label": "Budget Used",
        "format": "percent",
        "icon": "PieChart",
        "trend": "neutral"
      },
      {
        "key": "documentsCount",
        "label": "Documents",
        "format": "number",
        "icon": "FileText",
        "trend": "up"
      }
    ]
  },
  "projectBoard": {
    "type": "kanban",
    "title": "Project Board",
    "icon": "FolderKanban",
    "columns": [
      {
        "id": "planning",
        "title": "Planning",
        "color": "gray"
      },
      {
        "id": "in-progress",
        "title": "In Progress",
        "color": "blue"
      },
      {
        "id": "on-hold",
        "title": "On Hold",
        "color": "yellow"
      },
      {
        "id": "completed",
        "title": "Completed",
        "color": "green"
      }
    ]
  },
  "recentTimeEntries": {
    "type": "data-table",
    "title": "Recent Time Entries",
    "icon": "Clock",
    "columns": [
      {
        "key": "employee",
        "label": "Employee",
        "align": "left"
      },
      {
        "key": "project",
        "label": "Project",
        "align": "left"
      },
      {
        "key": "date",
        "label": "Date",
        "align": "left"
      },
      {
        "key": "hours",
        "label": "Hours",
        "align": "right"
      },
      {
        "key": "category",
        "label": "Category",
        "align": "left"
      },
      {
        "key": "status",
        "label": "Status",
        "align": "left"
      }
    ],
    "filters": [
      "project",
      "category"
    ]
  },
  "recentDocuments": {
    "type": "data-table",
    "title": "Recent Documents",
    "icon": "FileText",
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
        "key": "project",
        "label": "Project",
        "align": "left"
      },
      {
        "key": "uploadedBy",
        "label": "Uploaded By",
        "align": "left"
      },
      {
        "key": "uploadDate",
        "label": "Upload Date",
        "align": "left"
      },
      {
        "key": "status",
        "label": "Status",
        "align": "left"
      }
    ],
    "filters": [
      "category",
      "status"
    ]
  }
};

export const layout = [
  {
    "section": "kpis",
    "span": "full"
  },
  {
    "section": "projectBoard",
    "span": "full"
  },
  {
    "section": "recentTimeEntries",
    "span": "1/2"
  },
  {
    "section": "recentDocuments",
    "span": "1/2"
  }
];

export const actions = [
  {
    "label": "New Project",
    "route": "/project",
    "variant": "default"
  },
  {
    "label": "Log Time",
    "route": "/time-tracking",
    "variant": "outline"
  },
  {
    "label": "Upload Document",
    "route": "/document",
    "variant": "outline"
  }
];
