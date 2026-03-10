// Auto-generated from aggregate-contract.json — DO NOT EDIT

export const kpis = {
  "totalSkus": 248,
  "stockValue": 1245000,
  "lowStockAlerts": 5,
  "movementsToday": 12
};

export const stockLevels = [
  {
    "id": 1,
    "sku": "PRD-001",
    "name": "Steel Bolts M8",
    "warehouse": "Madrid Central",
    "available": 1200,
    "reserved": 150,
    "minimum": 200,
    "status": "In Stock"
  },
  {
    "id": 2,
    "sku": "PRD-002",
    "name": "Copper Wire 2.5mm",
    "warehouse": "Barcelona North",
    "available": 340,
    "reserved": 40,
    "minimum": 100,
    "status": "In Stock"
  },
  {
    "id": 3,
    "sku": "PRD-003",
    "name": "Hydraulic Pump HP-50",
    "warehouse": "Madrid Central",
    "available": 18,
    "reserved": 5,
    "minimum": 25,
    "status": "Low Stock"
  },
  {
    "id": 4,
    "sku": "PRD-004",
    "name": "LED Panel 60x60",
    "warehouse": "Barcelona North",
    "available": 85,
    "reserved": 20,
    "minimum": 50,
    "status": "In Stock"
  },
  {
    "id": 5,
    "sku": "PRD-005",
    "name": "Rubber Gasket Set",
    "warehouse": "Madrid Central",
    "available": 12,
    "reserved": 8,
    "minimum": 30,
    "status": "Low Stock"
  },
  {
    "id": 6,
    "sku": "PRD-006",
    "name": "Stainless Pipe DN50",
    "warehouse": "Barcelona North",
    "available": 450,
    "reserved": 60,
    "minimum": 100,
    "status": "In Stock"
  },
  {
    "id": 7,
    "sku": "PRD-007",
    "name": "Circuit Breaker 32A",
    "warehouse": "Madrid Central",
    "available": 95,
    "reserved": 10,
    "minimum": 40,
    "status": "In Stock"
  },
  {
    "id": 8,
    "sku": "PRD-008",
    "name": "Thermal Insulation Roll",
    "warehouse": "Barcelona North",
    "available": 8,
    "reserved": 3,
    "minimum": 15,
    "status": "Low Stock"
  },
  {
    "id": 9,
    "sku": "PRD-009",
    "name": "PVC Conduit 25mm",
    "warehouse": "Madrid Central",
    "available": 620,
    "reserved": 80,
    "minimum": 150,
    "status": "In Stock"
  },
  {
    "id": 10,
    "sku": "PRD-010",
    "name": "Bearing SKF 6205",
    "warehouse": "Barcelona North",
    "available": 5,
    "reserved": 2,
    "minimum": 20,
    "status": "Low Stock"
  },
  {
    "id": 11,
    "sku": "PRD-011",
    "name": "Welding Rod E6013",
    "warehouse": "Madrid Central",
    "available": 2000,
    "reserved": 300,
    "minimum": 500,
    "status": "In Stock"
  },
  {
    "id": 12,
    "sku": "PRD-012",
    "name": "Air Filter Element",
    "warehouse": "Barcelona North",
    "available": 3,
    "reserved": 1,
    "minimum": 10,
    "status": "Low Stock"
  }
];

export const lowStock = [
  {
    "name": "Hydraulic Pump HP-50",
    "current": 18,
    "minimum": 25,
    "severity": "amber"
  },
  {
    "name": "Rubber Gasket Set",
    "current": 12,
    "minimum": 30,
    "severity": "red"
  },
  {
    "name": "Thermal Insulation Roll",
    "current": 8,
    "minimum": 15,
    "severity": "red"
  },
  {
    "name": "Bearing SKF 6205",
    "current": 5,
    "minimum": 20,
    "severity": "red"
  },
  {
    "name": "Air Filter Element",
    "current": 3,
    "minimum": 10,
    "severity": "red"
  }
];

export const recentMovements = [
  {
    "id": 1,
    "direction": "in",
    "product": "Steel Bolts M8",
    "qty": 500,
    "warehouse": "Madrid Central",
    "time": "2 hours ago"
  },
  {
    "id": 2,
    "direction": "out",
    "product": "Copper Wire 2.5mm",
    "qty": 120,
    "warehouse": "Barcelona North",
    "time": "3 hours ago"
  },
  {
    "id": 3,
    "direction": "in",
    "product": "LED Panel 60x60",
    "qty": 50,
    "warehouse": "Barcelona North",
    "time": "5 hours ago"
  },
  {
    "id": 4,
    "direction": "out",
    "product": "Circuit Breaker 32A",
    "qty": 15,
    "warehouse": "Madrid Central",
    "time": "6 hours ago"
  },
  {
    "id": 5,
    "direction": "in",
    "product": "PVC Conduit 25mm",
    "qty": 200,
    "warehouse": "Madrid Central",
    "time": "8 hours ago"
  },
  {
    "id": 6,
    "direction": "out",
    "product": "Welding Rod E6013",
    "qty": 300,
    "warehouse": "Madrid Central",
    "time": "1 day ago"
  }
];
