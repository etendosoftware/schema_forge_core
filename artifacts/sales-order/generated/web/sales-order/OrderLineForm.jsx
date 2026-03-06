import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function OrderLineForm({ data, onChange, onSave, onDelete, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-4">
      <div className="space-y-3 rounded-lg border p-4 bg-muted/20">
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
      <div className="space-y-3 rounded-lg border border-dashed p-4 bg-muted/10">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">System Fields</p>
        <div className="space-y-1.5">
          <Label htmlFor="lineNo" className="text-sm text-muted-foreground">Line No *</Label>
          <Input
            id="lineNo"
            name="lineNo"
            type="number"
            value={data?.lineNo ?? ''}
            onChange={(e) => onChange?.('lineNo', e.target.value)} disabled readOnly className="bg-muted/50 text-muted-foreground border-dashed cursor-not-allowed" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lineNetAmount" className="text-sm text-muted-foreground">Line Net Amount</Label>
          <Input
            id="lineNetAmount"
            name="lineNetAmount"
            type="number"
            value={data?.lineNetAmount ?? ''}
            onChange={(e) => onChange?.('lineNetAmount', e.target.value)} disabled readOnly className="bg-muted/50 text-muted-foreground border-dashed cursor-not-allowed"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" size="sm">Save</Button>
        {onDelete && <Button variant="destructive" size="sm" onClick={(e) => { e.preventDefault(); onDelete(); }}>Delete</Button>}
      </div>
    </form>
  );
}
