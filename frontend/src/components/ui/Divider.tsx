interface DividerProps {
  className?: string;
  label?: string;
}

export default function Divider({ className = '', label }: DividerProps) {
  if (!label) {
    return <div role="separator" className={`border-t-2 border-accent-red/20 ${className}`} />;
  }

  return (
    <div role="separator" className={`flex items-center gap-3 ${className}`}>
      <span className="h-0.5 flex-1 bg-gradient-to-r from-transparent to-accent-red/30" />
      <span className="shrink-0 w-1.5 h-1.5 rotate-45 bg-accent-red/60 rounded-[2px]" />
      {label && <span className="shrink-0 text-[11px] font-bold uppercase tracking-widest text-foreground/35">{label}</span>}
      <span className="shrink-0 w-1.5 h-1.5 rotate-45 bg-accent-red/60 rounded-[2px]" />
      <span className="h-0.5 flex-1 bg-gradient-to-l from-transparent to-accent-red/30" />
    </div>
  );
}