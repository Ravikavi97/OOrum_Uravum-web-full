'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSiteSettings, getLogo, DEFAULT_LOGO_SRC } from '@/services/api';
import VisitorStats from '@/components/ui/VisitorStats';

const DEFAULT_SITE_NAME   = 'OORUM URAVUM';
const DEFAULT_TAGLINE     = 'ஒன்று பட்டால் உண்டு வாழ்வு';
const DEFAULT_DESCRIPTION = 'தமிழ் செய்திகள் — செய்திகள், அறிந்து கொள்வோம், உடல் நலம், தொழில்நுட்பம், படைப்பாக்கம்';

const quickLinks = [
  { label: 'முகப்பு',          href: '/' },
  { label: 'வீடியோ',           href: '/videos' },
  { label: 'Obituary (அஞ்சலி)',         href: '/obituary' },
  { label: 'எங்களைப் பற்றி',   href: '/about' },
  { label: 'தொடர்பு',          href: '/contact' },
  { label: 'Submit Obituary (அஞ்சலி)', href: '/submit-obituary' },
  { label: 'தனியுரிமை',       href: '/privacy' },
  { label: 'விதிமுறைகள்',     href: '/terms' },
];

const socialIcons: Record<string, { label: string; svg: React.ReactNode }> = {
  facebook: {
    label: 'Facebook',
    svg: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
  twitter: {
    label: 'Twitter / X',
    svg: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  youtube: {
    label: 'YouTube',
    svg: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23 7s-.3-1.9-1.1-2.7c-1.1-1.1-2.3-1.1-2.8-1.2C16.2 3 12 3 12 3s-4.2 0-7.1.1c-.6.1-1.8.1-2.8 1.2C1.3 5.1 1 7 1 7S.7 9.1.7 11.2v2c0 2.1.3 4.2.3 4.2s.3 1.9 1.1 2.7c1.1 1.1 2.5 1 3.1 1.1C7.2 21.3 12 21.3 12 21.3s4.2 0 7.1-.2c.6-.1 1.8-.1 2.8-1.2.8-.8 1.1-2.7 1.1-2.7s.3-2.1.3-4.2v-2C23.3 9.1 23 7 23 7zm-13.3 8.5V8.5l7.6 3.5-7.6 3.5z" />
      </svg>
    ),
  },
  instagram: {
    label: 'Instagram',
    svg: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  telegram: {
    label: 'Telegram',
    svg: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.012 9.483c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.875.738z" />
      </svg>
    ),
  },
};

export default function Footer() {
  const [siteName,    setSiteName]    = useState(DEFAULT_SITE_NAME);
  const [tagline,     setTagline]     = useState(DEFAULT_TAGLINE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [footerLogo,  setFooterLogo]  = useState(DEFAULT_LOGO_SRC);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    getSiteSettings().then((s) => {
      if (s.siteTitle)     setSiteName(s.siteTitle);
      if (s.siteTagline)   setTagline(s.siteTagline);
      if (s.siteDescription) setDescription(s.siteDescription);
      if (s.socialLinks) {
        try { setSocialLinks(JSON.parse(s.socialLinks)); } catch { /* ignore */ }
      }
    }).catch(() => {});
    // Resolves the stored value through `resolveAssetUrl`, so a relative
    // `/uploads/...` path is rebased onto the backend origin instead of 404ing
    // against this app's origin.
    getLogo('footer').then(setFooterLogo).catch(() => {});
  }, []);

  const activeSocials = Object.entries(socialLinks).filter(([, url]) => !!url);

  return (
    <footer className="bg-primary-dark text-white mt-auto">
      {/* Main footer body */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">

          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              {/* 48px keeps the footer mark in proportion to the 20px brand name beneath the
                grid, and the width cap stops a wide uploaded logo stretching the
                `lg:col-span-2` column. `onError` swaps in the bundled wordmark so a
                dead upload URL degrades to the default logo. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={footerLogo} alt={siteName} width={67} height={48}
                onError={(e) => {
                  if (e.currentTarget.src.endsWith(DEFAULT_LOGO_SRC)) return;
                  e.currentTarget.src = DEFAULT_LOGO_SRC;
                }}
                className="h-12 w-auto max-w-[160px] object-contain shrink-0" />
              <div>
                <span className="block text-xl font-extrabold text-white tracking-wide">{siteName}</span>
                <span className="block text-[11px] text-white/45 mt-0.5">{tagline}</span>
              </div>
            </Link>
            <p className="text-sm text-white/55 leading-relaxed max-w-sm">{description}</p>
            {/* Social icons */}
            {activeSocials.length > 0 && (
              <div className="flex gap-2.5 mt-5 flex-wrap">
                {activeSocials.map(([platform, url]) => {
                  const icon = socialIcons[platform];
                  return (
                    <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                      aria-label={icon?.label || platform}
                      className="flex items-center justify-center w-11 h-11 rounded-full bg-white/8 text-white/60 hover:bg-accent-red hover:text-white transition-all">
                      {icon?.svg ?? <span className="text-xs font-bold uppercase">{platform.slice(0,2)}</span>}
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-[13px] font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent-red rounded-full inline-block" />
              இணைப்புகள்
            </h3>
            <ul className="space-y-2">
              {quickLinks.slice(0, 5).map((l) => (
                <li key={l.href}>
                  <Link href={l.href}
                    className="text-sm text-white/55 hover:text-white hover:translate-x-0.5 transition-all inline-flex items-center gap-1.5">
                    <span className="text-accent-red text-[11px]">▶</span>{l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* More links */}
          <div>
            <h3 className="text-[13px] font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent-red rounded-full inline-block" />
              மேலும்
            </h3>
            <ul className="space-y-2">
              {quickLinks.slice(5).map((l) => (
                <li key={l.href}>
                  <Link href={l.href}
                    className="text-sm text-white/55 hover:text-white transition-colors inline-flex items-center gap-1.5">
                    <span className="text-accent-red text-[11px]">▶</span>{l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <VisitorStats />
          <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white/35">
            <p>Copyright © {new Date().getFullYear()} {siteName}. அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.</p>
            <p>
              Developed by{' '}
              <a href="https://casoftsolutions.cyvok.com/" target="_blank" rel="noopener noreferrer"
                className="text-white/55 hover:text-white underline-offset-2 hover:underline transition-colors">
                CASoftSolution
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
