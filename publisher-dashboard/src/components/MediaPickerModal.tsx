'use client';

import { useEffect, useState, useCallback, useRef, DragEvent } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminFetch, AdminApiError } from '@/lib/api';

export const UPLOADS_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
).replace(/\/api$/, '');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface MediaItem {
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

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function validateMediaFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.includes(file.type))
    return `Unsupported file type. Allowed: JPEG, PNG, WebP, AVIF.`;
  if (file.size > MAX_FILE_SIZE)
    return `File too large (${formatSize(file.size)}). Max 10 MB.`;
  return null;
}

/* ─── Upload progress helper using XMLHttpRequest ────────────────────────── */

export async function uploadMediaFile(
  file: File,
  token: string,
  onProgress: (pct: number) => void,
): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);

    const xhr = new XMLHttpRequest();
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

    xhr.open('POST', `${apiUrl}/media/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid response')); }
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          reject(new Error(body?.error?.message || `Upload failed (${xhr.status})`));
        } catch { reject(new Error(`Upload failed (${xhr.status})`)); }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(fd);
  });
}

/* ─── MediaPickerModal ───────────────────────────────────────────────────── */

interface Props {
  onSelect: (url: string, item: MediaItem) => void;
  onClose: () => void;
  /** Which URL variant to return: 'medium' | 'large' | 'original' | 'thumbnail' */
  prefer?: 'medium' | 'large' | 'original' | 'thumbnail';
}

export default function MediaPickerModal({ onSelect, onClose, prefer = 'medium' }: Props) {
  const { token } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await adminFetch<MediaItem[]>('/media', { token });
      setMedia(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const pickUrl = (item: MediaItem): string => {
    const base = UPLOADS_BASE;
    if (prefer === 'thumbnail') return `${base}${item.thumbnailUrl || item.originalUrl}`;
    if (prefer === 'large') return `${base}${item.largeUrl || item.originalUrl}`;
    if (prefer === 'medium') return `${base}${item.mediumUrl || item.originalUrl}`;
    return `${base}${item.originalUrl}`;
  };

  const handleFileSelect = (file: File) => {
    setUploadError('');
    const err = validateMediaFile(file);
    if (err) { setUploadError(err); return; }
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!uploadFile || !token) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    try {
      const item = await uploadMediaFile(uploadFile, token, setUploadProgress);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadProgress(0);
      if (fileRef.current) fileRef.current.value = '';
      await fetchMedia();
      // Auto-select the newly uploaded image
      onSelect(pickUrl(item), item);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Media picker"
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Media Library</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Upload zone */}
          <div className="border rounded-lg overflow-hidden">
            {!uploadFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`flex flex-col items-center justify-center py-8 cursor-pointer border-2 border-dashed rounded-lg m-3 transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
                }`}
                role="button" tabIndex={0}
                aria-label="Click or drag to upload an image"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
              >
                <svg className={`w-10 h-10 mb-2 ${dragOver ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <p className="text-sm font-medium text-gray-700">Upload a new image</p>
                <p className="text-xs text-gray-500 mt-1">JPEG, PNG, WebP, AVIF — max 10 MB</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0 border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={uploadPreview!} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{uploadFile.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{formatSize(uploadFile.size)}</p>

                    {/* Progress bar */}
                    {uploading && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Uploading…</span>
                          <span>{uploadProgress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {!uploading && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleUpload}
                          className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Upload &amp; Select
                        </button>
                        <button
                          onClick={() => { setUploadFile(null); setUploadPreview(null); setUploadError(''); if (fileRef.current) fileRef.current.value = ''; }}
                          className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {uploadError && (
                  <p className="mt-2 text-sm text-red-600">{uploadError}</p>
                )}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
              aria-label="Upload image file"
            />
            {uploadError && !uploadFile && (
              <p className="px-4 pb-3 text-sm text-red-600">{uploadError}</p>
            )}
          </div>

          {/* Library grid */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Or select from library</h3>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            {loading ? (
              <p className="text-gray-500 text-sm">Loading…</p>
            ) : media.length === 0 ? (
              <p className="text-gray-500 text-sm">No images uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(pickUrl(item), item)}
                    className="group relative bg-gray-100 rounded-lg overflow-hidden aspect-square border-2 border-transparent hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-all"
                    aria-label={`Select ${item.filename}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${UPLOADS_BASE}${item.thumbnailUrl || item.originalUrl}`}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 text-xs font-medium px-2 py-1 rounded shadow transition-opacity">
                        Select
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
