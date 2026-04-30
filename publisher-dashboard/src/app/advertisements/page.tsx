'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';

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
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

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
    setEditingId(null); setFormError(''); setShowForm(false); setImagePreview(null);
    if (imgRef.current) imgRef.current.value = '';
  };

  const openEdit = (ad: Ad) => {
    setEditingId(ad.id); setTitle(ad.title); setDescription(ad.description || '');
    setImageUrl(ad.imageUrl || ''); setLinkUrl(ad.linkUrl || '');
    setPosition(ad.position); setCropPosition(ad.cropPosition || '50% 50%');
    setActive(ad.active); setImagePreview(ad.imageUrl || null);
    setFormError(''); setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const media = await adminFetch<{ originalUrl: string; mediumUrl: string | null }>('/media/upload', { token: token!, method: 'POST', body: fd });
      const url = `${UPLOADS_BASE}${media.mediumUrl || media.originalUrl}`;
      setImageUrl(url); setImagePreview(url);
    } catch { setFormError('Image upload failed'); setImagePreview(null); }
    finally { setUploading(false); }
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
    };
    try {
      if (editingId) {
        await adminFetch(`/ads/${editingId}`, { token: token!, method: 'PUT', body: JSON.stringify(body) });
      } else {
        await adminFetch('/ads', { token: token!, method: 'POST', body: JSON.stringify(body) });
      }
      resetForm(); fetchAds();
    } catch (err) { setFormError(err instanceof AdminApiError ? err.message : 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this advertisement?')) return;
    try { await adminFetch(`/ads/${id}`, { token: token!, method: 'DELETE' }); fetchAds(); }
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

          {/* Position selector */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Placement</label>
              <select value={position} onChange={(e) => setPosition(e.target.value)} className="border rounded px-3 py-2 text-sm">
                <option value="sidebar">Sidebar</option>
                <option value="banner">Banner</option>
                <option value="header">Header Banner</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm mt-4">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
            </label>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Ad Image</label>
            {position === 'header' && (
              <p className="text-xs text-blue-600 mb-2 bg-blue-50 px-3 py-1.5 rounded">
                💡 Header banners display at <strong>728×90px</strong> on desktop. Upload any image and drag to position the visible area.
              </p>
            )}
            {imagePreview ? (
              <div className="space-y-4">
                {/* Drag-to-position crop tool */}
                {position === 'header' && (
                  <div className="space-y-3">
                    <ImagePositionTool
                      imageUrl={imagePreview}
                      cropPosition={cropPosition}
                      onChange={setCropPosition}
                      frameWidth={728}
                      frameHeight={90}
                      label="Desktop preview (728×90)"
                    />
                    <ImagePositionTool
                      imageUrl={imagePreview}
                      cropPosition={cropPosition}
                      onChange={setCropPosition}
                      frameWidth={360}
                      frameHeight={60}
                      label="Mobile preview (360×60)"
                    />
                  </div>
                )}
                {position === 'sidebar' && (
                  <ImagePositionTool
                    imageUrl={imagePreview}
                    cropPosition={cropPosition}
                    onChange={setCropPosition}
                    frameWidth={300}
                    frameHeight={250}
                    label="Sidebar preview (300×250)"
                  />
                )}
                {position === 'banner' && (
                  <ImagePositionTool
                    imageUrl={imagePreview}
                    cropPosition={cropPosition}
                    onChange={setCropPosition}
                    frameWidth={728}
                    frameHeight={200}
                    label="Banner preview (728×200)"
                  />
                )}
                <div className="flex gap-3">
                  {uploading && <p className="text-xs text-blue-600">Uploading…</p>}
                  <button type="button" onClick={() => imgRef.current?.click()} className="text-xs text-blue-600 hover:underline">Change image</button>
                  <button type="button" onClick={() => { setImageUrl(''); setImagePreview(null); setCropPosition('50% 50%'); }} className="text-xs text-red-600 hover:underline">Remove</button>
                  <button type="button" onClick={() => setCropPosition('50% 50%')} className="text-xs text-gray-500 hover:underline">Reset position</button>
                </div>
              </div>
            ) : (
              <div onClick={() => imgRef.current?.click()} className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') imgRef.current?.click(); }}>
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                <span className="text-xs text-gray-500">Upload ad image</span>
              </div>
            )}
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>

          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="Link URL (optional)" className="w-full border rounded px-3 py-2 text-sm" />

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={resetForm} className="bg-gray-200 px-4 py-2 rounded text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : ads.length === 0 ? <p className="text-gray-500 text-sm">No advertisements yet.</p> : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-2">Image</th>
                <th className="text-left px-4 py-2">Title</th>
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
                    ) : <span className="text-gray-400 text-xs">No image</span>}
                  </td>
                  <td className="px-4 py-2 font-medium">{ad.title}</td>
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
