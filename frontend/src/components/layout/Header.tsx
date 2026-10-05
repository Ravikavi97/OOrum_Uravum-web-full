'use client';

import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCategories, getSiteSettings, getLogo, DEFAULT_LOGO_SRC } from '@/services/api';
import type { Category } from '@/services/api';
import { useUserAuth } from '@/contexts/UserAuthContext';
import AuthModal from '@/components/ui/AuthModal';
import { CategoryIcon } from '@/components/ui/CategoryIcon';

const DEFAULT_SITE_NAME = 'OORUM URAVUM';
const DEFAULT_TAGLINE   = 'ஒன்று பட்டால் உண்டு வாழ்வு';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface HeaderAd {
  id: string; title: string; imageUrl: string | null;
  linkUrl: string | null; cropPosition: string | null;
}

function getCurrentDateTamil(): string {
  return new Date().toLocaleDateString('ta-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

/* ─── Ad Slideshow ────────────────────────────────────────────────────────── */
function HeaderAdSlideshow({ ads }: { ads: HeaderAd[] }) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const count = ads.length;

  const goTo = useCallback((idx: number) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => { setCurrent(idx); setAnimating(false); }, 280);
  }, [animating]);

  const next = useCallback(() => goTo((current + 1) % count), [current, count, goTo]);
  const prev = useCallback(() => goTo((current - 1 + count) % count), [current, count, goTo]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(next, 4500);
    return () => clearInterval(t);
  }, [count, next]);

  if (!count) return null;
  const ad = ads[current];
  if (!ad.imageUrl) return null;

  const imgStyle = ad.cropPosition ? { objectPosition: ad.cropPosition } : undefined;

  return (
    <div className="relative overflow-hidden rounded-lg h-full bg-white/5 group">
      {ad.linkUrl ? (
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer"
           className={`block w-full h-full transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" style={imgStyle} />
        </a>
      ) : (
        <div className={`w-full h-full transition-opacity duration-300 ${animating ? 'opacity-0' : 'opacity-100'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" style={imgStyle} />
        </div>
      )}
      {count > 1 && (
        <>
          <button onClick={(e) => { e.preventDefault(); prev(); }}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            aria-label="Previous ad">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={(e) => { e.preventDefault(); next(); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            aria-label="Next ad">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
            {ads.map((_, i) => (
              <button key={i} onClick={() => goTo(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === current ? 'bg-white' : 'bg-white/40'}`}
                aria-label={`Ad ${i + 1}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Desktop nav item with dropdown ─────────────────────────────────────────
   IMPORTANT: this menu must not sit inside any ancestor with `overflow-x-auto`
   or `overflow-y-auto`. A horizontal scroll container computes its vertical
   overflow to `auto` as well, so it clips this absolutely positioned `top-full`
   panel to the 42px nav row and the subcategories become unreachable — they
   render in the DOM but `elementFromPoint` still hits the page content behind,
   so the user sees no dropdown at all. The nav row therefore relies on
   `min-w-0` + `truncate` to stay inside the viewport instead of scrolling. ── */
function DesktopNavItem({ cat }: { cat: Category }) {
  const children = cat.children ?? [];
  const hasChildren = children.length > 0;
  const [open, setOpen] = useState(false);
  // `pinned` records that the user opened the menu from the chevron rather than
  // by hovering. Hovering already sets `open`, so without this the very next
  // click would read "already open" and close the menu again — making the
  // chevron look broken to anyone using a mouse.
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clear = () => { if (timer.current) clearTimeout(timer.current); };
  const enter = () => { clear(); setOpen(true); };
  const leave = () => {
    clear();
    timer.current = setTimeout(() => { setOpen(false); setPinned(false); }, 160);
  };
  const toggle = () => {
    clear();
    if (open && pinned) { setOpen(false); setPinned(false); }
    else { setOpen(true); setPinned(true); }
  };
  const close = () => { clear(); setOpen(false); setPinned(false); };

  // Escape closes an open menu, so the keyboard user is never trapped in it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const icon = <CategoryIcon iconUrl={cat.iconUrl} iconKey={cat.iconKey} className="h-3.5 w-3.5 shrink-0" mono />;

  if (!hasChildren) {
    return (
      <Link href={`/category/${cat.slug}`}
        className="flex min-w-0 grow basis-auto items-center justify-center gap-1.5 px-3 text-[13px] font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-colors">
        {icon}
        <span className="truncate">{cat.name}</span>
      </Link>
    );
  }

  return (
    <div className="relative flex min-w-0 grow basis-auto"
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}>
      <Link href={`/category/${cat.slug}`}
        className="flex min-w-0 grow basis-auto items-center justify-center gap-1.5 px-3 text-[13px] font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-colors">
        {icon}
        <span className="truncate">{cat.name}</span>
      </Link>

      {/* Separate toggle so the chevron opens the subcategories without
          navigating away, which also makes them reachable by tap and keyboard. */}
      <button type="button" onClick={toggle}
        aria-expanded={open} aria-controls={`desktop-submenu-${cat.slug}`}
        aria-label={open ? `Hide subcategories of ${cat.name}` : `Show subcategories of ${cat.name}`}
        className="flex shrink-0 items-center px-1.5 text-white/70 hover:text-white transition-colors">
        <svg className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none"
          viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div id={`desktop-submenu-${cat.slug}`}
          className="absolute left-0 top-full z-50 min-w-[200px] rounded-lg bg-white py-1.5 shadow-xl ring-1 ring-black/8 animate-dropdown">
          {children.map((child) => (
            <Link key={child.slug} href={`/category/${child.slug}`} onClick={close}
              className="flex items-center gap-2 px-4 py-2 text-[13px] text-gray-700 hover:bg-accent-red/8 hover:text-accent-red transition-colors font-medium">
              <CategoryIcon iconUrl={child.iconUrl} iconKey={child.iconKey} className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="truncate">{child.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Mobile nav item ─────────────────────────────────────────────────────── */
function MobileNavItem({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (cat.children?.length ?? 0) > 0;
  return (
    <div className="border-b border-white/8">
      <div className="flex items-center">
        <Link href={`/category/${cat.slug}`} onClick={onClose}
          className="flex flex-1 items-center gap-2 px-5 py-3 text-[13px] font-semibold text-white/85 hover:text-white hover:bg-white/8">
          <CategoryIcon iconUrl={cat.iconUrl} iconKey={cat.iconKey} className="h-4 w-4" mono />
          {cat.name}
        </Link>
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)}
            className="px-4 py-4 text-white/60 hover:text-white flex items-center justify-center"
            aria-label={expanded ? `Collapse ${cat.name}` : `Expand ${cat.name}`}
            aria-expanded={expanded}
            aria-controls={`mobile-submenu-${cat.slug}`}>
            <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div id={`mobile-submenu-${cat.slug}`} className="bg-white/5">
          {cat.children!.map((child) => (
            <Link key={child.slug} href={`/category/${child.slug}`} onClick={onClose}
              className="flex items-center gap-2 px-8 py-2.5 text-[12px] text-white/70 hover:text-white hover:bg-white/10">
              <CategoryIcon iconUrl={child.iconUrl} iconKey={child.iconKey} className="h-3.5 w-3.5" mono />
              {child.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Header ─────────────────────────────────────────────────────────── */
export default function Header({ initialCategories = [] }: { initialCategories?: Category[] }) {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [userMenuOpen,  setUserMenuOpen]  = useState(false);
  const [query,         setQuery]         = useState('');
  const [dateStr,       setDateStr]       = useState('');
  const [categories,    setCategories]    = useState<Category[]>(initialCategories);
  const [siteName,      setSiteName]      = useState(DEFAULT_SITE_NAME);
  const [tagline,       setTagline]       = useState(DEFAULT_TAGLINE);
  const [headerLogo,    setHeaderLogo]    = useState(DEFAULT_LOGO_SRC);
  const [headerAds,     setHeaderAds]     = useState<HeaderAd[]>([]);
  const { user, logout } = useUserAuth();
  const router = useRouter();
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDateStr(getCurrentDateTamil());
    // Only re-fetch categories if none were provided server-side
    if (initialCategories.length === 0) {
      getCategories().then(setCategories).catch(() => {});
    }
    getSiteSettings().then((s) => {
      if (s.siteTitle)   setSiteName(s.siteTitle);
      if (s.siteTagline) setTagline(s.siteTagline);
    }).catch(() => {});
    // Resolves the stored value through `resolveAssetUrl`, so a relative
    // `/uploads/...` path is rebased onto the backend origin instead of 404ing
    // against this app's origin.
    getLogo('header').then(setHeaderLogo).catch(() => {});
    fetch(`${API_URL}/ads`)
      .then((r) => r.json())
      .then((ads: (HeaderAd & { position?: string })[]) =>
        setHeaderAds(ads.filter((a) => a.position === 'header')))
      .catch(() => {});
  }, [initialCategories.length]);

  // Close user menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setQuery(''); setSearchOpen(false); setMenuOpen(false);
    }
  }

  const rootCats = categories.filter((c) => !c.parentId);

  return (
    <header className="sticky top-0 z-50 shadow-md">

      {/* ── Row 1: top utility bar ─────────────────────────────────────────── */}
      <div className="bg-primary-dark">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between gap-4 text-[11px] text-white/55">
          <span className="hidden sm:block">{dateStr}</span>
        </div>
      </div>

      {/* ── Row 2: logo + ad banner ────────────────────────────────────────── */}
      <div className="bg-primary-dark border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 sm:gap-4">
          {/* Logo — sized as a brand mark beside the site name, not as a wordmark in its
              own right. The artwork is 384x276 (aspect 1.391), so `h-9` renders it
              50x36 and `md:h-10` renders it 56x40 — matching the `min-h-[40px]` of the
              obituary CTA beside it, so both edges align. An earlier `md:h-20` made
              the logo 80px tall: twice the height of the CTA and of the site-name
              block it sits next to, which pushed Row 2 to 104px and left the logo
              dominating a row that is otherwise empty because no header ad is
              configured.

              The max-width cap is kept at EVERY breakpoint. `md:max-w-none` used to
              drop it, which defeated the whole point of the cap: a wide logo
              uploaded through the publisher dashboard then grew to its intrinsic
              width in a `shrink` row and pushed the header past the viewport.
              `onError` swaps in the bundled wordmark so a dead upload URL degrades
              to the default logo instead of a broken-image glyph in every header. */}
          <Link href="/" className="flex min-w-0 items-center gap-3 shrink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={headerLogo} alt={siteName} width={56} height={40}
              onError={(e) => {
                if (e.currentTarget.src.endsWith(DEFAULT_LOGO_SRC)) return;
                e.currentTarget.src = DEFAULT_LOGO_SRC;
              }}
              className="h-9 w-auto max-w-[90px] object-contain md:h-10 md:max-w-[120px] shrink-0" />
            <div className="hidden sm:flex flex-col">
              <span className="text-xl md:text-2xl font-extrabold text-white tracking-wide leading-tight">
                {siteName}
              </span>
              <span className="text-[11px] text-white/50 tracking-wide">{tagline}</span>
            </div>
          </Link>

          {/* Header ad banner – desktop */}
          {headerAds.length > 0 && (
            <div className="hidden xl:block flex-1 max-w-[728px] h-[90px]">
              <HeaderAdSlideshow ads={headerAds} />
            </div>
          )}

          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2 shrink-0">

            {/* Desktop user area */}
            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Link href="/submit-obituary"
                  className="flex items-center gap-1.5 bg-accent-red text-white px-3 py-2 min-h-[40px] rounded-full text-xs font-bold hover:bg-accent-red/85 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  பதிவிடு
                </Link>
                <div className="relative" ref={userMenuRef}>
                  <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 rounded-full hover:bg-white/10 px-2 py-1 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-accent-red flex items-center justify-center text-white text-sm font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-white/80 max-w-[120px] truncate">{user.name}</span>
                  </button>
                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg ring-1 ring-black/8 py-1 z-50 animate-dropdown">
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <Link href="/submit-obituary" onClick={() => setUserMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                        இரங்கல் பதிவிடு
                      </Link>
                      <button onClick={() => { logout(); setUserMenuOpen(false); }}
                        className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                        வெளியேறு
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Link href="/submit-obituary"
                  className="flex items-center gap-1.5 bg-accent-red text-white px-2.5 sm:px-3 py-2 min-h-[40px] rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap hover:bg-accent-red/85 transition-colors shrink-0">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  இரங்கல் பதிவிடு
                </Link>
                <button onClick={() => setAuthModalOpen(true)}
                  className="hidden md:flex items-center gap-1.5 border border-white/20 text-white/80 px-3 py-2 min-h-[40px] rounded-full text-xs font-semibold hover:bg-white/10 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                  </svg>
                  உள்நுழைய
                </button>
              </>
            )}

            {/* Hamburger */}
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="xl:hidden flex items-center justify-center w-11 h-11 rounded text-white/70 hover:text-white"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile ad banner */}
        {headerAds.length > 0 && (
          <div className="xl:hidden border-t border-white/10 px-4 pb-2">
            <div className="h-[56px] rounded-lg overflow-hidden">
              <HeaderAdSlideshow ads={headerAds} />
            </div>
          </div>
        )}

        {/* Expandable search bar */}
        {searchOpen && (
          <div className="border-t border-white/10 px-4 py-2">
            <div className="mx-auto max-w-7xl">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="செய்தி தேடுக..." autoFocus
                  className="flex-1 rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-accent-red/60 focus:bg-white/15 transition-all" />
                <button type="submit"
                  className="rounded-lg bg-accent-red px-5 py-2 text-sm font-bold text-white hover:bg-accent-red/85 transition-colors">
                  தேடு
                </button>
                <button type="button" onClick={() => setSearchOpen(false)}
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white/60 hover:text-white hover:border-white/40 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ── Row 3: navigation bar ──────────────────────────────────────────── */}
      {/* Row 3 shows only from `xl`. The full category bar needs ~1200px, so it
          overflowed at both `md` (768px) and `lg` (1024px). Below `xl` the mobile
          menu button is used instead.

          This row must NOT scroll horizontally. An `overflow-x-auto` ancestor
          computes its vertical overflow to `auto` too, which clipped the
          category dropdown to the 42px row height and made every subcategory
          unreachable. Long labels now truncate (`min-w-0` + `truncate`) inside
          each item instead, which keeps the bar inside the viewport without
          clipping the menus. */}
      <nav className="bg-nav-bg hidden xl:block" aria-label="Main navigation">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-stretch min-h-[42px]">

            {/* Evenly distributed group — home + videos + categories */}
            <div className="min-w-0 flex-1 flex items-stretch justify-evenly px-1">
              {/* Home link with house icon */}
              <Link href="/"
                className="flex shrink-0 items-center gap-1.5 px-3 text-[13px] font-bold text-white bg-accent-red hover:bg-accent-red/85 transition-colors">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                முகப்பு
              </Link>
              <Link href="/videos"
                className="flex shrink-0 items-center gap-1.5 px-3 text-[13px] font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                </svg>
                வீடியோ
              </Link>
              {rootCats.map((cat) => <DesktopNavItem key={cat.slug} cat={cat} />)}
            </div>

            {/* Right group — obituary + search */}
            <div className="flex items-stretch shrink-0">
              <Link href="/obituary"
                className="flex shrink-0 items-center whitespace-nowrap px-3 text-[13px] font-semibold text-white/85 hover:text-white hover:bg-white/10 transition-colors">
                இரங்கல்
              </Link>
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                aria-label="Search"
                className="flex shrink-0 items-center justify-center w-10 text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* ── Mobile slide-down menu ─────────────────────────────────────────── */}
      {menuOpen && (
        <div className="xl:hidden bg-primary-dark border-t border-white/10">
          <nav aria-label="Mobile navigation">
            <Link href="/" onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-5 py-3 text-[13px] font-bold text-white bg-accent-red/90">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              முகப்பு
            </Link>
            <Link href="/videos" onClick={() => setMenuOpen(false)}
              className="block px-5 py-3 text-[13px] font-semibold text-white/85 hover:text-white hover:bg-white/8 border-b border-white/8">
              வீடியோ
            </Link>
            {rootCats.map((cat) => (
              <MobileNavItem key={cat.slug} cat={cat} onClose={() => setMenuOpen(false)} />
            ))}
            <Link href="/obituary" onClick={() => setMenuOpen(false)}
              className="block px-5 py-3 text-[13px] font-semibold text-white/85 hover:text-white hover:bg-white/8 border-b border-white/8">
              இரங்கல்
            </Link>
          </nav>
          {/* Mobile search */}
          <form onSubmit={handleSearch} className="p-4">
            <div className="flex gap-2">
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="தேடுக..."
                className="flex-1 rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-accent-red/60" />
              <button type="submit"
                className="rounded-lg bg-accent-red px-4 py-2 text-sm font-bold text-white">
                தேடு
              </button>
            </div>
          </form>
          {/* Mobile auth */}
          <div className="px-4 pb-4 border-t border-white/10 pt-3">
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent-red flex items-center justify-center text-white text-sm font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-white/80">{user.name}</span>
                </div>
                <div className="flex gap-2">
                  <Link href="/submit-obituary" onClick={() => setMenuOpen(false)}
                    className="bg-accent-red text-white px-3 py-1.5 rounded text-xs font-bold">
                    பதிவிடு
                  </Link>
                  <button onClick={() => { logout(); setMenuOpen(false); }}
                    className="text-xs text-white/60 hover:text-white">
                    வெளியேறு
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setAuthModalOpen(true); setMenuOpen(false); }}
                className="w-full bg-accent-red text-white py-2.5 rounded-lg text-sm font-bold hover:bg-accent-red/85 transition-colors">
                உள்நுழைய / பதிவு செய்க
              </button>
            )}
          </div>
        </div>
      )}

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </header>
  );
}
