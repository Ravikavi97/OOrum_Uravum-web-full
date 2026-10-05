import type { Metadata } from "next";
import Link from "next/link";
import { getObituaries } from "@/services/api";
import type { Obituary } from "@/services/api";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Pagination from "@/components/ui/Pagination";

export const revalidate = 10;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const PAGE_SIZE = 12;

export const metadata: Metadata = {
  title: "இரங்கல் - ஊரும் உறவும்",
  description: "அனைத்து இரங்கல் மற்றும் அஞ்சலி குறிப்புகள்",
};

function fmtDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("ta-IN", { year: "numeric", month: "long", day: "numeric" });
}

function excerptOf(content: string): string {
  const text = content.replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function ObituaryCard({ obit }: { obit: Obituary }) {
  return (
    <Link
      href={`/obituary/${obit.slug}`}
      className="group bg-card-bg rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${API_URL}/obituaries/${obit.id}/image`}
          alt={obit.name}
          loading="lazy"
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h2 className="text-[13px] font-bold leading-snug line-clamp-2 group-hover:text-accent-red transition-colors">
          {obit.name}
        </h2>
        {obit.content && (
          <p className="mt-1.5 text-[11px] text-foreground/50 line-clamp-2">{excerptOf(obit.content)}</p>
        )}
        <span className="text-[10px] text-foreground/40 block mt-auto pt-2">{fmtDate(obit.publishedAt)}</span>
      </div>
    </Link>
  );
}

export default async function ObituaryListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pp } = await searchParams;
  const page = Math.max(1, parseInt(pp || "1", 10) || 1);

  const res = await getObituaries({ page, pageSize: PAGE_SIZE }).catch(() => ({
    data: [] as Obituary[],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 0,
  }));

  const obituaries = res.data;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <Breadcrumb items={[
        { label: "முகப்பு", href: "/" },
        { label: "இரங்கல்" },
      ]} />

      {/* Header — stacks on phones rather than competing with the CTA for a
          360px row; the English sub-label is dropped there because it is the
          least important text in the block. */}
      <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1 h-6 bg-accent-red rounded-full" />
            <h1 className="text-2xl font-bold">இரங்கல் / அஞ்சலி</h1>
            <span className="hidden text-xs text-foreground/40 uppercase tracking-wider ml-1 sm:inline">Obituary · Tributes</span>
          </div>
          <p className="text-sm text-foreground/60">நினைவு, நெரும்பு மற்றும் அஞ்சலி குறிப்புகள்</p>
        </div>
        <Link
          href="/submit-obituary"
          className="flex shrink-0 items-center gap-1.5 bg-accent-red text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-accent-red/85 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          இரங்கல் பதிவிடு
        </Link>
      </div>

      {/* Grid */}
      {obituaries.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {obituaries.map((o) => (
              <ObituaryCard key={o.id} obit={o} />
            ))}
          </div>
          <Pagination currentPage={page} totalPages={res.totalPages} basePath="/obituary" />
        </>
      ) : (
        <div className="py-20 text-center">
          <div className="inline-flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent-red/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-accent-red/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s-7-4.5-7-10a7 7 0 1114 0c0 5.5-7 10-7 10z" />
              </svg>
            </div>
            <p className="text-sm text-foreground/50">இரங்கல் குறிப்புகள் இன்னும் வெளியிடப்படவில்லை.</p>
            <Link
              href="/submit-obituary"
              className="bg-accent-red text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-accent-red/85 transition-colors"
            >
              இரங்கல் பதிவிடு
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}