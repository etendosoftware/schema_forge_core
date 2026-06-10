import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Upload, X, ImageIcon, Loader2, ZoomIn } from 'lucide-react';
import { useUI } from '@/i18n';

/**
 * ImageField — shows a product image and allows upload.
 *
 * Display: fetches binary via GET /sws/neo/image/{imageId} with JWT auth.
 * Upload: sends base64 via POST /sws/neo/image, gets imageId back.
 *
 * Props:
 *  - imageId: current AD_Image_ID value (string UUID or empty)
 *  - onChange: (newImageId) => void — called after a successful upload
 *  - token: JWT token for authenticated requests
 *  - apiBaseUrl: base URL like "/sws/neo" or "/etendo/sws/neo"
 *  - readOnly: boolean
 *  - fieldKey: string (for data-testid)
 *  - stretch: boolean — fill the available height (via an absolutely positioned
 *    preview, so the image never expands the grid row) instead of a fixed 176px box
 */
export function ImageField({ imageId, onChange, token, apiBaseUrl, readOnly = false, fieldKey = 'image', stretch = false }) {
  const ui = useUI();
  const [blobUrl, setBlobUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const inputRef = useRef(null);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);
  useEscapeKey(lightboxOpen, closeLightbox);

  const imageBase = apiBaseUrl
    ? apiBaseUrl.replace(/\/sws\/neo.*/, '/sws/neo') + '/image'
    : '/sws/neo/image';

  // Load image blob when imageId changes
  useEffect(() => {
    if (!imageId || !token) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    fetch(`${imageBase}/${imageId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.blob() : null)
      .then(blob => {
        if (!cancelled && blob) {
          setBlobUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [imageId, token, imageBase]);

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, []);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';

    setError(null);
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch(imageBase, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, mimeType: file.type || 'application/octet-stream', data: base64 }),
      });
      if (!res.ok) throw new Error(await res.text() || `Upload failed (${res.status})`);
      const { imageId: newId } = await res.json();
      if (!newId) throw new Error('No imageId returned from server');
      onChange?.(newId);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const openFilePicker = () => inputRef.current?.click();

  const handlePreviewClick = () => {
    if (blobUrl) {
      setLightboxOpen(true);
      return;
    }
    if (!readOnly) openFilePicker();
  };

  return (
    <>
      <div data-testid={`field-${fieldKey}`} className={`flex flex-col gap-1${stretch ? ' h-full' : ''}`}>
        {stretch ? (
          // In stretch mode the preview is absolutely positioned so the image
          // never contributes to grid track sizing (which would expand the row).
          // The wrapper fills the available height; min-h keeps the empty state usable.
          <div className="relative flex-1 min-h-[176px]">
            <div className={buildPreviewClass(stretch, readOnly, blobUrl)} onClick={handlePreviewClick}>
              <ImagePreview
                blobUrl={blobUrl}
                imageId={imageId}
                uploading={uploading}
                readOnly={readOnly}
                ui={ui}
                onRemove={() => onChange?.('')}
                onUpload={openFilePicker}
              />
            </div>
          </div>
        ) : (
          <div className={buildPreviewClass(stretch, readOnly, blobUrl)} onClick={handlePreviewClick}>
            <ImagePreview
              blobUrl={blobUrl}
              imageId={imageId}
              uploading={uploading}
              readOnly={readOnly}
              ui={ui}
              onRemove={() => onChange?.('')}
              onUpload={openFilePicker}
            />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          tabIndex={-1}
          style={{ visibility: 'hidden', position: 'absolute', width: 0, height: 0 }}
        />

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {lightboxOpen && blobUrl && <ImageLightbox blobUrl={blobUrl} onClose={closeLightbox} />}
    </>
  );
}

/** Close the active overlay when the Escape key is pressed. */
function useEscapeKey(active, onEscape) {
  useEffect(() => {
    if (!active) return;
    const handler = (e) => { if (e.key === 'Escape') onEscape(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, onEscape]);
}

/** Build the className for the preview box, including stretch and cursor affordances. */
function buildPreviewClass(stretch, readOnly, blobUrl) {
  return [
    `${stretch ? 'absolute inset-0' : 'relative w-full h-44'} rounded-2xl border border-gray-200/70 bg-gray-50/50 flex flex-col items-center justify-center overflow-hidden group`,
    !readOnly && !blobUrl ? 'cursor-pointer hover:border-gray-400 transition-colors' : '',
    blobUrl ? 'cursor-zoom-in' : '',
  ].join(' ');
}

/** Inner content of the preview box: either the image with hover actions, or the empty placeholder. */
function ImagePreview({ blobUrl, imageId, uploading, readOnly, ui, onRemove, onUpload }) {
  if (blobUrl) {
    return (
      <>
        <img src={blobUrl} alt="Product" className="max-w-full max-h-full object-contain" />
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none flex items-center justify-center">
          <ZoomIn className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>
        {!readOnly && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Remove image"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={(e) => { e.stopPropagation(); onUpload(); }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/50 text-white text-xs font-medium hover:bg-black/70 disabled:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {ui('uploadImage')}
            </button>
          </>
        )}
      </>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 text-muted-foreground px-3 text-center">
      {uploading
        ? <Loader2 className="h-7 w-7 animate-spin" />
        : <ImageIcon className="h-7 w-7" />
      }
      <span className="text-xs">{imageId ? 'Loading…' : ui('noImage')}</span>
      {!readOnly && !uploading && (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 group-hover:text-gray-700 mt-1">
          <Upload className="h-3.5 w-3.5" />
          {ui('uploadImage')}
        </span>
      )}
    </div>
  );
}

/** Full-screen image preview rendered in document.body via portal to escape any stacking context. */
function ImageLightbox({ blobUrl, onClose }) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>
      <img
        src={blobUrl}
        alt="Product"
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
