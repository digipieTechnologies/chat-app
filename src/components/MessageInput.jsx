import { useState, useRef, useEffect } from 'react';
import { Paperclip, Smile, Send, AtSign, Bold, Italic, X, ChevronDown, UserPlus, BarChart3 } from 'lucide-react';
import { CreatePollModal } from './chat/CreatePollModal';
import { parsePoll, pollPreview } from '../utils/poll';
import { parseDisappearing } from '../utils/disappearing';
import { IconButton } from './ui/IconButton';
import { Avatar } from './ui/Avatar';
import clsx from 'clsx';
import EmojiPicker from 'emoji-picker-react';
import { formatBytes } from '../utils/helpers';
import { useChat } from '../context/ChatContext';

// DOM-traversal based HTML to Markdown converter
function htmlToMarkdown(html) {
  if (!html) return '';
  const container = document.createElement('div');
  container.innerHTML = html;
  
  const processNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      let innerText = '';
      node.childNodes.forEach(child => {
        innerText += processNode(child);
      });
      
      if (tagName === 'strong' || tagName === 'b') {
        return `*${innerText}*`;
      }
      if (tagName === 'em' || tagName === 'i') {
        return `_${innerText}_`;
      }
      if (tagName === 'br') {
        return '\n';
      }
      if (tagName === 'div' || tagName === 'p') {
        return `\n${innerText}`;
      }
      return innerText;
    }
    return '';
  };
  
  let result = '';
  container.childNodes.forEach(child => {
    result += processNode(child);
  });
  return result.trim();
}

