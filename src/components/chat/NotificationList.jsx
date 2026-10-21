import { useState } from 'react';
import { Filter, SlidersHorizontal, Check } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';
import clsx from 'clsx';
import { useChat } from '../../context/ChatContext';

export function NotificationList({ notifications = [], onSelectChat, contacts = [] }) {
  const { markNotificationAsRead, markAllNotificationsAsRead, loading } = useChat();
  const [filterType, setFilterType] = useState('all'); // 'all' | 'public' | 'private' | 'personal'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);

  const handleNotificationClick = (n) => {
    if (!n.isRead) {
      markNotificationAsRead(n.id);
    }
    
    if (!onSelectChat) return;
    
    // 1. Redirect using linkId if present (from database)
    if (n.linkId) {
      onSelectChat(n.linkId);
      return;
    }
    
    // 2. Otherwise fallback to matching colleague by name
    const queryName = n.name.toLowerCase();
    const match = contacts.find(c => c.name.toLowerCase().includes(queryName));
    if (match) {
      onSelectChat(match.id);
    }
  };

  // Filter logic
  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'all') return true;
    
    const contact = contacts.find(c => c.roomId === n.linkId || c.id === n.linkId);
    
    if (filterType === 'personal') {
      return !contact || !contact.isChannel;
    }
    
    if (filterType === 'public') {
      return contact && contact.isChannel && (
        contact.name.toLowerCase().includes('test') || 
        contact.name.toLowerCase().includes('group') ||
        contact.name.toLowerCase().includes('akash') ||
        contact.name.toLowerCase().includes('testing02')
      );
    }
    
    if (filterType === 'private') {
      return contact && contact.isChannel && !(
        contact.name.toLowerCase().includes('test') || 
        contact.name.toLowerCase().includes('group') ||
        contact.name.toLowerCase().includes('akash') ||
        contact.name.toLowerCase().includes('testing02')
      );
    }
    
    return true;
  });

  // Sort logic
  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    
    if (sortOrder === 'asc') {
      return timeA - timeB;
    } else {
      return timeB - timeA;
    }
  });

  return (
    <div className="flex flex-col w-full flex-shrink-0 h-full bg-transparent">
      {/* Header Area */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[#0f172a] font-bold text-[15px]">
            Notifications
          </span>
          <div className="flex items-center gap-1.5 relative">
            {notifications.some(n => !n.isRead) && (
              <button 
                onClick={markAllNotificationsAsRead}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2 py-0.5 rounded transition-colors"
              >
                Mark all as read
              </button>
            )}
            <button 
              onClick={() => {
                setIsFilterOpen(!isFilterOpen);
                setIsSortOpen(false);
              }}
              className={clsx(
                "flex items-center justify-center w-7 h-7 rounded-full transition-colors",
                isFilterOpen ? "bg-[#e2e8f0] text-[#0f172a]" : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]"
              )}
            >
              <Filter size={15} strokeWidth={2.5} />
            </button>
            <button 
              onClick={() => {
                setIsSortOpen(!isSortOpen);
                setIsFilterOpen(false);
              }}
              className={clsx(
                "flex items-center justify-center w-7 h-7 rounded-full transition-colors",
                isSortOpen ? "bg-[#e2e8f0] text-[#0f172a]" : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]"
              )}
            >
              <SlidersHorizontal size={14} strokeWidth={2.5} />
            </button>

            {/* Filter Dropdown */}
            {isFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                <div className="absolute right-8 top-8 z-50 bg-white border border-[#e2e8f0] rounded-md shadow-lg py-1 w-[140px] animate-scale-in text-[12px] flex flex-col text-slate-700">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'public', label: 'Public Channel' },
                    { id: 'private', label: 'Private Channel' },
                    { id: 'personal', label: 'Personal' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setFilterType(opt.id);
                        setIsFilterOpen(false);
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-50 transition-colors font-medium text-slate-600 hover:text-slate-900"
                    >
                      <span>{opt.label}</span>
                      {filterType === opt.id && (
                        <Check size={13} className="text-indigo-600 stroke-[2.5]" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Sort Dropdown */}
            {isSortOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)} />
                <div className="absolute right-0 top-8 z-50 bg-white border border-[#e2e8f0] rounded-md shadow-lg py-1 w-[110px] animate-scale-in text-[12px] flex flex-col text-slate-700">
                  {[
                    { id: 'asc', label: 'Ascending' },
                    { id: 'desc', label: 'Descending' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortOrder(opt.id);
                        setIsSortOpen(false);
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-50 transition-colors font-medium text-slate-600 hover:text-slate-900"
                    >
                      <span>{opt.label}</span>
                      {sortOrder === opt.id && (
                        <Check size={13} className="text-indigo-600 stroke-[2.5]" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
        {loading ? (
          <div className="flex-1 overflow-hidden space-y-0.5 mt-2 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-2.5 px-2 py-[7px] mx-1.5">
                <div className="w-8 h-8 rounded-full shimmer shrink-0" />
                <div className="flex-1 min-w-0 ml-1 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-24 h-3.5 shimmer rounded-sm" />
                    <div className="w-8 h-2.5 shimmer rounded-sm" />
                  </div>
                  <div className="w-3/4 h-3 shimmer rounded-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedNotifications.length > 0 ? (
          sortedNotifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={clsx(
                "flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors group",
                n.isRead ? "hover:bg-[#f1f5f9]" : "bg-[#f1f5f9] hover:bg-[#e2e8f0]"
              )}
            >
              <div className="relative flex-shrink-0 mt-0.5">
                <Avatar initials={n.initial} color={n.color} size="sm" borderColor="#f8fafc" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-white border border-[#e2e8f0] rounded-full flex items-center justify-center text-[9px] shadow-sm">
                  {n.emoji}
                </span>
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] text-[#0f172a] font-semibold leading-tight line-clamp-1">
                    {n.name} {n.action}
                  </span>
                  <span className="text-[10px] text-[#94a3b8] flex-shrink-0 tabular-nums font-medium whitespace-nowrap">
                    {n.time}
                  </span>
                </div>
                {n.preview && (
                  <p className="text-[12px] text-[#64748b] truncate mt-0.5 group-hover:text-[#475569]">
                    {n.preview}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-40 p-4 text-center mt-10">
            <span className="text-[#94a3b8] text-[13px]">No notifications yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
