import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { FileCard } from './FileCard';
import { PollCard } from './PollCard';
import { MessageInfoModal } from './MessageInfoModal';
import { parsePoll, pollPreview } from '../../utils/poll';import { Smile, ChevronLeft, ChevronRight, MoreVertical, Info, CheckSquare, Pencil, Quote, Share2, Copy, Star, Trash2, CornerUpRight, Pin, Reply, X } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Emoji } from 'emoji-picker-react';

const REACTION_PAGES = [
  [
    { emoji: '👍', name: 'Thumbs Up' },
    { emoji: '❤️', name: 'Heart' },
    { emoji: '👏', name: 'Clap' },
    { emoji: '✔️', name: 'Yes' },
    { emoji: '😃', name: 'Smile' },
    { emoji: '❌', name: 'No' },
  ],
  [
    { emoji: '🎉', name: 'Party' },
    { emoji: '🙏', name: 'Pray' },
    { emoji: '👎', name: 'Thumbs Down' },
    { emoji: '😔', name: 'Sad' },
    { emoji: '😠', name: 'Angry' },
    { emoji: '🔥', name: 'Fire' },
  ]
];

function getEmojiUnified(emojiChar) {
  if (!emojiChar) return '';
  const codePoints = [];
  for (let i = 0; i < emojiChar.length; i++) {
    const codePoint = emojiChar.codePointAt(i);
    codePoints.push(codePoint.toString(16));
    if (codePoint > 0xffff) {
      i++;
    }
  }
  return codePoints.join('-');
}

function renderEmojiHelper(emojiChar, size) {
  if (emojiChar === '✔️' || emojiChar === '✔') {
    return (
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none" 
        className="select-none inline-block align-middle"
      >
        <circle cx="12" cy="12" r="10" stroke="#007eff" strokeWidth="2.2" fill="#ffffff" />
        <path d="M7.5 12.5l3 3 6-6" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return <Emoji unified={getEmojiUnified(emojiChar)} size={size} />;
}

function renderMessageText(text, contacts = [], isMe = false) {
  if (!text) return '';

  // 1. Escape raw string characters first to prevent XSS injection
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Parse blockquotes (lines starting with &gt; )
  const lines = escaped.split('\n');
  const processedLines = [];
  let inQuote = false;
  let quoteLines = [];

  for (let line of lines) {
    if (line.startsWith('&gt; ')) {
      if (!inQuote) {
        inQuote = true;
      }
      quoteLines.push(line.substring(5)); // Remove "&gt; "
    } else {
      if (inQuote) {
        processedLines.push(`<blockquote class="border-l-4 border-slate-300 pl-3 py-1 my-1 bg-slate-50/80 rounded text-slate-500 italic text-[12px] whitespace-pre-wrap">${quoteLines.join('<br/>')}</blockquote>`);
        inQuote = false;
        quoteLines = [];
      }
      processedLines.push(line);
    }
  }
  if (inQuote) {
    processedLines.push(`<blockquote class="border-l-4 border-slate-300 pl-3 py-1 my-1 bg-slate-50/80 rounded text-slate-500 italic text-[12px] whitespace-pre-wrap">${quoteLines.join('<br/>')}</blockquote>`);
  }
  escaped = processedLines.join('\n');

  // 2.5 Pull URLs out behind placeholders so bold/italic/mention parsing cannot mangle them
  // (e.g. underscores inside a link), then turn them into anchors at the end.
  const links = [];
  escaped = escaped.replace(/\b(?:https?:\/\/|www\.)[^\s<"]+/gi, (raw) => {
    // Trailing punctuation / escaped brackets belong to the sentence, not the URL
    const trailing = raw.match(/(?:[.,;:!?)\]]|&gt;|&lt;)+$/)?.[0] || '';
    const url = trailing ? raw.slice(0, -trailing.length) : raw;
    if (!/^(?:https?:\/\/|www\.)[^\s]+\.[^\s]+/i.test(url)) return raw;
    links.push(url);
    return `${links.length - 1}${trailing}`;
  });

  // 3. Parse the formatted content with boundary-safe Regex expressions sequentially
  const boldRegex = /(?<!\w)\*(\S(?:.*?\S)?)\*(?!\w)/g;
  const italicRegex = /(?<!\w)_(\S(?:.*?\S)?)_(?!\w)/g;

  escaped = escaped
    .replace(boldRegex, '<strong>$1</strong>')
    .replace(italicRegex, '<em>$1</em>');

  // 4. Parse mentions from contacts list
  const mentionNames = (contacts || [])
    .map(c => c.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const matchedMentions = new Set();

  for (const name of mentionNames) {
    const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`@${escapedName}(?!\\w)`, 'gi');
    if (regex.test(escaped)) {
      escaped = escaped.replace(regex, (match) => {
        const badgeClass = isMe 
          ? 'font-bold text-indigo-200 bg-white/10 px-1.5 py-0.5 rounded-md select-all' 
          : 'font-bold text-indigo-700 bg-indigo-50/70 px-1.5 py-0.5 rounded-md select-all';
        return `<span class="${badgeClass}">${match}</span>`;
      });
      matchedMentions.add(name.toLowerCase());
    }
  }

  // Fallback for any capitalized names starting with @ (e.g. current user Nehal Shetty, or offline/other users)
  // Matches @ followed by 1 to 3 Capitalized words
  const fallbackRegex = /@([A-Z][a-zA-Z0-9_-]*(?:\s+[A-Z][a-zA-Z0-9_-]*){0,2})(?!\w)/g;
  escaped = escaped.replace(fallbackRegex, (match, nameGroup) => {
    if (matchedMentions.has(nameGroup.toLowerCase())) {
      return match;
    }
    const badgeClass = isMe 
      ? 'font-bold text-indigo-200 bg-white/10 px-1.5 py-0.5 rounded-md select-all' 
      : 'font-bold text-indigo-700 bg-indigo-50/70 px-1.5 py-0.5 rounded-md select-all';
    return `<span class="${badgeClass}">${match}</span>`;
  });

  if (links.length > 0) {
    const linkClass = isMe
      ? 'underline underline-offset-2 break-all font-medium text-white hover:text-indigo-100'
      : 'underline underline-offset-2 break-all font-medium text-indigo-600 hover:text-indigo-800';
    escaped = escaped.replace(/(\d+)/g, (_, i) => {
      const shown = links[Number(i)];
      const href = /^https?:\/\//i.test(shown) ? shown : `https://${shown}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="${linkClass}">${shown}</a>`;
    });
  }

  return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
}

