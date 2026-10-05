import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

function HomeGlyph() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-3.5 w-3.5 shrink-0">
      <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
    </svg>
  );
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  if (!items || items.length === 0) return null;

  const hasHomeCrumb = items[0]?.href === '/';
  const rest = hasHomeCrumb ? items.slice(1) : items;

  return (
    <nav className="flex items-center gap-2 text-sm text-foreground/50 mb-4" aria-label="Breadcrumb">
      {hasHomeCrumb ? (
        <Link
          href="/"
          className="flex items-center gap-1.5 hover:text-accent-red transition-colors"
          aria-label="முகப்பு"
        >
          <HomeGlyph />
          {items[0].label}
        </Link>
      ) : (
        <Link
          href="/"
          className="flex items-center gap-1.5 hover:text-accent-red transition-colors"
        >
          <HomeGlyph />
          முகப்பு
        </Link>
      )}
      {rest.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-foreground/30">/</span>
          {item.href ? (
            <Link href={item.href} className="hover:text-accent-red transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground/70 font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}