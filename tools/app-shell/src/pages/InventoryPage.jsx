import React from 'react';
import { Link } from 'react-router-dom';
import { KPIHeader, DataTable } from '@/components/contract-ui';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package, AlertTriangle, ArrowUp, ArrowDown, Search } from 'lucide-react';

// -- KPI data ------------------------------------------------------------------

const KPIS = [
  { label: 'Total SKUs', value: 248, format: 'number', icon: Package },
  { label: 'Stock Value', value: 1245000, format: 'currency', trend: 3.2 },
  { label: 'Low Stock Alerts', value: 5, format: 'number', trend: 2, icon: AlertTriangle },
  { label: 'Movements Today', value: 12, format: 'number' },
];

// -- Inventory table columns ---------------------------------------------------

const COLUMNS = [
  { key: 'sku', label: 'SKU' },
  { key: 'name', label: 'Product Name' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'available', label: 'Available', type: 'amount' },
  { key: 'reserved', label: 'Reserved', type: 'amount' },
  { key: 'minimum', label: 'Minimum', type: 'amount' },
  { key: 'status', label: 'Status', type: 'status' },
];

const FILTERS = ['name', 'warehouse'];

// -- Mock inventory data (12 rows, Madrid & Barcelona) -------------------------

const INVENTORY_DATA = [
  { id: 1, sku: 'PRD-001', name: 'Steel Bolts M8', warehouse: 'Madrid Central', available: 1200, reserved: 150, minimum: 200, status: 'In Stock' },
  { id: 2, sku: 'PRD-002', name: 'Copper Wire 2.5mm', warehouse: 'Barcelona North', available: 340, reserved: 40, minimum: 100, status: 'In Stock' },
  { id: 3, sku: 'PRD-003', name: 'Hydraulic Pump HP-50', warehouse: 'Madrid Central', available: 18, reserved: 5, minimum: 25, status: 'Low Stock' },
  { id: 4, sku: 'PRD-004', name: 'LED Panel 60x60', warehouse: 'Barcelona North', available: 85, reserved: 20, minimum: 50, status: 'In Stock' },
  { id: 5, sku: 'PRD-005', name: 'Rubber Gasket Set', warehouse: 'Madrid Central', available: 12, reserved: 8, minimum: 30, status: 'Low Stock' },
  { id: 6, sku: 'PRD-006', name: 'Stainless Pipe DN50', warehouse: 'Barcelona North', available: 450, reserved: 60, minimum: 100, status: 'In Stock' },
  { id: 7, sku: 'PRD-007', name: 'Circuit Breaker 32A', warehouse: 'Madrid Central', available: 95, reserved: 10, minimum: 40, status: 'In Stock' },
  { id: 8, sku: 'PRD-008', name: 'Thermal Insulation Roll', warehouse: 'Barcelona North', available: 8, reserved: 3, minimum: 15, status: 'Low Stock' },
  { id: 9, sku: 'PRD-009', name: 'PVC Conduit 25mm', warehouse: 'Madrid Central', available: 620, reserved: 80, minimum: 150, status: 'In Stock' },
  { id: 10, sku: 'PRD-010', name: 'Bearing SKF 6205', warehouse: 'Barcelona North', available: 5, reserved: 2, minimum: 20, status: 'Low Stock' },
  { id: 11, sku: 'PRD-011', name: 'Welding Rod E6013', warehouse: 'Madrid Central', available: 2000, reserved: 300, minimum: 500, status: 'In Stock' },
  { id: 12, sku: 'PRD-012', name: 'Air Filter Element', warehouse: 'Barcelona North', available: 3, reserved: 1, minimum: 10, status: 'Low Stock' },
];

// -- Low stock alerts data -----------------------------------------------------

const LOW_STOCK_ALERTS = [
  { name: 'Hydraulic Pump HP-50', current: 18, minimum: 25, severity: 'amber' },
  { name: 'Rubber Gasket Set', current: 12, minimum: 30, severity: 'red' },
  { name: 'Thermal Insulation Roll', current: 8, minimum: 15, severity: 'red' },
  { name: 'Bearing SKF 6205', current: 5, minimum: 20, severity: 'red' },
  { name: 'Air Filter Element', current: 3, minimum: 10, severity: 'red' },
];

// -- Recent movements data -----------------------------------------------------

const RECENT_MOVEMENTS = [
  { id: 1, direction: 'in', product: 'Steel Bolts M8', qty: 500, warehouse: 'Madrid Central', time: '2 hours ago' },
  { id: 2, direction: 'out', product: 'Copper Wire 2.5mm', qty: 120, warehouse: 'Barcelona North', time: '3 hours ago' },
  { id: 3, direction: 'in', product: 'LED Panel 60x60', qty: 50, warehouse: 'Barcelona North', time: '5 hours ago' },
  { id: 4, direction: 'out', product: 'Circuit Breaker 32A', qty: 15, warehouse: 'Madrid Central', time: '6 hours ago' },
  { id: 5, direction: 'in', product: 'PVC Conduit 25mm', qty: 200, warehouse: 'Madrid Central', time: '8 hours ago' },
  { id: 6, direction: 'out', product: 'Welding Rod E6013', qty: 300, warehouse: 'Madrid Central', time: '1 day ago' },
];

// -- Component -----------------------------------------------------------------

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/physical-inventory">Physical Inventory</Link>
          </Button>
          <Button asChild>
            <Link to="/goods-movements">Goods Movements</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <KPIHeader kpis={KPIS} />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: DataTable (2/3 width) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-muted-foreground" />
                Stock Levels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={COLUMNS}
                filters={FILTERS}
                data={INVENTORY_DATA}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column: Alerts + Recent Movements (1/3 width) */}
        <div className="space-y-6">
          {/* Low Stock Alerts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Low Stock Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {LOW_STOCK_ALERTS.map((alert, idx) => (
                <div key={idx}>
                  {idx > 0 && <Separator className="mb-3" />}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{alert.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {alert.current} / {alert.minimum} minimum
                      </p>
                    </div>
                    <Badge
                      variant={alert.severity === 'red' ? 'destructive' : 'outline'}
                      className={
                        alert.severity === 'amber'
                          ? 'border-amber-300 bg-amber-50 text-amber-700'
                          : ''
                      }
                    >
                      {alert.severity === 'red' ? 'Critical' : 'Warning'}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent Movements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Movements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {RECENT_MOVEMENTS.map((movement, idx) => (
                <div key={movement.id}>
                  {idx > 0 && <Separator className="mb-3" />}
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-1 ${
                      movement.direction === 'in'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {movement.direction === 'in'
                        ? <ArrowUp className="h-3.5 w-3.5" />
                        : <ArrowDown className="h-3.5 w-3.5" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{movement.product}</p>
                      <p className="text-xs text-muted-foreground">
                        {movement.qty} units &middot; {movement.warehouse}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {movement.time}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
