import { cn } from '@/lib/utils';

export default function ResponseViewer({ response }) {
  if (!response) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-600 text-sm">
        Send a request to see the response
      </div>
    );
  }

  const { status, statusText, elapsed, body } = response;

  const statusColor =
    status >= 200 && status < 300 ? 'text-green-400' :
    status >= 400 && status < 500 ? 'text-amber-400' :
    status >= 500 ? 'text-red-400' :
    'text-zinc-400';

  const formatted = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body);

  return (
    <div className="flex flex-col gap-2">
      {/* Status bar */}
      <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800 rounded border border-zinc-700">
        <span className={cn('font-mono font-bold text-sm', statusColor)}>
          {status}
        </span>
        <span className="text-xs text-zinc-500">{statusText}</span>
        <span className="ml-auto text-xs text-zinc-500">{elapsed}ms</span>
      </div>

      {/* Response body */}
      <div className="relative">
        <pre className="bg-zinc-900 border border-zinc-800 rounded p-3 overflow-auto max-h-[500px] text-xs font-mono text-zinc-300 leading-relaxed">
          {formatted}
        </pre>
      </div>
    </div>
  );
}
