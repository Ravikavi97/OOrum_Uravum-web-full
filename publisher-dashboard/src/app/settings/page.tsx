'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';
import ImageUploadField from '@/components/ImageUploadField';

const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

interface ThemeColors {
  primaryDark: string;
  accentRed: string;
  background: string;
  foreground: string;
  cardBg: string;
}

const DEFAULT_COLORS: ThemeColors = {
  primaryDark: '#285430',
  accentRed: '#259306',
  background: '#F5EFE3',
  foreground: '#171717',
  cardBg: '#ffffff',
};

const DEFAULT_SITE_TITLE = 'OORUM URAVUM';
const DEFAULT_SITE_TAGLINE = 'ஒன்று பட்டால் உண்டு வாழ்வு';
const DEFAULT_SITE_DESCRIPTION = 'தமிழ் செய்திகள் — செய்திகள், அறிந்து கொள்வோம், உடல் நலம், தொழில்நுட்பம், படைப்பாக்கம்';
const ANALYTICS_ID_PATTERN = /^G-[A-Z0-9]{6,20}$/i;
const PREVIEW_UPDATE_MESSAGE = 'oorum:site-settings-preview:update';
const PREVIEW_READY_MESSAGE = 'oorum:site-settings-preview:ready';

export default function SettingsPage() {
  const { token, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // General
  const [siteTitle, setSiteTitle] = useState('');
  const [siteTagline, setSiteTagline] = useState('');
  const [siteDescription, setSiteDescription] = useState('');

  // Social
  const [socialFacebook, setSocialFacebook] = useState('');
  const [socialTwitter, setSocialTwitter] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [socialTelegram, setSocialTelegram] = useState('');

  // Logos
  const [headerLogo, setHeaderLogo] = useState('');
  const [footerLogo, setFooterLogo] = useState('');
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingFooter, setUploadingFooter] = useState(false);
  const headerLogoRef = useRef<HTMLInputElement>(null);
  const footerLogoRef = useRef<HTMLInputElement>(null);

  // Theme colors
  const [colors, setColors] = useState<ThemeColors>(DEFAULT_COLORS);

  // Analytics
  const [analyticsId, setAnalyticsId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewOrigin, setPreviewOrigin] = useState('');
  const [previewChannel, setPreviewChannel] = useState('');
  const [previewReady, setPreviewReady] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const previewFrame = useRef<HTMLIFrameElement>(null);

  const previewSettings = useMemo(() => ({
    siteTitle: siteTitle || DEFAULT_SITE_TITLE,
    siteTagline: siteTagline || DEFAULT_SITE_TAGLINE,
    siteDescription: siteDescription || DEFAULT_SITE_DESCRIPTION,
    headerLogo,
    footerLogo,
    socialLinks: {
      facebook: socialFacebook,
      twitter: socialTwitter,
      instagram: socialInstagram,
      youtube: socialYoutube,
      telegram: socialTelegram,
    },
    themeColors: colors,
    analyticsId,
  }), [
    siteTitle,
    siteTagline,
    siteDescription,
    headerLogo,
    footerLogo,
    socialFacebook,
    socialTwitter,
    socialInstagram,
    socialYoutube,
    socialTelegram,
    colors,
    analyticsId,
  ]);

  useEffect(() => {
    let active = true;
    const channel = window.crypto.randomUUID();
    setPreviewChannel(channel);

    fetch('/api/preview-config', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load preview configuration.');
        return response.json() as Promise<{ frontendUrl?: unknown }>;
      })
      .then(({ frontendUrl }) => {
        if (!active || typeof frontendUrl !== 'string') return;
        const frontend = new URL(frontendUrl);
        if (!['http:', 'https:'].includes(frontend.protocol)) {
          throw new Error('Invalid frontend preview URL.');
        }
        frontend.searchParams.set('__sitePreviewChannel', channel);
        frontend.searchParams.set('__sitePreviewParentOrigin', window.location.origin);
        setPreviewOrigin(new URL(frontendUrl).origin);
        setPreviewUrl(frontend.toString());
      })
      .catch((previewLoadError: unknown) => {
        console.error('[settings] Failed to initialize frontend preview:', previewLoadError);
        if (active) setPreviewError('Frontend preview could not be loaded. Check FRONTEND_PREVIEW_URL.');
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!previewOrigin || !previewChannel) return;

    const handlePreviewMessage = (event: MessageEvent<unknown>) => {
      if (event.origin !== previewOrigin || event.source !== previewFrame.current?.contentWindow) return;
      if (typeof event.data !== 'object' || event.data === null) return;
      const message = event.data as { type?: unknown; channel?: unknown };
      if (message.type === PREVIEW_READY_MESSAGE && message.channel === previewChannel) {
        setPreviewReady(true);
        previewFrame.current?.contentWindow?.postMessage({
          type: PREVIEW_UPDATE_MESSAGE,
          channel: previewChannel,
          settings: previewSettings,
        }, previewOrigin);
      }
    };

    window.addEventListener('message', handlePreviewMessage);
    return () => window.removeEventListener('message', handlePreviewMessage);
  }, [previewChannel, previewOrigin, previewSettings]);

  useEffect(() => {
    if (!previewReady || !previewChannel || !previewOrigin) return;
    previewFrame.current?.contentWindow?.postMessage({
      type: PREVIEW_UPDATE_MESSAGE,
      channel: previewChannel,
      settings: previewSettings,
    }, previewOrigin);
  }, [previewChannel, previewOrigin, previewReady, previewSettings]);

  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<Array<{ key: string; value: string }>>('/settings', { token, method: 'GET' });
      if (Array.isArray(data)) {
        const map: Record<string, string> = {};
        data.forEach((s) => { map[s.key] = s.value; });

        setSiteTitle(map['siteTitle'] || '');
        setSiteTagline(map['siteTagline'] || '');
        setSiteDescription(map['siteDescription'] || '');
        setAnalyticsId(map['analyticsId'] || '');
        setHeaderLogo(map['headerLogo'] || '');
        setFooterLogo(map['footerLogo'] || '');

        if (map['socialLinks']) {
          try {
            const s = JSON.parse(map['socialLinks']);
            setSocialFacebook(s.facebook || '');
            setSocialTwitter(s.twitter || '');
            setSocialInstagram(s.instagram || '');
            setSocialYoutube(s.youtube || '');
            setSocialTelegram(s.telegram || '');
          } catch { /* ignore */ }
        }
        if (map['themeColors']) {
          try { setColors({ ...DEFAULT_COLORS, ...JSON.parse(map['themeColors']) }); } catch { /* ignore */ }
        }
      }
    } catch { setError('Failed to load settings.'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (token) fetchSettings(); }, [fetchSettings, token]);

  if (!hasRole('ADMIN')) {
    return <div><h1 className="text-2xl font-bold mb-4">Settings</h1><p className="text-red-600">Admin access required.</p></div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (Object.values(colors).some((color) => !/^#[\da-f]{6}$/i.test(color))) {
      setError('Theme colors must be valid six-digit hex values.');
      return;
    }
    if (analyticsId && !ANALYTICS_ID_PATTERN.test(analyticsId)) {
      setError('Google Analytics ID must use the G-XXXXXXXXXX format.');
      return;
    }
    if (!token) {
      setError('Your session expired. Sign in again to save settings.');
      return;
    }

    setSaving(true);
    try {
      await adminFetch('/settings', {
        token,
        method: 'PUT',
        body: JSON.stringify({
          settings: {
            siteTitle,
            siteTagline,
            siteDescription,
            analyticsId,
            headerLogo,
            footerLogo,
            socialLinks: JSON.stringify({
              facebook: socialFacebook,
              twitter: socialTwitter,
              instagram: socialInstagram,
              youtube: socialYoutube,
              telegram: socialTelegram,
            }),
            themeColors: JSON.stringify(colors),
          },
        }),
      });
      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to save.');
    } finally { setSaving(false); }
  };

  const uploadLogo = async (file: File, type: 'header' | 'footer') => {
    const setUploading = type === 'header' ? setUploadingHeader : setUploadingFooter;
    const setLogo = type === 'header' ? setHeaderLogo : setFooterLogo;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const media = await adminFetch<{ originalUrl: string }>('/media/upload', { token: token!, method: 'POST', body: formData });
      setLogo(`${UPLOADS_BASE}${media.originalUrl}`);
    } catch { setError('Logo upload failed.'); }
    finally { setUploading(false); }
  };

  const updateColor = (key: keyof ThemeColors) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setColors((prev) => ({ ...prev, [key]: e.target.value }));
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Site Settings</h1>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <form onSubmit={handleSave} className="space-y-8">
        {error && <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded">{error}</p>}
        {message && <p className="text-green-600 text-sm bg-green-50 px-3 py-2 rounded">{message}</p>}

        {/* General */}
        <section className="bg-white p-5 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">General</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Site Title</label>
            <input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tagline</label>
            <input value={siteTagline} onChange={(e) => setSiteTagline(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </section>

        {/* Logos */}
        <section className="bg-white p-5 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Logos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <ImageUploadField
              label="Header Logo"
              value={headerLogo}
              onChange={setHeaderLogo}
              onUploadingChange={setUploadingHeader}
              prefer="original"
            />
            <ImageUploadField
              label="Footer Logo"
              value={footerLogo}
              onChange={setFooterLogo}
              onUploadingChange={setUploadingFooter}
              prefer="original"
            />
          </div>
        </section>

        {/* Theme Colors */}
        <section className="bg-white p-5 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Theme Colors</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {([
              { key: 'primaryDark' as const, label: 'Primary Dark (Header/Nav)' },
              { key: 'accentRed' as const, label: 'Accent Color (Buttons/Badges)' },
              { key: 'background' as const, label: 'Background' },
              { key: 'foreground' as const, label: 'Text Color' },
              { key: 'cardBg' as const, label: 'Card Background' },
            ]).map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={colors[key]} onChange={updateColor(key)} className="w-8 h-8 rounded border cursor-pointer" />
                  <input value={colors[key]} onChange={updateColor(key)} className="flex-1 border rounded px-2 py-1 text-xs font-mono" />
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setColors(DEFAULT_COLORS)} className="text-xs text-gray-500 hover:text-gray-700 underline">Reset to defaults</button>
        </section>

        {/* Social Links */}
        <section className="bg-white p-5 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Social Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium mb-1">Facebook</label><input value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/..." className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Twitter / X</label><input value={socialTwitter} onChange={(e) => setSocialTwitter(e.target.value)} placeholder="https://twitter.com/..." className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Instagram</label><input value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} placeholder="https://instagram.com/..." className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">YouTube</label><input value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)} placeholder="https://youtube.com/..." className="w-full border rounded px-3 py-2 text-sm" /></div>
            <div><label className="block text-xs font-medium mb-1">Telegram</label><input value={socialTelegram} onChange={(e) => setSocialTelegram(e.target.value)} placeholder="https://t.me/..." className="w-full border rounded px-3 py-2 text-sm" /></div>
          </div>
        </section>

        {/* Analytics */}
        <section className="bg-white p-5 rounded-lg shadow space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Analytics</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Google Analytics ID</label>
            <input value={analyticsId} onChange={(e) => setAnalyticsId(e.target.value)} placeholder="G-XXXXXXXXXX" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </section>

        <button type="submit" disabled={saving || uploadingHeader || uploadingFooter} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {(uploadingHeader || uploadingFooter) ? 'Uploading image…' : saving ? 'Saving…' : 'Save All Settings'}
        </button>
      </form>
      <aside className="xl:sticky xl:top-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Frontend Preview</h2>
            <p className="text-xs text-gray-500">Updates as you edit; save settings to publish them.</p>
          </div>
          {previewReady && <span className="text-xs text-green-700">Live</span>}
        </div>
        {previewError ? (
          <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{previewError}</p>
        ) : previewUrl ? (
          <iframe
            ref={previewFrame}
            src={previewUrl}
            title="Live Oorum Uravum frontend preview"
            className="h-[760px] w-full rounded-lg border border-gray-300 bg-white shadow"
          />
        ) : (
          <div role="status" className="flex h-[760px] items-center justify-center rounded-lg border border-gray-200 bg-white text-sm text-gray-500">
            Loading preview…
          </div>
        )}
      </aside>
      </div>
    </div>
  );
}
