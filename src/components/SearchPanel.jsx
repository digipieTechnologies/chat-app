import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useChat } from '../context/ChatContext';
import { Avatar } from './ui/Avatar';
import clsx from 'clsx';

function formatSearchTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function SearchPanel() {
  const { currentContact, contacts, currentUser } = useChat();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  
  const LIMIT = 20;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setResults([]);
    setOffset(0);
    setHasMore(true);
    if (debouncedQuery.trim() && currentContact?.roomId) {
      fetchResults(debouncedQuery, 0, true);
    }
  }, [debouncedQuery, currentContact?.roomId]);

  const fetchResults = async (searchQuery, currentOffset, isNewSearch = false) => {
    if (!currentContact?.roomId || !searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('search_messages', {
        p_room_id: currentContact.roomId,
        p_query: searchQuery.trim(),
        p_limit: LIMIT,
        p_offset: currentOffset
      });

      if (error) throw error;

      if (data) {
        setResults(prev => isNewSearch ? data : [...prev, ...data]);
        setHasMore(data.length === LIMIT);
        setOffset(currentOffset + LIMIT);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  const getSender = (senderId) => {
    if (senderId === currentUser?.id) return currentUser;
    return contacts.find(c => c.id === senderId) ?? { name: 'Unknown', initials: '?', color: '#9ca3af' };
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      fetchResults(debouncedQuery, offset);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#f8fafc]">
      {/* Search Header */}
      <div className="px-6 py-6 border-b border-[#e2e8f0] bg-white flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center">
            <Search className="absolute left-3 text-[#94a3b8]" size={18} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search in ${currentContact?.name}...`}
              className="w-full pl-10 pr-4 py-2.5 bg-[#f1f5f9] border border-transparent rounded-xl
                         text-[14px] text-[#0f172a] placeholder:text-[#94a3b8]
                         focus:bg-white focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5]
                         transition-all outline-none"
            />
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto">
          
          {!debouncedQuery.trim() ? (
            <div className="text-center py-12 mt-10">
              <Search size={36} className="mx-auto text-[#cbd5e1] mb-4" />
              <p className="text-[15px] font-bold text-[#0f172a]">Search Messages</p>
              <p className="text-[13px] text-[#64748b] mt-1">Find specific keywords or phrases in this conversation.</p>
            </div>
          ) : loading && results.length === 0 ? (
            <div className="flex flex-col gap-3">
              <div className="w-32 h-4 shimmer rounded mb-2" />
              {[1, 2, 3].map(i => (
                <div key={i} className="p-4 bg-white border border-[#e2e8f0] rounded-xl flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full shimmer shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between">
                      <div className="w-24 h-4 shimmer rounded" />
                      <div className="w-16 h-3 shimmer rounded" />
                    </div>
                    <div className="w-full h-3 shimmer rounded mt-1" />
                    <div className="w-2/3 h-3 shimmer rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-bold text-[#475569] uppercase tracking-wider">
                  {results.length > 0 ? 'Search Results' : 'No Results Found'}
                </h3>
              </div>

              {results.map((msg) => {
                const sender = getSender(msg.created_by);
                const isMe = msg.created_by === currentUser?.id;
                
                return (
                  <div key={msg.id} className="p-4 bg-white border border-[#e2e8f0] rounded-xl hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <Avatar initials={sender.initials} color={sender.color} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[13px] font-bold text-[#0f172a] truncate">
                            {isMe ? 'You' : sender.name}
                          </span>
                          <span className="text-[11px] font-medium text-[#94a3b8] flex-shrink-0">
                            {formatSearchTime(msg.created_at)}
                          </span>
                        </div>
                        <p className="text-[14px] text-[#334155] whitespace-pre-wrap break-words leading-relaxed">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {results.length > 0 && hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="mt-4 py-2.5 px-4 flex items-center justify-center gap-2
                             text-[13px] font-bold text-[#4f46e5] bg-[#eef2ff] 
                             hover:bg-[#e0e7ff] rounded-xl transition-colors disabled:opacity-70"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Loading...' : 'Load more messages'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
