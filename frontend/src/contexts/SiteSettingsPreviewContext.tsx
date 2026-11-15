'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeColors } from '@/services/api';

export interface SiteSettingsPreview {
  siteTitle: string;
  siteTagline: string;
  siteDescription: string;
  headerLogo: string;
  footerLogo: string;
  socialLinks: Record<string, string>;
  themeColors: ThemeColors;
  analyticsId: string;
}

const PREVIEW_UPDATE_MESSAGE = 'oorum:site-settings-preview:update';
const PREVIEW_READY_MESSAGE = 'oorum:site-settings-preview:ready';
const SiteSettingsPreviewContext = createContext<SiteSettingsPreview | null>(null);

function isSafeAsset(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  if (!value || (value.startsWith('/') && !value.startsWith('//'))) return true;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isSiteSettingsPreview(value: unknown): value is SiteSettingsPreview {
  if (typeof value !== 'object' || value === null) return false;
  const settings = value as Record<string, unknown>;
  const colors = settings.themeColors as Record<string, unknown> | null;
  const socialLinks = settings.socialLinks as Record<string, unknown> | null;

  return typeof settings.siteTitle === 'string'
    && typeof settings.siteTagline === 'string'
    && typeof settings.siteDescription === 'string'
    && isSafeAsset(settings.headerLogo)
    && isSafeAsset(settings.footerLogo)
    && !!socialLinks
    && Object.values(socialLinks).every((url) => typeof url === 'string' && (url === '' || /^https?:\/\//i.test(url)))
    && !!colors
    && ['primaryDark', 'accentRed', 'background', 'foreground', 'cardBg']
      .every((key) => typeof colors[key] === 'string' && /^#[\da-f]{6}$/i.test(colors[key] as string))
    && typeof settings.analyticsId === 'string'
    && settings.analyticsId.length <= 64;
}

export function SiteSettingsPreviewProvider({ children }: { children: React.ReactNode }) {
  const [preview, setPreview] = useState<SiteSettingsPreview | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const channel = params.get('__sitePreviewChannel');
    const parentOrigin = params.get('__sitePreviewParentOrigin');
    if (!channel || !parentOrigin) return;

    let expectedOrigin: string;
    try {
      const parsedOrigin = new URL(parentOrigin);
      if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== parentOrigin) return;
      expectedOrigin = parsedOrigin.origin;
    } catch {
      return;
    }

    let attempts = 0;
    const announceReady = () => {
      window.parent.postMessage({ type: PREVIEW_READY_MESSAGE, channel }, expectedOrigin);
    };
    const readyInterval = window.setInterval(() => {
      attempts += 1;
      if (attempts >= 20) {
        window.clearInterval(readyInterval);
        return;
      }
      announceReady();
    }, 500);

    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window.parent || event.origin !== expectedOrigin) return;
      if (typeof event.data !== 'object' || event.data === null) return;

      const message = event.data as { type?: unknown; channel?: unknown; settings?: unknown };
      if (message.type !== PREVIEW_UPDATE_MESSAGE || message.channel !== channel) return;
      if (!isSiteSettingsPreview(message.settings)) return;

      window.clearInterval(readyInterval);
      setPreview(message.settings);
    };

    window.addEventListener('message', handleMessage);
    announceReady();

    return () => {
      window.clearInterval(readyInterval);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <SiteSettingsPreviewContext.Provider value={preview}>
      {children}
    </SiteSettingsPreviewContext.Provider>
  );
}

export function useSiteSettingsPreview() {
  return useContext(SiteSettingsPreviewContext);
}

export const SITE_SETTINGS_PREVIEW_MESSAGES = {
  update: PREVIEW_UPDATE_MESSAGE,
  ready: PREVIEW_READY_MESSAGE,
} as const;
