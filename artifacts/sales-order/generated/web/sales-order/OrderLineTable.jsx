import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
          <TableRow>
            <TableHead>Line No</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Quantity</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead>Discount</TableHead>
            <TableHead>Line Net Amount</TableHead>
            <TableHead>Tax</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredData.map((row, idx) => (
            <TableRow key={row.id ?? idx} onClick={() => onRowSelect?.(row)} className="cursor-pointer">
            <TableCell>{row.lineNo}</TableCell>
            <TableCell>{row.product}</TableCell>
            <TableCell>{row.quantity}</TableCell>
            <TableCell>{row.unitPrice?.toLocaleString()}</TableCell>
            <TableCell>{row.discount}</TableCell>
            <TableCell>{row.lineNetAmount?.toLocaleString()}</TableCell>
            <TableCell>{row.tax}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
