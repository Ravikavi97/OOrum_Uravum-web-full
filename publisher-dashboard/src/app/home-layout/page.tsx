'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch } from '@/lib/api';
import {
  DEFAULT_HOME_LAYOUT_SECTIONS,
  HOME_LAYOUT_GROUPS,
  mergeHomeLayoutSections,
  moveHomeLayoutSection,
} from '@/lib/home-layout';
import type { HomeLayoutSection } from '@/lib/home-layout';

interface HomeLayoutConfig {
  sections: HomeLayoutSection[];
}

export default function HomeLayoutPage() {
  const { token, hasRole } = useAuth();
  const [sections, setSections] = useState<HomeLayoutSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
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
    setLoadFailed(false);
    setError('');
    setCategories([]);
    setVideoCategories([]);
    setMessage('');

    let data: Array<{ key: string; value: string }>;
    try {
      data = await adminFetch<Array<{ key: string; value: string }>>('/settings', {
        token,
        method: 'GET',
      });
      if (!Array.isArray(data)) throw new Error('Invalid settings response');
    } catch {
      setLoadFailed(true);
      setError('Failed to load homepage settings. Retry before changing the layout.');
      setLoading(false);
      return;
    }

    const warnings: string[] = [];
    const entry = data.find((setting) => setting.key === 'homeLayout');
    let savedSections: unknown = [];
    if (entry?.value) {
      try {
        const savedConfig = JSON.parse(entry.value) as HomeLayoutConfig;
        if (!Array.isArray(savedConfig.sections)) throw new Error('Invalid homepage layout');
        savedSections = savedConfig.sections;
      } catch {
        warnings.push('Saved homepage layout was invalid; defaults were loaded.');
      }
    }
    setSections(mergeHomeLayoutSections(savedSections));

    const heroEntry = data.find((setting) => setting.key === 'heroConfig');
    setHeroCat1('');
    setHeroCat2('');
    setInfoRowTitle('தகவல் கண்ணோட்டம்');
    if (heroEntry?.value) {
      try {
        const heroConfig = JSON.parse(heroEntry.value) as { categorySlugs?: unknown; infoRowTitle?: unknown };
        const slugs = Array.isArray(heroConfig.categorySlugs)
          ? heroConfig.categorySlugs.filter((slug): slug is string => typeof slug === 'string')
          : [];
        setHeroCat1(slugs[0] || '');
        setHeroCat2(slugs[1] || '');
        if (typeof heroConfig.infoRowTitle === 'string') setInfoRowTitle(heroConfig.infoRowTitle);
      } catch {
        warnings.push('Saved hero settings were invalid; defaults were loaded.');
      }
    }

    const videoHeroEntry = data.find((setting) => setting.key === 'videoHeroConfig');
    setVideoCat1('');
    setVideoCat2('');
    setVideoInfoRowTitle('அனைத்து வீடியோக்கள்');
    if (videoHeroEntry?.value) {
      try {
        const videoConfig = JSON.parse(videoHeroEntry.value) as { categorySlugs?: unknown; infoRowTitle?: unknown };
        const slugs = Array.isArray(videoConfig.categorySlugs)
          ? videoConfig.categorySlugs.filter((slug): slug is string => typeof slug === 'string')
          : [];
        setVideoCat1(slugs[0] || '');
        setVideoCat2(slugs[1] || '');
        if (typeof videoConfig.infoRowTitle === 'string') setVideoInfoRowTitle(videoConfig.infoRowTitle);
      } catch {
        warnings.push('Saved video hero settings were invalid; defaults were loaded.');
      }
    }

    const [categoryOptions, videoCategoryOptions] = await Promise.all([
      adminFetch<Array<{ id: string; name: string; slug: string; parentId: string | null }>>('/categories', { token })
        .then((options) => {
          if (!Array.isArray(options)) throw new Error('Invalid category response');
          return options.filter((category) => !category.parentId);
        })
        .catch(() => {
          warnings.push('Failed to load category options.');
          return [];
        }),
      adminFetch<Array<{ id: string; name: string; slug: string }>>('/videos/categories', { token })
        .then((options) => {
          if (!Array.isArray(options)) throw new Error('Invalid video category response');
          return options;
        })
        .catch(() => {
          warnings.push('Failed to load video category options.');
          return [];
        }),
    ]);
    setCategories(categoryOptions);
    setVideoCategories(videoCategoryOptions);
    setError(warnings.join(' '));
    setLoading(false);
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

  const saveConfig = async (updated: HomeLayoutSection[]): Promise<boolean> => {
    if (!token) return false;
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
      return true;
    } catch {
      setError('Failed to save layout.');
      return false;
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

  const toggleVisibility = async (sectionId: string) => {
    if (saving || loadFailed) return;
    const updated = sections.map((section) =>
      section.id === sectionId ? { ...section, visible: !section.visible } : section,
    );
    if (await saveConfig(updated)) setSections(updated);
  };

  const moveSection = async (sectionId: string, groupIds: readonly string[], direction: -1 | 1) => {
    if (saving || loadFailed) return;
    const reordered = moveHomeLayoutSection(sections, sectionId, groupIds, direction);
    if (await saveConfig(reordered)) setSections(reordered);
  };

  const resetLayout = async () => {
    if (saving || loadFailed) return;
    const defaults = DEFAULT_HOME_LAYOUT_SECTIONS.map((section) => ({ ...section }));
    if (await saveConfig(defaults)) setSections(defaults);
  };

  if (loading) return <p className="text-gray-500 text-sm">Loading…</p>;
  if (loadFailed) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">Home Page Layout</h1>
        <p role="alert" className="text-red-600 text-sm mb-4">{error}</p>
        <button type="button" onClick={() => void fetchConfig()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
          Retry loading settings
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Home Page Layout</h1>
      <p className="text-sm text-gray-600 mb-4">
        Control homepage visibility, section order, and the category settings used by the hero areas.
      </p>
      {error && <p role="alert" className="text-red-600 text-sm mb-4">{error}</p>}
      {message && <p role="status" className="text-green-600 text-sm mb-4">{message}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-xs text-gray-500">Changes save automatically. Reordering is limited to sections that share a layout area.</p>
        <button type="button" onClick={() => void resetLayout()} disabled={saving}
          className="px-3 py-2 text-sm border rounded hover:bg-gray-50 disabled:opacity-50">
          Reset layout to defaults
        </button>
      </div>

      <div className="space-y-6 max-w-2xl">
        {HOME_LAYOUT_GROUPS.map((group) => {
          const groupSections = sections
            .filter((section) => group.sectionIds.some((id) => id === section.id))
            .sort((a, b) => a.order - b.order);

          return (
            <section key={group.id} aria-labelledby={`group-${group.id}`}>
              <div className="mb-2">
                <h2 id={`group-${group.id}`} className="text-lg font-semibold">{group.label}</h2>
                <p className="text-xs text-gray-500">{group.description}</p>
              </div>
              <div className="bg-white rounded-lg shadow">
                {groupSections.map((section, index) => (
                  <div key={section.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={section.visible}
                          onChange={() => void toggleVisibility(section.id)}
                          disabled={saving}
                          className="sr-only peer"
                          aria-label={`Toggle ${section.label}`}
                        />
                        <span className="w-9 h-5 bg-gray-300 peer-checked:bg-blue-600 peer-disabled:opacity-50 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                      </label>
                      <span className={section.visible ? 'text-sm font-medium' : 'text-sm text-gray-400'}>
                        {section.label}
                      </span>
                    </div>

                    {group.reorderable && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => void moveSection(section.id, group.sectionIds, -1)}
                          disabled={index === 0 || saving}
                          className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label={`Move ${section.label} up`}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => void moveSection(section.id, group.sectionIds, 1)}
                          disabled={index === groupSections.length - 1 || saving}
                          className="px-2 py-1 text-xs border rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label={`Move ${section.label} down`}
                        >
                          ▼
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {saving && <p className="text-gray-500 text-sm mt-3">Saving…</p>}

      {/* Hero Section Config */}
      <h2 className="text-lg font-bold mt-10 mb-4">Hero Section Categories</h2>
      <div className="bg-white rounded-lg shadow max-w-xl p-4 space-y-4">
        <p className="text-xs text-gray-500">Choose 2 categories to display next to the slideshow in the hero section, and set the info row title.</p>
        <div>
          <label className="block text-sm font-medium mb-1">Category Column 1</label>
          <select value={heroCat1} onChange={(e) => setHeroCat1(e.target.value)} disabled={saving} className="w-full border rounded px-3 py-2 text-sm" aria-label="Hero category 1">
            <option value="">Auto (first with articles)</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Category Column 2</label>
          <select value={heroCat2} onChange={(e) => setHeroCat2(e.target.value)} disabled={saving} className="w-full border rounded px-3 py-2 text-sm" aria-label="Hero category 2">
            <option value="">Auto (second with articles)</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Info Row Title</label>
          <input value={infoRowTitle} onChange={(e) => setInfoRowTitle(e.target.value)} disabled={saving} className="w-full border rounded px-3 py-2 text-sm" placeholder="தகவல் கண்ணோட்டம்" aria-label="Info row title" />
        </div>
        <button type="button" onClick={saveHeroConfig} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Hero Config'}
        </button>
      </div>

      {/* Video Hero Section Config */}
      <h2 className="text-lg font-bold mt-10 mb-4">Video Hero Section Categories</h2>
      <div className="bg-white rounded-lg shadow max-w-xl p-4 space-y-4">
        <p className="text-xs text-gray-500">Choose 2 video categories to display next to the video slideshow, and set the info row title.</p>
        <div>
          <label className="block text-sm font-medium mb-1">Video Category Column 1</label>
          <select value={videoCat1} onChange={(e) => setVideoCat1(e.target.value)} disabled={saving} className="w-full border rounded px-3 py-2 text-sm" aria-label="Video category 1">
            <option value="">Auto (latest videos)</option>
            {videoCategories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Video Category Column 2</label>
          <select value={videoCat2} onChange={(e) => setVideoCat2(e.target.value)} disabled={saving} className="w-full border rounded px-3 py-2 text-sm" aria-label="Video category 2">
            <option value="">Auto (latest videos)</option>
            {videoCategories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Info Row Title</label>
          <input value={videoInfoRowTitle} onChange={(e) => setVideoInfoRowTitle(e.target.value)} disabled={saving} className="w-full border rounded px-3 py-2 text-sm" placeholder="அனைத்து வீடியோக்கள்" aria-label="Video info row title" />
        </div>
        <button type="button" onClick={saveVideoHeroConfig} disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Video Hero Config'}
        </button>
      </div>
    </div>
  );
}
