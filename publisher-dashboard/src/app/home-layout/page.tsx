'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch } from '@/lib/api';

interface Section {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

interface HomeLayoutConfig {
  sections: Section[];
}

const DEFAULT_SECTIONS: Section[] = [
  { id: 'ticker', label: 'Ticker', visible: true, order: 0 },
  { id: 'videoHero', label: 'Video Hero Section', visible: true, order: 1 },
  { id: 'hero', label: 'Text News Hero Section', visible: true, order: 2 },
  { id: 'obituary', label: 'Obituary / Tributes', visible: true, order: 3 },
  { id: 'topicCards', label: 'Topic Cards', visible: true, order: 4 },
  { id: 'latestNews', label: 'Latest News', visible: true, order: 5 },
  { id: 'adSidebar', label: 'Advertisement Sidebar', visible: true, order: 6 },
  { id: 'archiveSidebar', label: 'Archive Sidebar', visible: true, order: 7 },
];

export default function HomeLayoutPage() {
  const { token, hasRole } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Hero config state
  const [categories, setCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [heroCat1, setHeroCat1] = useState('');
  const [heroCat2, setHeroCat2] = useState('');
  const [infoRowTitle, setInfoRowTitle] = useState('தகவல் கண்ணோட்டம்');

  // Video hero config state
  const [videoCategories, setVideoCategories] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [videoCat1, setVideoCat1] = useState('');
  const [videoCat2, setVideoCat2] = useState('');
  const [videoInfoRowTitle, setVideoInfoRowTitle] = useState('அனைத்து வீடியோக்கள்');

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<Array<{ key: string; value: string }>>('/settings', {
        token,
        method: 'GET',
      });

      // Load sections
      const entry = Array.isArray(data) ? data.find((s) => s.key === 'homeLayout') : null;
      if (entry?.value) {
        const parsed: HomeLayoutConfig = JSON.parse(entry.value);
        if (parsed.sections?.length) {
          const sorted = [...parsed.sections].sort((a, b) => a.order - b.order);
          // Merge any new default sections not yet in saved config
          const savedIds = new Set(sorted.map((s) => s.id));
          const missing = DEFAULT_SECTIONS.filter((d) => !savedIds.has(d.id)).map((d, i) => ({ ...d, order: sorted.length + i }));
          setSections([...sorted, ...missing]);
        } else {
          setSections(DEFAULT_SECTIONS);
        }
      } else {
        setSections(DEFAULT_SECTIONS);
      }

      // Load hero config
      const heroEntry = Array.isArray(data) ? data.find((s) => s.key === 'heroConfig') : null;
      if (heroEntry?.value) {
        try {
          const hc = JSON.parse(heroEntry.value);
          if (hc.categorySlugs?.[0]) setHeroCat1(hc.categorySlugs[0]);
          if (hc.categorySlugs?.[1]) setHeroCat2(hc.categorySlugs[1]);
          if (hc.infoRowTitle) setInfoRowTitle(hc.infoRowTitle);
        } catch { /* ignore */ }
      }

      // Load video hero config
      const videoHeroEntry = Array.isArray(data) ? data.find((s) => s.key === 'videoHeroConfig') : null;
      if (videoHeroEntry?.value) {
        try {
          const vc = JSON.parse(videoHeroEntry.value);
          if (vc.categorySlugs?.[0]) setVideoCat1(vc.categorySlugs[0]);
          if (vc.categorySlugs?.[1]) setVideoCat2(vc.categorySlugs[1]);
          if (vc.infoRowTitle) setVideoInfoRowTitle(vc.infoRowTitle);
        } catch { /* ignore */ }
      }

      // Load categories
      const cats = await adminFetch<Array<{ id: string; name: string; slug: string; parentId: string | null }>>('/categories', { token });
      setCategories(cats.filter((c) => !c.parentId));

      // Load video categories
      try {
        const vcats = await adminFetch<Array<{ id: string; name: string; slug: string }>>('/videos/categories', { token });
        setVideoCategories(vcats);
      } catch { /* ignore */ }
    } catch {
      setSections(DEFAULT_SECTIONS);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchConfig();
  }, [fetchConfig, token]);

