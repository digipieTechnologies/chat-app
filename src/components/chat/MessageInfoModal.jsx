import { createPortal } from 'react-dom';
import { X, CheckCheck, Check } from 'lucide-react';
import { Avatar } from '../ui/Avatar';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// "Seen by" details for one of my messages. `readBy` is [{ user_id, read_at }] from the chat context
export function MessageInfoModal({ message, readBy = [], contact, contacts = [], myUserId, onClose }) {
  const receipts = readBy
    .filter(r => r?.user_id && r.user_id !== myUserId)
    .sort((a, b) => new Date(a.read_at || 0) - new Date(b.read_at || 0));

  // Everyone who should be able to see the message, other than me
  const audienceIds = contact?.isChannel
    ? (contact.participants || []).filter(id => id !== myUserId)
    : [contact?.id].filter(Boolean);

  const seenIds = new Set(receipts.map(r => r.user_id));
  const notSeenIds = audienceIds.filter(id => !seenIds.has(id));

  const person = (id) => contacts.find(c => c.id === id) || { id, name: 'Unknown user', initials: '?', color: '#9ca3af' };

  const Row = ({ id, right }) => {
    const p = person(id);
    return (
      <div className="flex items-center gap-3 py-2">
        <Avatar initials={p.initials} color={p.color} size="sm" borderColor="#ffffff" />
        <span className="flex-1 min-w-0 truncate text-[13px] font-semibold text-slate-800">{p.name}</span>
        {right && <span className="text-[11px] text-slate-400 tabular-nums shrink-0">{right}</span>}
      </div>
    );
  };

  const preview = message.type === 'file' ? (message.file?.name || 'Attachment') : message.text;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[400px] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-slate-800">Message info</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <p className="text-[13px] text-slate-700 line-clamp-3 break-words whitespace-pre-wrap">{preview}</p>
            <p className="text-[11px] text-slate-400 mt-1">Sent {formatWhen(message.createdAt)}</p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-sky-500 mb-1">
              <CheckCheck size={14} /> Seen by {receipts.length > 0 ? `(${receipts.length})` : ''}
            </div>
            {receipts.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-1">Nobody has seen this message yet.</p>
            ) : (
              receipts.map(r => <Row key={r.user_id} id={r.user_id} right={formatWhen(r.read_at)} />)
            )}
          </div>

          {notSeenIds.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-bold text-slate-400 mb-1">
                <Check size={14} /> Not seen yet ({notSeenIds.length})
              </div>
              {notSeenIds.map(id => <Row key={id} id={id} />)}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
