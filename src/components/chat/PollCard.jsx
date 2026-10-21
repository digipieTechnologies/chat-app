import { Check } from 'lucide-react';
import clsx from 'clsx';
import { tallyPoll } from '../../utils/poll';

export function PollCard({ poll, reactions, isMe, myUserId, contacts = [], currentUser, onVote }) {
  const { counts, total, mine, voters } = tallyPoll(poll, reactions, myUserId);

  const nameOf = (id) => {
    if (id === myUserId) return 'You';
    return contacts.find(c => c.id === id)?.name || currentUser?.name || 'Someone';
  };

  return (
    <div className="w-[250px] sm:w-[300px] max-w-full flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className={clsx('text-[10px] font-bold uppercase tracking-wide', isMe ? 'text-indigo-200' : 'text-indigo-500')}>Poll</span>
        <p className="text-[14px] font-semibold leading-snug break-words whitespace-pre-wrap">{poll.question}</p>
        <span className={clsx('text-[11px]', isMe ? 'text-indigo-200' : 'text-slate-400')}>
          {poll.multi ? 'Select one or more' : 'Select one'}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {poll.options.map((label, idx) => {
          const count = counts[idx];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const selected = mine.has(idx);
          const names = (voters[idx] || []).map(nameOf).join(', ');
          return (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); onVote(idx); }}
              title={names || 'No votes yet'}
              className={clsx(
                'relative overflow-hidden rounded-lg border text-left px-3 py-2 transition-colors',
                isMe
                  ? (selected ? 'border-white/70 bg-white/15' : 'border-white/20 hover:bg-white/10')
                  : (selected ? 'border-indigo-400 bg-indigo-50' : 'border-[#e2e8f0] hover:bg-slate-50')
              )}
            >
              <span
                className={clsx('absolute inset-y-0 left-0 transition-all duration-300', isMe ? 'bg-white/20' : 'bg-indigo-100')}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center gap-2 text-[13px]">
                <span
                  className={clsx(
                    'w-4 h-4 shrink-0 flex items-center justify-center border',
                    poll.multi ? 'rounded' : 'rounded-full',
                    selected
                      ? (isMe ? 'bg-white border-white text-[#4f46e5]' : 'bg-[#4f46e5] border-[#4f46e5] text-white')
                      : (isMe ? 'border-white/60' : 'border-slate-300')
                  )}
                >
                  {selected && <Check size={11} strokeWidth={3.5} />}
                </span>
                <span className="flex-1 min-w-0 break-words">{label}</span>
                <span className={clsx('shrink-0 tabular-nums text-[11px] font-semibold', isMe ? 'text-indigo-100' : 'text-slate-500')}>
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <span className={clsx('text-[11px]', isMe ? 'text-indigo-200' : 'text-slate-400')}>
        {total} {total === 1 ? 'vote' : 'votes'}
      </span>
    </div>
  );
}
