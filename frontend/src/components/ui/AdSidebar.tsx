'use client';

import { useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface Ad {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  position: string;
}

export default function AdSidebar() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/ads`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Ad[]) => setAds(data))
      .catch(() => {});
  }, []);

  if (!ads.length) {
    return (
      <div className="rounded-xl bg-card-bg shadow-sm overflow-hidden">
        <div className="bg-accent-red px-4 py-2.5"><h3 className="text-sm font-bold text-white">Advertisement</h3></div>
        <div className="p-4 flex flex-col items-center justify-center min-h-[250px] bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-dashed border-gray-200 rounded-lg m-3">
          <svg className="w-10 h-10 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6V7.5Z" /></svg>
          <p className="text-xs font-medium text-gray-400">Your Ad Here</p>
          <p className="text-[10px] text-gray-300 mt-1">Contact us for advertising</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl bg-card-bg shadow-sm overflow-hidden">
        <div className="bg-accent-red px-4 py-2.5"><h3 className="text-sm font-bold text-white">Advertisement</h3></div>
        <div className="p-2 space-y-2">
          {ads.map((ad) => (
            <button
              key={ad.id}
              type="button"
              onClick={() => setSelectedAd(ad)}
              className="w-full rounded-lg overflow-hidden hover:ring-2 hover:ring-accent-red/50 transition-all cursor-pointer"
            >
              {ad.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ad.imageUrl} alt={ad.title} className="w-full h-auto object-cover" />
              ) : (
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-4 text-center">
                  <p className="text-sm font-medium text-gray-600">{ad.title}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Ad Detail Popup */}
      {selectedAd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAd(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-lg">{selectedAd.title}</h2>
              <button onClick={() => setSelectedAd(null)} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">✕</button>
            </div>
            {selectedAd.imageUrl && (
              <div className="w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedAd.imageUrl} alt={selectedAd.title} className="w-full h-auto" />
              </div>
            )}
            <div className="p-4">
              {selectedAd.description && (
                <div className="prose prose-sm max-w-none text-gray-700 mb-4" dangerouslySetInnerHTML={{ __html: selectedAd.description }} />
              )}
              {selectedAd.linkUrl && (
                <a href={selectedAd.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-block bg-accent-red text-white px-4 py-2 rounded text-sm font-medium hover:bg-accent-red/90 transition-colors">
                  Visit Link →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
