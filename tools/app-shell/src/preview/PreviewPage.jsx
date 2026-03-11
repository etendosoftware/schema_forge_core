import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';

import orderPageSource from '../../../../artifacts/sales-order/generated/web/sales-order/OrderPage.jsx?raw';
import orderTableSource from '../../../../artifacts/sales-order/generated/web/sales-order/OrderTable.jsx?raw';
import orderFormSource from '../../../../artifacts/sales-order/generated/web/sales-order/OrderForm.jsx?raw';
import orderLineTableSource from '../../../../artifacts/sales-order/generated/web/sales-order/OrderLineTable.jsx?raw';

import * as mockDataModule from '@generated/sales-order/generated/web/sales-order/mockData.js';

const COMPONENTS = [
  { name: 'OrderPage', source: orderPageSource },
  { name: 'OrderTable', source: orderTableSource },
  { name: 'OrderForm', source: orderFormSource },
  { name: 'OrderLineTable', source: orderLineTableSource },
];

/**
 * Strip ES module imports and convert exports so the code can run
 * inside a plain script context (Babel standalone in the iframe).
 */
function prepareCodeForIframe(source) {
  return source
    .split('\n')
    .filter((line) => !line.match(/^\s*import\s+.*\s+from\s+['"]/))
    .join('\n')
    .replace(
      /export\s+default\s+function\s+(\w+)\s*\(/g,
      'exports.default = function $1(',
    )
    .replace(/\bexport\s+/g, '');
}

/**
 * Join multiple prepared source files into a single code string
 * that can be sent to the preview iframe.
 */
function buildPreviewCode(sources) {
  return sources.map(prepareCodeForIframe).join('\n\n');
}

export default function PreviewPage() {
  const [activeComponent, setActiveComponent] = useState('OrderPage');
  const iframeRef = useRef(null);
  const [iframeReady, setIframeReady] = useState(false);

  const sendToIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !iframeReady) return;

    const selected = COMPONENTS.find((c) => c.name === activeComponent);
    if (!selected) return;

    const code = buildPreviewCode([selected]);

    iframe.contentWindow.postMessage(
      {
        type: 'preview-render',
        code,
        mockData: JSON.parse(JSON.stringify(mockDataModule)),
      },
      '*',
    );
  }, [activeComponent, iframeReady]);

  useEffect(() => {
    sendToIframe();
  }, [sendToIframe]);

  const handleIframeLoad = useCallback(() => {
    setIframeReady(true);
  }, []);

  // When iframeReady flips to true, send the initial payload
  useEffect(() => {
    if (iframeReady) {
      sendToIframe();
    }
  }, [iframeReady, sendToIframe]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-2 border-b bg-background">
        {COMPONENTS.map((comp) => (
          <Button
            key={comp.name}
            variant={activeComponent === comp.name ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveComponent(comp.name)}
          >
            {comp.name}
          </Button>
        ))}
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={sendToIframe}>
          Refresh
        </Button>
      </div>
      <iframe
        ref={iframeRef}
        src="/preview.html"
        sandbox="allow-scripts"
        title="Component Preview"
        className="flex-1 w-full border-0"
        onLoad={handleIframeLoad}
      />
    </div>
  );
}
