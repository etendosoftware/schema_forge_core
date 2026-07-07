import { useCallback, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '../../lib/utils.js';

const DEFAULT_LABELS = {
  dropHere: 'Drop your file here',
  dropHint: 'or select a file. Supported formats: CSV or TXT',
};

export function ImportDropzone({ accept = '.csv,.txt', onFileSelected, labels }) {
  const text = { ...DEFAULT_LABELS, ...labels };
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
      <Upload className="h-6 w-6 text-muted-foreground" data-testid="Upload__607f9c" />
      <p className="text-sm font-medium text-foreground" data-testid="ImportDropzone__title">{text.dropHere}</p>
      <p className="text-xs text-muted-foreground" data-testid="ImportDropzone__hint">{text.dropHint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        data-testid="ImportDropzone__fileInput"
        className="hidden"
      />
    </div>
  );
}
