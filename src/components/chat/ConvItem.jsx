import { useEffect, useState } from 'react';
import { MoreVertical, MailOpen, Mail, BellOff, Bell } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';

const HOUR = 3600 * 1000;
const MUTE_OPTIONS = [
  { label: '1 hour', ms: HOUR },
  { label: '8 hours', ms: 8 * HOUR },
  { label: '1 week', ms: 7 * 24 * HOUR },
  { label: 'Always', ms: 'forever' },
];

export function ConvItem({ contact: c, isActive, onClick, onMarkUnread, onMarkRead, muted = false, onMute }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isUnread = c.unread > 0;
  const canMute = !!onMute && !!c.roomId;
  const canToggle = (!!onMarkUnread && !!onMarkRead && (c.roomId || isUnread)) || canMute;

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    document.addEventListener('close-all-menus', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('close-all-menus', close);
    };
  }, [menuOpen]);

  const toggleMenu = (e) => {
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('close-all-menus'));
    setMenuOpen(v => !v);
  };

  const itemClass = 'w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium';

  return (
    <div
      onClick={onClick}
      onContextMenu={canToggle ? (e) => { e.preventDefault(); toggleMenu(e); } : undefined}
      className={clsx('conv-item group relative', isActive && 'active')}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar
          initials={c.initials}
          color={c.color}
          status={c.isChannel ? null : c.status}
          size="sm"
          borderColor={isActive ? '#f1f5f9' : '#f8fafc'}
        />
        {c.isChannel && (
          <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white
                           border border-[#e2e8f0] rounded-full flex items-center justify-center">
            <span className="text-[9px] text-[#64748b] font-bold">#</span>
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 ml-2">
        <div className="flex items-center justify-between gap-2">
          <span className={clsx(
            'flex items-center gap-1.5 min-w-0 text-[15px]',
            isActive ? 'text-[#0f172a] font-semibold' : (c.unread > 0 && !muted ? 'text-[#0f172a] font-semibold' : 'text-[#334155] font-medium')
          )}>
            <span className="truncate">{c.name}</span>
            {muted && <BellOff size={12} className="shrink-0 text-[#94a3b8]" aria-label="Muted" />}
          </span>
          <span className="text-[11.5px] text-[#94a3b8] flex-shrink-0 tabular-nums font-medium">
            {c.timestamp}
          </span>
        </div>

        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className={clsx(
            'text-[13.5px] truncate leading-snug',
            c.unread > 0 && !isActive && !muted ? 'text-[#475569] font-medium' : 'text-[#64748b]'
          )}>
            {c.lastMessage}
          </p>
          {c.unread > 0 && (
            <span
              className={clsx(
                'ubadge flex-shrink-0 border-2 border-[#f8fafc] group-hover:border-[#f1f5f9] mt-0.5',
                muted && '!bg-[#94a3b8]'
              )}
            >
              {c.unread}
            </span>
          )}
        </div>
      </div>

      {/* Hover actions */}
      {canToggle && (
        <button
          onClick={toggleMenu}
          aria-label="Chat options"
          className={clsx(
            'absolute right-1.5 top-1.5 w-6 h-6 rounded-full flex items-center justify-center bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#0f172a] shadow-sm transition-opacity',
            menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
        >
          <MoreVertical size={13} strokeWidth={2.5} />
        </button>
      )}

      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-1.5 top-8 z-50 w-[170px] bg-white border border-[#e2e8f0] rounded-md shadow-lg py-1 animate-scale-in"
        >
          {onMarkUnread && onMarkRead && (c.roomId || isUnread) && (
            <button
              onClick={() => {
                setMenuOpen(false);
                if (isUnread) onMarkRead(c);
                else onMarkUnread(c);
              }}
              className={itemClass}
            >
              {isUnread ? <MailOpen size={12} className="text-slate-400" /> : <Mail size={12} className="text-slate-400" />}
              {isUnread ? 'Mark as read' : 'Mark as unread'}
            </button>
          )}

          {canMute && muted && (
            <button
              onClick={() => {
                setMenuOpen(false);
                onMute(c, null);
              }}
              className={itemClass}
            >
              <Bell size={12} className="text-slate-400" />
              Unmute notifications
            </button>
          )}

          {canMute && !muted && (
            <>
              <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-[#94a3b8] border-t border-slate-100 mt-1">
                Mute notifications
              </div>
              {MUTE_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => {
                    setMenuOpen(false);
                    onMute(c, opt.ms);
                  }}
                  className={itemClass}
                >
                  <BellOff size={12} className="text-slate-400" />
                  {opt.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
