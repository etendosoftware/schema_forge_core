import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OrderLineForm({ data, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="product" className="text-sm text-foreground font-medium">Product *</Label>
          <Input
            id="product"
            name="product"
            type="text"
            value={data?.product ?? ''}
            onChange={(e) => onChange?.('product', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quantity" className="text-sm text-foreground font-medium">Quantity *</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            value={data?.quantity ?? ''}
            onChange={(e) => onChange?.('quantity', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unitPrice" className="text-sm text-foreground font-medium">Unit Price *</Label>
          <Input
            id="unitPrice"
            name="unitPrice"
            type="number"
            value={data?.unitPrice ?? ''}
            onChange={(e) => onChange?.('unitPrice', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discount" className="text-sm text-foreground font-medium">Discount</Label>
          <Input
            id="discount"
            name="discount"
            type="number"
            value={data?.discount ?? ''}
            onChange={(e) => onChange?.('discount', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tax" className="text-sm text-foreground font-medium">Tax</Label>
          <Input
            id="tax"
            name="tax"
            type="text"
            value={data?.tax ?? ''}
            onChange={(e) => onChange?.('tax', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm text-foreground font-medium">Description</Label>
          <Input
            id="description"
            name="description"
            type="text"
            value={data?.description ?? ''}
            onChange={(e) => onChange?.('description', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
    </div>
  );
}
