export function EmptyState({ contacts }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#f8fafc] gap-5 select-none">
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-white border border-[#e2e8f0] flex items-center justify-center shadow-sm">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#4f46e5"
               strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
      </div>

      <div className="text-center max-w-xs">
        <h2 className="text-lg font-bold text-[#0f172a] mb-1">Select a conversation</h2>
        <p className="text-[13px] text-[#64748b] leading-relaxed">
          Choose from your messages on the left to start chatting.
        </p>
      </div>
    </div>
  );
}
