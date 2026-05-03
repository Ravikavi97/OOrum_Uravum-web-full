'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/services/api';
import VisitorStats from '@/components/ui/VisitorStats';

const DEFAULT_SITE_NAME = 'OORUM URAVUM';
const DEFAULT_TAGLINE = 'ஒன்று பட்டால் உண்டு வாழ்வு';
const DEFAULT_DESCRIPTION = 'தமிழ் செய்திகள் — செய்திகள், உடல் நலம், தொழில்நுட்பம், படைப்பாக்கம்';

const quickLinks = [
  { label: 'எங்களைப் பற்றி', href: '/about' },
  { label: 'தொடர்பு', href: '/contact' },
  { label: 'இரங்கல் சமர்ப்பிக்க', href: '/submit-obituary' },
  { label: 'தனியுரிமை', href: '/privacy' },
  { label: 'விதிமுறைகள்', href: '/terms' },
];

interface SocialLinks {
  [key: string]: string;
}

const socialIcons: Record<string, string> = {
  facebook: 'Facebook',
  twitter: 'Twitter',
  youtube: 'YouTube',
  instagram: 'Instagram',
  telegram: 'Telegram',
};

export default function Footer() {
  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME);
  const [tagline, setTagline] = useState(DEFAULT_TAGLINE);
  const [description, setDescription] = useState(DEFAULT_DESCRIPTION);
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const [footerLogo, setFooterLogo] = useState('/logo.png');

  useEffect(() => {
    getSiteSettings()
      .then((settings) => {
        if (settings.siteTitle) setSiteName(settings.siteTitle);
        if (settings.siteTagline) setTagline(settings.siteTagline);
        if (settings.siteDescription) setDescription(settings.siteDescription);
        if (settings.footerLogo) setFooterLogo(settings.footerLogo);
        if (settings.socialLinks) {
          try {
            const parsed = JSON.parse(settings.socialLinks);
            setSocialLinks(parsed);
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="mt-auto bg-primary-dark text-white">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* Site info */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2">
              <img src={footerLogo} alt={siteName} className="h-16 w-auto" />
              <span className="text-lg font-bold text-white">{siteName}</span>
            </Link>
            <p className="mt-1 text-xs text-white/50">
              {tagline}
            </p>
            <p className="mt-2 text-sm text-white/60">
              {description}
            </p>

            {/* Social links */}
            {Object.keys(socialLinks).length > 0 && (
              <div className="mt-3 flex gap-3">
                {Object.entries(socialLinks).map(([platform, url]) => (
                  url && (
                    <a
                      key={platform}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white/50 hover:text-white transition-colors"
                      aria-label={socialIcons[platform] || platform}
                    >
                      {socialIcons[platform] || platform}
                    </a>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Quick links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 border-t border-white/10 pt-4">
          <VisitorStats />
          <p className="mt-4 text-center text-xs text-white/40">
            Copyright © {new Date().getFullYear()} {siteName}
          </p>
        </div>
      </div>
    </footer>
  );
}
