import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

export function buildReportUrl({ baseUrl = '', reportId, params = {}, format = 'pdf' }) {
  const searchParams = new URLSearchParams({ format });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const encodedReportId = encodeURIComponent(reportId || '');
  return `${baseUrl}/sws/reports/${encodedReportId}?${searchParams.toString()}`;
}

export function ReportViewerFrame({ baseUrl = '', reportId, params, format = 'pdf', title = 'Report' }) {
  const [loading, setLoading] = useState(true);
  const src = useMemo(() => buildReportUrl({ baseUrl, reportId, params, format }), [baseUrl, reportId, params, format]);

  return (
    <section className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 px-4">
        <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
        {loading && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading
          </span>
        )}
      </div>
      <iframe
        title={title}
        src={src}
        className="min-h-0 flex-1 bg-white"
        onLoad={() => setLoading(false)}
      />
    </section>
  );
}
