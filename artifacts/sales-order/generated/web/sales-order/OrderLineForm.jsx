import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function OrderLineForm({ data, onChange, onSave, onDelete, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-3">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="lineNo" className="text-sm text-gray-600">Line No *</Label>
          <Input
            id="lineNo"
            name="lineNo"
            type="number"
            value={data?.lineNo ?? ''}
            onChange={(e) => onChange?.('lineNo', e.target.value)} disabled readOnly className="bg-gray-50 text-gray-500" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product" className="text-sm text-gray-600">Product *</Label>
          <Input
            id="product"
            name="product"
            type="text"
            value={data?.product ?? ''}
            onChange={(e) => onChange?.('product', e.target.value)} required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quantity" className="text-sm text-gray-600">Quantity *</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            value={data?.quantity ?? ''}
            onChange={(e) => onChange?.('quantity', e.target.value)} required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitPrice" className="text-sm text-gray-600">Unit Price *</Label>
          <Input
            id="unitPrice"
            name="unitPrice"
            type="number"
            value={data?.unitPrice ?? ''}
            onChange={(e) => onChange?.('unitPrice', e.target.value)} required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discount" className="text-sm text-gray-600">Discount</Label>
          <Input
            id="discount"
            name="discount"
            type="number"
            value={data?.discount ?? ''}
            onChange={(e) => onChange?.('discount', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lineNetAmount" className="text-sm text-gray-600">Line Net Amount</Label>
          <Input
            id="lineNetAmount"
            name="lineNetAmount"
            type="number"
            value={data?.lineNetAmount ?? ''}
            onChange={(e) => onChange?.('lineNetAmount', e.target.value)} disabled readOnly className="bg-gray-50 text-gray-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tax" className="text-sm text-gray-600">Tax</Label>
          <Input
            id="tax"
            name="tax"
            type="text"
            value={data?.tax ?? ''}
            onChange={(e) => onChange?.('tax', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm text-gray-600">Description</Label>
          <Input
            id="description"
            name="description"
            type="text"
            value={data?.description ?? ''}
            onChange={(e) => onChange?.('description', e.target.value)}
          />
        </div>
      </div>
      <Separator className="my-4" />
      <div className="flex gap-2">
        <Button type="submit" size="sm">Save</Button>
        {onDelete && <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); onDelete(); }}>Delete</Button>}
      </div>
    </form>
  );
}
