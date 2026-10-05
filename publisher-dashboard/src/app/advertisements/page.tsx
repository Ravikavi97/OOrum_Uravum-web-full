'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';
import ImageUploadField from '@/components/ImageUploadField';
import { ToastContainer, useToast } from '@/components/Toast';

const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

interface Ad {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  position: string;
  cropPosition: string | null;
  active: boolean;
  order: number;
  variant?: string | null;
  badge?: string | null;
  metaText?: string | null;
  icon?: string | null;
  linkLabel?: string | null;
}

const AD_ICON_KEYS = [
  'calendar', 'book', 'ticket', 'megaphone', 'gift',
  'users', 'heart', 'sparkles', 'star', 'globe',
] as const;

const AD_ICON_PATHS: Record<string, string> = {
  calendar: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5',
  book: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  ticket: 'M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z',
  megaphone: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46',
  gift: 'M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 0114.625 7.5H12m0 0V21m-8.625-9.75h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  heart: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  sparkles: 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z',
  star: 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zm0 0a8.949 8.949 0 004.951-1.488A3.987 3.987 0 0013 16h-2a3.987 3.987 0 00-3.951 3.512A8.949 8.949 0 0012 21zm3-11a3 3 0 11-6 0 3 3 0 016 0z',
};

function AdIcon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={AD_ICON_PATHS[name] || AD_ICON_PATHS.megaphone} />
    </svg>
  );
}

/* ── Image Position Tool ──────────────────────────────────────────────────── */

