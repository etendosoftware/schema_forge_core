import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useUI } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { useStatementImport } from '@/hooks/useStatementImport';

/**
 * Modal dialog for uploading a C43 bank statement file.
 *
 * @param {{
 *   open: boolean;
 *   accountId: string;
 *   onClose: () => void;
 *   onSuccess: () => void;
 * }} props
 */
export function UploadStatementDialog({ open, accountId, onClose, onSuccess }) {
  const ui = useUI();
  const { importStatement, importing } = useStatementImport();
  const inputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      const contentBase64 = await fileToBase64(selectedFile);
      await importStatement({ accountId, fileName: selectedFile.name, contentBase64 });
      toast.success(ui('financeAccountStatementsImportSuccess'));
      setSelectedFile(null);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(ui('financeAccountStatementsImportError'));
    }
  };

  const handleOpenChange = (isOpen) => {
    if (!isOpen) {
      setSelectedFile(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{ui('financeAccountStatementsImportDialogTitle')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <p className="text-sm text-[#6c6c89]">
            {ui('financeAccountStatementsImportDialogDescription')}
          </p>

          <div
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[#D1D4DB] p-8 text-center transition-colors hover:border-[#121217] hover:bg-[#F5F7F9]"
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".c43,.43,.txt,.nor"
              onChange={handleFileChange}
              className="sr-only"
              aria-label={ui('financeAccountStatementsImportFileInput')}
            />
            {selectedFile ? (
              <span className="text-sm font-medium text-[#121217]">{selectedFile.name}</span>
            ) : (
              <>
                <span className="text-sm font-medium text-[#121217]">
                  {ui('financeAccountStatementsImportDropzone')}
                </span>
                <span className="text-xs text-[#6c6c89]">
                  {ui('financeAccountStatementsImportDropzoneHint')}
                </span>
              </>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-lg border border-[#D1D4DB] bg-white px-4 text-sm font-medium text-[#121217] hover:bg-[#F5F7F9]"
              >
                {ui('financeAccountStatementsImportCancel')}
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={!selectedFile || importing}
              className="inline-flex h-10 items-center rounded-lg bg-[#121217] px-4 text-sm font-medium text-white hover:bg-[#FFD500] hover:text-[#121217] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing
                ? ui('financeAccountStatementsImportUploading')
                : ui('financeAccountStatementsImportConfirm')}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
