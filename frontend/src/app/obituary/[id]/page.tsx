import type { Metadata } from "next";
import Link from "next/link";

const BASE_URL =
  typeof window === "undefined"
    ? (process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api")
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api");

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface Obituary {
  id: string;
  name: string;
  content: string;
  sourceUrl: string | null;
  publishedAt: string;
  createdAt: string;
}

async function getObituary(id: string): Promise<Obituary | null> {
  try {
    const res = await fetch(`${BASE_URL}/obituaries`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data.find((o: Obituary) => o.id === id) || null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const obit = await getObituary(id);
  return { title: obit ? `${obit.name} - Obituary` : "Obituary" };
}

export default async function ObituaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const obit = await getObituary(id);

  if (!obit) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Obituary not found</h1>
        <Link href="/" className="text-accent-red hover:underline">Back to Home</Link>
      </main>
    );
  }

  const imgUrl = `${API_URL}/obituaries/${obit.id}/image`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-accent-red hover:underline mb-6 inline-block">&larr; Back to Home</Link>
      <article className="rounded-2xl bg-card-bg shadow-sm overflow-hidden">
        <div className="w-full aspect-[3/4] max-h-[500px] bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center overflow-hidden">
          <img
            src={imgUrl}
            alt={obit.name}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="p-6">
          <h1 className="text-xl font-bold mb-2">{obit.name}</h1>
          <p className="text-xs text-foreground/40 mb-4">{new Date(obit.publishedAt).toLocaleDateString("ta-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
          <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{obit.content}</div>
        </div>
      </article>
    </main>
  );
}
