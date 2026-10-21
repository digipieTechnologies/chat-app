export function DateDivider({ label }) {
  return (
    <div className="flex items-center gap-4 px-6 my-6">
      <div className="flex-1 h-px bg-[#e2e8f0]" />
      <span className="text-[11px] font-bold text-[#64748b] uppercase tracking-wider px-3 py-1 rounded-full border border-[#e2e8f0] bg-white">
        {label}
      </span>
      <div className="flex-1 h-px bg-[#e2e8f0]" />
    </div>
  );
}
