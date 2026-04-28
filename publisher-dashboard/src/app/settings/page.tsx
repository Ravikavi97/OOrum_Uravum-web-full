'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';

const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

interface ThemeColors {
  primaryDark: string;
  accentRed: string;
  background: string;
  foreground: string;
  cardBg: string;
}

const DEFAULT_COLORS: ThemeColors = {
  primaryDark: '#1a1a2e',
  accentRed: '#e94560',
  background: '#f5f5f5',
  foreground: '#171717',
  cardBg: '#ffffff',
};

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

  const saveSetting = async (key: string, value: string) => {
    await adminFetch('/settings', { token: token!, method: 'PUT', body: JSON.stringify({ key, value }) });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setMessage(''); setSaving(true);
    try {
      await Promise.all([
        saveSetting('siteTitle', siteTitle),
        saveSetting('siteTagline', siteTagline),
        saveSetting('siteDescription', siteDescription),
        saveSetting('analyticsId', analyticsId),
        saveSetting('headerLogo', headerLogo),
        saveSetting('footerLogo', footerLogo),
        saveSetting('socialLinks', JSON.stringify({ facebook: socialFacebook, twitter: socialTwitter, instagram: socialInstagram, youtube: socialYoutube, telegram: socialTelegram })),
        saveSetting('themeColors', JSON.stringify(colors)),
      ]);
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
      <form onSubmit={handleSave} className="space-y-8 max-w-2xl">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Header Logo */}
            <div>
              <label className="block text-sm font-medium mb-2">Header Logo</label>
              {headerLogo ? (
                <div className="flex items-start gap-3">
                  <div className="w-32 h-16 rounded border bg-gray-900 flex items-center justify-center overflow-hidden p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={headerLogo} alt="Header logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => headerLogoRef.current?.click()} className="text-xs text-blue-600 hover:underline">Change</button>
                    <button type="button" onClick={() => setHeaderLogo('')} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => headerLogoRef.current?.click()} className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') headerLogoRef.current?.click(); }}>
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                  <span className="text-xs text-gray-500">{uploadingHeader ? 'Uploading…' : 'Upload header logo'}</span>
                </div>
              )}
              <input ref={headerLogoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f, 'header'); }} />
            </div>
            {/* Footer Logo */}
            <div>
              <label className="block text-sm font-medium mb-2">Footer Logo</label>
              {footerLogo ? (
                <div className="flex items-start gap-3">
                  <div className="w-32 h-16 rounded border bg-gray-900 flex items-center justify-center overflow-hidden p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={footerLogo} alt="Footer logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => footerLogoRef.current?.click()} className="text-xs text-blue-600 hover:underline">Change</button>
                    <button type="button" onClick={() => setFooterLogo('')} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>
                </div>
              ) : (
                <div onClick={() => footerLogoRef.current?.click()} className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') footerLogoRef.current?.click(); }}>
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                  <span className="text-xs text-gray-500">{uploadingFooter ? 'Uploading…' : 'Upload footer logo'}</span>
                </div>
              )}
              <input ref={footerLogoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f, 'footer'); }} />
            </div>
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

        <button type="submit" disabled={saving} className="bg-blue-600 text-white px-8 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving…' : 'Save All Settings'}
        </button>
      </form>
    </div>
  );
}
