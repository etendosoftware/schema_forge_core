import { Edit2, Mail, Download } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

export default function PreviewActionButtons({
  triggerEdit,
  onEmail,
  onDownloadPdf,
  hasPdf,
  sendLabel,
  downloadLabel,
  editLabel,
}) {
  return (
    <>
      <Button
        size="sm"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-[#121217] hover:bg-[#2a2a30] text-white [&_svg]:size-5"
        onClick={onEmail}
      >
        <Mail />
        {sendLabel}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] disabled:opacity-40 disabled:cursor-not-allowed [&_svg]:size-5"
        disabled={!hasPdf}
        onClick={hasPdf ? onDownloadPdf : undefined}
      >
        <Download className="text-[#828FA3]" />
        {downloadLabel}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="gap-1 px-2 py-1 h-8 rounded-lg text-sm font-medium bg-white border-[#D1D4DB] shadow-sm text-[#121217] [&_svg]:size-5"
        onClick={triggerEdit}
      >
        <Edit2 className="text-[#828FA3]" />
        {editLabel}
      </Button>
    </>
  );
}

export function PreviewEmptyPanel({ icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-20">
      <span className="text-3xl">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}
