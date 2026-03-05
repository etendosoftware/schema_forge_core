import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
          <TableRow>
            <TableHead>Document No</TableHead>
            <TableHead>Business Partner</TableHead>
            <TableHead>Order Date</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Total Lines</TableHead>
            <TableHead>Grand Total</TableHead>
            <TableHead>Doc Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((row, idx) => (
            <TableRow key={row.id ?? idx} onClick={() => onRowSelect?.(row)} className="cursor-pointer">
            <TableCell>{row.documentNo}</TableCell>
            <TableCell>{row.businessPartner}</TableCell>
            <TableCell>{row.orderDate}</TableCell>
            <TableCell>{row.currency}</TableCell>
            <TableCell>{row.totalLines?.toLocaleString()}</TableCell>
            <TableCell>{row.grandTotal?.toLocaleString()}</TableCell>
            <TableCell>{row.docStatus}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
