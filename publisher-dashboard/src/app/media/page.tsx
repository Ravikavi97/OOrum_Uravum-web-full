'use client';

import { useEffect, useState, useCallback, useRef, DragEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';
import { ToastContainer, useToast } from '@/components/Toast';

// Base URL for serving uploaded files (backend origin, not the CMS origin)
const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface MediaItem {
  id: string;
  filename: string;
  originalUrl: string;
  thumbnailUrl: string | null;
  mediumUrl: string | null;
  largeUrl: string | null;
  mimeType: string;
  size: number;
  createdAt: string;
}

export function validateMediaFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, AVIF.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${formatSize(file.size)}). Max 10 MB.`;
  }
  return null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaPage() {
  const { token } = useAuth();
  const { toasts, showToast, dismiss } = useToast();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<MediaItem[] | { data: MediaItem[] }>('/media', { token });
      setMedia(Array.isArray(data) ? data : data.data ?? []);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchMedia();
  }, [fetchMedia, token]);

  // ─── File selection ────────────────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    setError('');
    const validationError = validateMediaFile(file);
    if (validationError) {
      setError(validationError);
      setPreview(null);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleInputChange = () => {
    const file = fileRef.current?.files?.[0];
    if (file) handleFileSelect(file);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    setError('');
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── Drag and drop ────────────────────────────────────────────────────────

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // ─── Upload ────────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      await adminFetch('/media/upload', {
        token: token!,
        method: 'POST',
        body: formData,
      });
      clearSelection();
      fetchMedia();
      showToast('Image uploaded successfully');
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(''), 2000);
    } catch { /* clipboard not available */ }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await adminFetch(`/media/${id}`, { token: token!, method: 'DELETE' });
      setConfirmDelete(false);
      setSelectedItem(null);
      fetchMedia();
      showToast('Image deleted');
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const getVariants = (item: MediaItem) => {
    const variants: { label: string; url: string }[] = [
      { label: 'Original', url: `${UPLOADS_BASE}${item.originalUrl}` },
    ];
    if (item.thumbnailUrl) variants.push({ label: 'Thumbnail', url: `${UPLOADS_BASE}${item.thumbnailUrl}` });
    if (item.mediumUrl) variants.push({ label: 'Medium', url: `${UPLOADS_BASE}${item.mediumUrl}` });
    if (item.largeUrl) variants.push({ label: 'Large', url: `${UPLOADS_BASE}${item.largeUrl}` });
    return variants;
  };

  return (
    <div>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <h1 className="text-2xl font-bold mb-6">Media Library</h1>

      {/* Upload zone */}
      <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
        {!selectedFile ? (
          /* Drop zone placeholder */
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center py-12 px-6 cursor-pointer border-2 border-dashed rounded-lg mx-4 my-4 transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
            }`}
            role="button"
            tabIndex={0}
            aria-label="Click or drag to upload an image"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
          >
            <svg className={`w-12 h-12 mb-3 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            <p className="text-sm font-medium text-gray-700 mb-1">
              {dragOver ? 'Drop image here' : 'Click to upload or drag and drop'}
            </p>
            <p className="text-xs text-gray-500">JPEG, PNG, WebP or AVIF — max 10 MB</p>
          </div>
        ) : (
          /* Preview with upload/cancel */
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0 border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview!} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{formatSize(selectedFile.size)} · {selectedFile.type.split('/')[1].toUpperCase()}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Uploading…
                      </span>
                    ) : 'Upload'}
                  </button>
                  <button
                    onClick={clearSelection}
                    disabled={uploading}
                    className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-300 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="hidden"
          onChange={handleInputChange}
          aria-label="Upload media file"
        />
        {error && (
          <div className="mx-4 mb-4 bg-red-50 text-red-600 px-3 py-2 rounded text-sm flex items-center gap-2" role="alert">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : media.length === 0 ? (
        <p className="text-gray-500 text-sm">No media files yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {media.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedItem(m)}
              className="bg-white rounded-lg shadow overflow-hidden text-left hover:ring-2 hover:ring-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
              aria-label={`View details for ${m.filename}`}
            >
              <div className="aspect-square bg-gray-100 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${UPLOADS_BASE}${m.thumbnailUrl || m.originalUrl}`}
                  alt={m.filename}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="p-2">
                <p className="text-xs truncate" title={m.filename}>{m.filename}</p>
                <p className="text-xs text-gray-400">{formatSize(m.size)}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-label="Media detail"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-semibold text-lg truncate" title={selectedItem.filename}>
                {selectedItem.filename}
              </h2>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close detail modal"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <div className="bg-gray-100 rounded mb-4 flex items-center justify-center" style={{ maxHeight: '300px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${UPLOADS_BASE}${selectedItem.originalUrl}`}
                  alt={selectedItem.filename}
                  className="max-w-full max-h-[300px] object-contain"
                />
              </div>
              <div className="text-sm text-gray-500 mb-4 space-y-1">
                <p>Type: {selectedItem.mimeType}</p>
                <p>Size: {formatSize(selectedItem.size)}</p>
                <p>Uploaded: {new Date(selectedItem.createdAt).toLocaleDateString()}</p>
              </div>

              {/* Delete button */}
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="mb-4 w-full bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Image
                  </>
                )}
              </button>

              <h3 className="font-medium text-sm mb-2">Variant URLs</h3>
              <div className="space-y-2">
                {getVariants(selectedItem).map((v) => (
                  <div key={v.label} className="flex items-center gap-2">
                    <span className="text-xs font-medium w-20 shrink-0">{v.label}</span>
                    <input
                      readOnly
                      value={v.url}
                      className="flex-1 text-xs border rounded px-2 py-1 bg-gray-50 truncate"
                      aria-label={`${v.label} URL`}
                    />
                    <button
                      onClick={() => copyUrl(v.url)}
                      className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded shrink-0"
                      aria-label={`Copy ${v.label} URL`}
                    >
                      {copiedUrl === v.url ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && selectedItem && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
          onClick={() => !deleting && setConfirmDelete(false)}
          role="dialog"
          aria-label="Confirm delete"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">Delete this image?</h3>
            <p className="text-sm text-gray-500 text-center mb-6">This cannot be undone. The image and all its variants will be permanently removed.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(selectedItem.id)}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting…
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
