import { useState, useEffect } from 'react';
import { Star, FileText, MessageSquare, Loader2 } from 'lucide-react';
import { useChat } from '../context/ChatContext';
import { supabase } from '../lib/supabase';
import { Avatar } from './ui/Avatar';
import clsx from 'clsx';

export function StarredPanel() {
  const { currentUser, contacts, handleToggleStar, setActiveTab, setScrollToMessageId } = useChat();
  const [starredMessages, setStarredMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    
    async function fetchStarred() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .filter('star_by_users', 'cs', `{"{\\"user_id\\":\\"${currentUser.id}\\"}"}`)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
          
        if (error) throw error;

        const formatted = (data || []).map(m => {
          let fileMeta = null;
          let text = m.message;
          if (m.type === 'file') {
            try { fileMeta = JSON.parse(m.message); text = ''; } catch(e) {}
          }
          return {
            id: m.id,
            senderId: m.created_by === currentUser.id ? 'me' : m.created_by,
            text,
            file: fileMeta,
            timestamp: new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: m.type || 'text',
            createdAt: m.created_at,
          };
        });
        setStarredMessages(formatted);
      } catch (err) {
        console.error("Error fetching starred messages:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStarred();
  }, [currentUser]);

  const handleUnstar = async (e, msgId) => {
    e.stopPropagation();
    // Optimistically remove it from the list
    setStarredMessages(prev => prev.filter(m => m.id !== msgId));
    // Trigger the context toggle
    await handleToggleStar(msgId);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] px-3 sm:px-6 py-4 sm:py-6">
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-[15px] font-bold text-[#0f172a]">Starred Messages</h3>
          <span className="text-[11px] font-semibold text-[#64748b] bg-white border border-[#e2e8f0] px-2.5 py-1 rounded-full shadow-sm">
            {starredMessages.length} starred
          </span>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-white border border-[#e2e8f0] rounded-xl">
                <div className="w-10 h-10 rounded-full shimmer shrink-0" />
                <div className="flex-1 min-w-0 mt-0.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-3.5 shimmer rounded-sm" />
                    <div className="w-10 h-2.5 shimmer rounded-sm" />
                  </div>
                  <div className="w-3/4 h-3 shimmer rounded-sm mt-0.5" />
                </div>
              </div>
            ))}
          </div>
        ) : starredMessages.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#fef3c7] border border-[#fde68a] flex items-center justify-center mb-4">
              <Star size={26} className="text-[#f59e0b]" strokeWidth={1.8} />
            </div>
            <p className="text-[14px] font-bold text-[#475569] mb-1">No starred messages</p>
            <p className="text-[12px] text-[#64748b]">Star messages to find them here easily</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {starredMessages.map(msg => {
              const sender = msg.senderId === 'me'
                ? currentUser
                : contacts.find(c => c.id === msg.senderId);

              return (
                <div
                  key={msg.id}
                  onClick={() => {
                    setActiveTab('chat');
                    setScrollToMessageId(msg.id);
                  }}
                  className="flex items-start gap-4 p-4 bg-white border border-[#e2e8f0]
                             rounded-xl hover:border-[#cbd5e1] hover:shadow-sm transition-all duration-150
                             cursor-pointer group min-w-0"
                >
                  <Avatar initials={sender?.initials} color={sender?.color} size="md" borderColor="#ffffff" />

                  <div className="flex-1 min-w-0 mt-0.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[13px] font-bold text-[#0f172a]">{sender?.name}</span>
                      <span className="text-[11px] font-medium text-[#94a3b8] tabular-nums">{msg.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {msg.type === 'file'
                        ? <FileText size={14} className="text-[#3b82f6] flex-shrink-0" />
                        : <MessageSquare size={14} className="text-[#cbd5e1] flex-shrink-0" />
                      }
                      <p className="text-[13px] text-[#475569] truncate font-medium">{msg.text}</p>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => handleUnstar(e, msg.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-150
                               w-8 h-8 flex items-center justify-center rounded-lg
                               hover:bg-[#fef3c7] text-[#f59e0b]">
                    <Star size={16} strokeWidth={2} fill="currentColor" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
