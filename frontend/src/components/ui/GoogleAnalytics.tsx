'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    dataLayer?: IArguments[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,20}$/i;

export default function GoogleAnalytics({ initialMeasurementId = '' }: { initialMeasurementId?: string }) {
  const pathname = usePathname();
  const [measurementId, setMeasurementId] = useState('');
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('__sitePreviewChannel')) {
      return;
    }

    if (!MEASUREMENT_ID_PATTERN.test(initialMeasurementId)) return;
    const timer = window.setTimeout(() => setMeasurementId(initialMeasurementId), 0);
    return () => window.clearTimeout(timer);
  }, [initialMeasurementId]);

  useEffect(() => {
    if (!scriptReady || !measurementId) return;
    window.gtag?.('event', 'page_view', { page_path: pathname });
  }, [measurementId, pathname, scriptReady]);

  if (!measurementId) return null;

  const bootstrap = [
    'window.dataLayer = window.dataLayer || [];',
    'window.gtag = window.gtag || function(){window.dataLayer.push(arguments);};',
    "window.gtag('js', new Date());",
    `window.gtag('config', '${measurementId}', { send_page_view: false });`,
  ].join('\n');

  return (
    <>
      <Script
        id="google-analytics-bootstrap"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: bootstrap }}
      />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
    </>
  );
}
