'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
    </div>
  );
}
