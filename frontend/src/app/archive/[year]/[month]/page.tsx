import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticles } from "@/services/api";
import ArticleCard from "@/components/article/ArticleCard";
import Pagination from "@/components/ui/Pagination";

export const revalidate = 10;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const MONTHS = ["ஜனவரி","பிப்ரவரி","மார்ச்","ஏப்ரல்","மே","ஜூன்","ஜூலை","ஆகஸ்ட்","செப்டம்பர்","அக்டோபர்","நவம்பர்","டிசம்பர்"];

export async function generateMetadata({ params }: { params: Promise<{ year: string; month: string }> }): Promise<Metadata> {
  const { year, month } = await params;
  const m = parseInt(month, 10);
  const mn = m >= 1 && m <= 12 ? MONTHS[m - 1] : month;
  return { title: `${mn} ${year} காப்பகம் - ஊரும் உறவும்`, alternates: { canonical: `${SITE_URL}/archive/${year}/${month}` } };
}

export default async function ArchivePage({ params, searchParams }: { params: Promise<{ year: string; month: string }>; searchParams: Promise<{ page?: string }> }) {
  const { year: ys, month: ms } = await params;
  const { page: pp } = await searchParams;
  const year = parseInt(ys, 10), month = parseInt(ms, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) notFound();
  const page = Math.max(1, parseInt(pp || "1", 10) || 1);

  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  let result;
  try { result = await getArticles({ dateFrom, dateTo, page, pageSize: 9, status: "PUBLISHED" }); }
  catch { result = { data: [], total: 0, page: 1, pageSize: 9, totalPages: 0 }; }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold border-b-2 border-primary-dark pb-2">{MONTHS[month - 1]} {year} — காப்பகம்</h1>
      {result.data.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.data.map((a) => <ArticleCard key={a.id} article={a} />)}
        </div>
      ) : (
        <p className="py-12 text-center text-foreground/60">இந்த மாதத்தில் செய்திகள் இல்லை</p>
      )}
      <Pagination currentPage={page} totalPages={result.totalPages} basePath={`/archive/${year}/${month}`} />
    </main>
  );
}
