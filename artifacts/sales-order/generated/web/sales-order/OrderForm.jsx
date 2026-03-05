import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function OrderForm({ data, onChange, onSave, onDelete, onProcess }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave?.(data); }} className="space-y-3">
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="documentNo" className="text-sm text-gray-600">Document No *</Label>
          <Input
            id="documentNo"
            name="documentNo"
            type="text"
            value={data?.documentNo ?? ''}
            onChange={(e) => onChange?.('documentNo', e.target.value)} disabled readOnly className="bg-gray-50 text-gray-500" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="businessPartner" className="text-sm text-gray-600">Business Partner *</Label>
          <Input
            id="businessPartner"
            name="businessPartner"
            type="text"
            value={data?.businessPartner ?? ''}
            onChange={(e) => onChange?.('businessPartner', e.target.value)} required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="orderDate" className="text-sm text-gray-600">Order Date *</Label>
          <Input
            id="orderDate"
            name="orderDate"
            type="text"
            value={data?.orderDate ?? ''}
            onChange={(e) => onChange?.('orderDate', e.target.value)} required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="warehouse" className="text-sm text-gray-600">Warehouse *</Label>
          <Input
            id="warehouse"
            name="warehouse"
            type="text"
            value={data?.warehouse ?? ''}
            onChange={(e) => onChange?.('warehouse', e.target.value)} required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency" className="text-sm text-gray-600">Currency *</Label>
          <Input
            id="currency"
            name="currency"
            type="text"
            value={data?.currency ?? ''}
            onChange={(e) => onChange?.('currency', e.target.value)} disabled readOnly className="bg-gray-50 text-gray-500" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="paymentTerms" className="text-sm text-gray-600">Payment Terms</Label>
          <Input
            id="paymentTerms"
            name="paymentTerms"
            type="text"
            value={data?.paymentTerms ?? ''}
            onChange={(e) => onChange?.('paymentTerms', e.target.value)}
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
        <div className="space-y-1.5">
          <Label htmlFor="totalLines" className="text-sm text-gray-600">Total Lines</Label>
          <Input
            id="totalLines"
            name="totalLines"
            type="number"
            value={data?.totalLines ?? ''}
            onChange={(e) => onChange?.('totalLines', e.target.value)} disabled readOnly className="bg-gray-50 text-gray-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="grandTotal" className="text-sm text-gray-600">Grand Total</Label>
          <Input
            id="grandTotal"
            name="grandTotal"
            type="number"
            value={data?.grandTotal ?? ''}
            onChange={(e) => onChange?.('grandTotal', e.target.value)} disabled readOnly className="bg-gray-50 text-gray-500"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="docStatus" className="text-sm text-gray-600">Doc Status *</Label>
          <Input
            id="docStatus"
            name="docStatus"
            type="text"
            value={data?.docStatus ?? ''}
            onChange={(e) => onChange?.('docStatus', e.target.value)} disabled readOnly className="bg-gray-50 text-gray-500" required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="deliveryLocation" className="text-sm text-gray-600">Delivery Location</Label>
          <Input
            id="deliveryLocation"
            name="deliveryLocation"
            type="text"
            value={data?.deliveryLocation ?? ''}
            onChange={(e) => onChange?.('deliveryLocation', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoiceAddress" className="text-sm text-gray-600">Invoice Address</Label>
          <Input
            id="invoiceAddress"
            name="invoiceAddress"
            type="text"
            value={data?.invoiceAddress ?? ''}
            onChange={(e) => onChange?.('invoiceAddress', e.target.value)}
          />
        </div>
      </div>
      <Separator className="my-4" />
      <div className="flex gap-2">
        <Button type="submit" size="sm">Save</Button>
        {onDelete && <Button variant="outline" size="sm" onClick={(e) => { e.preventDefault(); onDelete(); }}>Delete</Button>}
      </div>
      <Separator className="my-4" />
      <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onProcess?.('completeOrder')}>
            Complete Order
          </Button>
          <Button variant="outline" size="sm" onClick={() => onProcess?.('voidOrder')}>
            Void Order
          </Button>
      </div>
    </form>
  );
}
