'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch } from '@/lib/api';

interface VideoCat {
  id: string;
  name: string;
  slug: string;
}

interface VideoPost {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  thumbnailUrl: string | null;
  platform: string;
  active: boolean;
  order: number;
  categoryId: string | null;
  category: VideoCat | null;
  publishedAt: string;
}

function getThumbnail(video: VideoPost): string {
  if (video.thumbnailUrl) return video.thumbnailUrl;
  const ytMatch = video.videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`;
  return '';
}

function getEmbedUrl(videoUrl: string): string {
  const ytMatch = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = videoUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  const dmMatch = videoUrl.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
  if (dmMatch) return `https://www.dailymotion.com/embed/video/${dmMatch[1]}`;
  return videoUrl;
}

function detectPlatform(url: string): string {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/vimeo\.com/.test(url)) return 'vimeo';
  if (/dailymotion\.com/.test(url)) return 'dailymotion';
  return 'other';
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\u0B80-\u0BFF]+/g, '-').replace(/^-|-$/g, '');
}

export default function VideosPage() {
  const { token } = useAuth();
  const [videos, setVideos] = useState<VideoPost[]>([]);
  const [categories, setCategories] = useState<VideoCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [platform, setPlatform] = useState('youtube');
  const [active, setActive] = useState(true);
  const [order, setOrder] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Category form
  const [showCatForm, setShowCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Preview & delete
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filter
  const [filterCat, setFilterCat] = useState('');

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [vids, cats] = await Promise.all([
        adminFetch<VideoPost[]>('/videos', { token, headers: { Authorization: `Bearer ${token}` } }),
        adminFetch<VideoCat[]>('/videos/categories', { token }),
      ]);
      setVideos(vids);
      setCategories(cats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setVideoUrl(''); setPlatform('youtube');
    setActive(true); setOrder(0); setCategoryId(''); setEditingId(null); setShowForm(false);
  };

  const handleEdit = (v: VideoPost) => {
    setTitle(v.title); setDescription(v.description || ''); setVideoUrl(v.videoUrl);
    setPlatform(v.platform); setActive(v.active); setOrder(v.order);
    setCategoryId(v.categoryId || ''); setEditingId(v.id); setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true); setError(''); setSuccess('');
    const body = { title, description: description || undefined, videoUrl, platform, active, order, categoryId: categoryId || null };
    try {
      if (editingId) {
        await adminFetch(`/videos/${editingId}`, { method: 'PUT', token, body: JSON.stringify(body) });
        setSuccess('Video updated');
      } else {
        await adminFetch('/videos', { method: 'POST', token, body: JSON.stringify(body) });
        setSuccess('Video created');
      }
      resetForm(); fetchData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    try {
      await adminFetch(`/videos/${id}`, { method: 'DELETE', token });
      setSuccess('Video deleted'); setDeleteId(null); fetchData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete'); }
  };

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newCatName.trim()) return;
    try {
      await adminFetch('/videos/categories', {
        method: 'POST', token,
        body: JSON.stringify({ name: newCatName.trim(), slug: toSlug(newCatName.trim()) }),
      });
      setNewCatName(''); setShowCatForm(false); setSuccess('Category created'); fetchData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to create category'); }
  };

  const handleDeleteCat = async (id: string) => {
    if (!token) return;
    try {
      await adminFetch(`/videos/categories/${id}`, { method: 'DELETE', token });
      setSuccess('Category deleted'); fetchData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to delete category'); }
  };

  const filteredVideos = filterCat ? videos.filter((v) => v.categoryId === filterCat) : videos;

  if (loading) return <div className="p-6 text-gray-500">Loading videos…</div>;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">🎬 Video Posts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage video content from YouTube, Vimeo, and other platforms</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCatForm(!showCatForm)} className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            📁 Categories
          </button>
          <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            {showForm ? 'Cancel' : '+ Add Video'}
          </button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* Category Management */}
      {showCatForm && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border p-5">
          <h2 className="text-base font-semibold mb-3">Video Categories</h2>
          <form onSubmit={handleCreateCat} className="flex gap-2 mb-4">
            <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="New category name" required className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Add</button>
          </form>
          {categories.length === 0 ? (
            <p className="text-xs text-gray-400">No categories yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
                  <span className="text-sm font-medium">{c.name}</span>
                  <button onClick={() => handleDeleteCat(c.id)} className="text-red-400 hover:text-red-600 text-xs" title="Delete">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-white rounded-xl shadow-sm border p-6 space-y-4">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit Video' : 'Add New Video'}</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Video title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Video URL *</label>
            <input type="url" value={videoUrl} onChange={(e) => { setVideoUrl(e.target.value); setPlatform(detectPlatform(e.target.value)); }} required className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="https://www.youtube.com/watch?v=..." />
            <p className="text-xs text-gray-400 mt-1">Supports YouTube, Vimeo, Dailymotion URLs</p>
          </div>
          {videoUrl && (
            <div className="rounded-lg overflow-hidden border bg-gray-50">
              <div className="aspect-video"><iframe src={getEmbedUrl(videoUrl)} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Preview" /></div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Brief description of the video" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">No category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="youtube">YouTube</option>
                <option value="vimeo">Vimeo</option>
                <option value="dailymotion">Dailymotion</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order</label>
              <input type="number" value={order} onChange={(e) => setOrder(parseInt(e.target.value) || 0)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{submitting ? 'Saving…' : editingId ? 'Update Video' : 'Add Video'}</button>
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
          </div>
        </form>
      )}

      {/* Filter by category */}
      {categories.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setFilterCat('')} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filterCat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All ({videos.length})</button>
          {categories.map((c) => {
            const count = videos.filter((v) => v.categoryId === c.id).length;
            return (
              <button key={c.id} onClick={() => setFilterCat(c.id)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterCat === c.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Video List */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border">
          <span className="text-5xl mb-4 block">🎬</span>
          <p className="text-gray-500 text-sm">{filterCat ? 'No videos in this category.' : 'No videos yet. Add your first video post.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVideos.map((v) => {
            const thumb = getThumbnail(v);
            return (
              <div key={v.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative aspect-video bg-gray-100 cursor-pointer" onClick={() => setPreviewId(previewId === v.id ? null : v.id)}>
                  {previewId === v.id ? (
                    <iframe src={`${getEmbedUrl(v.videoUrl)}?autoplay=1`} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={v.title} />
                  ) : thumb ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb} alt={v.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
                          <svg className="w-6 h-6 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300"><span className="text-4xl">🎬</span></div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${v.platform === 'youtube' ? 'bg-red-600' : v.platform === 'vimeo' ? 'bg-blue-500' : v.platform === 'dailymotion' ? 'bg-blue-700' : 'bg-gray-600'}`}>{v.platform.toUpperCase()}</span>
                    {v.category && <span className="px-2 py-0.5 rounded text-[10px] font-bold text-white bg-purple-600">{v.category.name}</span>}
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${v.active ? 'bg-green-500' : 'bg-gray-400'}`}>{v.active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1">{v.title}</h3>
                  {v.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{v.description}</p>}
                  <p className="text-[10px] text-gray-400 mb-3 truncate">{v.videoUrl}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(v)} className="flex-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-100">Edit</button>
                    <button onClick={() => setDeleteId(v.id)} className="flex-1 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-100">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteId(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-2">Delete Video?</h3>
            <p className="text-sm text-gray-600 mb-4">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(deleteId)} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
              <button onClick={() => setDeleteId(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
