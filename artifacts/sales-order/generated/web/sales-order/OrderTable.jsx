import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';

export default function OrderTable({ data = [], onRowSelect, selectedId }) {
  const [filterDocumentNo, setFilterDocumentNo] = useState('');
  const [filterBusinessPartner, setFilterBusinessPartner] = useState('');
  const [filterDocStatus, setFilterDocStatus] = useState('');

  const filteredData = data.filter(row => {
    if (filterDocumentNo && !String(row.documentNo ?? '').toLowerCase().includes(filterDocumentNo.toLowerCase())) return false;
    if (filterBusinessPartner && !String(row.businessPartner ?? '').toLowerCase().includes(filterBusinessPartner.toLowerCase())) return false;
    if (filterDocStatus && !String(row.docStatus ?? '').toLowerCase().includes(filterDocStatus.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter Document No..."
            value={filterDocumentNo}
            onChange={(e) => setFilterDocumentNo(e.target.value)}
            className="pl-8 max-w-xs focus:ring-2 focus:ring-primary focus:outline-none transition-colors duration-200"
            aria-label={"Filter by Document No"}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter Business Partner..."
            value={filterBusinessPartner}
            onChange={(e) => setFilterBusinessPartner(e.target.value)}
            className="pl-8 max-w-xs focus:ring-2 focus:ring-primary focus:outline-none transition-colors duration-200"
            aria-label={"Filter by Business Partner"}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter Doc Status..."
            value={filterDocStatus}
            onChange={(e) => setFilterDocStatus(e.target.value)}
            className="pl-8 max-w-xs focus:ring-2 focus:ring-primary focus:outline-none transition-colors duration-200"
            aria-label={"Filter by Doc Status"}
          />
        </div>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-primary/20 bg-muted/40">
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Document No</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Business Partner</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Order Date</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Currency</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Total Lines</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Grand Total</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Doc Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((row, idx) => (
              <TableRow
                key={row.id ?? idx}
                onClick={() => onRowSelect?.(row)}
                className={[
                  'cursor-pointer transition-colors',
                  row.id === selectedId ? 'bg-primary/10 border-l-2 border-l-primary' : '',
                  idx % 2 !== 0 && row.id !== selectedId ? 'bg-muted/30' : '',
                  'hover:bg-primary/5',
                ].filter(Boolean).join(' ')}
              >
            <TableCell>{row.documentNo}</TableCell>
            <TableCell>{row.businessPartner}</TableCell>
            <TableCell>{row.orderDate}</TableCell>
            <TableCell>{row.currency}</TableCell>
            <TableCell className="tabular-nums">{row.totalLines?.toLocaleString()}</TableCell>
            <TableCell className="tabular-nums">{row.grandTotal?.toLocaleString()}</TableCell>
            <TableCell><StatusBadge status={row.docStatus} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">{filteredData.length} of {data.length} records</p>
    </div>
  );
}
