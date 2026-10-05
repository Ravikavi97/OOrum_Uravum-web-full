import Link from 'next/link';
import type { Advertisement } from '@/services/api';
import { AdIcon } from '@/components/ui/AdIcon';

type AdVariant = 'default' | 'event' | 'book';

/* Site promo shown under the DB ads — not an advertisement row */
export const PARTNER_CTA = {
  title: 'Partner With Oorum Uravum',
  description:
    'Promote cultural initiatives, publications, or community notices.',
  buttonLabel: 'Advertise With Us',
  href: '/contact',
};

function ArrowGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
      className="h-3.5 w-3.5"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function toVariant(v: string | null | undefined): AdVariant {
  return v === 'event' || v === 'book' ? v : 'default';
}

function AdPlaceholder() {
  return (
    <div className="rounded-2xl border-2 border-dashed border-accent-red/25 bg-accent-red/5 px-4 py-8 text-center">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
        className="mx-auto h-9 w-9 text-accent-red/40"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6V7.5z"
        />
      </svg>
      <p className="mt-2 text-sm font-semibold text-foreground/70">Your Ad Here</p>
      <p className="mt-1 text-xs text-foreground/45">Contact us to advertise</p>
    </div>
  );
}

/**
 * Media block: uploaded image when present, otherwise the chosen icon on a tile.
 * `fit` lets a caller force the image to fill a fixed box instead of sizing to
 * its intrinsic width, which would otherwise floor a flex container's width.
 */
function AdMedia({
  ad,
  rounded,
  fit = false,
}: {
  ad: Advertisement;
  rounded: string;
  fit?: boolean;
}) {
  if (ad.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ad.imageUrl}
        alt={ad.title}
        loading="lazy"
        style={ad.cropPosition ? { objectPosition: ad.cropPosition } : undefined}
        className={`${rounded} ${fit ? 'h-full w-full object-cover' : 'h-auto w-full object-cover'}`}
      />
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center bg-primary-dark text-white ${rounded} h-14 w-14`}
    >
      <AdIcon name={ad.icon || 'megaphone'} className="h-6 w-6" />
    </span>
  );
}

function EventRow({ ad }: { ad: Advertisement }) {
  if (!ad.badge && !ad.metaText) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {ad.badge && (
        <span className="rounded-full bg-accent-red px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
          {ad.badge}
        </span>
      )}
      {ad.metaText && <span className="text-xs font-medium text-gray-500">{ad.metaText}</span>}
    </div>
  );
}

function AdText({ ad }: { ad: Advertisement }) {
  return (
    <>
      <h3 className="text-lg font-bold leading-snug text-primary-dark transition-colors group-hover:text-accent-red">
        {ad.title}
      </h3>
      {ad.description && (
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/70">{ad.description}</p>
      )}
      {ad.linkUrl && (
        <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-accent-red">
          {ad.linkLabel || 'Learn More'}
          <ArrowGlyph />
        </span>
      )}
    </>
  );
}

function AdCard({ ad }: { ad: Advertisement }) {
  const variant = toVariant(ad.variant);
  const hasLink = Boolean(ad.linkUrl);
  const hasMedia = Boolean(ad.imageUrl || ad.icon);

  let content: React.ReactNode;
  if (variant === 'event') {
    content = (
      <>
        <EventRow ad={ad} />
        <AdText ad={ad} />
      </>
    );
  } else if (variant === 'book') {
    content = (
      <div className="flex items-center gap-3 sm:gap-4">
        {hasMedia && (
          <span className="flex h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
            <AdMedia ad={ad} rounded="rounded-2xl" fit />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <AdText ad={ad} />
        </div>
      </div>
    );
  } else {
    content = (
      <>
        {hasMedia && (
          <div className="mb-3">
            <AdMedia ad={ad} rounded="rounded-xl" />
          </div>
        )}
        <AdText ad={ad} />
      </>
    );
  }

  const shell =
    'rounded-2xl border border-accent-red/20 bg-accent-red/5 p-4 transition-colors hover:border-accent-red/50 hover:bg-accent-red/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2';

  if (!hasLink) {
    return <div className={shell}>{content}</div>;
  }

  const external = isExternal(ad.linkUrl as string);
  return (
    <a
      href={ad.linkUrl as string}
      {...(external ? { target: '_blank' as const, rel: 'noopener noreferrer' } : {})}
      className={`group block ${shell}`}
      aria-label={`${ad.title}${external ? ' (opens in a new tab)' : ''}`}
    >
      {content}
    </a>
  );
}

export default function SponsoredSidebar({ ads = [] }: { ads?: Advertisement[] }) {
  return (
    <aside
      aria-labelledby="advertising-heading"
      className="rounded-3xl border border-accent-red/20 bg-card-bg p-4 shadow-sm sm:p-6"
    >
      {/* Wraps and lets the heading shrink: this row's natural min-content width
          (tile + "Advertising" + "Sponsored" pill) is wider than a phone column,
          which used to push the whole page into a horizontal scroll. */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-red text-[11px] font-extrabold uppercase text-white">
          Ad
        </span>
        <h2
          id="advertising-heading"
          className="min-w-0 flex-1 text-xl font-extrabold uppercase leading-none tracking-wide text-primary-dark sm:text-[26px]"
        >
          Advertising
        </h2>
        <span className="shrink-0 rounded-full border border-gray-300 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Sponsored
        </span>
      </div>

      <div className="my-5 h-px w-full bg-accent-red/15" aria-hidden="true" />

      <div className="space-y-4">
        {ads.length > 0 ? (
          ads.map((ad) => <AdCard key={ad.id} ad={ad} />)
        ) : (
          <AdPlaceholder />
        )}

        <article className="rounded-2xl bg-primary-dark p-4 text-center sm:p-6">
          <h3 className="text-lg font-bold leading-snug text-white sm:text-xl">{PARTNER_CTA.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/70">{PARTNER_CTA.description}</p>
          <Link
            href={PARTNER_CTA.href}
            className="mt-5 block w-full rounded-lg bg-accent-red px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-red/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark"
          >
            {PARTNER_CTA.buttonLabel}
          </Link>
        </article>
      </div>
    </aside>
  );
}