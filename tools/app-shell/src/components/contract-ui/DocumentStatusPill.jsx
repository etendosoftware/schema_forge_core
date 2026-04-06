const DOC_STATUS = {
  CO: { label: 'Completed', bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  DR: { label: 'Draft',     bg: '#f3f4f6', color: '#374151', dot: '#9ca3af' },
  VO: { label: 'Voided',    bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  CL: { label: 'Closed',    bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  IP: { label: 'In Process', bg: '#fef3c7', color: '#78350f', dot: '#f59e0b' },
};

export default function DocumentStatusPill({ data }) {
  const docStatus = data?.documentStatus;
  if (!docStatus) return null;

  const ds = DOC_STATUS[docStatus] || { label: docStatus, bg: '#f3f4f6', color: '#374151', dot: '#9ca3af' };

  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px] font-medium"
      style={{ padding: '4px 12px', borderRadius: '6px', backgroundColor: ds.bg, color: ds.color }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ds.dot }} />
      Document Status
      <span style={{ opacity: 0.4 }}>&middot;</span>
      <span className="font-semibold">{ds.label}</span>
    </span>
  );
}
