import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Check, CheckCheck, Search, X, ChevronUp, ChevronDown, Pin } from 'lucide-react';
import clsx from 'clsx';
import { Virtuoso } from 'react-virtuoso';
import { Avatar } from './ui/Avatar';
import { DateDivider } from './chat/DateDivider';
import { MessageBubble } from './chat/MessageBubble';
import { useChat } from '../context/ChatContext';

function getDateLabel(isoString) {
  if (!isoString) return 'Today';
  const date = new Date(isoString);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function groupMessages(messages) {
  const groups = [];
  messages.forEach(msg => {
    const dateLabel = getDateLabel(msg.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.senderId === msg.senderId && last.dateLabel === dateLabel) {
      last.items.push(msg);
    } else {
      groups.push({ senderId: msg.senderId, dateLabel, items: [msg] });
    }
  });
  return groups;
}

export function MessageArea({ messages, contact, currentUser, contacts = [], typingUsers = [], onViewFile, isSearchOpen, setIsSearchOpen }) {
  const virtuosoRef = useRef(null);
  const { handleTogglePin, isFetchingChat, scrollToMessageId, setScrollToMessageId, uploadingFiles } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [tempHighlightId, setTempHighlightId] = useState(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Flatten for virtualization
  const flattenedItems = useMemo(() => {
    const activeMessages = messages.filter(m => !m.isDeleted);
    const groups = groupMessages(activeMessages);
    const items = [];
    let lastDateLabel = null;

    groups.forEach(group => {
      const showDivider = group.dateLabel !== lastDateLabel;
      if (showDivider) {
        lastDateLabel = group.dateLabel;
      }
      items.push({
        ...group,
        showDivider,
        id: group.items[0]?.id || Math.random() // Unique ID
      });
    });
    return items;
  }, [messages]);

  // Find matches
  const matches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return messages.filter(m => {
      if (m.isDeleted) return false;
      if (m.type === 'text' && m.text?.toLowerCase().includes(query)) return true;
      if (m.type === 'file' && m.file?.name?.toLowerCase().includes(query)) return true;
      return false;
    });
  }, [messages, searchQuery]);

  const pinnedMessage = useMemo(() => {
    return messages.find(m => m.isPinned && !m.isDeleted);
  }, [messages]);

  const handleScrollToMessage = useCallback((msgId) => {
    const groupIndex = flattenedItems.findIndex(g => g.items.some(m => m.id === msgId));
    if (groupIndex !== -1 && virtuosoRef.current) {
      virtuosoRef.current.scrollToIndex({
        index: groupIndex,
        align: 'start',
        behavior: 'smooth'
      });
    }
  }, [flattenedItems]);

  useEffect(() => {
    if (scrollToMessageId && !isFetchingChat && flattenedItems.length > 0) {
      handleScrollToMessage(scrollToMessageId);
      
      // Delay clearing the ID and highlighting so Virtuoso has time to render the DOM node
      setTimeout(() => {
        const element = document.getElementById(`bubble-${scrollToMessageId}`);
        if (element) {
           element.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-1', 'ring-offset-white');
           setTimeout(() => element.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-1', 'ring-offset-white'), 2000);
        }
        setScrollToMessageId(null);
      }, 300);
    }
  }, [scrollToMessageId, handleScrollToMessage, setScrollToMessageId, isFetchingChat, flattenedItems.length]);

  const prevItemsLengthRef = useRef(0);

  useEffect(() => {
    prevItemsLengthRef.current = flattenedItems.length;
  }, [flattenedItems.length]);

  // Handle Match Navigation
  useEffect(() => {
    if (matches.length > 0) {
      setActiveMatchIndex(matches.length - 1); // Start at the most recent match
    } else {
      setActiveMatchIndex(0);
    }
  }, [matches]);

  useEffect(() => {
    if (matches.length > 0 && matches[activeMatchIndex] && virtuosoRef.current) {
      const matchId = matches[activeMatchIndex].id;
      const groupIndex = flattenedItems.findIndex(g => g.items.some(m => m.id === matchId));
      if (groupIndex !== -1) {
        virtuosoRef.current.scrollToIndex({
          index: groupIndex,
          align: 'start',
          behavior: 'smooth'
        });
      }
    }
  }, [activeMatchIndex, matches, flattenedItems]);

  // Handle Scroll to Specific Message (e.g. from Starred Sidebar)
  useEffect(() => {
    if (scrollToMessageId && !isFetchingChat && virtuosoRef.current && flattenedItems.length > 0) {
      const groupIndex = flattenedItems.findIndex(g => g.items.some(m => m.id === scrollToMessageId));
      if (groupIndex !== -1) {
        const timer = setTimeout(() => {
          virtuosoRef.current.scrollToIndex({
            index: groupIndex,
            align: 'start',
            behavior: 'auto'
          });
          setTempHighlightId(scrollToMessageId);
          setScrollToMessageId(null);
          
          // Clear highlight after 2.5 seconds
          const highlightTimer = setTimeout(() => {
            setTempHighlightId(null);
          }, 2500);
          return () => clearTimeout(highlightTimer);
        }, 150);
        return () => clearTimeout(timer);
      } else {
        setScrollToMessageId(null);
      }
    }
  }, [scrollToMessageId, isFetchingChat, flattenedItems, setScrollToMessageId]);

  // Auto-scroll to bottom on initial chat load or room change
  useEffect(() => {
    if (!isFetchingChat && flattenedItems.length > 0 && virtuosoRef.current) {
      const timer = setTimeout(() => {
        if (virtuosoRef.current) {
          virtuosoRef.current.scrollToIndex({
            index: flattenedItems.length - 1,
            align: 'end',
            behavior: 'auto'
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFetchingChat, contact?.roomId, flattenedItems.length]);

  // Scroll to reveal typing indicator or uploading files if at bottom
  useEffect(() => {
    if (((typingUsers && typingUsers.length > 0) || (uploadingFiles && uploadingFiles.length > 0)) && isAtBottom && virtuosoRef.current && flattenedItems.length > 0) {
      const timer = setTimeout(() => {
        if (virtuosoRef.current) {
          virtuosoRef.current.scrollToIndex({
            index: flattenedItems.length - 1,
            align: 'end',
            behavior: 'smooth'
          });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [typingUsers, uploadingFiles, isAtBottom, flattenedItems.length]);

  const handleNextMatch = () => {
    setActiveMatchIndex(prev => (prev < matches.length - 1 ? prev + 1 : 0));
  };

  const handlePrevMatch = () => {
    setActiveMatchIndex(prev => (prev > 0 ? prev - 1 : matches.length - 1));
  };

  const getSender = (senderId) => {
    if (senderId === 'me' || senderId === currentUser?.id) return currentUser;
    return contacts.find(c => c.id === senderId) ?? { name: 'Unknown', initials: '?', color: '#9ca3af' };
  };

  const isSeen = (msg) => {
    if (contact?.isChannel) return false;
    const readList = msg.readByUsers || [];
    return readList.some(item => {
      const parsed = typeof item === 'string' ? JSON.parse(item) : item;
      return parsed?.user_id === contact?.id;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white relative">
      {/* Inline Search Bar */}
      {isSearchOpen && (
        <div className="absolute top-0 left-0 right-0 bg-white border-b border-[#e2e8f0] z-50 px-4 py-2 flex items-center shadow-sm animate-fade-in">
          <Search size={16} className="text-[#94a3b8]" />
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search in chat..."
            className="flex-1 ml-3 bg-transparent border-none outline-none text-[14px] text-[#0f172a] placeholder-[#94a3b8]"
          />
          {searchQuery && (
            <div className="flex items-center gap-2 mr-3 text-[12px] font-medium text-[#64748b] flex-shrink-0">
              <span className="whitespace-nowrap">{matches.length > 0 ? activeMatchIndex + 1 : 0} / {matches.length}</span>
              <div className="flex items-center border border-[#e2e8f0] rounded-lg overflow-hidden bg-[#f8fafc] flex-shrink-0">
                <button 
                  onClick={handlePrevMatch} 
                  disabled={matches.length === 0}
                  className="p-1 hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
                >
                  <ChevronUp size={16} />
                </button>
                <div className="w-px h-4 bg-[#e2e8f0]" />
                <button 
                  onClick={handleNextMatch} 
                  disabled={matches.length === 0}
                  className="p-1 hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          )}
          <button 
            onClick={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }}
            className="p-1.5 text-[#64748b] hover:bg-[#f1f5f9] rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Pinned Message Banner */}
      {pinnedMessage && (
        <div className={clsx(
          "flex items-center justify-between px-4 md:px-6 py-2 bg-slate-50 border-b border-[#e2e8f0] z-10 animate-slide-down relative shadow-xs",
          isSearchOpen && "mt-12"
        )}>
          <div 
            onClick={() => handleScrollToMessage(pinnedMessage.id)}
            className="flex-1 flex items-center gap-3 cursor-pointer hover:opacity-80 min-w-0"
          >
            <Pin size={15} className="text-indigo-600 rotate-45 shrink-0" />
            <div className="text-[12px] min-w-0">
              <span className="font-bold text-slate-700">Pinned Message</span>
              <p className="text-slate-500 truncate mt-0.5 max-w-full">
                {pinnedMessage.type === 'file' ? `📁 ${pinnedMessage.file?.name || 'File'}` : pinnedMessage.text}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePin(pinnedMessage.id);
            }}
            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-200/50 transition-colors shrink-0 ml-2"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Virtualized Message Area */}
      <div className="flex-1 min-h-0 relative">
        {flattenedItems.length > 0 ? (
          <Virtuoso
            ref={virtuosoRef}
            atBottomStateChange={(bottom) => setIsAtBottom(bottom)}
            data={flattenedItems}
            computeItemKey={(index, item) => item.id}
            initialTopMostItemIndex={flattenedItems.length - 1}
            followOutput={(isAtBottom) => {
              // If we went from 0 to N items, it's an initial load, so jump instantly
              if (prevItemsLengthRef.current === 0) return 'auto';
              // Otherwise, if we're at the bottom and a new message arrives, scroll smoothly
              return isAtBottom ? 'smooth' : false;
            }}
            alignToBottom={true}
            style={{ height: '100%' }}
            components={{
              Header: () => <div className="h-4" />,
              Footer: () => {
                return (
                  <>
                    {uploadingFiles && uploadingFiles.length > 0 && (
                      <div className="flex flex-col gap-2 px-6 py-2 pb-6 animate-fade-in items-end">
                        {uploadingFiles.map((file) => (
                          <div key={file.id} className="flex flex-col items-start gap-2 px-4 py-3 bg-[#4f46e5]/10 border border-[#4f46e5]/20 text-[#4f46e5] rounded-2xl rounded-tr-sm w-fit max-w-[70%] shadow-sm">
                            <div className="flex items-center gap-2 w-full min-w-0 max-w-full">
                              <div className="w-4 h-4 border-2 border-[#4f46e5]/30 border-t-[#4f46e5] rounded-full animate-spin shrink-0" />
                              <span className="text-[13px] font-medium truncate flex-1 min-w-0">{file.name}</span>
                            </div>
                            <span className="text-[10px] opacity-70">Uploading...</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {typingUsers && typingUsers.length > 0 && (
                      <div className="flex items-end gap-3 px-6 py-2 pb-6 animate-fade-in">
                        <Avatar initials={typingUsers[0].initials} color={typingUsers[0].color} size="sm" borderColor="#ffffff" />
                        <div className="flex items-center gap-1.5 px-4 py-3 bg-[#f1f5f9] border border-[#e2e8f0] rounded-2xl rounded-bl-sm w-fit shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce-1" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce-2" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#94a3b8] animate-bounce-3" />
                        </div>
                      </div>
                    )}
                    {(!uploadingFiles || uploadingFiles.length === 0) && (!typingUsers || typingUsers.length === 0) && <div className="h-6" />}
                  </>
                );
              }
            }}
            itemContent={(index, group) => {
              const isMe = group.senderId === 'me' || group.senderId === currentUser?.id;
              const sender = getSender(group.senderId);

              return (
                <div className="pb-1 pt-1" key={group.id}>
                  {group.showDivider && <DateDivider label={group.dateLabel} />}
                  <div className={clsx('flex gap-3 px-6 py-1 group transition-colors duration-150', isMe && 'flex-row-reverse')}>
                    {/* Avatar - Only for incoming messages */}
                    <div className={clsx('flex-shrink-0 w-8 self-start mt-0.5', isMe && 'hidden')}>
                      <Avatar
                        initials={sender.initials}
                        color={sender.color}
                        size="sm"
                        borderColor="#ffffff"
                      />
                    </div>

                    {/* Messages */}
                    <div className={clsx('flex flex-col gap-1 w-full min-w-0', isMe ? 'items-end' : 'items-start')}>
                      {/* Header */}
                      {!isMe && (
                        <div className="flex items-baseline gap-2 mb-0.5 ml-1">
                          <span className="text-[13px] font-bold text-[#0f172a]">{sender.name}</span>
                        </div>
                      )}

                      {/* Bubbles */}
                      {group.items.map(msg => {
                        const seen = isSeen(msg);
                        const recipientOnline = contact?.status === 'online';
                        const tick = seen ? (
                          <CheckCheck size={14} className="text-[#38bdf8]" />
                        ) : recipientOnline ? (
                          <CheckCheck size={13} className="text-indigo-200/80" />
                        ) : (
                          <Check size={13} className="text-indigo-200/80" />
                        );

                        const isHighlighted = (matches.length > 0 && matches[activeMatchIndex]?.id === msg.id) || tempHighlightId === msg.id;
                        const replyToMessage = msg.replyToMessageId ? messages.find(m => m.id === msg.replyToMessageId) : null;

                        return (
                          <div key={msg.id} id={`msg-${msg.id}`}>
                            <MessageBubble
                              message={msg}
                              isMe={isMe}
                              tick={tick}
                              onViewFile={onViewFile}
                              isHighlighted={isHighlighted}
                              replyToMessage={replyToMessage}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }}
          />
        ) : isFetchingChat ? (
          <div className="flex-1 overflow-hidden space-y-4 px-6 py-6">
            {[
              { isMe: false, w: 'w-[45%]' },
              { isMe: true, w: 'w-[30%]' },
              { isMe: false, w: 'w-[60%]' },
              { isMe: false, w: 'w-[20%]' },
              { isMe: true, w: 'w-[40%]' },
            ].map((item, idx) => (
              <div 
                key={idx} 
                className={clsx(
                  "flex items-end gap-3",
                  item.isMe && "flex-row-reverse"
                )}
              >
                {!item.isMe && (
                  <div className="w-8 h-8 rounded-full shimmer shrink-0" />
                )}
                <div className="flex flex-col gap-1 w-full max-w-full">
                  {!item.isMe && (
                    <div className="w-20 h-3 shimmer rounded-sm mb-1" />
                  )}
                  <div className={clsx(
                    "h-16 shimmer rounded-2xl",
                    item.w,
                    item.isMe ? "rounded-tr-sm bg-indigo-50/50" : "rounded-tl-sm bg-slate-50/50"
                  )} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 px-6 text-center">
            No messages yet. Send a message to start the conversation!
          </div>
        )}

        {/* Scroll to Bottom Button */}
        {!isAtBottom && flattenedItems.length > 0 && (
          <button
            onClick={() => {
              virtuosoRef.current?.scrollToIndex({
                index: flattenedItems.length - 1,
                align: 'end',
                behavior: 'smooth'
              });
            }}
            className="absolute bottom-4 right-4 z-40 p-2 bg-white text-[#64748b] hover:text-[#0f172a] rounded-full shadow-md border border-[#e2e8f0] transition-all hover:bg-slate-50 flex items-center justify-center animate-fade-in"
          >
            <ChevronDown size={20} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  );
}
