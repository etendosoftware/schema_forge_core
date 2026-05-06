import { useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useUI } from '@/i18n';
import { useCopilot } from '@/components/CopilotContext';
import { getOcrDocType } from './ocrDocTypes';
import { useOcrExtraction } from './useOcrExtraction';
import { useOcrFlow } from './useOcrFlow';

/* eslint-disable react/prop-types */

export default function OcrInlineUploader({
  docTypeId,
  isNew,
  apiBaseUrl,
  onRefresh,
  token: tokenProp,
  // Legacy props kept for backward compat with DetailView's slot bag:
  // - onFieldChange / onSave / onAddChild / entity were used by the previous
  //   client-side orchestration. The /batch endpoint owns persistence now,
  //   so these are accepted-but-ignored. DetailView still passes them.
  // eslint-disable-next-line no-unused-vars
  onFieldChange, onSave, onAddChild, entity, ...slotRest
}) {
  const ui = useUI();
  const { token: copilotToken } = useCopilot();
  const token = tokenProp || copilotToken;
  const docType = getOcrDocType(docTypeId);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { result, loading: applying, pendingModal } = useOcrFlow({
    docTypeId,
    token,
    apiBaseUrl,
    onRefresh,
  });
  const { extract, status, error, reset } = useOcrExtraction({
    token,
    toolName: docType?.toolName,
    question: docType?.question,
    structuredOutput: docType?.structuredOutput,
  });

  if (!isNew || !docType) return null;

  const isBusy = applying || status === 'uploading' || status === 'extracting';

  const loadFile = (picked) => {
    if (!picked) return;
    setFile(picked);
    reset();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const handleExtract = async () => {
    if (!file || isBusy) return;
    try {
      const payload = await extract(file);
      window.dispatchEvent(new CustomEvent(docType.eventName, { detail: payload }));
    } catch {
      // surfaced via status/error
    }
  };

  const clearFile = () => {
    setFile(null);
    reset();
  };

  return (
    <div className="mb-3">
      <div
        onDrop={handleDrop}
        onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsDragOver(false); }}
        className={`flex items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
          isDragOver ? 'border-primary bg-primary/5' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <Upload className="h-5 w-5 shrink-0 text-gray-500" />
        <div className="flex-1 min-w-0">
          {file ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="truncate font-medium text-foreground">{file.name}</span>
              <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
              <button
                type="button"
                onClick={clearFile}
                disabled={isBusy}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label={ui('cancel')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="text-sm">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="font-medium text-primary hover:underline"
              >
                {ui('ocrInlinePickPdf')}
              </button>
              <span className="text-muted-foreground"> {ui('ocrInlineDropHint')}</span>
            </div>
          )}
          {status === 'uploading' && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {ui('ocrUploading')}
            </div>
          )}
          {(status === 'extracting' || applying) && (
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {ui('ocrExtracting')}
            </div>
          )}
          {status === 'error' && (
            <div className="mt-1 flex items-start gap-2 text-xs text-red-600">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{error || ui('ocrFailed')}</span>
            </div>
          )}
          {result && status === 'done' && !applying && (
            <div className="mt-1 flex items-center gap-2 text-xs text-emerald-600">
              <CheckCircle2 className="h-3 w-3" />
              {ui('ocrDone')}
              {result.linesCreated > 0 && ` · ${ui('ocrLinesCreated', { count: result.linesCreated })}`}
              {result.linesFailed > 0 && (
                <span className="text-amber-600"> · {ui('ocrLinesFailed', { count: result.linesFailed })}</span>
              )}
              {result.unresolved?.length > 0 && (
                <span className="text-amber-600"> · {result.unresolved.length} {ui('ocrUnresolved')}</span>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={file ? handleExtract : () => inputRef.current?.click()}
          disabled={isBusy}
          className="shrink-0 rounded-md border border-gray-900 px-3 py-1.5 text-xs font-medium text-gray-900 transition-colors hover:bg-gray-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? ui('ocrProcessing') : (file ? ui('ocrExtractFill') : ui('ocrInlineBrowse'))}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => { loadFile(event.target.files?.[0]); event.target.value = ''; }}
        />
      </div>
      {pendingModal}
    </div>
  );
}