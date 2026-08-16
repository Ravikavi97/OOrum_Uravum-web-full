'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MediaPickerModal, { UPLOADS_BASE, MediaItem, validateMediaFile, uploadMediaFile, formatSize } from './MediaPickerModal';

interface Props {
  /** Current image URL (full URL stored in form state) */
  value: string;
  /** Called with the new URL when an image is selected or uploaded */
  onChange: (url: string) => void;
  /** Called when upload starts/ends — parent uses this to block the save button */
  onUploadingChange?: (uploading: boolean) => void;
  label?: string;
  /** Which URL variant to prefer when picking from library */
  prefer?: 'medium' | 'large' | 'original' | 'thumbnail';
}

export default function ImageUploadField({
  value,
  onChange,
  onUploadingChange,
  label = 'Image',
  prefer = 'medium',
}: Props) {
  const { token } = useAuth();
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const setUploadingState = (v: boolean) => {
    setUploading(v);
    onUploadingChange?.(v);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const err = validateMediaFile(file);
    if (err) { setUploadError(err); return; }
    setUploadError('');
    setUploadingState(true);
    setUploadProgress(0);
    try {
      const item = await uploadMediaFile(file, token, setUploadProgress);
      const variantUrl = prefer === 'medium' ? item.mediumUrl :
                         prefer === 'large' ? item.largeUrl :
                         prefer === 'thumbnail' ? item.thumbnailUrl :
                         item.originalUrl;
      const url = `${UPLOADS_BASE}${variantUrl || item.originalUrl}`;
      onChange(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingState(false);
      setUploadProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handlePickerSelect = (url: string) => {
    onChange(url);
    setShowPicker(false);
  };

  const handleRemove = () => {
    onChange('');
    setUploadError('');
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>

      {value ? (
        /* Preview with change/remove actions */
        <div className="flex items-start gap-3 p-3 border rounded-lg bg-gray-50">
          <div className="w-20 h-20 rounded overflow-hidden bg-gray-200 shrink-0 border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Selected image" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 truncate mb-2" title={value}>{value.split('/').pop()}</p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300 transition-colors"
              >
                Upload new
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="flex-1 border-2 border-dashed border-gray-300 rounded-lg py-4 flex flex-col items-center justify-center text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors text-sm"
          >
            <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span className="font-medium">Select from library</span>
            <span className="text-xs text-gray-400 mt-0.5">Browse uploaded images</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 border-2 border-dashed border-gray-300 rounded-lg py-4 flex flex-col items-center justify-center text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50/50 transition-colors text-sm"
          >
            <svg className="w-8 h-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="font-medium">Upload new image</span>
            <span className="text-xs text-gray-400 mt-0.5">JPEG, PNG, WebP, AVIF</span>
          </button>
        </div>
      )}

      {/* Upload progress */}
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

      {uploadError && (
        <p className="mt-1 text-sm text-red-600" role="alert">{uploadError}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={handleFileChange}
        aria-label={`Upload ${label}`}
      />

      {showPicker && (
        <MediaPickerModal
          prefer={prefer}
          onSelect={handlePickerSelect}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
