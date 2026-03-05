import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';

export default function OrderTable({ data = [], onRowSelect }) {
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
      <div className="flex gap-2">
        <Input
          placeholder="Filter Document No..."
          value={filterDocumentNo}
          onChange={(e) => setFilterDocumentNo(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Filter Business Partner..."
          value={filterBusinessPartner}
          onChange={(e) => setFilterBusinessPartner(e.target.value)}
          className="max-w-xs"
        />
        <Input
          placeholder="Filter Doc Status..."
          value={filterDocStatus}
          onChange={(e) => setFilterDocStatus(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-100">
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Document No</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Business Partner</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Order Date</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Currency</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Lines</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Grand Total</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Doc Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-50">
          {filteredData.map((row, idx) => (
            <TableRow key={row.id ?? idx} onClick={() => onRowSelect?.(row)} className="cursor-pointer hover:bg-gray-50 transition-colors">
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
  );
}
