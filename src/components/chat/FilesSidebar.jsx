import { useState, useEffect } from 'react';
import { Search, Filter, SlidersHorizontal, FileText, Image as ImageIcon, Check, Eye, X } from 'lucide-react';
import clsx from 'clsx';
import { useChat } from '../../context/ChatContext';
import { supabase } from '../../lib/supabase';
import { formatMessageTime } from '../../utils/helpers';

export function FilesSidebar() {
  const { companyUserId, contacts, handleSelect, setScrollToMessageId, setViewingFile } = useChat();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'public' | 'private' | 'personal'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!companyUserId || !contacts) {
      setLoading(false);
      return;
    }

    const fetchFiles = async () => {
      try {
        setLoading(true);
        const roomIds = contacts.map(c => c.roomId).filter(Boolean);
        console.log("[FilesSidebar] contacts:", contacts);
        console.log("[FilesSidebar] roomIds:", roomIds);
        if (roomIds.length === 0) {
          console.log("[FilesSidebar] No roomIds available, skipping query");
          setFiles([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from('chat_messages')
          .select('*, company_users!chat_messages_created_by_fkey(users(first_name, last_name))')
          .eq('type', 'file')
          .eq('is_deleted', false)
          .in('room_id', roomIds)
          .order('created_at', { ascending: false });

        console.log("[FilesSidebar] Supabase query result:", data);
        if (error) {
          console.error("[FilesSidebar] Supabase query error:", error);
          throw error;
        }

        const formatted = (data || []).map(m => {
          let meta = {};
          try {
            meta = JSON.parse(m.message);
          } catch (e) {}

          const fname = m.company_users?.users?.first_name || 'Someone';
          const lname = m.company_users?.users?.last_name || '';
          return {
            id: m.id,
            roomId: m.room_id,
            name: meta.name || 'Unknown File',
            size: meta.size || 'Unknown',
            type: meta.type || '',
            sender: `${fname} ${lname}`.trim(),
            date: formatMessageTime(m.created_at),
            url: meta.url || '#',
            rawMeta: meta,
            createdAt: m.created_at,
          };
        });
        console.log("[FilesSidebar] Formatted files:", formatted);
        setFiles(formatted);
      } catch (err) {
        console.error("Error fetching files:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [companyUserId, contacts]);

  // Filter logic
  const filteredFiles = files.filter(file => {
    // 1. Search Query filter
    if (query.trim()) {
      const matchName = file.name.toLowerCase().includes(query.toLowerCase());
      const matchSender = file.sender.toLowerCase().includes(query.toLowerCase());
      if (!matchName && !matchSender) return false;
    }

    // 2. Tab/FilterType filter
    if (filterType === 'all') return true;

    const contact = contacts.find(c => c.roomId === file.roomId || c.id === file.roomId);

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
  const sortedFiles = [...filteredFiles].sort((a, b) => {
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
            Files
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
        ) : sortedFiles.length > 0 ? (
          sortedFiles.map(file => {
            const isImage = file.type?.startsWith('image/');
            const Icon = isImage ? ImageIcon : FileText;

            return (
              <div 
                key={file.id} 
                onClick={() => {
                  const target = contacts.find(c => c.roomId === file.roomId || c.id === file.roomId);
                  if (target) {
                    setScrollToMessageId(file.id);
                    handleSelect(target);
                  }
                }}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#f1f5f9] cursor-pointer transition-colors group"
              >
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewingFile(file.rawMeta);
                  }}
                  className="relative w-10 h-10 rounded-lg flex-shrink-0 cursor-pointer overflow-hidden group/thumb flex items-center justify-center border border-[#e2e8f0]/40"
                >
                  {isImage && file.url ? (
                    <img 
                      src={file.url} 
                      alt={file.name} 
                      className="w-full h-full object-cover rounded-lg" 
                    />
                  ) : (
                    <div className={clsx(
                      "w-full h-full rounded-lg flex items-center justify-center transition-colors",
                      isImage ? "bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100" : "bg-blue-50 text-blue-500 group-hover:bg-blue-100"
                    )}>
                      <Icon size={18} strokeWidth={2.5} />
                    </div>
                  )}

                  {/* Hover Eye Overlay */}
                  <div className="absolute inset-0 bg-black/45 rounded-lg flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                    <Eye size={16} className="text-white fill-none" strokeWidth={2.5} />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[13px] text-[#0f172a] font-semibold leading-tight truncate">
                      {file.name}
                    </span>
                    <span className="text-[10px] text-[#94a3b8] flex-shrink-0 tabular-nums font-medium whitespace-nowrap mt-0.5">
                      {file.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[12px] text-[#64748b] truncate group-hover:text-[#475569]">
                      {file.sender}
                    </span>
                    <span className="text-[10px] text-[#cbd5e1]">•</span>
                    <span className="text-[11px] text-[#94a3b8] font-medium flex-shrink-0">
                      {file.size}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-40 p-4 text-center mt-10">
            <span className="text-[#94a3b8] text-[13px]">No files uploaded yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
