import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function OrderForm({ data, onChange, onSave, onDelete, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 rounded-lg border p-4 bg-muted/20">
        <div className="space-y-1.5">
          <Label htmlFor="businessPartner" className="text-sm text-foreground font-medium">Business Partner *</Label>
          <Input
            id="businessPartner"
            name="businessPartner"
            type="text"
            value={data?.businessPartner ?? ''}
            onChange={(e) => onChange?.('businessPartner', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orderDate" className="text-sm text-foreground font-medium">Order Date *</Label>
          <Input
            id="orderDate"
            name="orderDate"
            type="text"
            value={data?.orderDate ?? ''}
            onChange={(e) => onChange?.('orderDate', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="warehouse" className="text-sm text-foreground font-medium">Warehouse *</Label>
          <Input
            id="warehouse"
            name="warehouse"
            type="text"
            value={data?.warehouse ?? ''}
            onChange={(e) => onChange?.('warehouse', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentTerms" className="text-sm text-foreground font-medium">Payment Terms</Label>
          <Input
            id="paymentTerms"
            name="paymentTerms"
            type="text"
            value={data?.paymentTerms ?? ''}
            onChange={(e) => onChange?.('paymentTerms', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none"
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
        <div className="space-y-1.5">
          <Label htmlFor="deliveryLocation" className="text-sm text-foreground font-medium">Delivery Location</Label>
          <Input
            id="deliveryLocation"
            name="deliveryLocation"
            type="text"
            value={data?.deliveryLocation ?? ''}
            onChange={(e) => onChange?.('deliveryLocation', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoiceAddress" className="text-sm text-foreground font-medium">Invoice Address</Label>
          <Input
            id="invoiceAddress"
            name="invoiceAddress"
            type="text"
            value={data?.invoiceAddress ?? ''}
            onChange={(e) => onChange?.('invoiceAddress', e.target.value)} className="focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="space-y-3 rounded-lg border border-dashed p-4 bg-muted/10">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">System Fields</p>
        <div className="space-y-1.5">
          <Label htmlFor="documentNo" className="text-sm text-muted-foreground">Document No *</Label>
          <Input
            id="documentNo"
            name="documentNo"
            type="text"
            value={data?.documentNo ?? ''}
            onChange={(e) => onChange?.('documentNo', e.target.value)} disabled readOnly className="bg-muted/50 text-muted-foreground border-dashed cursor-not-allowed" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-sm text-muted-foreground">Currency *</Label>
          <Input
            id="currency"
            name="currency"
            type="text"
            value={data?.currency ?? ''}
            onChange={(e) => onChange?.('currency', e.target.value)} disabled readOnly className="bg-muted/50 text-muted-foreground border-dashed cursor-not-allowed" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="totalLines" className="text-sm text-muted-foreground">Total Lines</Label>
          <Input
            id="totalLines"
            name="totalLines"
            type="number"
            value={data?.totalLines ?? ''}
            onChange={(e) => onChange?.('totalLines', e.target.value)} disabled readOnly className="bg-muted/50 text-muted-foreground border-dashed cursor-not-allowed"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grandTotal" className="text-sm text-muted-foreground">Grand Total</Label>
          <Input
            id="grandTotal"
            name="grandTotal"
            type="number"
            value={data?.grandTotal ?? ''}
            onChange={(e) => onChange?.('grandTotal', e.target.value)} disabled readOnly className="bg-muted/50 text-muted-foreground border-dashed cursor-not-allowed"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="docStatus" className="text-sm text-muted-foreground">Doc Status *</Label>
          <Input
            id="docStatus"
            name="docStatus"
            type="text"
            value={data?.docStatus ?? ''}
            onChange={(e) => onChange?.('docStatus', e.target.value)} disabled readOnly className="bg-muted/50 text-muted-foreground border-dashed cursor-not-allowed" required
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" size="sm">Save</Button>
        {onDelete && <Button variant="destructive" size="sm" onClick={(e) => { e.preventDefault(); onDelete(); }}>Delete</Button>}
      </div>
      <div className="rounded-lg border p-4 bg-muted/10 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => onProcess?.('completeOrder')}>
            Complete Order
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onProcess?.('voidOrder')}>
            Void Order
          </Button>
        </div>
      </div>
    </form>
  );
}