export function MessageBubble({ message, isMe, tick, onViewFile, isHighlighted, replyToMessage }) {
  const {
    companyUserId,
    currentUser,
    handleToggleReaction,
    setEditingMessage,
    setShowEditTimeLimitModal,
    handleToggleStar,
    handleDeleteMessage,
    setChatAlert,
    setForwardingMessage,
    handleTogglePin,
    setScrollToMessageId,
    setQuoteMessage,
    handleVotePoll,
    getMessageReceipts,
    startSelect,
    currentContact,
    contacts
  } = useChat();

  const poll = message.type === 'text' ? parsePoll(message.text) : null;

  const [showPopover, setShowPopover] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [page, setPage] = useState(0);
  const [hoveredReaction, setHoveredReaction] = useState(null);
  const [menuDirection, setMenuDirection] = useState('down'); // 'up' or 'down'
  const [menuPos, setMenuPos] = useState(null); // { x, y }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Close context menu and reactions popover when clicking anywhere else or scrolling
  useEffect(() => {
    const handleOutsideAction = () => {
      setShowMenu(false);
      setShowPopover(false);
    };

    // Always listen to this event to close when another bubble opens
    document.addEventListener('close-all-menus', handleOutsideAction);
    
    if (showMenu || showPopover) {
      document.addEventListener('click', handleOutsideAction);
      window.addEventListener('scroll', handleOutsideAction, true);
    }
    
    return () => {
      document.removeEventListener('close-all-menus', handleOutsideAction);
      document.removeEventListener('click', handleOutsideAction);
      window.removeEventListener('scroll', handleOutsideAction, true);
    };
  }, [showMenu, showPopover]);

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('close-all-menus'));
    setShowPopover(false);
    
    const rect = e.currentTarget.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    // Ensure menu doesn't go off-screen
    const windowWidth = window.innerWidth;
    
    let spaceBelow;
    const scrollContainer = e.currentTarget.closest('.flex-1');
    if (scrollContainer) {
      const scrollRect = scrollContainer.getBoundingClientRect();
      spaceBelow = scrollRect.bottom - e.clientY;
    } else {
      const windowHeight = window.innerHeight;
      spaceBelow = windowHeight - e.clientY;
    }

    setMenuDirection(spaceBelow < 220 ? 'up' : 'down');
    
    if (spaceBelow < 220) {
      y -= 220; // approximate menu height
    }
    
    if (e.clientX + 160 > windowWidth) {
      x -= 150; // shift left by menu width
    }
    
    setMenuPos({ x, y });
    setShowMenu(true);
  };

  // Time constraint: can edit only within 5 minutes of sending
  const timeDiffMinutes = (new Date() - new Date(message.createdAt)) / 60000;
  const canEdit = isMe && (timeDiffMinutes < 5) && (message.type !== 'file') && !poll;

  if (message.isDeleted) {
    return (
      <div className={clsx("relative flex items-center gap-2 group/bubble max-w-full", isMe ? "self-end" : "self-start")}>
        <div className={clsx(
          'relative px-4 py-2 text-[13px] leading-relaxed italic text-slate-400 select-none shadow-sm rounded-2xl border bg-slate-50 border-slate-100 transition-all',
          isMe ? 'rounded-tr-sm self-end' : 'rounded-tl-sm self-start',
          isHighlighted && 'ring-2 ring-[#f59e0b] ring-offset-1 ring-offset-white'
        )}>
          This message was deleted.
        </div>
      </div>
    );
  }

  const rawReactions = message.reactions || [];
  const reactionsMap = {};
  rawReactions.forEach(r => {
    const parsed = typeof r === 'string' ? JSON.parse(r) : r;
    // Poll votes share this column but are not emoji reactions
    if (parsed?.reaction && !String(parsed.reaction).startsWith('poll:')) {
      if (!reactionsMap[parsed.reaction]) {
        reactionsMap[parsed.reaction] = { count: 0, userIds: [] };
      }
      reactionsMap[parsed.reaction].count += 1;
      reactionsMap[parsed.reaction].userIds.push(parsed.user_id);
    }
  });

  const parsedReactions = Object.keys(reactionsMap).map(emoji => ({
    emoji,
    count: reactionsMap[emoji].count,
    hasReacted: reactionsMap[emoji].userIds.includes(companyUserId),
  }));

  const attachmentMetaNode = (
    <div className={clsx("flex items-center gap-1 mt-0.5 select-none pointer-events-none px-1", isMe ? "self-end" : "self-start")}>
      <span className="text-[9px] tabular-nums font-semibold flex items-center gap-0.5 text-slate-400">
        {message.timestamp}
        {message.isEdited && <span className="italic ml-0.5">(edited)</span>}
        {message.isStarred && (
          <Star size={9} className="text-amber-400 fill-amber-400 shrink-0 ml-0.5" />
        )}
        {message.isPinned && (
          <Pin size={9} className="text-indigo-500 fill-indigo-500 shrink-0 ml-0.5 rotate-45" />
        )}
      </span>
      {isMe && tick}
    </div>
  );

  let bubbleContent = null;
  if (message.type === 'file') {
    const isImage = message.file?.type?.startsWith('image/');
    if (isImage && message.file?.url) {
      bubbleContent = (
        <div className="flex flex-col items-start gap-1 max-w-full">
          {message.isForwarded && (
            <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1 pl-1 select-none">
              <CornerUpRight size={11} strokeWidth={2.5} />
              <span>Forwarded</span>
            </div>
          )}
          {replyToMessage && (() => {
            const replySender = replyToMessage.senderId === 'me' ? 'You' : contacts.find(c => c.id === replyToMessage.senderId)?.name || 'Someone';
            return (
              <div className="w-full mb-1">
                <div 
                  onClick={() => setScrollToMessageId(replyToMessage.id)}
                  className="cursor-pointer w-full text-left bg-black/5 rounded-md px-2 py-1.5 border-l-2 border-indigo-400 opacity-90 hover:opacity-100 transition-opacity"
                >
                  <div className="text-[10px] font-bold text-indigo-700">{replySender}</div>
                  <div className="text-[11px] line-clamp-4 text-slate-700">{pollPreview(replyToMessage.text) || 'Attachment'}</div>
                </div>
              </div>
            );
          })()}
          <div
            id={`bubble-${message.id}`}
            onClick={() => onViewFile && onViewFile(message.file)}
            className={clsx(
              'mt-1 cursor-pointer overflow-hidden rounded-xl animate-slide-up hover:opacity-90 transition-all border max-w-full w-[260px]',
              isMe ? 'border-[#4338ca] shadow-sm' : 'border-[#e2e8f0] shadow-sm',
              isHighlighted && 'ring-2 ring-[#f59e0b] ring-offset-1 ring-offset-white'
            )}
          >
            <img
              src={message.file.url}
              alt={message.file.name}
              className="w-full h-auto max-h-[280px] object-cover block"
            />
          </div>
          {attachmentMetaNode}
          {parsedReactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 pl-1">
              {parsedReactions.map(r => (
                <button
                  key={r.emoji}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleReaction(message.id, r.emoji);
                  }}
                  className={clsx(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all border shadow-xs select-none",
                    r.hasReacted
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                      : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  {renderEmojiHelper(r.emoji, 13)}
                  {r.count > 1 && <span>{r.count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      bubbleContent = (
        <div className="flex flex-col items-start gap-1 max-w-full">
          {message.isForwarded && (
            <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mb-1 pl-1 select-none">
              <CornerUpRight size={11} strokeWidth={2.5} />
              <span>Forwarded</span>
            </div>
          )}
          {replyToMessage && (() => {
            const replySender = replyToMessage.senderId === 'me' ? 'You' : contacts.find(c => c.id === replyToMessage.senderId)?.name || 'Someone';
            return (
              <div className="w-0 min-w-full mb-1">
                <div 
                  onClick={() => setScrollToMessageId(replyToMessage.id)}
                  className="cursor-pointer w-full text-left bg-black/5 rounded-md px-2 py-1.5 border-l-2 border-indigo-400 opacity-90 hover:opacity-100 transition-opacity"
                >
                  <div className="text-[10px] font-bold text-indigo-700">{replySender}</div>
                  <div className="text-[11px] truncate text-slate-700">{pollPreview(replyToMessage.text) || 'Attachment'}</div>
                </div>
              </div>
            );
          })()}
          <div id={`bubble-${message.id}`} className={clsx("flex flex-col gap-1 transition-all rounded-xl", isHighlighted && "ring-2 ring-[#f59e0b] ring-offset-1 ring-offset-white")}>
            <FileCard file={message.file} isMe={isMe} onViewFile={onViewFile} />
            {attachmentMetaNode}
            {parsedReactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1 pl-1">
                {parsedReactions.map(r => (
                  <button
                    key={r.emoji}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleReaction(message.id, r.emoji);
                    }}
                    className={clsx(
                      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all border shadow-xs select-none",
                      r.hasReacted
                        ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                        : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {renderEmojiHelper(r.emoji, 13)}
                    {r.count > 1 && <span>{r.count}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }
  } else {
    bubbleContent = (
      <div id={`bubble-${message.id}`} className={clsx(
        'relative px-3.5 pt-2.5 pb-2 text-[15px] md:text-[14px] leading-relaxed whitespace-pre-wrap break-words w-fit min-w-[100px] max-w-[100%] sm:max-w-[90%] md:max-w-[85%] lg:max-w-[75%] shadow-sm animate-slide-up flex flex-col transition-all',
        isMe
          ? 'bg-[#4f46e5] text-white rounded-2xl rounded-tr-sm self-end'
          : 'bg-[#ffffff] border border-[#e2e8f0] text-[#0f172a] rounded-2xl rounded-tl-sm self-start',
        isHighlighted && 'ring-2 ring-[#f59e0b] ring-offset-1 ring-offset-white'
      )}>
        {message.isForwarded && (
          <div className={clsx(
            "text-[10.5px] font-semibold flex items-center gap-1 mb-1.5 select-none",
            isMe ? "text-indigo-200" : "text-slate-400"
          )}>
            <CornerUpRight size={12} strokeWidth={2.5} />
            <span>Forwarded</span>
          </div>
        )}
        {replyToMessage && (() => {
            const replySender = replyToMessage.senderId === 'me' ? 'You' : contacts.find(c => c.id === replyToMessage.senderId)?.name || 'Someone';
            return (
              <div className="w-full mb-2">
                <div 
                  onClick={() => setScrollToMessageId(replyToMessage.id)}
                  className={clsx(
                    "cursor-pointer w-full text-left rounded-md px-2.5 py-1.5 border-l-[3px] opacity-90 hover:opacity-100 transition-opacity",
                    isMe ? "bg-black/10 border-white text-white" : "bg-slate-50 border-indigo-500 text-slate-800"
                  )}
                >
                  <div className={clsx("text-[11px] font-bold", isMe ? "text-white" : "text-indigo-600")}>{replySender}</div>
                  <div className="text-[12px] md:text-[11px] line-clamp-2 opacity-90 leading-snug mt-0.5">{pollPreview(replyToMessage.text) || 'Attachment'}</div>
                </div>
              </div>
            );
        })()}

        <div className="mb-0.5">
          {poll ? (
            <PollCard
              poll={poll}
              reactions={message.reactions}
              isMe={isMe}
              myUserId={companyUserId}
              contacts={contacts}
              currentUser={currentUser}
              onVote={(idx) => handleVotePoll(message.id, idx)}
            />
          ) : (() => {
            const allUsers = [...contacts];
            if (currentUser && !allUsers.some(u => u.id === currentUser.id)) {
              allUsers.push(currentUser);
            }
            return renderMessageText(message.text, allUsers, isMe);
          })()}
        </div>

        <div className="flex items-end justify-between gap-4 mt-1">
          <div className="flex flex-wrap gap-1">
            {parsedReactions.length > 0 && parsedReactions.map(r => (
              <button
                key={r.emoji}
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleReaction(message.id, r.emoji);
                }}
                className={clsx(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-semibold transition-all border shadow-xs select-none",
                  r.hasReacted
                    ? isMe
                      ? "bg-white/20 border-white/20 text-white"
                      : "bg-indigo-50 border-indigo-200 text-indigo-600"
                    : isMe
                      ? "bg-white/10 border-white/10 text-white/95 hover:bg-white/20"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                )}
              >
                {renderEmojiHelper(r.emoji, 13)}
                {r.count > 1 && <span>{r.count}</span>}
              </button>
            ))}
          </div>

          <div className={clsx(
            "text-[9.5px] tabular-nums font-semibold flex items-center gap-1 shrink-0 ml-auto select-none pointer-events-none",
            isMe ? "text-indigo-200" : "text-slate-400"
          )}>
            <span>{message.timestamp}</span>
            {message.isEdited && <span className="italic">(edited)</span>}
            {message.isStarred && (
              <Star size={10} className="text-amber-400 fill-amber-400 shrink-0" />
            )}
            {message.isPinned && (
              <Pin size={10} className={clsx("shrink-0 rotate-45", isMe ? "text-indigo-200 fill-indigo-200" : "text-indigo-500 fill-indigo-500")} />
            )}
            {isMe && tick}
          </div>
        </div>
      </div>
    );
  }
  const dropdownMenuNode = showMenu ? (
    <div 
      style={menuPos ? { left: menuPos.x, top: menuPos.y } : {}}
      className={clsx(
      "absolute z-[100] bg-white border border-[#e2e8f0] rounded-md shadow-lg py-1 w-[150px] animate-scale-in",
      menuPos ? "" : clsx("right-0", menuDirection === 'up' ? "bottom-full mb-1" : "top-full mt-1")
    )}>
      {canEdit && (
        <button
          onClick={() => {
            const createdAtTime = new Date(message.createdAt).getTime();
            const currentTime = Date.now();
            const diffMs = currentTime - createdAtTime;
            const diffMins = diffMs / 1000 / 60;
            
            if (diffMins > 5) {
              setShowEditTimeLimitModal(true);
            } else {
              setEditingMessage(message);
            }
            setShowMenu(false);
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
        >
          <Pencil size={12} className="text-slate-400" />
          Edit
        </button>
      )}

      <button
        onClick={() => {
          const replySender = isMe ? 'You' : contacts.find(c => c.id === message.senderId)?.name || 'Someone';
          setQuoteMessage({ ...message, senderName: replySender });
          setShowMenu(false);
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
      >
        <Reply size={12} className="text-slate-400" />
        Reply
      </button>

      <button
        onClick={() => {
          setForwardingMessage(message);
          setShowMenu(false);
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
      >
        <Share2 size={12} className="text-slate-400" />
        Forward
      </button>

      <button
        onClick={() => {
          startSelect(message.id);
          setShowMenu(false);
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
      >
        <CheckSquare size={12} className="text-slate-400" />
        Select
      </button>

      {isMe && (
        <button
          onClick={() => {
            setShowInfo(true);
            setShowMenu(false);
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
        >
          <Info size={12} className="text-slate-400" />
          Info
        </button>
      )}

      {message.type !== 'file' && !poll && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(message.text || '');
            setChatAlert({ type: 'success', message: 'Message copied to clipboard' });
            setShowMenu(false);
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
        >
          <Copy size={12} className="text-slate-400" />
          Copy
        </button>
      )}

      <button
        onClick={() => {
          handleToggleStar(message.id);
          setShowMenu(false);
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
      >
        <Star size={12} className={clsx(message.isStarred ? "text-amber-500 fill-amber-500" : "text-slate-400")} />
        {message.isStarred ? 'Unstar Message' : 'Star Message'}
      </button>

      <button
        onClick={() => {
          handleTogglePin(message.id);
          setShowMenu(false);
        }}
        className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
      >
        <Pin size={12} className={clsx(message.isPinned ? "text-indigo-500 fill-indigo-500 rotate-45" : "text-slate-400 rotate-45")} />
        {message.isPinned ? 'Unpin Message' : 'Pin Message'}
      </button>

      {isMe && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(true);
            setShowMenu(false);
          }}
          className="w-full px-3 py-1.5 flex items-center gap-2 text-left text-[12px] text-[#ef4444] hover:bg-red-50/50 transition-colors font-semibold border-t border-slate-100 mt-0.5"
        >
          <Trash2 size={12} className="text-[#ef4444]" />
          Delete
        </button>
      )}
    </div>
  ) : null;

  return (
    <div 
      onContextMenu={handleContextMenu}
      className={clsx(
        "relative flex items-start gap-2 group/bubble max-w-full transition-all", 
        isMe ? "flex-row-reverse self-end" : "flex-row self-start",
        (showMenu || showPopover) ? "z-[60]" : "z-10"
      )}>

      {bubbleContent}

      {/* Smiley Hover Reaction Trigger Button & Action Dropdown Trigger */}
      <div className={clsx(
        "relative transition-opacity flex-shrink-0 flex items-center gap-1 z-30 mt-2",
        (showMenu || showPopover) ? "opacity-100" : "opacity-0 group-hover/bubble:opacity-100"
      )}>

        {/* Smile Button and Popover */}
        {!isMe && !poll && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const wasOpen = showPopover;
                document.dispatchEvent(new CustomEvent('close-all-menus'));
                
                setShowMenu(false);
                if (!wasOpen) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const windowHeight = window.innerHeight;
                  const spaceBelow = windowHeight - rect.bottom;
                  setMenuDirection(spaceBelow < 220 ? 'up' : 'down');
                }
                setShowPopover(!wasOpen);
              }}
              className={clsx(
                "w-6 h-6 rounded-full flex items-center justify-center transition-colors shadow-sm border bg-white",
                showPopover
                  ? "border-indigo-200 text-[#007eff] hover:bg-indigo-50"
                  : "border-[#e2e8f0] text-[#64748b] hover:text-[#007eff] hover:bg-[#f8fafc]"
              )}
            >
              <Smile size={13} strokeWidth={2.5} />
            </button>

            {/* Smiley Popover React Emojis */}
            {showPopover && (
              <div className={clsx(
                "absolute left-1/2 -translate-x-1/2 z-50 bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-1.5 flex flex-col items-center gap-1.5 animate-scale-in max-w-[280px]",
                menuDirection === 'up' ? "bottom-full mb-2.5" : "top-full mt-2.5"
              )}>
                {/* Arrow pointing to the Smile button */}
                <div className={clsx(
                  "absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-[#e2e8f0] rotate-45 z-10",
                  menuDirection === 'up' 
                    ? "bottom-0 translate-y-1/2 border-r border-b" 
                    : "top-0 -translate-y-1/2 border-l border-t"
                )} />

                <div className="flex items-center gap-1 relative z-20">
                  <button
                    disabled={page === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPage(p => Math.max(0, p - 1));
                    }}
                    className={clsx(
                      "p-1 rounded-lg transition-all",
                      page === 0
                        ? "text-slate-300 cursor-not-allowed opacity-50"
                        : "hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#475569]"
                    )}
                  >
                    <ChevronLeft size={13} strokeWidth={2.5} />
                  </button>

                  <div className="flex items-center gap-0.5">
                    {REACTION_PAGES[page].map(item => (
                      <div
                        key={item.emoji}
                        className="relative flex flex-col items-center"
                        onMouseEnter={() => setHoveredReaction(item.name)}
                        onMouseLeave={() => setHoveredReaction(null)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleReaction(message.id, item.emoji);
                            setShowPopover(false);
                          }}
                          className="w-7 h-7 flex items-center justify-center hover:scale-125 transition-transform"
                        >
                          {renderEmojiHelper(item.emoji, 20)}
                        </button>

                        {hoveredReaction === item.name && (
                          <div className="absolute top-full mt-2 z-[60] bg-[#1e293b] text-white text-[9px] font-semibold px-2 py-1 rounded shadow-md leading-none animate-fade-in whitespace-nowrap pointer-events-none">
                            {item.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    disabled={page === REACTION_PAGES.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPage(p => Math.min(REACTION_PAGES.length - 1, p + 1));
                    }}
                    className={clsx(
                      "p-1 rounded-lg transition-all",
                      page === REACTION_PAGES.length - 1
                        ? "text-slate-300 cursor-not-allowed opacity-50"
                        : "hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#475569]"
                    )}
                  >
                    <ChevronRight size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Trigger Menu Button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const wasOpen = showMenu;
              document.dispatchEvent(new CustomEvent('close-all-menus'));
              
              setMenuPos(null);
              setShowPopover(false);
              
              if (!wasOpen) {
                const rect = e.currentTarget.getBoundingClientRect();
                const scrollContainer = e.currentTarget.closest('.flex-1');
                
                let spaceBelow;
                if (scrollContainer) {
                  const scrollRect = scrollContainer.getBoundingClientRect();
                  spaceBelow = scrollRect.bottom - rect.bottom;
                } else {
                  const windowHeight = window.innerHeight;
                  spaceBelow = windowHeight - rect.bottom;
                }
                
                setMenuDirection(spaceBelow < 220 ? 'up' : 'down');
                setShowMenu(true);
              }
            }}
            className={clsx(
              "w-6 h-6 rounded-full flex items-center justify-center transition-colors shadow-sm border bg-white",
              showMenu
                ? "border-indigo-200 text-[#007eff] hover:bg-indigo-50"
                : "border-[#e2e8f0] text-[#64748b] hover:text-[#007eff] hover:bg-[#f8fafc]"
            )}
          >
            <MoreVertical size={13} strokeWidth={2.5} />
          </button>
          
          {/* Default left-click Dropdown */}
          {!menuPos && dropdownMenuNode}
        </div>

      </div>

      {/* Right-click Context Dropdown */}
      {menuPos && dropdownMenuNode}

      {showInfo && (
        <MessageInfoModal
          message={message}
          readBy={getMessageReceipts(message)}
          contact={currentContact}
          contacts={contacts}
          myUserId={companyUserId}
          onClose={() => setShowInfo(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[400px] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-800">Delete Message</h3>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center hover:bg-blue-100 transition-colors"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
                <Trash2 size={28} className="text-[#ef4444] fill-[#ef4444]" />
              </div>
              <p className="text-[14px] text-slate-500 font-medium">Are you sure you want to delete this message?</p>
            </div>
            <div className="flex bg-slate-100/50 p-0 m-0">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(false); }}
                className="flex-1 py-3 text-[14px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 transition-colors border-none cursor-pointer bg-slate-200/40"
              >
                Cancel
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  handleDeleteMessage(message.id); 
                  setShowDeleteConfirm(false); 
                }}
                className="flex-1 py-3 text-[14px] font-bold text-white bg-[#007eff] hover:bg-[#0066cc] transition-colors border-none cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
