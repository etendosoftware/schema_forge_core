import { useState, useEffect } from 'react';
import { useUI } from '@/i18n';

/* eslint-disable react/prop-types */

export function BoxIcon({ size = 24, color = '#828FA3' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 8L12 3L3 8M21 8V16L12 21M21 8L12 13M3 8V16L12 21M3 8L12 13M12 21V13" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProductNameCell({ row, token, apiBaseUrl }) {
  const [imgSrc, setImgSrc] = useState(null);
  const imageId = row.image;
  const neoBaseUrl = apiBaseUrl.replace(/\/[^/]+$/, '');

  useEffect(() => {
    if (!imageId) return;
    let objectUrl;
    fetch(`${neoBaseUrl}/image/${imageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob) {
          objectUrl = URL.createObjectURL(blob);
          setImgSrc(objectUrl);
        }
      })
      .catch(() => {});
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageId, token, neoBaseUrl]);

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-[#F5F7F9] flex items-center justify-center overflow-hidden flex-shrink-0">
        {imgSrc
          ? <img src={imgSrc} alt={row.name} className="w-full h-full object-cover" />
          : <BoxIcon />
        }
      </div>
      <div className="flex flex-col justify-center gap-0.5">
        <span className="text-sm font-semibold text-[#121217] leading-5">{row.name}</span>
        {row.searchKey && (
          <span className="inline-flex items-center px-2 py-0.5 bg-[#F5F7F9] rounded-full text-xs text-[#3F3F50] leading-4 w-fit">
            {row.searchKey}
          </span>
        )}
      </div>
    </div>
  );
}

export function ProductPriceCell({ row, token, apiBaseUrl }) {
  const ui = useUI();
  const [price, setPrice] = useState(undefined);

  useEffect(() => {
    if (!row.id) return;
    fetch(`${apiBaseUrl}/price?parentId=${row.id}&_startRow=0&_endRow=10`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const rows = data?.response?.data ?? [];
        const sales = rows.find((r) => {
          const v = r['priceListVersion$salesPriceList'];
          if (typeof v === 'boolean') return v;
          if (typeof v === 'string') return ['true', 'y', 'yes', '1'].includes(v.toLowerCase());
          return false;
        });
        setPrice(sales ? { unit: Number(sales.standardPrice) || 0, list: Number(sales.listPrice) || 0 } : null);
      })
      .catch(() => setPrice(null));
  }, [row.id, token, apiBaseUrl]);

  if (price === undefined) return <span className="text-muted-foreground text-sm">—</span>;
  if (price === null) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-[#121217] whitespace-nowrap">{price.unit.toFixed(2)} €</span>
      <span className="text-xs text-[#555B6D] whitespace-nowrap">{ui('priceSalesPrice')} {price.list.toFixed(2)} €</span>
    </div>
  );
}

export function ProductStockCell({ row, token, apiBaseUrl }) {
  const [stock, setStock] = useState(undefined);

  useEffect(() => {
    if (!row.id) return;
    fetch(`${apiBaseUrl}/stock?parentId=${row.id}&_startRow=0&_endRow=200`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const rows = data?.response?.data ?? [];
        setStock(rows.reduce((s, r) => s + (Number(r.quantityOnHand) || 0), 0));
      })
      .catch(() => setStock(null));
  }, [row.id, token, apiBaseUrl]);

  if (stock === undefined) return <span className="text-muted-foreground text-sm">—</span>;
  if (stock === null) return <span className="text-muted-foreground text-sm">—</span>;
  return <span className="text-sm text-[#121217]">{stock}</span>;
}
