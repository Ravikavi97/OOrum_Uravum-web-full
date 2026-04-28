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

export default function AdBanner() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/ads`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Ad[]) => setAds(data.filter((a) => a.position === 'banner')))
      .catch(() => {});
  }, []);

  if (!ads.length) return null;

  return (
    <>
      <div className="space-y-3 mb-6">
        {ads.map((ad) => (
          <button
            key={ad.id}
            type="button"
            onClick={() => setSelectedAd(ad)}
            className="w-full rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          >
            {ad.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.imageUrl} alt={ad.title} className="w-full h-auto object-cover" />
            ) : (
              <div className="bg-gradient-to-r from-accent-red to-accent-red/80 p-4 text-center">
                <p className="text-sm font-bold text-white">{ad.title}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedAd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAd(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-lg">{selectedAd.title}</h2>
              <button onClick={() => setSelectedAd(null)} className="text-gray-400 hover:text-gray-600 text-xl" aria-label="Close">✕</button>
            </div>
            {selectedAd.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedAd.imageUrl} alt={selectedAd.title} className="w-full h-auto" />
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
