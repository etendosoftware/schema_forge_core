import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function OrderLineForm({ data, onChange, onSave, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="lineNo">Line No *</Label>
          <Input
            id="lineNo"
            name="lineNo"
            type="number"
            value={data?.lineNo ?? ''}
            onChange={(e) => onChange?.('lineNo', e.target.value)} disabled readOnly className="bg-muted" required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="product">Product *</Label>
          <Input
            id="product"
            name="product"
            type="text"
            value={data?.product ?? ''}
            onChange={(e) => onChange?.('product', e.target.value)} required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity *</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            value={data?.quantity ?? ''}
            onChange={(e) => onChange?.('quantity', e.target.value)} required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitPrice">Unit Price *</Label>
          <Input
            id="unitPrice"
            name="unitPrice"
            type="number"
            value={data?.unitPrice ?? ''}
            onChange={(e) => onChange?.('unitPrice', e.target.value)} required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discount">Discount</Label>
          <Input
            id="discount"
            name="discount"
            type="number"
            value={data?.discount ?? ''}
            onChange={(e) => onChange?.('discount', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lineNetAmount">Line Net Amount</Label>
          <Input
            id="lineNetAmount"
            name="lineNetAmount"
            type="number"
            value={data?.lineNetAmount ?? ''}
            onChange={(e) => onChange?.('lineNetAmount', e.target.value)} disabled readOnly className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tax">Tax</Label>
          <Input
            id="tax"
            name="tax"
            type="text"
            value={data?.tax ?? ''}
            onChange={(e) => onChange?.('tax', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            type="text"
            value={data?.description ?? ''}
            onChange={(e) => onChange?.('description', e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
