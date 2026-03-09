import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KPIHeader, KanbanBoard } from '@/components/contract-ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ShoppingCart, FileText, TrendingUp } from 'lucide-react';

// -- KPI data ------------------------------------------------------------------

const KPIS = [
  { label: 'Total Quoted', value: 125400, format: 'currency', trend: 15, icon: FileText },
  { label: 'Total Invoiced', value: 98200, format: 'currency', trend: 8, icon: TrendingUp },
  { label: 'Pending Collection', value: 27300, format: 'currency', trend: -5, icon: ShoppingCart },
  { label: 'Orders This Month', value: 23, format: 'number', trend: 3 },
];

// -- Kanban columns & seed cards -----------------------------------------------

const COLUMNS = [
  { id: 'draft', title: 'Draft', color: 'gray' },
  { id: 'sent', title: 'Sent', color: 'blue' },
  { id: 'negotiation', title: 'Negotiation', color: 'yellow' },
  { id: 'won', title: 'Won', color: 'green' },
  { id: 'lost', title: 'Lost', color: 'red' },
];

const INITIAL_CARDS = [
  { id: 'QT-001', columnId: 'draft', title: 'QT-2026-0089', subtitle: 'Empresa ABC S.L.', value: 8500, badges: ['Priority'] },
  { id: 'QT-002', columnId: 'draft', title: 'QT-2026-0090', subtitle: 'Tech Solutions', value: 3200 },
  { id: 'QT-003', columnId: 'sent', title: 'QT-2026-0085', subtitle: 'Global Trade Ltd', value: 15000, badges: ['VIP'] },
  { id: 'QT-004', columnId: 'sent', title: 'QT-2026-0087', subtitle: 'Madrid Logistics', value: 4800 },
  { id: 'QT-005', columnId: 'negotiation', title: 'QT-2026-0082', subtitle: 'Barcelona Foods', value: 22000, badges: ['Priority', 'VIP'], priority: 3 },
  { id: 'QT-006', columnId: 'negotiation', title: 'QT-2026-0084', subtitle: 'Sevilla Motors', value: 6700, priority: 2 },
  { id: 'QT-007', columnId: 'won', title: 'QT-2026-0078', subtitle: 'Valencia Exports', value: 18500 },
  { id: 'QT-008', columnId: 'won', title: 'QT-2026-0080', subtitle: 'Bilbao Tech', value: 9200 },
  { id: 'QT-009', columnId: 'lost', title: 'QT-2026-0076', subtitle: 'Zaragoza Industrial', value: 5400 },
];

// -- Status label / color helpers for the list view ----------------------------

const STATUS_LABEL = {
  draft: 'Draft',
  sent: 'Sent',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

const STATUS_VARIANT = {
  draft: 'secondary',
  sent: 'default',
  negotiation: 'outline',
  won: 'default',
  lost: 'destructive',
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

export default function SalesPage() {
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
      navigate('/sales-quotation');
    },
    [navigate]
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
        <Button asChild>
          <Link to="/sales-quotation">+ New Quotation</Link>
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
          emptyMessage="No quotations"
        />
      )}

      {activeTab === 'list' && (
        <Card>
          <CardHeader>
            <CardTitle>Quotations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Document No</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Customer</th>
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
                      onClick={() => navigate('/sales-quotation')}
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
