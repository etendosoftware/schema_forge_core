import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KPIHeader, KanbanBoard } from '@/components/contract-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Truck, FileText, Plus } from 'lucide-react';

// -- KPI data ------------------------------------------------------------------

const KPIS = [
  { label: 'Total Ordered', value: 89500, format: 'currency', trend: 6, icon: FileText },
  { label: 'Received On Time', value: 92, format: 'percent', trend: 2, icon: Truck },
  { label: 'Pending Invoices', value: 8, format: 'number' },
  { label: 'Overdue', value: 12400, format: 'currency', trend: -15 },
];

// -- Kanban columns & seed cards -----------------------------------------------

const COLUMNS = [
  { id: 'draft', title: 'Draft', color: 'gray' },
  { id: 'confirmed', title: 'Confirmed', color: 'blue' },
  { id: 'in-transit', title: 'In Transit', color: 'yellow' },
  { id: 'received', title: 'Received', color: 'green' },
  { id: 'invoiced', title: 'Invoiced', color: 'purple' },
];

const INITIAL_CARDS = [
  { id: 'PO-001', columnId: 'draft', title: 'PO-2026-0234', subtitle: 'Suministros García', value: 12500 },
  { id: 'PO-002', columnId: 'draft', title: 'PO-2026-0235', subtitle: 'Nordic Components', value: 8200 },
  { id: 'PO-003', columnId: 'confirmed', title: 'PO-2026-0236', subtitle: 'China Imports Ltd', value: 45000, badges: ['Priority'] },
  { id: 'PO-004', columnId: 'confirmed', title: 'PO-2026-0237', subtitle: 'Local Parts SL', value: 3400 },
  { id: 'PO-005', columnId: 'in-transit', title: 'PO-2026-0238', subtitle: 'Euro Materials', value: 18700, badges: ['Delayed'] },
  { id: 'PO-006', columnId: 'received', title: 'PO-2026-0239', subtitle: 'Steel Works AG', value: 6800 },
  { id: 'PO-007', columnId: 'received', title: 'PO-2026-0240', subtitle: 'Paper Supply Co', value: 2100 },
  { id: 'PO-008', columnId: 'invoiced', title: 'PO-2026-0241', subtitle: 'Ibérica Industrial', value: 15000 },
];

// -- Status label / color helpers for the list view ----------------------------

const STATUS_LABEL = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  'in-transit': 'In Transit',
  received: 'Received',
  invoiced: 'Invoiced',
};

const STATUS_VARIANT = {
  draft: 'secondary',
  confirmed: 'default',
  'in-transit': 'outline',
  received: 'default',
  invoiced: 'secondary',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// -- Component -----------------------------------------------------------------

export default function PurchasesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('kanban');
  const [cards, setCards] = useState(INITIAL_CARDS);

  const handleDragEnd = useCallback((cardId, _fromColumnId, toColumnId) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, columnId: toColumnId } : c))
    );
  }, []);

  const handleCardClick = useCallback(
    () => {
      navigate('/purchase-order');
    },
    [navigate]
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Purchases</h1>
        <Button asChild>
          <Link to="/purchase-order">
            <Plus className="mr-2 h-4 w-4" />
            New PO
          </Link>
        </Button>
      </div>

      {/* KPIs */}
      <KPIHeader kpis={KPIS} />

      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeTab === 'kanban' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('kanban')}
        >
          Kanban
        </Button>
        <Button
          variant={activeTab === 'list' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('list')}
        >
          List
        </Button>
      </div>

      {/* Tab content */}
      {activeTab === 'kanban' && (
        <KanbanBoard
          columns={COLUMNS}
          cards={cards}
          onDragEnd={handleDragEnd}
          onCardClick={handleCardClick}
          emptyMessage="No purchase orders"
        />
      )}

      {activeTab === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doc No</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr
                      key={card.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate('/purchase-order')}
                    >
                      <td className="px-4 py-3 font-medium">{card.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{card.subtitle}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(card.value)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[card.columnId] || 'secondary'}>
                          {STATUS_LABEL[card.columnId] || card.columnId}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">2026-03-09</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
