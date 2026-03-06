import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function OrderLineTable({ data = [], onRowSelect, selectedId }) {
  const [filterProduct, setFilterProduct] = useState('');

  const filteredData = data.filter(row => {
    if (filterProduct && !String(row.product ?? '').toLowerCase().includes(filterProduct.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter Product..."
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="pl-8 max-w-xs focus:ring-2 focus:ring-primary focus:outline-none transition-colors duration-200"
            aria-label={"Filter by Product"}
          />
        </div>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-primary/20 bg-muted/40">
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Line No</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Product</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Quantity</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Unit Price</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Discount</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Line Net Amount</TableHead>
            <TableHead className="text-xs font-medium text-blue-800 uppercase tracking-wider">Tax</TableHead>
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
      <p className="text-xs text-muted-foreground">{filteredData.length} of {data.length} records</p>
    </div>
  );
}
