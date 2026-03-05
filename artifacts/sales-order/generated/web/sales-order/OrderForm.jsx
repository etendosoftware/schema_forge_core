import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function OrderForm({ data, onChange, onSave, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="documentNo">Document No *</Label>
          <Input
            id="documentNo"
            name="documentNo"
            type="text"
            value={data?.documentNo ?? ''}
            onChange={(e) => onChange?.('documentNo', e.target.value)} disabled readOnly className="bg-muted" required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="businessPartner">Business Partner *</Label>
          <Input
            id="businessPartner"
            name="businessPartner"
            type="text"
            value={data?.businessPartner ?? ''}
            onChange={(e) => onChange?.('businessPartner', e.target.value)} required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="orderDate">Order Date *</Label>
          <Input
            id="orderDate"
            name="orderDate"
            type="text"
            value={data?.orderDate ?? ''}
            onChange={(e) => onChange?.('orderDate', e.target.value)} required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="warehouse">Warehouse *</Label>
          <Input
            id="warehouse"
            name="warehouse"
            type="text"
            value={data?.warehouse ?? ''}
            onChange={(e) => onChange?.('warehouse', e.target.value)} required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency *</Label>
          <Input
            id="currency"
            name="currency"
            type="text"
            value={data?.currency ?? ''}
            onChange={(e) => onChange?.('currency', e.target.value)} disabled readOnly className="bg-muted" required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paymentTerms">Payment Terms</Label>
          <Input
            id="paymentTerms"
            name="paymentTerms"
            type="text"
            value={data?.paymentTerms ?? ''}
            onChange={(e) => onChange?.('paymentTerms', e.target.value)}
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
        <div className="space-y-2">
          <Label htmlFor="totalLines">Total Lines</Label>
          <Input
            id="totalLines"
            name="totalLines"
            type="number"
            value={data?.totalLines ?? ''}
            onChange={(e) => onChange?.('totalLines', e.target.value)} disabled readOnly className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="grandTotal">Grand Total</Label>
          <Input
            id="grandTotal"
            name="grandTotal"
            type="number"
            value={data?.grandTotal ?? ''}
            onChange={(e) => onChange?.('grandTotal', e.target.value)} disabled readOnly className="bg-muted"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="docStatus">Doc Status *</Label>
          <Input
            id="docStatus"
            name="docStatus"
            type="text"
            value={data?.docStatus ?? ''}
            onChange={(e) => onChange?.('docStatus', e.target.value)} disabled readOnly className="bg-muted" required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deliveryLocation">Delivery Location</Label>
          <Input
            id="deliveryLocation"
            name="deliveryLocation"
            type="text"
            value={data?.deliveryLocation ?? ''}
            onChange={(e) => onChange?.('deliveryLocation', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoiceAddress">Invoice Address</Label>
          <Input
            id="invoiceAddress"
            name="invoiceAddress"
            type="text"
            value={data?.invoiceAddress ?? ''}
            onChange={(e) => onChange?.('invoiceAddress', e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
      </div>
      <Separator />
      <div className="flex gap-2">
          <Button variant="outline" onClick={() => onProcess?.('completeOrder')}>
            Complete Order
          </Button>
          <Button variant="outline" onClick={() => onProcess?.('voidOrder')}>
            Void Order
          </Button>
      </div>
    </form>
  );
}
