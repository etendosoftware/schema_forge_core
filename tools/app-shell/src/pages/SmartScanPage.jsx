import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ScanLine,
  Upload,
  FileCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Activity,
} from 'lucide-react';

// -- Inline mock data (self-contained page) -----------------------------------

const KPIS = [
  { label: 'Documents Scanned', value: '1,284', icon: FileCheck, trend: '+12%' },
  { label: 'Pending Review', value: '23', icon: Clock, trend: '-3' },
  { label: 'Auto-Matched', value: '94%', icon: CheckCircle2, trend: '+2%' },
  { label: 'Exceptions', value: '7', icon: AlertTriangle, trend: '-1' },
];

const RECENT_SCANS = [
  { id: 1, name: 'INV-2026-0891.pdf', type: 'Invoice', status: 'Matched', date: '2026-03-09', confidence: '98%' },
  { id: 2, name: 'PO-2026-0445.pdf', type: 'Purchase Order', status: 'Matched', date: '2026-03-09', confidence: '96%' },
  { id: 3, name: 'REC-2026-0112.jpg', type: 'Receipt', status: 'Review', date: '2026-03-08', confidence: '72%' },
  { id: 4, name: 'INV-2026-0890.pdf', type: 'Invoice', status: 'Matched', date: '2026-03-08', confidence: '99%' },
  { id: 5, name: 'STMT-2026-03.pdf', type: 'Statement', status: 'Exception', date: '2026-03-07', confidence: '45%' },
  { id: 6, name: 'INV-2026-0889.pdf', type: 'Invoice', status: 'Matched', date: '2026-03-07', confidence: '97%' },
];

const ACTIVITY_FEED = [
  { id: 1, label: 'INV-2026-0891 auto-matched to SO-4421', time: '2 min ago' },
  { id: 2, label: 'Batch scan completed: 12 documents processed', time: '15 min ago' },
  { id: 3, label: 'REC-2026-0112 flagged for manual review', time: '1 hr ago' },
  { id: 4, label: 'STMT-2026-03 marked as exception', time: '3 hr ago' },
  { id: 5, label: 'INV-2026-0890 auto-matched to PO-3398', time: '5 hr ago' },
];

const STATUS_VARIANT = {
  Matched: 'default',
  Review: 'secondary',
  Exception: 'destructive',
};

// -- Component -----------------------------------------------------------------

export default function SmartScanPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Smart Scan</h1>
        <Button>
          <ScanLine className="h-4 w-4 mr-2" />
          New Scan
        </Button>
      </div>

      {/* Upload area */}
      <Card>
        <CardContent className="p-8">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-10 text-center space-y-3">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Drop documents here or click to upload</p>
            <p className="text-xs text-muted-foreground">
              Supports PDF, JPG, PNG up to 25 MB. Batch upload supported.
            </p>
            <Button variant="outline" size="sm">
              Browse Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-xl font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.trend}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two-column layout: Recent Scans (2/3) + Activity Feed (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Scans Table */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                Recent Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Document</th>
                      <th className="pb-2 font-medium">Type</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_SCANS.map((scan) => (
                      <tr key={scan.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{scan.name}</td>
                        <td className="py-2">{scan.type}</td>
                        <td className="py-2">
                          <Badge variant={STATUS_VARIANT[scan.status] || 'outline'}>
                            {scan.status}
                          </Badge>
                        </td>
                        <td className="py-2">{scan.date}</td>
                        <td className="py-2 text-right">{scan.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-muted-foreground" />
                Scan Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ACTIVITY_FEED.map((entry, idx) => (
                <div key={entry.id}>
                  {idx > 0 && <Separator className="mb-3" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{entry.label}</p>
                    <span className="text-xs text-muted-foreground">{entry.time}</span>
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
