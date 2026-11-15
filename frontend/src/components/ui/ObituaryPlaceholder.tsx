export default function ObituaryPlaceholder({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`flex h-full w-full items-center justify-center bg-[#f7f4eb] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/obituary-icon.svg" alt="" className="h-3/5 w-3/5 object-contain" />
    </div>
  );
}
