import { useState, useEffect } from 'react';
import { Search, Filter, SlidersHorizontal, Check, X } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { useChat } from '../../context/ChatContext';
import { supabase } from '../../lib/supabase';
import { formatMessageTime, getUserColor } from '../../utils/helpers';
import clsx from 'clsx';

export function StarredSidebar() {
  const { companyUserId, contacts, handleSelect, setScrollToMessageId } = useChat();
  const [starred, setStarred] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'public' | 'private' | 'personal'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!companyUserId) return;
    const fetchStarred = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*, company_users!chat_messages_created_by_fkey(users(first_name, last_name))')
          .filter('star_by_users', 'cs', `{"{\\"user_id\\":\\"${companyUserId}\\"}"}`)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map(m => {
          let preview = m.message;
          if (m.type === 'file') {
            try {
              const meta = JSON.parse(m.message);
              preview = meta.name || 'a file';
            } catch(e) { preview = 'a file'; }
          }
          const fname = m.company_users?.users?.first_name || 'Someone';
          const lname = m.company_users?.users?.last_name || '';
          return {
            id: m.id,
            roomId: m.room_id,
            name: `${fname} ${lname}`.trim(),
            preview: preview,
            date: formatMessageTime(m.created_at),
            initial: `${fname?.[0] || '?'}${lname?.[0] || ''}`.toUpperCase(),
            color: getUserColor(m.created_by),
            createdAt: m.created_at,
          };
        });
        setStarred(formatted);
      } catch (err) {
        console.error("Error fetching starred messages:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStarred();
  }, [companyUserId]);

  // Filter logic
  const filteredStarred = starred.filter(item => {
    // 1. Search Query filter
    if (query.trim()) {
      const matchText = item.preview.toLowerCase().includes(query.toLowerCase());
      if (!matchText) return false;
    }

    // 2. Tab/FilterType filter
    if (filterType === 'all') return true;

    const contact = contacts.find(c => c.roomId === item.roomId || c.id === item.roomId);

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
  const sortedStarred = [...filteredStarred].sort((a, b) => {
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
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-[#e2e8f0]
                        rounded-md px-2.5 py-1.5 shadow-sm focus-within:border-[#4f46e5] focus-within:ring-1 focus-within:ring-[#4f46e5] transition-all mb-3">
          <Search size={13} className="text-[#94a3b8] flex-shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

        <div className="flex items-center justify-between mb-1">
          <span className="text-[#0f172a] font-bold text-[14px]">
            Starred Messages
          </span>
          <div className="flex items-center gap-1.5 relative">
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
              <Filter size={14} strokeWidth={2.5} />
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
              <SlidersHorizontal size={13} strokeWidth={2.5} />
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
        ) : sortedStarred.length > 0 ? (
          sortedStarred.map(item => (
            <div 
              key={item.id} 
              onClick={() => {
                const target = contacts.find(c => c.roomId === item.roomId || c.id === item.roomId);
                if (target) {
                  handleSelect(target);
                  setScrollToMessageId(item.id);
                }
              }}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f1f5f9] cursor-pointer transition-colors group"
            >
              <div className="relative flex-shrink-0">
                <Avatar initials={item.initial} color={item.color} size="md" borderColor="#f8fafc" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[13px] text-[#0f172a] font-semibold leading-tight line-clamp-1">
                    {item.name}
                  </span>
                  <span className="text-[10px] text-[#94a3b8] flex-shrink-0 tabular-nums font-medium whitespace-nowrap mt-0.5">
                    {item.date}
                  </span>
                </div>
                <p className="text-[12px] text-[#64748b] truncate mt-0.5 group-hover:text-[#475569]">
                  {item.preview}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-40 p-4 text-center mt-10">
            <span className="text-[#94a3b8] text-[13px]">No starred messages yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
