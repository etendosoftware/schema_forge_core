import { EntityForm } from '@/components/contract-ui';

// @sf-generated-start fields:productPo
const fields = [
  { key: 'businessPartner', column: 'C_BPartner_ID', type: 'search', required: true, readOnly: true, section: 'other', reference: 'BusinessPartner', inputMode: 'search', defaultValue: '@C_BPartner_ID@' },
  { key: 'qualityRating', column: 'QualityRating', type: 'number', section: 'principal' },
  { key: 'currentVendor', column: 'IsCurrentVendor', type: 'checkbox', required: true, section: 'principal', defaultValue: 'Y' },
  { key: 'uPCEAN', column: 'UPC', type: 'text', section: 'principal' },
  { key: 'currency', column: 'C_Currency_ID', type: 'selector', section: 'principal', reference: 'Currency', inputMode: 'selector' },
  { key: 'listPrice', column: 'PriceList', type: 'text', section: 'other' },
  { key: 'priceEffectiveFrom', column: 'PriceEffective', type: 'date', section: 'other' },
  { key: 'purchaseOrderPrice', column: 'PricePO', type: 'text', section: 'other' },
  { key: 'lastPurchasePrice', column: 'PriceLastPO', type: 'text', readOnly: true, section: 'other' },
  { key: 'lastInvoicePrice', column: 'PriceLastInv', type: 'text', readOnly: true, section: 'other' },
  { key: 'uOM', column: 'C_UOM_ID', type: 'selector', section: 'other', reference: 'UOM', inputMode: 'selector' },
  { key: 'minimumOrderQty', column: 'Order_Min', type: 'text', section: 'other' },
  { key: 'quantityPerPackage', column: 'Order_Pack', type: 'text', section: 'other' },
  { key: 'purchasingLeadTime', column: 'DeliveryTime_Promised', type: 'number', section: 'other' },
  { key: 'fixedCostPerOrder', column: 'CostPerOrder', type: 'number', section: 'other' },
  { key: 'vendorProductNo', column: 'VendorProductNo', type: 'text', section: 'other', defaultValue: '@Value@' },
  { key: 'vendorCategory', column: 'VendorCategory', type: 'text', section: 'other' },
  { key: 'discontinued', column: 'Discontinued', type: 'checkbox', section: 'other' },
  { key: 'quantityType', column: 'Qtytype', type: 'select', section: 'other', options: [{ value: 'E', label: 'Exact' }, { value: 'M', label: 'Multiple' }] },
  { key: 'manufacturer', column: 'Manufacturer', type: 'text', section: 'other' },
  { key: 'standardQuantity', column: 'Qtystd', type: 'text', section: 'other' },
  { key: 'capacity', column: 'Capacity', type: 'text', section: 'other' },
];
// @sf-generated-end fields:productPo

// @sf-generated-start component:ProductPoForm
export default function ProductPoForm(props) {
  // @sf-custom-slot hooks:ProductPoForm
  return <EntityForm fields={fields} {...props} />;
}
// @sf-generated-end component:ProductPoForm

// @sf-custom-slot section:ProductPoForm-custom
