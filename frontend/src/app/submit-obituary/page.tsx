'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useUserAuth } from '@/contexts/UserAuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function SubmitObituaryPage() {
  const { user } = useUserAuth();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);

  // Auto-fill submitter info from logged-in user
  useEffect(() => {
    if (user) {
      setSubmitterName(user.name);
      setSubmitterEmail(user.email);
    }
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be less than 10MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('content', content);
      fd.append('submitterName', submitterName);
      fd.append('submitterEmail', submitterEmail);
      if (imageFile) fd.append('image', imageFile);

      const res = await fetch(`${API_URL}/obituaries/submit`, {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Submission failed');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="bg-green-50 rounded-2xl p-8 border border-green-200">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-xl font-bold text-green-800 mb-2">சமர்ப்பிக்கப்பட்டது!</h1>
          <p className="text-sm text-green-700 mb-4">
            உங்கள் இரங்கல் செய்தி வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது. நிர்வாகி அங்கீகரித்த பிறகு இது வெளியிடப்படும்.
          </p>
          <p className="text-xs text-green-600 mb-6">Your obituary has been submitted successfully. It will be published after admin approval.</p>
          <Link href="/" className="inline-block bg-accent-red text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-accent-red/90">
            முகப்புக்கு செல்ல
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-foreground/50 mb-6">
        <Link href="/" className="hover:text-accent-red">முகப்பு</Link>
        <span>/</span>
        <span>இரங்கல் சமர்ப்பிக்க</span>
      </nav>

      <div className="bg-card-bg rounded-2xl shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="w-1 h-6 bg-accent-red rounded-full" />
          <div>
            <h1 className="text-xl font-bold">இரங்கல் / அஞ்சலி சமர்ப்பிக்க</h1>
            <p className="text-xs text-foreground/50 mt-0.5">Submit an Obituary / Tribute</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
          <p className="text-xs text-blue-700">
            📋 உங்கள் இரங்கல் செய்தி நிர்வாகியால் மதிப்பாய்வு செய்யப்பட்ட பிறகு வெளியிடப்படும்.
            <br />
            <span className="text-blue-500">Your submission will be reviewed by an admin before publishing.</span>
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Submitter info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">உங்கள் பெயர் *</label>
              <input
                type="text"
                value={submitterName}
                onChange={(e) => setSubmitterName(e.target.value)}
                required
                placeholder="Your name"
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">மின்னஞ்சல் *</label>
              <input
                type="email"
                value={submitterEmail}
                onChange={(e) => setSubmitterEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red"
              />
            </div>
          </div>

          {/* Deceased name */}
          <div>
            <label className="block text-sm font-medium mb-1">இறந்தவரின் பெயர் *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Name of the deceased"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red"
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium mb-1">இரங்கல் செய்தி *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={6}
              placeholder="Obituary content / tribute message"
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red"
            />
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-sm font-medium mb-1">புகைப்படம்</label>
            {imagePreview ? (
              <div className="flex items-start gap-4">
                <div className="w-32 h-40 rounded-lg border overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => imgRef.current?.click()} className="text-xs text-blue-600 hover:underline">Change</button>
                  <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="text-xs text-red-600 hover:underline">Remove</button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => imgRef.current?.click()}
                className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 cursor-pointer hover:border-accent-red/50 hover:bg-red-50/30 transition-colors text-center"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') imgRef.current?.click(); }}
              >
                <div className="flex-1">
                  <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                  <p className="text-xs text-gray-500">புகைப்படத்தை பதிவேற்ற கிளிக் செய்யவும்</p>
                  <p className="text-[10px] text-gray-400 mt-1">Click to upload photo (max 10MB)</p>
                </div>
              </div>
            )}
            <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent-red text-white py-3 rounded-lg text-sm font-bold hover:bg-accent-red/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'சமர்ப்பிக்கிறது...' : 'இரங்கல் சமர்ப்பிக்க'}
          </button>
        </form>
      </div>
    </main>
  );
}
