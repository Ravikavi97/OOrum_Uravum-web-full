'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getCategories, getSiteSettings } from '@/services/api';
import type { Category } from '@/services/api';

const DEFAULT_SITE_NAME = 'OORUM URAVUM';
const DEFAULT_TAGLINE = 'ஒன்று பட்டால் உண்டு வாழ்வு';

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

// ─── Main Header ─────────────────────────────────────────────────────────────

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [siteName, setSiteName] = useState(DEFAULT_SITE_NAME);
  const [tagline, setTagline] = useState(DEFAULT_TAGLINE);
  const [headerLogo, setHeaderLogo] = useState('/logo.png');
  const router = useRouter();

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
        <div className="mx-auto max-w-7xl px-4 py-2 md:py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3">
            <img src={headerLogo} alt={siteName} className="h-12 w-auto md:h-20" />
            <div className="flex flex-col">
              <span className="text-base md:text-2xl font-bold text-white tracking-wide">
                {siteName}
              </span>
              <span className="text-[10px] md:text-xs text-white/60">
                {tagline}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
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
        </div>
      )}
    </header>
  );
}
