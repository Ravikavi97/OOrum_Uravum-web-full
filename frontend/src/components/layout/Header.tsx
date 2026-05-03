'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCategories, getSiteSettings } from '@/services/api';
import type { Category } from '@/services/api';
import { useUserAuth } from '@/contexts/UserAuthContext';
import AuthModal from '@/components/ui/AuthModal';

const DEFAULT_SITE_NAME = 'OORUM URAVUM';
const DEFAULT_TAGLINE = 'ஒன்று பட்டால் உண்டு வாழ்வு';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface HeaderAd {
  id: string;
  title: string;
  imageUrl: string | null;
  linkUrl: string | null;
  cropPosition: string | null;
}

function getCurrentDateTamil(): string {
  return new Date().toLocaleDateString('ta-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Desktop nav item with optional dropdown ─────────────────────────────────

function DesktopNavItem({ cat }: { cat: Category }) {
  const hasChildren = cat.children && cat.children.length > 0;
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  function enter() {
    clearTimeout(timeout.current);
    setOpen(true);
  }
  function leave() {
    timeout.current = setTimeout(() => setOpen(false), 150);
  }

  if (!hasChildren) {
    return (
      <Link
        href={`/category/${cat.slug}`}
        className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white hover:bg-white/10"
      >
        {cat.name}
      </Link>
    );
  }

  return (
    <div className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <Link
        href={`/category/${cat.slug}`}
        className="flex items-center gap-1 whitespace-nowrap px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white hover:bg-white/10"
      >
        {cat.name}
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </Link>
      {open && (
        <div className="absolute left-0 top-full z-50 min-w-[180px] rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 animate-dropdown">
          {cat.children!.map((child) => (
            <Link
              key={child.slug}
              href={`/category/${child.slug}`}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Mobile nav item with expandable children ────────────────────────────────

function MobileNavItem({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = cat.children && cat.children.length > 0;

  return (
    <div className="border-b border-white/5">
      <div className="flex items-center">
        <Link
          href={`/category/${cat.slug}`}
          onClick={onClose}
          className="flex-1 px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10"
        >
          {cat.name}
        </Link>
        {hasChildren && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-4 py-3 text-white/60 hover:text-white"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="bg-white/5">
          {cat.children!.map((child) => (
            <Link
              key={child.slug}
              href={`/category/${child.slug}`}
              onClick={onClose}
              className="block px-8 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/10"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Header Ad Slideshow ──────────────────────────────────────────────────────

function HeaderAdSlideshow({ ads }: { ads: HeaderAd[] }) {
  const [current, setCurrent] = useState(0);
  const [animDir, setAnimDir] = useState<'left' | 'right'>('left');
  const [animating, setAnimating] = useState(false);
  const count = ads.length;

  const goTo = useCallback((idx: number, dir: 'left' | 'right') => {
    if (animating) return;
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setAnimating(false);
    }, 300);
  }, [animating]);

  const next = useCallback(() => goTo((current + 1) % count, 'left'), [current, count, goTo]);
  const prev = useCallback(() => goTo((current - 1 + count) % count, 'right'), [current, count, goTo]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(next, 4000);
    return () => clearInterval(t);
  }, [count, next]);

  if (!count) return null;
  const ad = ads[current];
  if (!ad.imageUrl) return null;

  const slideClass = animating
    ? animDir === 'left' ? 'translate-x-full opacity-0' : '-translate-x-full opacity-0'
    : 'translate-x-0 opacity-100';

  const imgStyle = ad.cropPosition ? { objectPosition: ad.cropPosition } : undefined;

  return (
    <div className="relative overflow-hidden rounded-lg bg-white/5 h-full group">
      {ad.linkUrl ? (
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className={`block w-full h-full transition-all duration-300 ease-in-out ${slideClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" style={imgStyle} />
        </a>
      ) : (
        <div className={`w-full h-full transition-all duration-300 ease-in-out ${slideClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" style={imgStyle} />
        </div>
      )}
      {count > 1 && (
        <>
          {/* Left arrow */}
          <button
            onClick={(e) => { e.preventDefault(); prev(); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 md:w-7 md:h-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            aria-label="Previous ad"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          {/* Right arrow */}
          <button
            onClick={(e) => { e.preventDefault(); next(); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 md:w-7 md:h-7 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            aria-label="Next ad"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          {/* Dots */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
            {ads.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > current ? 'left' : 'right')}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/40'}`}
                aria-label={`Ad ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Header ─────────────────────────────────────────────────────────────

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME);
  const [tagline, setTagline] = useState(DEFAULT_TAGLINE);
  const [headerLogo, setHeaderLogo] = useState('/logo.png');
  const [headerAds, setHeaderAds] = useState<HeaderAd[]>([]);
  const { user, logout } = useUserAuth();
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDateStr(getCurrentDateTamil());

    getCategories()
      .then((cats) => setCategories(cats))
      .catch(() => {});

    getSiteSettings()
      .then((settings) => {
        if (settings.siteTitle) setSiteName(settings.siteTitle);
        if (settings.siteTagline) setTagline(settings.siteTagline);
        if (settings.headerLogo) setHeaderLogo(settings.headerLogo);
      })
      .catch(() => {});

    // Fetch header ads
    fetch(`${API_URL}/ads`)
      .then((r) => r.json())
      .then((ads) => {
        setHeaderAds((ads as (HeaderAd & { position?: string })[]).filter((a) => a.position === 'header'));
      })
      .catch(() => {});
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setQuery('');
      setSearchOpen(false);
      setMenuOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-50">
      {/* Top date bar */}
      <div className="bg-primary-dark text-white/70 text-xs">
        <div className="mx-auto max-w-7xl px-4 py-1.5 flex items-center justify-between">
          <span>{dateStr}</span>
        </div>
      </div>

      {/* Logo section */}
      <div className="bg-primary-dark border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-2 md:py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 md:gap-3 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headerLogo}
              alt={siteName}
              className="h-12 w-auto md:h-20"
            />
            <div className="flex flex-col">
              <span className="text-base md:text-2xl font-bold text-white tracking-wide">
                {siteName}
              </span>
              <span className="text-[10px] md:text-xs text-white/60">
                {tagline}
              </span>
            </div>
          </Link>

          {/* Header Ad Banner — desktop: next to logo, mobile: full width below */}
          {headerAds.length > 0 && (
            <div className="hidden md:block flex-1 max-w-[728px] h-[90px] ml-4">
              <HeaderAdSlideshow ads={headerAds} />
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {/* Search icon */}
            <button
              type="button"
              onClick={() => setSearchOpen(!searchOpen)}
              className="hidden md:flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* User auth area */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                {/* Post obituary button */}
                <Link
                  href="/submit-obituary"
                  className="flex items-center gap-1.5 bg-accent-red text-white px-3 py-1.5 rounded-full text-xs font-bold hover:bg-accent-red/90 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  பதிவிடு
                </Link>
                {/* User avatar dropdown */}
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-full hover:bg-white/10 px-2 py-1 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent-red flex items-center justify-center text-white text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-white/80 max-w-[80px] truncate">{user.name}</span>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg ring-1 ring-black/5 py-1 z-50 animate-dropdown">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <Link href="/submit-obituary" onClick={() => setUserMenuOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">இரங்கல் பதிவிடு</Link>
                      <button onClick={() => { logout(); setUserMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">வெளியேறு</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="hidden md:flex items-center gap-1.5 bg-white/10 text-white px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white/20 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                உள்நுழைய
              </button>
            )}

            {/* Hamburger for mobile */}
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded text-white/70 hover:text-white"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Desktop search bar (expandable) */}
        {searchOpen && (
          <div className="hidden md:block border-t border-white/10 px-4 py-2">
            <div className="mx-auto max-w-7xl">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="தேடுக..."
                  autoFocus
                  className="flex-1 rounded bg-white/10 border border-white/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
                />
                <button type="submit" className="rounded bg-accent-red px-4 py-2 text-sm font-medium text-white hover:bg-accent-red/90 transition-colors">
                  தேடு
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Mobile header ad banner */}
        {headerAds.length > 0 && (
          <div className="md:hidden border-t border-white/10 px-4 py-2">
            <div className="h-[60px] rounded-lg overflow-hidden">
              <HeaderAdSlideshow ads={headerAds} />
            </div>
          </div>
        )}
      </div>

      {/* Navigation bar — desktop */}
      <nav className="bg-primary-dark/95 border-b border-white/5 hidden md:block">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-center gap-0.5">
            <Link
              href="/"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white hover:bg-white/10"
            >
              முகப்பு
            </Link>
            <Link
              href="/videos"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-white/80 transition-colors hover:text-white hover:bg-white/10"
            >
              வீடியோ
            </Link>
            {categories.filter((cat) => !cat.parentId).map((cat) => (
              <DesktopNavItem key={cat.slug} cat={cat} />
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-primary-dark border-t border-white/10">
          <nav className="flex flex-col">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 border-b border-white/5"
            >
              முகப்பு
            </Link>
            <Link
              href="/videos"
              onClick={() => setMenuOpen(false)}
              className="px-4 py-3 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 border-b border-white/5"
            >
              வீடியோ
            </Link>
            {categories.filter((cat) => !cat.parentId).map((cat) => (
              <MobileNavItem key={cat.slug} cat={cat} onClose={() => setMenuOpen(false)} />
            ))}
          </nav>
          <form onSubmit={handleSearch} className="p-4">
            <div className="flex gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="தேடுக..."
                className="flex-1 rounded bg-white/10 border border-white/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/40"
              />
              <button type="submit" className="rounded bg-accent-red px-4 py-2 text-sm font-medium text-white">
                தேடு
              </button>
            </div>
          </form>
          {/* Mobile auth */}
          <div className="px-4 pb-4 border-t border-white/10 pt-3">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent-red flex items-center justify-center text-white text-sm font-bold">{user.name.charAt(0).toUpperCase()}</div>
                  <span className="text-sm text-white/80">{user.name}</span>
                </div>
                <div className="flex gap-2">
                  <Link href="/submit-obituary" onClick={() => setMenuOpen(false)} className="bg-accent-red text-white px-3 py-1.5 rounded text-xs font-bold">பதிவிடு</Link>
                  <button onClick={() => { logout(); setMenuOpen(false); }} className="text-xs text-white/60 hover:text-white">வெளியேறு</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setAuthModalOpen(true); setMenuOpen(false); }} className="w-full bg-accent-red text-white py-2 rounded text-sm font-bold">உள்நுழைய / பதிவு</button>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  );
}
