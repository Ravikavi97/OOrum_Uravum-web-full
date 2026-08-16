import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getObituaryBySlug, ApiRequestError } from "@/services/api";

export const revalidate = 10;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const obit = await getObituaryBySlug(slug);
    return { title: `${obit.name} - இரங்கல்` };
  } catch {
    return { title: "இரங்கல்" };
  }
}

export default async function ObituaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let obit;
  try {
    obit = await getObituaryBySlug(slug);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) notFound();
    notFound();
  }

  const imgUrl = `${API_URL}/obituaries/${obit.id}/image`;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <nav className="flex items-center gap-2 text-sm text-foreground/50 mb-6">
        <Link href="/" className="hover:text-accent-red">முகப்பு</Link>
        <span>/</span>
        <span>இரங்கல்</span>
      </nav>

      <article className="rounded-2xl bg-card-bg shadow-sm overflow-hidden">
        <div className="w-full bg-gray-100 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgUrl}
            alt={obit.name}
            className="w-full h-auto object-contain"
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
