import { useState } from 'react';
import { Search, Edit, X } from 'lucide-react';
import clsx from 'clsx';
import { ConvItem } from './chat/ConvItem';
import { CreateGroupModal } from './chat/CreateGroupModal';
import { useChat } from '../context/ChatContext';

const TABS = [
  { id: 'all',      label: 'All'      },
  { id: 'unread',   label: 'Unread'   },
  { id: 'channels', label: 'Channels' },
];

export function ChatList({ contacts = [], activeContactId, onSelectContact }) {
  const { handleCreateGroup, loading, handleMarkUnread, handleMarkRead, isRoomMuted, handleMuteChat } = useChat();
  const [activeTab, setActiveTab]     = useState('all');
  const [query, setQuery]             = useState('');
  const [showModal, setShowModal]     = useState(false);

  const filtered = contacts.filter(c => {
    const hit = c.name.toLowerCase().includes(query.toLowerCase());
    if (!hit) return false;
    if (activeTab === 'unread')   return c.unread > 0;
    if (activeTab === 'channels') return c.isChannel;
    return true;
  });

  return (
    <div className="flex flex-col w-full flex-shrink-0 h-full bg-transparent">

      {/* Header Area */}
      <div className="px-4 pt-4 pb-2">
        {/* Title & Action */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#0f172a] font-bold text-[15px]">
            Messages
          </span>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center w-7 h-7 rounded-full text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0] transition-colors"
          >
            <Edit size={14} strokeWidth={2.5} />
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-[#e2e8f0]
                        rounded-md px-2.5 py-1.5 shadow-sm focus-within:border-[#4f46e5] focus-within:ring-1 focus-within:ring-[#4f46e5] transition-all mb-3">
          <Search size={13} className="text-[#94a3b8] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-[13px] text-[#0f172a] placeholder:text-[#94a3b8]
                       outline-none min-w-0"
          />
          {query.length > 0 && (
            <button 
              onClick={() => setQuery('')}
              className="text-[#94a3b8] hover:text-[#475569] transition-colors flex-shrink-0 focus:outline-none"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[#e2e8f0] p-0.5 rounded-lg">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={clsx(
                'flex-1 py-1 rounded-md text-[11px] font-semibold transition-all duration-150',
                activeTab === t.id
                  ? 'bg-white text-[#0f172a] shadow-sm'
                  : 'text-[#64748b] hover:text-[#475569]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {loading ? (
          <div className="flex-1 overflow-hidden space-y-0.5 mt-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2.5 py-[9px] mx-1.5">
                <div className="w-8 h-8 rounded-full shimmer shrink-0" />
                <div className="flex-1 min-w-0 ml-2 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-24 h-4 shimmer rounded-sm" />
                    <div className="w-8 h-3 shimmer rounded-sm" />
                  </div>
                  <div className="w-3/4 h-3.5 shimmer rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Search size={24} className="text-[#cbd5e1] mb-3" />
            <p className="text-[13px] text-[#64748b] font-medium">No results found</p>
          </div>
        ) : (
          filtered.map(c => (
            <ConvItem
              key={c.id}
              contact={c}
              isActive={c.id === activeContactId}
              onClick={() => onSelectContact(c)}
              onMarkUnread={handleMarkUnread}
              onMarkRead={handleMarkRead}
              muted={isRoomMuted(c.roomId)}
              onMute={handleMuteChat}
            />
          ))
        )}
      </div>

      <CreateGroupModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        contacts={contacts}
        onCreate={handleCreateGroup}
      />
    </div>
  );
}
