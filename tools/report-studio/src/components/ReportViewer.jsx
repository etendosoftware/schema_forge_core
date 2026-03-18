import { useRef, useEffect } from 'react';

export default function ReportViewer({ html, loading }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!iframeRef.current || !html) return;
    const doc = iframeRef.current.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full mx-auto mb-2"></div>
          <span className="text-sm">Rendering report...</span>
        </div>
      </div>
    );
  }

  if (!html) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <div className="text-center">
          <div className="text-4xl mb-2">📄</div>
          <span className="text-sm">Select an artifact and click Refresh to preview</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-4">
      <div className="bg-white rounded-lg shadow-lg h-full overflow-hidden">
        <iframe
          ref={iframeRef}
          title="Report Preview"
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
