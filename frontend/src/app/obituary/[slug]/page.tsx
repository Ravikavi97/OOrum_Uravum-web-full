import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getObituaryBySlug, getObituaryImageUrl, ApiRequestError } from "@/services/api";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ObituaryPhoto from "@/components/ui/ObituaryPhoto";

export const revalidate = 10;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const obit = await getObituaryBySlug(slug);
    return { title: `${obit.name} - Obituary (அஞ்சலி)` };
  } catch {
    return { title: "Obituary (அஞ்சலி)" };
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

  const imgUrl = getObituaryImageUrl(obit);
  const publicationContent = obit.content?.trim() || obit.lifeStory?.trim() || "";
  const detailEntries: Array<[string, string | null]> = [
    ["Date of birth", obit.dateOfBirth ? new Date(obit.dateOfBirth).toLocaleDateString("en-GB", { timeZone: "UTC" }) : null],
    ["Date of death", obit.dateOfDeath ? new Date(obit.dateOfDeath).toLocaleDateString("en-GB", { timeZone: "UTC" }) : null],
    ["Last residential address", obit.lastResidentialAddress],
  ];
  const publicationDetails = detailEntries.filter(([, value]) => Boolean(value));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumb items={[
        { label: 'முகப்பு', href: '/' },
        { label: 'Obituary (அஞ்சலி)' },
      ]} />

      <article className="rounded-2xl bg-card-bg shadow-sm overflow-hidden">
        <div className="relative min-h-72 w-full overflow-hidden bg-gray-100">
          <ObituaryPhoto
            src={imgUrl}
            alt={obit.name}
            className="w-full max-h-[75vh] object-contain"
          />
        </div>
        <div className="p-4 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Publication name</p>
          <h1 className="text-xl font-bold mb-2">{obit.name}</h1>
          <p className="text-xs text-foreground/40 mb-4">{new Date(obit.publishedAt).toLocaleDateString("ta-IN", { year: "numeric", month: "long", day: "numeric" })}</p>
          {publicationContent && (
            <section aria-labelledby="publication-content-heading">
              <h2 id="publication-content-heading" className="text-sm font-semibold mb-2">Publication content</h2>
              <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line break-words">
                {publicationContent}
              </div>
            </section>
          )}
          {publicationDetails.length > 0 && (
            <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 pt-4">
              {publicationDetails.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold text-foreground/50">{label}</dt>
                  <dd className="mt-0.5 text-sm whitespace-pre-line break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </article>
    </main>
  );
}
