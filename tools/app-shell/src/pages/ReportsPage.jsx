import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '@/components/contract-ui';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

import { sections, actions } from '@generated/reports/generated/config';
import * as mockData from '@generated/reports/generated/mockData';

// -- Tab definitions ----------------------------------------------------------

const TABS = [
  { id: 'balanceSheet', label: 'Balance Sheet', title: 'Balance Sheet' },
  { id: 'profitLoss', label: 'P&L', title: 'Profit & Loss' },
  { id: 'agingReceivable', label: 'Aging Receivable', title: 'Aging of Receivables' },
  { id: 'agingPayable', label: 'Aging Payable', title: 'Aging of Payables' },
];

// -- Component ----------------------------------------------------------------

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('balanceSheet');

  const currentTab = TABS.find((t) => t.id === activeTab);
  const currentColumns = sections[activeTab]?.columns ?? [];
  const currentData = mockData[activeTab] ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          Financial Reports
        </h1>
        <div className="flex items-center gap-2">
          {actions.map((action) => (
            <Button key={action.route} variant={action.variant || 'default'} asChild>
              <Link to={action.route}>{action.label}</Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-2">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Active report table */}
      <Card>
        <CardHeader>
          <CardTitle>{currentTab?.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={currentColumns} data={currentData} />
        </CardContent>
      </Card>
    </div>
  );
}
