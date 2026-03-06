import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function OrderForm({ data, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-3">
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
  );
}