export function MessageInput({ onSendMessage, onTyping, contacts = [], onViewFile }) {
  const [emojiOpen, setEmojiOpen] = useState(false);
  const editorRef                 = useRef(null);
  const fileInputRef              = useRef(null);
  const typingTimeoutRef          = useRef(null);
  const lastTypingBroadcastRef    = useRef(0);
  const textValueRef              = useRef('');
  const [isTyping, setIsTyping]   = useState(false);
  const [isEmpty, setIsEmpty]     = useState(true);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [openAddMenuId, setOpenAddMenuId] = useState(null);
  const [pollOpen, setPollOpen] = useState(false);

  const { handleSendPoll, currentContact, handleAddParticipantToGroup, setChatAlert, editingMessage, setEditingMessage, handleEditMessage, quoteMessage, setQuoteMessage, allMessages, setShowEditTimeLimitModal, drafts, saveDraft, globalSharedFile, setGlobalSharedFile } = useChat();

  const isUserInChat = (userId) => {
    if (!currentContact?.isChannel) return true;
    if (!currentContact?.participants) return true;
    return currentContact.participants.includes(userId);
  };

  // Web Share Target - consume global file when input mounts
  useEffect(() => {
    if (globalSharedFile) {
      addFiles([globalSharedFile]);
      setGlobalSharedFile(null);
    }
  }, [globalSharedFile, setGlobalSharedFile]);

  // Prefill contentEditable editor when editing a message or loading drafts
  useEffect(() => {
    if (editingMessage) {
      if (editorRef.current) {
        editorRef.current.innerText = editingMessage.text;
        setIsEmpty(false);
        // Position cursor at the end
        editorRef.current.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      if (editorRef.current) {
        const draft = drafts[currentContact?.id] || '';
        editorRef.current.innerText = draft;
        textValueRef.current = draft;
        setIsEmpty(draft.trim() === '');
        if (draft) {
          editorRef.current.focus();
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(editorRef.current);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
  }, [editingMessage, currentContact?.id]);

  // Save draft on unmount or when currentContact.id changes
  useEffect(() => {
    return () => {
      if (currentContact?.id) {
        const text = textValueRef.current;
        if (!editingMessage) {
          saveDraft(currentContact.id, text);
        }
      }
    };
  }, [currentContact?.id, editingMessage, saveDraft]);

  // Auto-focus editor when a reply (quote) is initiated
  useEffect(() => {
    if (quoteMessage && editorRef.current) {
      editorRef.current.focus();
    }
  }, [quoteMessage]);

  const [isBoldActive, setIsBoldActive]     = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);

  const [mentionState, setMentionState] = useState(null); // { query: string, index: number }
  const [highlightIdx, setHighlightIdx] = useState(0);

  const mentionContacts = (contacts || []).filter(c => !c.isChannel);
  const filteredMentions = mentionState 
    ? mentionContacts.filter(c => c.name.toLowerCase().includes(mentionState.query.toLowerCase()))
    : [];

  const checkActiveFormats = () => {
    setIsBoldActive(document.queryCommandState('bold'));
    setIsItalicActive(document.queryCommandState('italic'));
  };

  const handleFormat = (command) => {
    document.execCommand(command, false, null);
    checkActiveFormats();
    editorRef.current?.focus();
  };

  const addFiles = (files) => {
    let currentTotalSize = pendingFiles.reduce((acc, f) => acc + f.size, 0);
    const maxSizeLimit = 50 * 1024 * 1024; // 50 MB
    
    const filesToAdd = [];
    
    files.forEach(file => {
      const spaceLeft = 10 - (pendingFiles.length + filesToAdd.length);
      
      if (spaceLeft <= 0) {
        setChatAlert({ message: 'You can only upload 10 files at a time.' });
        return;
      }
      
      if (currentTotalSize + file.size > maxSizeLimit) {
        setChatAlert({ message: 'You can only upload 50 MB at a time.' });
        return;
      }
      
      filesToAdd.push(file);
      currentTotalSize += file.size;
    });
    
    if (filesToAdd.length > 0) {
      setPendingFiles(prev => [...prev, ...filesToAdd]);
    }
  };

  const send = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML || '';
    const markdown = htmlToMarkdown(html);
    
    if (!markdown && pendingFiles.length === 0) return;

    if (editingMessage) {
      handleEditMessage(editingMessage.id, markdown);
      setEditingMessage(null);
    } else {
      onSendMessage(markdown, pendingFiles);
      setPendingFiles([]);
    }

    editor.innerHTML = '';
    setIsEmpty(true);
    textValueRef.current = '';
    if (!editingMessage && currentContact?.id) {
      saveDraft(currentContact.id, '');
    }
    setEmojiOpen(false);
    setMentionState(null);
    setIsBoldActive(false);
    setIsItalicActive(false);
    
    if (onTyping) onTyping(false);
    setIsTyping(false);
    lastTypingBroadcastRef.current = 0;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    editor.focus();
  };

  const insertMention = (user) => {
    if (!mentionState) return;
    const editor = editorRef.current;
    if (!editor) return;

    editor.focus();

    const text = editor.textContent || '';
    const before = text.substring(0, mentionState.index);
    const newText = `${before}@${user.name} `;
    
    editor.textContent = newText;
    setIsEmpty(false);
    setMentionState(null);

    // Position cursor at the end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const triggerAtSymbol = () => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    document.execCommand('insertText', false, '@');
    setIsEmpty(false);

    // Simple manual trigger index
    const text = editor.textContent || '';
    const lastAtIdx = text.lastIndexOf('@');
    setMentionState({ query: '', index: lastAtIdx === -1 ? 0 : lastAtIdx });
    setHighlightIdx(0);
  };

  const handleInput = (e) => {
    const textContent = e.target.textContent || '';
    textValueRef.current = textContent;
    setIsEmpty(textContent.trim() === '');
    
    // Check shortcuts
    checkActiveFormats();

    // Mention trigger checks
    const text = textContent;
    const lastAtIdx = text.lastIndexOf('@');
    if (lastAtIdx !== -1 && lastAtIdx >= text.length - 15) {
      const query = text.substring(lastAtIdx + 1);
      if (!/\s/.test(query)) {
        setMentionState({ query, index: lastAtIdx });
        setHighlightIdx(0);
      } else {
        setMentionState(null);
      }
    } else {
      setMentionState(null);
    }

    if (onTyping) {
      const now = Date.now();
      const needsPing = !isTyping || (now - lastTypingBroadcastRef.current > 2000);
      if (needsPing) {
        setIsTyping(true);
        onTyping(true);
        lastTypingBroadcastRef.current = now;
      }
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        onTyping(false);
        lastTypingBroadcastRef.current = 0;
      }, 3000);
    }
  };

  const onKey = (e) => {
    if (e.key === 'ArrowUp' && isEmpty) {
      e.preventDefault();
      const myMessages = (allMessages || []).filter(m => m.senderId === 'me' && m.type === 'text' && !m.isDeleted && !parsePoll(m.text) && !parseDisappearing(m.text));
      if (myMessages.length > 0) {
        const lastMsg = myMessages[myMessages.length - 1];
        
        const createdAtTime = new Date(lastMsg.createdAt).getTime();
        const currentTime = Date.now();
        const diffMs = currentTime - createdAtTime;
        const diffMins = diffMs / 1000 / 60;
        
        if (diffMins > 5) {
          setShowEditTimeLimitModal(true);
        } else {
          setEditingMessage(lastMsg);
        }
      }
      return;
    }

    // If Ctrl+B or Ctrl+I is clicked, check formats on next tick
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'i')) {
      setTimeout(checkActiveFormats, 0);
    }

    if (mentionState && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx(prev => (prev + 1) % filteredMentions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx(prev => (prev - 1 + filteredMentions.length) % filteredMentions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentions[highlightIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionState(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) { 
      e.preventDefault(); 
      send(); 
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    
    const pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          pastedFiles.push(file);
        }
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFiles(pastedFiles);
    }
  };

  const addEmoji = (em) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, em);
    setIsEmpty(false);
    setEmojiOpen(false);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      addFiles(files);
    }
    e.target.value = '';
  };

  const isSendDisabled = isEmpty && pendingFiles.length === 0;

  return (
    <div className="px-3 md:px-6 pb-4 md:pb-6 pt-2 bg-white flex-shrink-0 w-full max-w-full">
      <div className="msg-box relative w-full">

        {/* Emoji Picker Dropdown */}
        {emojiOpen && (
          <div className="absolute bottom-full right-0 mb-2 z-50 animate-scale-in w-[320px] max-w-[calc(100vw-3rem)]">
            <EmojiPicker
              onEmojiClick={(emojiData) => addEmoji(emojiData.emoji)}
              autoFocusSearch={false}
              theme="light"
              width="100%"
              height={380}
            />
          </div>
        )}

        <CreatePollModal isOpen={pollOpen} onClose={() => setPollOpen(false)} onCreate={handleSendPoll} />

        {/* Mentions Dropdown */}
        {mentionState && filteredMentions.length > 0 && (
          <div className="absolute bottom-full left-4 mb-2 w-[240px] bg-white border border-[#e2e8f0]
                          rounded-xl shadow-lg overflow-y-auto max-h-[200px] z-50 py-1 animate-scale-in">
            {filteredMentions.map((user, idx) => (
              <div
                key={user.id}
                onMouseEnter={() => setHighlightIdx(idx)}
                onClick={() => insertMention(user)}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors text-[13px] font-medium",
                  idx === highlightIdx ? "bg-[#f1f5f9] text-[#0f172a]" : "text-[#475569] hover:bg-[#f8fafc]"
                )}
              >
                <Avatar initials={user.initials} color={user.color} size="xs" borderColor="#ffffff" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-semibold">{user.name}</p>
                  <p className="text-[10px] text-[#94a3b8] truncate leading-none mt-0.5">{user.role}</p>
                </div>
                {!isUserInChat(user.id) && (
                  <div className="flex items-center gap-1.5 ml-2 relative">
                    <button 
                      onClick={(e) => {
                         e.stopPropagation();
                         setOpenAddMenuId(openAddMenuId === user.id ? null : user.id);
                      }}
                      className="flex items-center gap-1 text-[10px] text-[#94a3b8] hover:text-[#64748b] bg-slate-50 px-1.5 py-0.5 rounded border border-[#e2e8f0] transition-colors"
                    >
                      Not in chat <ChevronDown size={10} />
                    </button>
                    {openAddMenuId === user.id && (
                       <div className="absolute top-full right-0 mt-1 bg-white border border-[#e2e8f0] shadow-lg rounded-lg py-1 z-[60] w-[140px] animate-scale-in">
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             handleAddParticipantToGroup(currentContact.roomId, user.id);
                             setOpenAddMenuId(null);
                           }}
                           className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-medium text-[#0f172a] hover:bg-[#f8fafc] transition-colors"
                         >
                           Add to chat
                           <UserPlus size={12} className="text-[#94a3b8]" />
                         </button>
                       </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Attachment Draft Previews (Horizontal list) */}
        {pendingFiles.length > 0 && (
          <div className="px-4 pt-3 pb-1 flex gap-2.5 overflow-x-auto max-w-full no-scrollbar">
            {pendingFiles.map((file, idx) => {
              const fileId = idx;
              const isImage = file.type.startsWith('image/');
              
              const handleRemove = (e) => {
                e.stopPropagation();
                setPendingFiles(prev => prev.filter((_, i) => i !== idx));
              };
              
              const handlePreviewClick = (e) => {
                e.stopPropagation();
                if (!onViewFile) return;
                const tempUrl = URL.createObjectURL(file);
                onViewFile({
                  name: file.name,
                  size: formatBytes(file.size),
                  url: tempUrl,
                  type: file.type
                });
              };
              
              return (
                <div 
                  key={fileId}
                  className="flex-shrink-0 relative group rounded-xl border border-[#e2e8f0] p-1 bg-white hover:opacity-90 transition-opacity"
                >
                  {/* Cross Icon */}
                  <button
                    onClick={handleRemove}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-[#cbd5e1]
                               flex items-center justify-center text-[#64748b] hover:text-[#ef4444] shadow-sm z-10 transition-all hover:scale-105"
                  >
                    <X size={12} strokeWidth={2.5} />
                  </button>
                  
                  {isImage ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt="Preview"
                      onClick={handlePreviewClick}
                      className="w-14 h-14 object-cover rounded-lg cursor-pointer animate-scale-in"
                    />
                  ) : (
                    <div 
                      onClick={handlePreviewClick}
                      className="w-14 h-14 rounded-lg bg-indigo-50 border border-indigo-100 flex flex-col items-center justify-center text-indigo-500 font-bold text-[10px] cursor-pointer hover:bg-indigo-100/50 transition-colors px-1 text-center animate-scale-in"
                    >
                      <span className="truncate max-w-full leading-none mb-1">
                        {file.name.split('.').pop().toUpperCase() || 'FILE'}
                      </span>
                      <span className="text-[7px] text-indigo-400 leading-none">
                        {formatBytes(file.size)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Replying Banner */}
        {quoteMessage && (
          <div className="flex items-center justify-between bg-indigo-50/80 px-4 py-2 text-[12px] text-[#475569] border-b border-[#e2e8f0]">
            <div className="flex flex-col gap-0.5 overflow-hidden">
              <span className="font-semibold text-indigo-600">Replying to {quoteMessage.senderName || 'Someone'}</span>
              <span className="truncate max-w-full opacity-80 text-[11px]">{pollPreview(quoteMessage.text) || 'Attachment'}</span>
            </div>
            <button 
              onClick={() => setQuoteMessage(null)}
              className="text-[#64748b] hover:text-[#ef4444] p-1 rounded-md hover:bg-slate-200/50 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Editing Banner */}
        {editingMessage && (
          <div className="flex items-center justify-between bg-slate-100/80 px-4 py-1.5 text-[11px] text-[#475569] font-semibold border-b border-[#e2e8f0]">
            <span>Editing message...</span>
            <button 
              onClick={() => {
                setEditingMessage(null);
              }}
              className="text-[#64748b] hover:text-[#ef4444] text-[10px] font-bold"
            >
              Cancel
            </button>
          </div>
        )}

        {/* contentEditable Div */}
        <div className="px-4 pt-3 pb-2">
          <div
            ref={editorRef}
            contentEditable
            placeholder="Message..."
            onInput={handleInput}
            onKeyDown={onKey}
            onPaste={handlePaste}
            onKeyUp={checkActiveFormats}
            onMouseUp={checkActiveFormats}
            className="w-full bg-transparent text-[16px] md:text-[14px] text-[#0f172a] outline-none leading-relaxed min-h-[24px] max-h-[120px] overflow-y-auto rich-editor"
            style={{ minHeight: '24px' }}
          />
        </div>

        {/* Toolbar row */}
        <div className="flex items-center justify-between px-2 pb-2 mt-1">
          {/* Left tools */}
          <div className="flex items-center gap-1">
            <IconButton icon={Bold}       title="Bold"   onClick={() => handleFormat('bold')} active={isBoldActive} />
            <IconButton icon={Italic}     title="Italic" onClick={() => handleFormat('italic')} active={isItalicActive} />
            <div className="w-px h-4 bg-[#e2e8f0] mx-1" />
            <input 
              type="file" 
              multiple
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
            />
            <IconButton icon={Paperclip}  title="Attach file" onClick={() => fileInputRef.current?.click()} />
            <IconButton icon={AtSign}     title="Mention"  onClick={triggerAtSymbol} />
            {!editingMessage && <IconButton icon={BarChart3} title="Create poll" onClick={() => setPollOpen(true)} />}
            <IconButton
              icon={Smile}
              title="Emoji"
              onClick={() => setEmojiOpen(v => !v)}
              active={emojiOpen}
            />
          </div>

          {/* Send / Mic */}
          <div className="flex items-center gap-2 pr-1">
            <button
              onClick={send}
              disabled={isSendDisabled}
              className={clsx(
                "flex items-center justify-center w-8 h-8 rounded-lg shadow-sm transition-all",
                isSendDisabled 
                  ? "bg-[#f1f5f9] text-[#cbd5e1] cursor-not-allowed" 
                  : "bg-[#4f46e5] hover:bg-[#4338ca] text-white hover:scale-105"
              )}
            >
              <Send size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
