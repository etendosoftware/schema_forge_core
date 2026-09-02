import { useCallback, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import { acceptAttribute, formatNames } from '../../lib/import/importFormats.js';

const DEFAULT_LABELS = {
  dropHere: 'Drop your file here',
  // {formats} is filled with the window's own declared list, so the hint can no longer claim
  // CSV/TXT while the input quietly accepts something else. Kept as a placeholder rather than a
  // baked sentence because the locale files own the wording, including the conjunction.
  dropHint: 'or select a file. Supported formats: {formats}',
};

/**
 * `formats` is `window.import.formats` — the window's own declaration of what its import eats.
 * It governs BOTH the `accept` attribute and the hint text, so the two cannot disagree; before
 * this, both were hardcoded to CSV/TXT and the declaration was dead config. An explicit
 * `accept` still wins, for a caller that is not import-driven.
 */
export function ImportDropzone({ accept, formats, onFileSelected, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const acceptAttr = accept ?? acceptAttribute(formats);
  const hint = text.dropHint.replace('{formats}', formatNames(formats).join(', '));
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleZoneClick = useCallback(() => inputRef.current?.click(), []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileSelected(file);
  }, [onFileSelected]);

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = '';
  }, [onFileSelected]);

  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="ImportDropzone__zone"
      onClick={handleZoneClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleZoneClick(); } }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
      )}
    >
      {/*
        SHELL-02 — the arrow follows the DATA, not the file: an import pulls records INTO
        Etendo, so it is a Download, and that is the icon the toolbar button that opens this
        dialog already carries (`Download__ListViewImport`). The dropzone shipped with `Upload`
        — reading as "send a file out" — so the popup contradicted the button the user had just
        clicked. Same rule, one icon: do not flip this back to the file's direction.
      */}
      <Download className="h-6 w-6 text-muted-foreground" data-testid="Download__ImportDropzone" />
      <p className="text-sm font-medium text-foreground" data-testid="ImportDropzone__title">{text.dropHere}</p>
      <p className="text-xs text-muted-foreground" data-testid="ImportDropzone__hint">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        onChange={handleInputChange}
        data-testid="ImportDropzone__fileInput"
        className="hidden"
      />
    </div>
  );
}
