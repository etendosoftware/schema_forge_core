import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

export default function OrderLineTable({ data = [], onRowSelect }) {
  const [filterProduct, setFilterProduct] = useState('');

  const filteredData = data.filter(row => {
    if (filterProduct && !String(row.product ?? '').toLowerCase().includes(filterProduct.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Filter Product..."
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-gray-100">
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Line No</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Product</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Line Net Amount</TableHead>
            <TableHead className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-gray-50">
          {filteredData.map((row, idx) => (
            <TableRow key={row.id ?? idx} onClick={() => onRowSelect?.(row)} className="cursor-pointer hover:bg-gray-50 transition-colors">
            <TableCell>{row.lineNo}</TableCell>
            <TableCell>{row.product}</TableCell>
            <TableCell>{row.quantity}</TableCell>
            <TableCell className="tabular-nums">{row.unitPrice?.toLocaleString()}</TableCell>
            <TableCell>{row.discount}</TableCell>
            <TableCell className="tabular-nums">{row.lineNetAmount?.toLocaleString()}</TableCell>
            <TableCell>{row.tax}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