function ImagePositionTool({
  imageUrl,
  cropPosition,
  onChange,
  frameWidth,
  frameHeight,
  label,
}: {
  imageUrl: string;
  cropPosition: string;
  onChange: (pos: string) => void;
  frameWidth: number;
  frameHeight: number;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Parse "X% Y%" into numbers
  const parts = cropPosition.split(' ').map((s) => parseInt(s) || 50);
  const posX = parts[0] ?? 50;
  const posY = parts[1] ?? 50;

  const handleMove = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    onChange(`${Math.round(x)}% ${Math.round(y)}%`);
  }, [onChange]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    handleMove(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, handleMove]);

  // Touch support
  const onTouchStart = (e: React.TouchEvent) => {
    setDragging(true);
    const t = e.touches[0];
    handleMove(t.clientX, t.clientY);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: TouchEvent) => { const t = e.touches[0]; handleMove(t.clientX, t.clientY); };
    const onEnd = () => setDragging(false);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => { window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onEnd); };
  }, [dragging, handleMove]);

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-gray-500 font-medium">{label} — drag to position the image:</p>
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded border-2 border-blue-300 cursor-crosshair select-none"
        style={{ width: Math.min(frameWidth, 728), height: frameHeight }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Position preview"
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `${posX}% ${posY}%` }}
          draggable={false}
        />
        {/* Crosshair indicator */}
        <div
          className="absolute w-5 h-5 border-2 border-white rounded-full shadow-lg pointer-events-none"
          style={{ left: `${posX}%`, top: `${posY}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.3)' }}
        >
          <div className="absolute inset-1 bg-white rounded-full" />
        </div>
      </div>
      <p className="text-[10px] text-gray-400">Position: {posX}% {posY}%</p>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────────────── */

export default function AdvertisementsPage() {
  const { token } = useAuth();
  const { toasts, showToast, dismiss } = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [position, setPosition] = useState('sidebar');
  const [cropPosition, setCropPosition] = useState('50% 50%');
  const [active, setActive] = useState(true);
  const [variant, setVariant] = useState('default');
  const [badge, setBadge] = useState('');
  const [metaText, setMetaText] = useState('');
  const [icon, setIcon] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const fetchAds = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<Ad[]>('/ads', { token });
      setAds(data);
    } catch { setError('Failed to load ads'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (token) fetchAds(); }, [fetchAds, token]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setImageUrl(''); setLinkUrl('');
    setPosition('sidebar'); setCropPosition('50% 50%'); setActive(true);
    setVariant('default'); setBadge(''); setMetaText(''); setIcon(''); setLinkLabel('');
    setEditingId(null); setFormError(''); setShowForm(false);
  };

  const openEdit = (ad: Ad) => {
    setEditingId(ad.id); setTitle(ad.title); setDescription(ad.description || '');
    setImageUrl(ad.imageUrl || ''); setLinkUrl(ad.linkUrl || '');
    setPosition(ad.position); setCropPosition(ad.cropPosition || '50% 50%');
    setActive(ad.active);
    setVariant(ad.variant || 'default');
    setBadge(ad.badge || '');
    setMetaText(ad.metaText || '');
    setIcon(ad.icon || '');
    setLinkLabel(ad.linkLabel || '');
    setFormError(''); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setSaving(true);
    const body = {
      title,
      description: description || undefined,
      imageUrl: imageUrl || undefined,
      linkUrl: linkUrl || undefined,
      position,
      cropPosition: cropPosition !== '50% 50%' ? cropPosition : null,
      active,
      variant,
      badge: badge || null,
      metaText: metaText || null,
      icon: icon || null,
      linkLabel: linkLabel || null,
    };
    try {
      if (editingId) {
        await adminFetch(`/ads/${editingId}`, { token: token!, method: 'PUT', body: JSON.stringify(body) });
      } else {
        await adminFetch('/ads', { token: token!, method: 'POST', body: JSON.stringify(body) });
      }
      resetForm(); fetchAds();
      showToast(editingId ? 'Ad updated successfully' : 'Ad created successfully');
    } catch (err) { setFormError(err instanceof AdminApiError ? err.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this advertisement?')) return;
    try { await adminFetch(`/ads/${id}`, { token: token!, method: 'DELETE' }); fetchAds(); showToast('Ad deleted'); }
    catch { setError('Failed to delete'); }
  };

  const toggleActive = async (ad: Ad) => {
    try {
      await adminFetch(`/ads/${ad.id}`, { token: token!, method: 'PUT', body: JSON.stringify({ active: !ad.active }) });
      fetchAds();
    } catch { /* silent */ }
  };

  return (
    <div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Advertisements</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ New Ad</button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-5 rounded-lg shadow mb-6 space-y-4">
          <h2 className="font-semibold text-lg">{editingId ? 'Edit Ad' : 'New Ad'}</h2>
          {formError && <p className="text-red-600 text-sm">{formError}</p>}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required className="w-full border rounded px-3 py-2 text-sm" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (shown in popup)" rows={3} className="w-full border rounded px-3 py-2 text-sm" />

          {/* Placement + card style */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Placement</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)} className="border rounded px-3 py-2 text-sm">
                <option value="sidebar">Sidebar</option>
                <option value="banner">Banner</option>
                <option value="header">Header Banner</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Card style</label>
              <select value={variant} onChange={(e) => setVariant(e.target.value)} className="border rounded px-3 py-2 text-sm">
                <option value="default">Standard — image/icon on top</option>
                <option value="event">Event — badge + meta row</option>
                <option value="book">Book — icon beside text</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
            </label>
          </div>

          {/* Tag / badge + meta text */}
          {variant === 'event' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-3">
              <p className="text-xs text-amber-800 font-medium">
                Event card fields — the tag renders as a coloured pill above the title.
              </p>
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-gray-500 mb-1">Tag / Badge (max 50)</label>
                  <input
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    maxLength={50}
                    placeholder="UPCOMING EVENT"
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-gray-500 mb-1">Meta text (max 255)</label>
                  <input
                    value={metaText}
                    onChange={(e) => setMetaText(e.target.value)}
                    maxLength={255}
                    placeholder="Tamil Cultural Fest 2026"
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {badge && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  Preview:
                  <span className="rounded-full bg-amber-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                    {badge}
                  </span>
                  {metaText && <span className="text-gray-500">{metaText}</span>}
                </div>
              )}
            </div>
          )}

          {/* Icon picker — used when there is no image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
            <p className="text-xs text-gray-500 mb-2">
              Used instead of the image on the sidebar card. Leave empty for no icon.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIcon('')}
                className={`px-3 py-2 rounded border text-xs ${icon === '' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}
              >
                None
              </button>
              {AD_ICON_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  title={key}
                  aria-label={key}
                  aria-pressed={icon === key}
                  onClick={() => setIcon(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded border text-xs capitalize ${
                    icon === key
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <AdIcon name={key} />
                  {key}
                </button>
              ))}
            </div>
          </div>

          {/* Image upload — optional */}
          <div>
            {position === 'header' && (
              <p className="text-xs text-blue-600 mb-2 bg-blue-50 px-3 py-1.5 rounded">
                💡 Header banners display at <strong>728×90px</strong> on desktop. Upload any image and drag to position the visible area.
              </p>
            )}
            <ImageUploadField
              label="Ad Image (optional)"
              value={imageUrl}
              onChange={(url) => { setImageUrl(url); }}
              onUploadingChange={setUploadingImage}
              prefer="large"
            />
            {/* Drag-to-position crop tool — shown after image is set */}
            {imageUrl && (
              <div className="mt-4 space-y-3">
                {position === 'header' && (
                  <div className="space-y-3">
                    <ImagePositionTool imageUrl={imageUrl} cropPosition={cropPosition} onChange={setCropPosition} frameWidth={728} frameHeight={90} label="Desktop preview (728×90)" />
                    <ImagePositionTool imageUrl={imageUrl} cropPosition={cropPosition} onChange={setCropPosition} frameWidth={360} frameHeight={60} label="Mobile preview (360×60)" />
                  </div>
                )}
                {position === 'sidebar' && (
                  <ImagePositionTool imageUrl={imageUrl} cropPosition={cropPosition} onChange={setCropPosition} frameWidth={300} frameHeight={250} label="Sidebar preview (300×250)" />
                )}
                {position === 'banner' && (
                  <ImagePositionTool imageUrl={imageUrl} cropPosition={cropPosition} onChange={setCropPosition} frameWidth={728} frameHeight={200} label="Banner preview (728×200)" />
                )}
                <button type="button" onClick={() => setCropPosition('50% 50%')} className="text-xs text-gray-500 hover:underline">Reset position</button>
              </div>
            )}
          </div>

          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Link URL (optional)" className="w-full border rounded px-3 py-2 text-sm" />
          <div>
            <label className="block text-xs text-gray-500 mb-1">Link label (max 100)</label>
            <input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              maxLength={100}
              placeholder="Register & Sponsor"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">Defaults to “Learn More” when left empty.</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving || uploadingImage} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">{uploadingImage ? 'Uploading image…' : saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={resetForm} className="bg-gray-200 px-4 py-2 rounded text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : ads.length === 0 ? <p className="text-gray-500 text-sm">No advertisements yet.</p> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Media</th>
                <th className="text-left px-4 py-2">Title</th>
                <th className="text-left px-4 py-2">Style</th>
                <th className="text-left px-4 py-2">Position</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ads.map((ad) => (
                <tr key={ad.id}>
                  <td className="px-4 py-2">
                    {ad.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ad.imageUrl} alt={ad.title} className="w-16 h-10 object-cover rounded" style={ad.cropPosition ? { objectPosition: ad.cropPosition } : undefined} />
                    ) : ad.icon ? (
                      <span className="inline-flex h-10 w-16 items-center justify-center rounded bg-gray-800 text-white">
                        <AdIcon name={ad.icon} className="h-5 w-5" />
                      </span>
                    ) : <span className="text-gray-400 text-xs">No image / icon</span>}
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{ad.title}</div>
                    {ad.badge && (
                      <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                        {ad.badge}
                      </span>
                    )}
                    {ad.metaText && <div className="text-xs text-gray-500">{ad.metaText}</div>}
                    {ad.linkLabel && <div className="text-[11px] text-blue-600">&rarr; {ad.linkLabel}</div>}
                  </td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">{ad.variant || 'default'}</span>
                  </td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${ad.position === 'header' ? 'bg-blue-100 text-blue-700' : ad.position === 'banner' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{ad.position}</span></td>
                  <td className="px-4 py-2">
                    <button onClick={() => toggleActive(ad)} className={`px-2 py-0.5 rounded text-xs font-medium ${ad.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ad.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-2 flex gap-2">
                    <button onClick={() => openEdit(ad)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    <button onClick={() => handleDelete(ad.id)} className="text-red-600 hover:underline text-xs">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
