import Link from "next/link";

const MONTHS = ["ஜனவரி","பிப்ரவரி","மார்ச்","ஏப்ரல்","மே","ஜூன்","ஜூலை","ஆகஸ்ட்","செப்டம்பர்","அக்டோபர்","நவம்பர்","டிசம்பர்"];

// Generate last 12 months from current date
function getRecentMonths(): { year: number; month: number; label: string }[] {
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return months;
}

export default function ArchiveSidebar() {
  const months = getRecentMonths();

  return (
    <div className="rounded-xl bg-card-bg shadow-sm overflow-hidden">
      <div className="bg-accent-red px-4 py-2.5">
        <h3 className="text-sm font-bold text-white">Archive</h3>
      </div>
      <ul className="p-3 space-y-1">
        {months.map((m) => (
          <li key={`${m.year}-${m.month}`}>
            <Link
              href={`/archive/${m.year}/${m.month}`}
              className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs text-foreground/70 hover:bg-accent-red/10 hover:text-accent-red transition-colors"
            >
              <span>{m.label}</span>
              <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