  if (!hasRole('ADMIN')) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Home Layout</h1>
        <p className="text-red-600">Admin access required.</p>
      </div>
    );
  }

  const saveConfig = async (updated: Section[]) => {
    if (!token) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const config: HomeLayoutConfig = { sections: updated };
      await adminFetch('/settings', {
        token,
        method: 'PUT',
        body: JSON.stringify({ key: 'homeLayout', value: JSON.stringify(config) }),
      });
      setMessage('Layout saved successfully.');
    } catch {
      setError('Failed to save layout.');
    } finally {
      setSaving(false);
    }
  };

  const saveHeroConfig = async () => {
    if (!token) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const config = {
        categorySlugs: [heroCat1, heroCat2].filter(Boolean),
        infoRowTitle,
      };
      await adminFetch('/settings', {
        token,
        method: 'PUT',
        body: JSON.stringify({ key: 'heroConfig', value: JSON.stringify(config) }),
      });
      setMessage('Hero config saved successfully.');
    } catch {
      setError('Failed to save hero config.');
    } finally {
      setSaving(false);
    }
  };

  const saveVideoHeroConfig = async () => {
    if (!token) return;
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const config = {
        categorySlugs: [videoCat1, videoCat2].filter(Boolean),
        infoRowTitle: videoInfoRowTitle,
      };
      await adminFetch('/settings', {
        token,
        method: 'PUT',
        body: JSON.stringify({ key: 'videoHeroConfig', value: JSON.stringify(config) }),
      });
      setMessage('Video hero config saved successfully.');
    } catch {
      setError('Failed to save video hero config.');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = (index: number) => {
    const updated = sections.map((s, i) =>
      i === index ? { ...s, visible: !s.visible } : s,
    );
    setSections(updated);
    saveConfig(updated);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...sections];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    const reordered = updated.map((s, i) => ({ ...s, order: i }));
    setSections(reordered);
    saveConfig(reordered);
  };

  const moveDown = (index: number) => {
    if (index === sections.length - 1) return;
    const updated = [...sections];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    const reordered = updated.map((s, i) => ({ ...s, order: i }));
    setSections(reordered);
    saveConfig(reordered);
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Home Page Layout</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {message && <p className="text-green-600 text-sm mb-4">{message}</p>}

      <div className="bg-white rounded-lg shadow max-w-xl">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={section.visible}
                  onChange={() => toggleVisibility(index)}
                  className="sr-only peer"
                  aria-label={`Toggle ${section.label}`}
                />
                <div className="w-9 h-5 bg-gray-300 peer-checked:bg-blue-600 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
              <span className={section.visible ? 'text-sm font-medium' : 'text-sm text-gray-400'}>
                {section.label}
              </span>
            </div>

            <div className="flex gap-1">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0 || saving}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={`Move ${section.label} up`}
              >
                ▲
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === sections.length - 1 || saving}
                className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label={`Move ${section.label} down`}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>

      {saving && <p className="text-gray-500 text-sm mt-3">Saving…</p>}

      {/* Hero Section Config */}
      <h2 className="text-lg font-bold mt-10 mb-4">Hero Section Categories</h2>
      <div className="bg-white rounded-lg shadow max-w-xl p-4 space-y-4">
        <p className="text-xs text-gray-500">Choose 2 categories to display next to the slideshow in the hero section, and set the info row title.</p>
        <div>
          <label className="block text-sm font-medium mb-1">Category Column 1</label>
          <select value={heroCat1} onChange={(e) => setHeroCat1(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" aria-label="Hero category 1">
            <option value="">Auto (first with articles)</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category Column 2</label>
          <select value={heroCat2} onChange={(e) => setHeroCat2(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" aria-label="Hero category 2">
            <option value="">Auto (second with articles)</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Info Row Title</label>
          <input value={infoRowTitle} onChange={(e) => setInfoRowTitle(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="தகவல் கண்ணோட்டம்" aria-label="Info row title" />
        </div>
        <button onClick={saveHeroConfig} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Hero Config'}
        </button>
      </div>

      {/* Video Hero Section Config */}
      <h2 className="text-lg font-bold mt-10 mb-4">Video Hero Section Categories</h2>
      <div className="bg-white rounded-lg shadow max-w-xl p-4 space-y-4">
        <p className="text-xs text-gray-500">Choose 2 video categories to display next to the video slideshow, and set the info row title.</p>
        <div>
          <label className="block text-sm font-medium mb-1">Video Category Column 1</label>
          <select value={videoCat1} onChange={(e) => setVideoCat1(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" aria-label="Video category 1">
            <option value="">Auto (latest videos)</option>
            {videoCategories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Video Category Column 2</label>
          <select value={videoCat2} onChange={(e) => setVideoCat2(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" aria-label="Video category 2">
            <option value="">Auto (latest videos)</option>
            {videoCategories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Info Row Title</label>
          <input value={videoInfoRowTitle} onChange={(e) => setVideoInfoRowTitle(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="அனைத்து வீடியோக்கள்" aria-label="Video info row title" />
        </div>
        <button onClick={saveVideoHeroConfig} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Video Hero Config'}
        </button>
      </div>
    </div>
  );
}
