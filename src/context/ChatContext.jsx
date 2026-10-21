import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { getUserColor, formatMessageTime, formatBytes, sortContacts } from '../utils/helpers';
import { parsePoll, pollPreview, buildPollMessage, POLL_VOTE_PREFIX } from '../utils/poll';
import { buildDisappearingMessage, computeExpiries, parseDisappearing } from '../utils/disappearing';
import { CURSOR_ACTION, RECEIPT_ACTION, MUTE_ACTION, tsOf, parseReadState, addReceipt, receiptsForMessage, isMuteActive } from '../utils/readState';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const { companyUserId } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  let activeNav = 'chats';
  if (location.pathname.startsWith('/notifications')) activeNav = 'notifications';
  else if (location.pathname.startsWith('/starred')) activeNav = 'starred';
  else if (location.pathname.startsWith('/files')) activeNav = 'files';

  let activeContactId = null;
  const pathParts = location.pathname.split('/');
  if (pathParts.length > 2 && pathParts[2]) {
    activeContactId = pathParts[2];
  }

  const [contacts,      setContacts]      = useState([]);
  const [activeTab,     setActiveTab]     = useState('chat');
  const [allMessages,   setAllMessages]   = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [typingUsers,   setTypingUsers]   = useState({});
  const [notifications, setNotifications] = useState([]);
  const [viewingFile,   setViewingFile]   = useState(null);
  const [currentUser,   setCurrentUser]   = useState(null);
  const [chatAlert,     setChatAlert]     = useState(null);
  const [isSearchOpen,  setIsSearchOpen]  = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [quoteMessage, setQuoteMessage] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [isFetchingChat, setIsFetchingChat] = useState(true);
  const [scrollToMessageId, setScrollToMessageId] = useState(null);
  const [showEditTimeLimitModal, setShowEditTimeLimitModal] = useState(false);
  const [drafts, setDrafts] = useState(() => {
    try {
      const saved = localStorage.getItem('chat_drafts');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });
  const [globalSharedFile, setGlobalSharedFile] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Web Share Target Hook Integration - Global Level
  useEffect(() => {
    if (searchParams.get('shared') === 'true') {
      const request = indexedDB.open('ChatAppSharedFilesDB', 1);

      request.onsuccess = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('files')) return;

        const tx = db.transaction('files', 'readonly');
        const store = tx.objectStore('files');
        
        const getRequest = store.get('latest-shared-file');
        
        getRequest.onsuccess = () => {
          const file = getRequest.result;
          if (file) {
            setGlobalSharedFile(file);
            
            // Clean up the URL query param without adding to history
            searchParams.delete('shared');
            setSearchParams(searchParams, { replace: true });
            
            // Remove the file from IndexedDB to avoid processing it again
            try {
              const deleteTx = db.transaction('files', 'readwrite');
              deleteTx.objectStore('files').delete('latest-shared-file');
            } catch (e) {
              console.error('Failed to clean up shared file from IndexedDB:', e);
            }
          }
        };
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('shared')]);

  const saveDraft = useCallback((contactId, text) => {
    setDrafts(prev => {
      const updated = { ...prev, [contactId]: text };
      try {
        localStorage.setItem('chat_drafts', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const [onlineUsers, setOnlineUsers] = useState({});
  const presenceChannelRef = useRef(null);

  // "N new messages" divider: first unread message of the room at the moment it was opened
  const [unreadMarker, setUnreadMarker] = useState(null); // { roomId, messageId, count }
  const openSnapshotRef = useRef(new Map()); // roomId -> my read cursor (ISO or null) captured when the chat was opened

  // Read state stored in the notifications table (see utils/readState.js)
  const cursorsRef = useRef({}); // roomId -> { id, upTo }  (my own cursor rows)
  const [peerReceipts, setPeerReceipts] = useState({}); // roomId -> userId -> [{ upTo, at }]
  const contactsRef = useRef([]);
  const receiptFlushRef = useRef({}); // roomId -> { last, timer }

  // Muted chats (stored as '__mute' rows in the notifications table): roomId -> { id, until }
  const [mutes, setMutes] = useState({});
  const mutesRef = useRef({});
  const [muteTick, setMuteTick] = useState(0);
  useEffect(() => { mutesRef.current = mutes; }, [mutes]);
  // Re-evaluate timed mutes so a mute switches off by itself when it expires
  useEffect(() => {
    if (Object.keys(mutes).length === 0) return;
    const timer = setInterval(() => setMuteTick(t => t + 1), 30000);
    return () => clearInterval(timer);
  }, [mutes]);

  // Multi-select: ids of the messages ticked in the current chat (empty = not selecting)
  const [selectedIds, setSelectedIds] = useState([]);
  const startSelect = useCallback((id) => setSelectedIds([id]), []);
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }, []);
  const clearSelect = useCallback(() => setSelectedIds([]), []);

  // Clear temporary message states when switching chats
  useEffect(() => {
    setQuoteMessage(null);
    setEditingMessage(null);
    setForwardingMessage(null);
    setSelectedIds([]);
  }, [activeContactId]);

  const markNotificationAsRead = useCallback(async (notifId) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notifId);
      if (error) console.error("Error marking notification as read:", error);
    } catch (err) {
      console.error("Error in markNotificationAsRead:", err);
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      if (!companyUserId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('recipient_id', companyUserId)
        .eq('is_read', false);
      if (error) console.error("Error marking all notifications as read:", error);
    } catch (err) {
      console.error("Error in markAllNotificationsAsRead:", err);
    }
  }, [companyUserId]);

  useEffect(() => {
    if (activeNav === 'notifications') {
      markAllNotificationsAsRead();
    }
  }, [activeNav, markAllNotificationsAsRead]);

  const typingTimeoutsRef = useRef({});
  const activeChannelRef  = useRef(null);

  const activeContact = contacts.find(c => c.id === activeContactId) || null;
  const currentContact = activeContact;

  const setActiveNav = useCallback((nav) => {
    if (activeContactId) {
      navigate(`/${nav}/${activeContactId}`);
    } else {
      navigate(`/${nav}`);
    }
  }, [navigate, activeContactId]);
  
  const activeRoomTypingUserIds = typingUsers[currentContact?.roomId] || [];
  const activeRoomTypingUsers = activeRoomTypingUserIds
    .map(id => contacts.find(c => c.id === id))
    .filter(Boolean);

  // Request native notification permissions on startup
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Auto-dismiss chat alert after 5 seconds
  useEffect(() => {
    if (chatAlert) {
      const timer = setTimeout(() => setChatAlert(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [chatAlert]);

  // Load initial data
  useEffect(() => {
    if (!companyUserId) return;

    const updateLastSeen = () => {
      supabase
        .from('company_users')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', companyUserId)
        .then(() => {});
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') updateLastSeen();
    };

    window.addEventListener('beforeunload', updateLastSeen);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', updateLastSeen);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [companyUserId]);

  useEffect(() => {
    if (!companyUserId) return;
    async function loadData() {
      try {
        setLoading(true);
        // 1. Fetch current user details
        const { data: hemilData } = await supabase
          .from('company_users')
          .select('*, users(*)')
          .eq('id', companyUserId)
          .single();
        
        let resolvedCurrentUser = {
          id: companyUserId,
          name: 'Hemil Gandhi',
          initials: 'HG',
          color: getUserColor(companyUserId),
          status: 'online',
          role: 'Python Department',
        };

        // Presence Setup
        if (!presenceChannelRef.current) {
          const channel = supabase.channel('online-users', {
            config: {
              presence: {
                key: companyUserId,
              },
            },
          });
          presenceChannelRef.current = channel;
          
          channel
            .on('presence', { event: 'sync' }, () => {
              const state = channel.presenceState();
              const online = {};
              for (const [key, presences] of Object.entries(state)) {
                online[key] = true;
                for (const p of presences) {
                  if (p.user_id) online[p.user_id] = true;
                }
              }
              setOnlineUsers(online);
            })
            .subscribe(async (status) => {
              if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: companyUserId, online_at: new Date().toISOString() });
              }
            });
        }
        
        if (hemilData && hemilData.users) {
          resolvedCurrentUser = {
            id: hemilData.id,
            name: `${hemilData.users.first_name || ''} ${hemilData.users.last_name || ''}`.trim(),
            initials: `${hemilData.users.first_name?.[0] || ''}${hemilData.users.last_name?.[0] || ''}`.toUpperCase() || 'HG',
            color: getUserColor(hemilData.id),
            status: 'online',
            role: hemilData.department || hemilData.designation || 'Python Department',
            avatar: hemilData.users.avatar_url,
            email: hemilData.users.email,
            mobile: hemilData.users.mobile_number || '+91-6351266005',
            country: hemilData.users.country || 'India',
            organization: 'Digipie Technologies LLP',
          };
          setCurrentUser(resolvedCurrentUser);
        }

        // 2. Fetch other company users
        const { data: cUsers } = await supabase
          .from('company_users')
          .select('*, users(*)')
          .neq('id', companyUserId);

        // 3. Fetch rooms
        const { data: rooms } = await supabase
          .from('chat_rooms')
          .select('*')
          .contains('participants', [companyUserId]);

        // 4. Fetch last messages
        const lastMessageIds = (rooms || []).map(r => r.last_message_id).filter(Boolean);
        let lastMessages = [];
        if (lastMessageIds.length > 0) {
          const { data: msgs } = await supabase
            .from('chat_messages')
            .select('*')
            .in('id', lastMessageIds);
          lastMessages = msgs || [];
        }

        // 4.4 Read state kept in the notifications table (my read cursors + receipts others sent me)
        const { data: readRows } = await supabase
          .from('notifications')
          .select('id, action, sender_id, recipient_id, link_id, preview, created_at')
          .in('action', [CURSOR_ACTION, RECEIPT_ACTION, MUTE_ACTION])
          .or(`sender_id.eq.${companyUserId},recipient_id.eq.${companyUserId}`);
        const readState = parseReadState(readRows, companyUserId);
        cursorsRef.current = readState.cursors;
        setPeerReceipts(readState.receipts);
        setMutes(readState.mutes);

        // 4.5 Fetch unread messages to calculate badge counts
        const { data: unreadMessages } = await supabase
          .from('chat_messages')
          .select('id, room_id, read_by_users, created_at, is_deleted, type, message')
          .neq('created_by', companyUserId);

        const getUnreadCountForRoom = (roomId) => {
          if (!roomId) return 0;
          const cursor = readState.cursors[roomId];
          return (unreadMessages || []).filter(m => {
            if (m.room_id !== roomId) return false;
            if (m.is_deleted) return false;
            if (m.type === 'text' && parseDisappearing(m.message)) return false;
            // Once a read cursor exists it is the source of truth; before that fall back to the old per-message receipts
            if (cursor) return tsOf(m.created_at) > tsOf(cursor.upTo);
            const readList = m.read_by_users || [];
            const hasRead = readList.some(item => {
              const parsed = typeof item === 'string' ? JSON.parse(item) : item;
              return parsed?.user_id === companyUserId;
            });
            return !hasRead;
          }).length;
        };

        // Helper to format last message string
        const formatLastMsg = (msg, isGroup = false) => {
          if (!msg) return '';
          const isYou = msg.created_by === companyUserId;
          
          let prefix = '';
          if (isGroup) {
            if (isYou) {
              prefix = 'You: ';
            } else {
              const sender = (cUsers || []).find(cu => cu.id === msg.created_by);
              const senderName = sender?.users?.first_name || 'Someone';
              prefix = `${senderName}: `;
            }
          } else {
            if (isYou) {
              prefix = 'You: ';
            }
          }

          let isForwarded = msg.is_forwarded || false;
          let msgText = msg.message || '';
          if (msg.type === 'text') {
            if (!isForwarded && msg.message) {
              try {
                const parsed = JSON.parse(msg.message);
                if (parsed && typeof parsed === 'object' && 'isForwarded' in parsed) {
                  msgText = parsed.text || '';
                  isForwarded = true;
                }
              } catch (e) {
                if (msg.message.startsWith('[Forwarded]\n')) {
                  msgText = msg.message.substring(12);
                  isForwarded = true;
                }
              }
            }
          }

          if (msg.type === 'file') {
            try {
              const fileMeta = typeof msg.message === 'string' ? JSON.parse(msg.message) : msg.message;
              const isImg = fileMeta?.type?.startsWith('image/');
              return `${prefix}sent a ${isImg ? 'image' : 'file'}`;
            } catch (e) {
              return `${prefix}sent a file`;
            }
          }
          
          // Strip markdown characters before returning
          const cleanText = pollPreview(msgText)
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/_([^_]+)_/g, '$1');

          return `${prefix}${cleanText}`;
        };

        // 5. Build group chats list
        const groupContacts = (rooms || [])
          .filter(r => r.type === 'group')
          .map(r => {
            const lastMsg = lastMessages.find(m => m.id === r.last_message_id);
            return {
              id: r.id,
              roomId: r.id,
              name: r.name || 'Group Chat',
              initials: (r.name || 'GC').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2),
              color: getUserColor(r.id),
              status: null,
              role: 'Channel',
              lastMessage: lastMsg ? formatLastMsg(lastMsg, true) : 'No messages yet',
              timestamp: lastMsg ? formatMessageTime(lastMsg.created_at) : '',
              rawTimestamp: lastMsg ? lastMsg.created_at : '',
              unread: getUnreadCountForRoom(r.id),
              pinned: false,
              isChannel: true,
              participants: r.participants,
            };
          });

        // 6. Build direct chats list
        const directContacts = (cUsers || []).map(cu => {
          const matchingRoom = (rooms || []).find(r => 
            r.type === 'single' && 
            r.participants.includes(companyUserId) && 
            r.participants.includes(cu.id)
          );
          
          const lastMsg = matchingRoom ? lastMessages.find(m => m.id === matchingRoom.last_message_id) : null;
          
          return {
            id: cu.id,
            roomId: matchingRoom ? matchingRoom.id : null,
            name: `${cu.users?.first_name || ''} ${cu.users?.last_name || ''}`.trim() || 'Colleague',
            initials: `${cu.users?.first_name?.[0] || ''}${cu.users?.last_name?.[0] || ''}`.toUpperCase() || '?',
            color: getUserColor(cu.id),
            status: cu.is_active ? 'online' : 'offline',
            role: cu.department || cu.designation || 'Colleague',
            lastSeen: cu.is_active ? 'Online' : 'Offline',
            lastMessage: lastMsg ? formatLastMsg(lastMsg, false) : 'Click to start chatting',
            timestamp: lastMsg ? formatMessageTime(lastMsg.created_at) : '',
            rawTimestamp: lastMsg ? lastMsg.created_at : '',
            unread: getUnreadCountForRoom(matchingRoom ? matchingRoom.id : null),
            pinned: false,
            isChannel: false,
          };
        });

        const merged = [...groupContacts, ...directContacts];
        setContacts(sortContacts(merged));

        // 7. Fetch notifications
        try {
          const { data: dbNotifs } = await supabase
            .from('notifications')
            .select(`
              *,
              sender:company_users!notifications_sender_id_fkey(
                id,
                users(
                  id,
                  first_name,
                  last_name,
                  avatar_url
                )
              )
            `)
            .eq('recipient_id', companyUserId)
            .order('created_at', { ascending: false });

          if (dbNotifs) {
            const filtered = dbNotifs.filter(n => {
              const act = (n.action || '').toLowerCase();
              return act.includes('mention') || act.includes('react');
            });
            const formattedNotifs = filtered.map(n => {
              let previewText = n.preview;
              if (previewText && previewText.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(previewText);
                  previewText = parsed.text || parsed.name || previewText;
                } catch (e) {}
              }
              return {
                id: n.id,
                name: `${n.sender?.users?.first_name || 'Someone'}`,
                action: n.action,
                preview: previewText,
                time: formatMessageTime(n.created_at),
                color: getUserColor(n.sender_id),
                initial: `${n.sender?.users?.first_name?.[0] || '?'}${n.sender?.users?.last_name?.[0] || ''}`.toUpperCase(),
                emoji: n.emoji || '🔔',
                isRead: n.is_read,
                linkId: n.link_id,
                createdAt: n.created_at,
              };
            });
            setNotifications(formattedNotifs);
          }
        } catch (errNotif) {
          console.warn("Could not load notifications from DB, falling back to mocks:", errNotif);
        }

      } catch (error) {
        console.error("Failed to load initial chat data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [companyUserId]);

  useEffect(() => { contactsRef.current = contacts; }, [contacts]);

  // Writes to my read cursor are serialised per room so two quick calls never create duplicate cursor rows
  const cursorQueueRef = useRef({});
  const queueCursorWrite = useCallback((roomId, upTo) => {
    const run = async () => {
      const existing = cursorsRef.current[roomId];
      if (existing?.id) {
        const ids = existing.ids?.length ? existing.ids : [existing.id];
        const { error } = await supabase.from('notifications').update({ preview: upTo }).in('id', ids);
        if (error) throw error;
        cursorsRef.current[roomId] = { id: existing.id, upTo, ids };
        return;
      }
      const { data, error } = await supabase
        .from('notifications')
        .insert({ recipient_id: companyUserId, sender_id: companyUserId, action: CURSOR_ACTION, link_id: roomId, preview: upTo, is_read: true })
        .select('id')
        .single();
      if (error) throw error;
      cursorsRef.current[roomId] = { id: data.id, upTo, ids: [data.id] };
    };
    const next = (cursorQueueRef.current[roomId] || Promise.resolve()).catch(() => {}).then(run);
    cursorQueueRef.current[roomId] = next;
    return next;
  }, [companyUserId]);

  // Move my read cursor to the newest incoming message and tell the other participants ("Seen by")
  const flushRead = useCallback(async (roomId) => {
    try {
      const { data: latest } = await supabase
        .from('chat_messages')
        .select('created_at')
        .eq('room_id', roomId)
        .neq('created_by', companyUserId)
        .order('created_at', { ascending: false })
        .limit(1);
      const upTo = latest?.[0]?.created_at;
      if (!upTo) return;

      const current = cursorsRef.current[roomId];
      if (current && tsOf(current.upTo) >= tsOf(upTo)) return;

      await queueCursorWrite(roomId, upTo);

      const contact = contactsRef.current.find(c => c.roomId === roomId);
      const recipients = (contact ? (contact.isChannel ? (contact.participants || []) : [contact.id]) : [])
        .filter(id => id && id !== companyUserId)
        .slice(0, 50);
      if (recipients.length > 0) {
        const { error } = await supabase.from('notifications').insert(
          recipients.map(rid => ({ recipient_id: rid, sender_id: companyUserId, action: RECEIPT_ACTION, link_id: roomId, preview: upTo, is_read: true }))
        );
        if (error) console.error('Error sending read receipt:', error);
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  }, [companyUserId, queueCursorWrite]);

  // First call for a room goes out immediately; calls within 3s are coalesced into one trailing flush
  const markMessagesAsRead = useCallback((roomId) => {
    if (!roomId || !companyUserId) return;
    const state = receiptFlushRef.current[roomId] || (receiptFlushRef.current[roomId] = { last: 0, timer: null });
    const wait = state.last + 3000 - Date.now();
    if (wait <= 0) {
      state.last = Date.now();
      return flushRead(roomId);
    }
    if (!state.timer) {
      state.timer = setTimeout(() => {
        state.timer = null;
        state.last = Date.now();
        flushRead(roomId);
      }, wait);
    }
  }, [companyUserId, flushRead]);

  const sendTypingStatus = (isTyping) => {
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: companyUserId, isTyping },
      });
    }
  };

  const handleSelect = useCallback((contact) => {
    if (contact && contact.id === activeContactId) {
      // If we are already on this chat, just ensure we are on the chat tab
      setActiveTab('chat');
      return;
    }

    setActiveTab('chat');
    setIsFetchingChat(true);
    setAllMessages([]);
    // Remember where my read cursor was before opening, so the "new messages" divider is not affected by marking as read
    if (contact?.roomId) openSnapshotRef.current.set(contact.roomId, cursorsRef.current[contact.roomId]?.upTo ?? null);
    if (contact) {
      navigate(`/${activeNav}/${contact.id}`);
    } else {
      navigate(`/${activeNav}`);
    }
    setContacts(prev => prev.map(c => {
      if (contact && (c.id === contact.id || (contact.roomId && c.roomId === contact.roomId))) {
        return { ...c, unread: 0 };
      }
      return c;
    }));
    if (contact?.roomId) markMessagesAsRead(contact.roomId);
  }, [markMessagesAsRead, navigate, activeContactId, activeNav]);

  const setActiveContact = handleSelect;

  // Put a chat back into the unread state by moving my read cursor to just before the newest incoming message.
  // The cursor lives in the notifications table, so the badge survives reloads and other devices.
  const handleMarkUnread = async (contact) => {
    if (!contact) return;
    const roomId = contact.roomId;
    const wasOpen = contact.id === activeContactId;

    setContacts(prev => prev.map(c => (c.id === contact.id ? { ...c, unread: Math.max(1, c.unread || 0) } : c)));
    if (wasOpen) handleSelect(null);
    if (!roomId) return;

    try {
      const { data: recent } = await supabase
        .from('chat_messages')
        .select('created_at, type, message')
        .eq('room_id', roomId)
        .neq('created_by', companyUserId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);

      const incoming = (recent || []).filter(m => !(m.type === 'text' && parseDisappearing(m.message)));
      if (incoming.length === 0) return;
      openSnapshotRef.current.delete(roomId);
      await queueCursorWrite(roomId, incoming[1]?.created_at ?? '1970-01-01T00:00:00.000Z');
    } catch (err) {
      console.error('Error marking chat as unread:', err);
    }
  };

  const handleMarkRead = async (contact) => {
    if (!contact) return;
    setContacts(prev => prev.map(c => (c.id === contact.id ? { ...c, unread: 0 } : c)));
    if (contact.roomId) await flushRead(contact.roomId);
  };

  const isRoomMuted = useCallback(
    (roomId) => !!roomId && isMuteActive(mutes[roomId]),
    // muteTick makes timed mutes expire without any other state change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutes, muteTick]
  );

  // duration: milliseconds, 'forever', or null to unmute
  const handleMuteChat = async (contact, duration) => {
    const roomId = contact?.roomId;
    if (!roomId || !companyUserId) return;
    const existing = mutesRef.current[roomId];

    try {
      if (duration === null) {
        setMutes(prev => {
          const next = { ...prev };
          delete next[roomId];
          return next;
        });
        if (existing?.id) {
          const ids = existing.ids?.length ? existing.ids : [existing.id];
          const { error } = await supabase.from('notifications').delete().in('id', ids);
          if (error) throw error;
        }
        return;
      }

      const until = duration === 'forever' ? 'forever' : new Date(Date.now() + duration).toISOString();
      if (existing?.id) {
        const ids = existing.ids?.length ? existing.ids : [existing.id];
        setMutes(prev => ({ ...prev, [roomId]: { id: existing.id, until, ids } }));
        const { error } = await supabase.from('notifications').update({ preview: until }).in('id', ids);
        if (error) throw error;
        return;
      }
      setMutes(prev => ({ ...prev, [roomId]: { id: null, until } }));
      const { data, error } = await supabase
        .from('notifications')
        .insert({ recipient_id: companyUserId, sender_id: companyUserId, action: MUTE_ACTION, link_id: roomId, preview: until, is_read: true })
        .select('id')
        .single();
      if (error) throw error;
      setMutes(prev => (prev[roomId] ? { ...prev, [roomId]: { id: data.id, until: prev[roomId].until, ids: [data.id] } } : prev));
    } catch (err) {
      console.error('Error updating mute:', err);
      setChatAlert({ message: 'Could not update mute setting. Please try again.' });
    }
  };

  // Who has read this message of mine: legacy per-message receipts plus cursor receipts from the notifications table
  const getMessageReceipts = useCallback(
    (message) => receiptsForMessage(message, peerReceipts[currentContact?.roomId]),
    [peerReceipts, currentContact?.roomId]
  );

  const getOrCreateRoomForContact = async (contact) => {
    if (contact.roomId) return contact.roomId;

    const { data: existing } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('type', 'single')
      .contains('participants', [companyUserId, contact.id]);

    if (existing && existing.length > 0) {
      const roomId = existing[0].id;
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, roomId } : c));
      return roomId;
    }

    const roomName = `${currentUser?.name || 'User'} & ${contact.name}`;
    const { data: newRoom, error: roomErr } = await supabase
      .from('chat_rooms')
      .insert({
        type: 'single',
        participants: [companyUserId, contact.id],
        created_by: companyUserId,
        name: roomName,
        description: 'Direct message room',
        typing_participants: []
      })
      .select()
      .single();

    if (roomErr) {
      console.error("Failed to create room:", roomErr);
      throw roomErr;
    }

    const roomId = newRoom.id;
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, roomId } : c));
    return roomId;
  };

  const handleSend = async (text, files, { skipQuote = false } = {}) => {
    if (!currentContact) return;
    const replyToId = skipQuote ? null : (quoteMessage?.id || null);

    try {
      let roomId = currentContact.roomId;
      if (!roomId) {
        roomId = await getOrCreateRoomForContact(currentContact);
        setActiveContact(prev => prev ? { ...prev, roomId } : null);
      }

      let lastUploadedMsg = null;

      if (files && files.length > 0) {
        for (const file of files) {
          const fileId = Math.random().toString(36).substring(2);
          setUploadingFiles(prev => [...prev, { id: fileId, name: file.name, size: file.size }]);
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${companyUserId}/${Date.now()}-${fileId}.${fileExt}`;
            const filePath = `chat_documents/${fileName}`;
          
          const { error: uploadError } = await supabase.storage.from('chat').upload(filePath, file);
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage.from('chat').getPublicUrl(filePath, { download: file.name });
          const fileMeta = { name: file.name, size: formatBytes(file.size), url: publicUrl, type: file.type };

          const { data: insertedMsg, error: msgErr } = await supabase
            .from('chat_messages')
            .insert({ 
              room_id: roomId, 
              created_by: companyUserId, 
              message: JSON.stringify(fileMeta),
              type: 'file',
              reply_to_message_id: replyToId
            })
            .select()
            .single();

          if (msgErr) throw msgErr;
          lastUploadedMsg = insertedMsg;

          setAllMessages(prev => {
            if (prev.some(x => x.id === insertedMsg.id)) return prev;
            return [...prev, {
              id: insertedMsg.id,
              senderId: 'me',
              text: '',
              file: fileMeta,
              timestamp: new Date(insertedMsg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              type: 'file',
              createdAt: insertedMsg.created_at,
              replyToMessageId: insertedMsg.reply_to_message_id,
            }];
          });
          } finally {
            setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
          }
        }
      }

      let newMsgText = null;
      if (text) {
        const { data: insertedMsg, error: msgErr } = await supabase
          .from('chat_messages')
          .insert({ 
            room_id: roomId, 
            created_by: companyUserId, 
            message: text,
            type: 'text',
            reply_to_message_id: replyToId
          })
          .select()
          .single();

        if (msgErr) return console.error("Failed to send message:", msgErr);
        newMsgText = insertedMsg;

        setAllMessages(prev => {
          if (prev.some(x => x.id === insertedMsg.id)) return prev;
          return [...prev, {
            id: insertedMsg.id,
            senderId: 'me',
            text: insertedMsg.message,
            timestamp: new Date(insertedMsg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: 'text',
            createdAt: insertedMsg.created_at,
            replyToMessageId: insertedMsg.reply_to_message_id,
          }];
        });

        // Insert mention notifications
        const mentionedContacts = contacts.filter(c => !c.isChannel && text.includes(`@${c.name}`));
        if (mentionedContacts.length > 0) {
          const notifs = mentionedContacts.map(c => ({
            recipient_id: c.id,
            sender_id: companyUserId,
            action: '@Mentioned You:',
            preview: text.substring(0, 100),
            emoji: '@',
            link_id: roomId
          }));
          supabase.from('notifications').insert(notifs).then(({error}) => {
            if (error) console.error("Error inserting mentions", error);
          });
        }
      }

      const latestMsg = newMsgText || lastUploadedMsg;
      if (latestMsg) {
        if (!skipQuote) setQuoteMessage(null);
        await supabase.from('chat_rooms').update({ last_message_id: latestMsg.id }).eq('id', roomId);

        setContacts(prev => {
          const updated = prev.map(c => {
            if (c.id === currentContact.id || c.roomId === roomId) {
              let preview = '';
              if (newMsgText) {
                const cleanText = pollPreview(text)
                  .replace(/\*([^*]+)\*/g, '$1')
                  .replace(/_([^_]+)_/g, '$1');
                preview = `You: ${cleanText}`;
              } else if (lastUploadedMsg) {
                let isImg = false;
                try {
                  const parsed = typeof lastUploadedMsg.message === 'string'
                    ? JSON.parse(lastUploadedMsg.message)
                    : lastUploadedMsg.message;
                  isImg = parsed?.type?.startsWith('image/');
                } catch (e) {}
                preview = `You: sent a ${isImg ? 'image' : 'file'}`;
              }
              return {
                ...c,
                roomId,
                lastMessage: preview,
                timestamp: formatMessageTime(latestMsg.created_at),
                rawTimestamp: latestMsg.created_at,
              };
            }
            return c;
          });
          return sortContacts(updated);
        });
      }
    } catch (err) {
      console.error("Error in handleSend:", err);
    }
  };

  const handleForwardMessage = async (message, targetContacts) => {
    try {
      let forwardedMessageValue = '';
      let forwardedType = message.type;
      if (message.type === 'file') {
        forwardedMessageValue = JSON.stringify(message.file);
      } else {
        forwardedMessageValue = message.text;
      }
 
      for (const contact of targetContacts) {
        const roomId = await getOrCreateRoomForContact(contact);
        
        const { data: insertedMsg, error: msgErr } = await supabase
          .from('chat_messages')
          .insert({
            room_id: roomId,
            created_by: companyUserId,
            message: forwardedMessageValue,
            type: forwardedType,
            is_forwarded: true
          })
          .select()
          .single();

        if (msgErr) {
          console.error("Failed to insert forwarded message:", msgErr);
          continue;
        }

        await supabase.from('chat_rooms').update({ last_message_id: insertedMsg.id }).eq('id', roomId);

        if (currentContact && (currentContact.id === contact.id || currentContact.roomId === roomId)) {
          setAllMessages(prev => {
            if (prev.some(x => x.id === insertedMsg.id)) return prev;
            
            let fileMeta = null;
            let text = message.text;
            if (insertedMsg.type === 'file') {
              fileMeta = message.file;
              text = '';
            }

            return [...prev, {
              id: insertedMsg.id,
              senderId: 'me',
              text: text,
              file: fileMeta,
              isForwarded: true,
              timestamp: new Date(insertedMsg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              type: insertedMsg.type || 'text',
              createdAt: insertedMsg.created_at,
              readByUsers: insertedMsg.read_by_users,
              reactions: [],
            }];
          });
        }

        setContacts(prev => {
          const updated = prev.map(c => {
            if (c.id === contact.id || c.roomId === roomId) {
              let preview = '';
              if (insertedMsg.type === 'file') {
                const isImg = message.file?.type?.startsWith('image/');
                preview = `You: sent a ${isImg ? 'image' : 'file'}`;
              } else {
                const cleanText = message.text
                  .replace(/\*([^*]+)\*/g, '$1')
                  .replace(/_([^_]+)_/g, '$1');
                preview = `You: ${cleanText}`;
              }
              return {
                ...c,
                roomId,
                lastMessage: preview,
                timestamp: formatMessageTime(insertedMsg.created_at),
                rawTimestamp: insertedMsg.created_at,
              };
            }
            return c;
          });
          return sortContacts(updated);
        });
      }

      setChatAlert({ type: 'success', message: 'Message forwarded successfully' });
    } catch (err) {
      console.error("Error in handleForwardMessage:", err);
      setChatAlert({ type: 'error', message: 'Failed to forward message' });
    }
  };

  const handleFileUpload = async (file) => {
    if (!currentContact) return;
    try {
      let roomId = currentContact.roomId;
      if (!roomId) {
        const { data: existing } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('type', 'single')
          .contains('participants', [companyUserId, currentContact.id]);

        if (existing && existing.length > 0) {
          roomId = existing[0].id;
        } else {
          const roomName = `${currentUser.name} & ${currentContact.name}`;
          const { data: newRoom, error: roomErr } = await supabase
            .from('chat_rooms')
            .insert({
              type: 'single',
              participants: [companyUserId, currentContact.id],
              created_by: companyUserId,
              name: roomName,
              description: 'Direct message room',
              typing_participants: []
            })
            .select()
            .single();

          if (roomErr) throw roomErr;
          roomId = newRoom.id;
          setContacts(prev => prev.map(c => c.id === currentContact.id ? { ...c, roomId } : c));
          setActiveContact(prev => ({ ...prev, roomId }));
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileId = Math.random().toString(36).substring(2);
      const fileName = `${companyUserId}/${Date.now()}-${fileId}.${fileExt}`;
      const filePath = `chat_documents/${fileName}`;
      
      setUploadingFiles(prev => [...prev, { id: fileId, name: file.name, size: file.size }]);
      try {
        const { error: uploadError } = await supabase.storage.from('chat').upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('chat').getPublicUrl(filePath, { download: file.name });

      const fileMeta = { name: file.name, size: formatBytes(file.size), url: publicUrl, type: file.type };
      
      const { data: newMsg, error: msgErr } = await supabase
        .from('chat_messages')
        .insert({ room_id: roomId, created_by: companyUserId, message: JSON.stringify(fileMeta), type: 'file' })
        .select()
        .single();

      if (msgErr) throw msgErr;

      await supabase.from('chat_rooms').update({ last_message_id: newMsg.id }).eq('id', roomId);

      setAllMessages(prev => {
        if (prev.some(x => x.id === newMsg.id)) return prev;
        return [...prev, {
          id: newMsg.id,
          senderId: 'me',
          text: '',
          file: fileMeta,
          timestamp: new Date(newMsg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          type: 'file',
          createdAt: newMsg.created_at,
        }];
      });

      setContacts(prev => prev.map(c => {
        if (c.id === currentContact.id || c.roomId === roomId) {
          return {
            ...c,
            roomId,
            lastMessage: `You: sent a file`,
            timestamp: formatMessageTime(newMsg.created_at),
          };
        }
        return c;
      }));
      } finally {
        setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
      }
    } catch (err) {
      console.error("Error in handleFileUpload:", err);
      alert("Failed to upload file. Please try again.");
    }
  };

  // Listen to messages for active contact
  useEffect(() => {
    if (!currentContact) return;

    let isMounted = true;

    async function loadMessages() {
      // Clear old messages before fetching new ones so we don't show previous chat
      setAllMessages([]);
      setUnreadMarker(null);
      setIsFetchingChat(true);

      // Captured before anything marks the chat as read (opened by click: snapshot from handleSelect; by URL: current cursor)
      const cursorAtOpen = openSnapshotRef.current.has(currentContact.roomId)
        ? openSnapshotRef.current.get(currentContact.roomId)
        : (cursorsRef.current[currentContact.roomId]?.upTo ?? null);

      if (!currentContact.roomId) {
        setIsFetchingChat(false);
        return;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', currentContact.roomId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error("Error fetching room messages:", error);
        if (isMounted) {
          setIsFetchingChat(false);
        }
        return;
      }

      if (isMounted) {
        const formatted = (data || []).map(m => {
          let fileMeta = null;
          let text = m.message;
          let isForwarded = m.is_forwarded || false;
          if (!isForwarded) {
            if (m.type === 'file') {
              try { fileMeta = JSON.parse(m.message); text = ''; isForwarded = !!fileMeta?.isForwarded; } catch(e) {}
            } else {
              try {
                const parsed = JSON.parse(m.message);
                if (parsed && typeof parsed === 'object' && 'isForwarded' in parsed) {
                  text = parsed.text || '';
                  isForwarded = true;
                }
              } catch (e) {
                if (m.message && m.message.startsWith('[Forwarded]\n')) {
                  text = m.message.substring(12);
                  isForwarded = true;
                }
              }
            }
          } else {
            if (m.type === 'file') {
              try { fileMeta = JSON.parse(m.message); text = ''; } catch(e) {}
            }
          }
          return {
            id: m.id,
            senderId: m.created_by === companyUserId ? 'me' : m.created_by,
            text,
            file: fileMeta,
            isForwarded,
            timestamp: new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: m.type || 'text',
            createdAt: m.created_at,
            readByUsers: m.read_by_users,
            reactions: m.reaction_by_users || [],
            isEdited: m.is_edited,
            isDeleted: m.is_deleted,
            isPinned: m.is_pinned || false,
            replyToMessageId: m.reply_to_message_id,
            isStarred: (m.star_by_users || []).some(s => {
              const parsed = typeof s === 'string' ? JSON.parse(s) : s;
              return parsed?.user_id === companyUserId;
            }),
          };
        });
        // Where the "new messages" divider goes: everything newer than my read cursor as it was when the chat was opened.
        // Rooms without a cursor yet fall back to the old per-message receipts.
        const incoming = formatted.filter(m => m.senderId !== 'me' && !m.isDeleted && !(m.type === 'text' && parseDisappearing(m.text)));
        const unreadIncoming = cursorAtOpen
          ? incoming.filter(m => tsOf(m.createdAt) > tsOf(cursorAtOpen))
          : incoming.filter(m => !(m.readByUsers || []).some(item => {
              const parsed = typeof item === 'string' ? JSON.parse(item) : item;
              return parsed?.user_id === companyUserId;
            }));
        openSnapshotRef.current.delete(currentContact.roomId);
        setUnreadMarker(unreadIncoming.length > 0
          ? { roomId: currentContact.roomId, messageId: unreadIncoming[0].id, count: unreadIncoming.length }
          : null);
        setAllMessages(formatted);
        setIsFetchingChat(false);
      }

      if (document.visibilityState === 'visible' && document.hasFocus()) {
        markMessagesAsRead(currentContact.roomId);
      }
    }

    loadMessages();

    let channel;
    if (currentContact.roomId) {
      channel = supabase.channel(`room-${currentContact.roomId}`);
      activeChannelRef.current = channel;

      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${currentContact.roomId}` },
          (payload) => {
            const m = payload.new;
            if (isMounted) {
              setAllMessages(prev => {
                if (prev.some(x => x.id === m.id)) return prev;
                let fileMeta = null;
                let text = m.message;
                let isForwarded = m.is_forwarded || false;
                if (!isForwarded) {
                  if (m.type === 'file') {
                    try { fileMeta = JSON.parse(m.message); text = ''; isForwarded = !!fileMeta?.isForwarded; } catch(e) {}
                  } else {
                    try {
                      const parsed = JSON.parse(m.message);
                      if (parsed && typeof parsed === 'object' && 'isForwarded' in parsed) {
                        text = parsed.text || '';
                        isForwarded = true;
                      }
                    } catch (e) {
                      if (m.message && m.message.startsWith('[Forwarded]\n')) {
                        text = m.message.substring(12);
                        isForwarded = true;
                      }
                    }
                  }
                } else {
                  if (m.type === 'file') {
                    try { fileMeta = JSON.parse(m.message); text = ''; } catch(e) {}
                  }
                }
                return [
                  ...prev,
                  {
                    id: m.id,
                    senderId: m.created_by === companyUserId ? 'me' : m.created_by,
                    text,
                    file: fileMeta,
                    isForwarded,
                    timestamp: new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    type: m.type || 'text',
                    createdAt: m.created_at,
                    readByUsers: m.read_by_users,
                    reactions: m.reaction_by_users || [],
                    isEdited: m.is_edited,
                    isDeleted: m.is_deleted,
                    isPinned: m.is_pinned || false,
                    replyToMessageId: m.reply_to_message_id,
                    isStarred: (m.star_by_users || []).some(s => {
                      const parsed = typeof s === 'string' ? JSON.parse(s) : s;
                      return parsed?.user_id === companyUserId;
                    }),
                  }
                ];
              });

              if (m.created_by !== companyUserId) {
                if (document.visibilityState === 'visible' && document.hasFocus()) {
                  markMessagesAsRead(currentContact.roomId);
                }
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${currentContact.roomId}` },
          (payload) => {
            const m = payload.new;
            if (isMounted) {
              setAllMessages(prev => prev.map(msg => {
                if (msg.id === m.id) {
                  let fileMeta = null;
                  let text = m.message;
                  let isForwarded = m.is_forwarded || false;
                  if (!isForwarded) {
                    if (m.type === 'file') {
                      try { fileMeta = JSON.parse(m.message); text = ''; isForwarded = !!fileMeta?.isForwarded; } catch(e) {}
                    } else {
                      try {
                        const parsed = JSON.parse(m.message);
                        if (parsed && typeof parsed === 'object' && 'isForwarded' in parsed) {
                          text = parsed.text || '';
                          isForwarded = true;
                        }
                      } catch (e) {
                        if (m.message && m.message.startsWith('[Forwarded]\n')) {
                          text = m.message.substring(12);
                          isForwarded = true;
                        }
                      }
                    }
                  } else {
                    if (m.type === 'file') {
                      try { fileMeta = JSON.parse(m.message); text = ''; } catch(e) {}
                    }
                  }
                  return { 
                    ...msg, 
                    text,
                    file: fileMeta,
                    isForwarded,
                    readByUsers: m.read_by_users, 
                    reactions: m.reaction_by_users || [],
                    isEdited: m.is_edited,
                    isDeleted: m.is_deleted,
                    isPinned: m.is_pinned || false,
                    isStarred: (m.star_by_users || []).some(s => {
                      const parsed = typeof s === 'string' ? JSON.parse(s) : s;
                      return parsed?.user_id === companyUserId;
                    }),
                  };
                }
                return msg;
              }));
            }
          }
        )
        .on(
          'broadcast',
          { event: 'typing' },
          ({ payload }) => {
            const { userId, isTyping } = payload;
            if (isMounted) {
              setTypingUsers(prev => {
                const roomTyping = prev[currentContact.roomId] || [];
                if (isTyping) {
                  if (roomTyping.includes(userId)) return prev;
                  return { ...prev, [currentContact.roomId]: [...roomTyping, userId] };
                } else {
                  return { ...prev, [currentContact.roomId]: roomTyping.filter(id => id !== userId) };
                }
              });

              if (isTyping) {
                if (typingTimeoutsRef.current[userId]) {
                  clearTimeout(typingTimeoutsRef.current[userId]);
                }
                typingTimeoutsRef.current[userId] = setTimeout(() => {
                  setTypingUsers(prev => {
                    const roomTyping = prev[currentContact.roomId] || [];
                    return { ...prev, [currentContact.roomId]: roomTyping.filter(id => id !== userId) };
                  });
                }, 5000);
              }
            }
          }
        )
        .subscribe();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && document.hasFocus() && currentContact?.roomId) {
        markMessagesAsRead(currentContact.roomId);
        if (presenceChannelRef.current) {
            presenceChannelRef.current.track({ user_id: companyUserId, online_at: new Date().toISOString() });
        }
      }
    };
    const handleFocus = () => {
      if (currentContact?.roomId) {
        markMessagesAsRead(currentContact.roomId);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      activeChannelRef.current = null;
      if (channel) supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentContact?.roomId, currentContact?.id, companyUserId, markMessagesAsRead]);

  // Global messages sidebar
  useEffect(() => {
    const globalChannel = supabase
      .channel('global-messages-sidebar')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const m = payload.new;
          setContacts(prev => {
            const exists = prev.some(c => c.roomId === m.room_id);
            if (!exists) {
              if (m.room_id) {
                supabase
                  .from('chat_rooms')
                  .select('*')
                  .eq('id', m.room_id)
                  .single()
                  .then(async ({ data: room }) => {
                    if (!room) return;
                    // Fix: Ensure we are actually a participant in this room before adding it!
                    if (room.participants && !room.participants.includes(companyUserId)) return;
                    
                    let newContact = null;
                    
                    if (room.type === 'group') {
                      let fileLabel = 'sent a file';
                      if (m.type === 'file') {
                        try {
                          const fileMeta = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
                          if (fileMeta?.type?.startsWith('image/')) {
                            fileLabel = 'sent an image';
                          }
                        } catch (e) {}
                      }

                      newContact = {
                        id: room.id,
                        roomId: room.id,
                        name: room.name || 'Group Chat',
                        initials: (room.name || 'GC').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2),
                        color: getUserColor(room.id),
                        status: null,
                        role: 'Channel',
                        lastMessage: m.type === 'file' ? fileLabel : pollPreview(m.message).replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1'),
                        timestamp: formatMessageTime(m.created_at),
                        rawTimestamp: m.created_at,
                        unread: m.created_by !== companyUserId ? 1 : 0,
                        pinned: false,
                        isChannel: true,
                      };
                    } else {
                      const otherId = room.participants.find(p => p !== companyUserId);
                      if (otherId) {
                        const { data: cu } = await supabase
                          .from('company_users')
                          .select('*, users(*)')
                          .eq('id', otherId)
                          .single();
                        
                        if (cu) {
                          let fileLabel = 'sent a file';
                          if (m.type === 'file') {
                            try {
                              const fileMeta = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
                              if (fileMeta?.type?.startsWith('image/')) {
                                  fileLabel = 'sent an image';
                              }
                            } catch (e) {}
                          }

                          newContact = {
                            id: cu.id,
                            roomId: room.id,
                            name: `${cu.users?.first_name || ''} ${cu.users?.last_name || ''}`.trim() || 'Colleague',
                            initials: `${cu.users?.first_name?.[0] || ''}${cu.users?.last_name?.[0] || ''}`.toUpperCase() || '?',
                            color: getUserColor(cu.id),
                            status: cu.is_active ? 'online' : 'offline',
                            role: cu.department || cu.designation || 'Colleague',
                            lastSeen: cu.is_active ? 'Online' : 'Offline',
                            lastMessage: m.type === 'file' ? fileLabel : pollPreview(m.message).replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1'),
                            timestamp: formatMessageTime(m.created_at),
                            rawTimestamp: m.created_at,
                            unread: m.created_by !== companyUserId ? 1 : 0,
                            pinned: false,
                            isChannel: false,
                          };
                        }
                      }
                    }

                    if (newContact) {
                      setContacts(latest => {
                        if (latest.some(x => x.roomId === room.id)) return latest;
                        
                        const existingIdx = latest.findIndex(x => !x.isChannel && x.id === newContact.id);
                        if (existingIdx !== -1) {
                          const updated = [...latest];
                          updated[existingIdx] = { ...updated[existingIdx], ...newContact };
                          return sortContacts(updated);
                        }
                        
                        return sortContacts([newContact, ...latest]);
                      });
                    }
                  });
              }
              return prev;
            }

            const updated = prev.map(c => {
              if (c.roomId === m.room_id) {
                let isForwarded = m.is_forwarded || false;
                let text = m.message;
                if (m.type === 'file') {
                  try {
                    const fileMeta = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
                    const isImg = fileMeta?.type?.startsWith('image/');
                    text = `sent a ${isImg ? 'image' : 'file'}`;
                  } catch (e) {
                    text = 'sent a file';
                  }
                } else {
                  if (!isForwarded && text) {
                    try {
                      const parsed = JSON.parse(text);
                      if (parsed && typeof parsed === 'object' && 'isForwarded' in parsed) {
                        text = parsed.text || '';
                        isForwarded = true;
                      }
                    } catch (e) {
                      if (text.startsWith('[Forwarded]\n')) {
                        text = text.substring(12);
                        isForwarded = true;
                      }
                    }
                  }
                  text = pollPreview(text)
                    .replace(/\*([^*]+)\*/g, '$1')
                    .replace(/_([^_]+)_/g, '$1');
                }

                if (c.isChannel) {
                  const sender = prev.find(x => x.id === m.created_by) || (m.created_by === companyUserId ? currentUser : null);
                  const senderName = sender ? (m.created_by === companyUserId ? 'You' : sender.name.split(' ')[0]) : 'Someone';
                  text = `${senderName}: ${text}`;
                } else if (m.created_by === companyUserId) {
                  text = `You: ${text}`;
                }

                const isIncomingFromOtherRoom = m.created_by !== companyUserId && 
                                                currentContact?.roomId !== m.room_id && 
                                                currentContact?.id !== c.id;

                return {
                  ...c,
                  roomId: m.room_id,
                  lastMessage: text,
                  timestamp: formatMessageTime(m.created_at),
                  rawTimestamp: m.created_at,
                  unread: isIncomingFromOtherRoom ? c.unread + 1 : c.unread,
                };
              }
              return c;
            });
            return sortContacts(updated);
          });

          // Trigger native Chrome push notification for incoming messages
          if (m.created_by !== companyUserId) {
            supabase.from('chat_rooms').select('participants').eq('id', m.room_id).single().then(({ data: roomData }) => {
              if (roomData && roomData.participants && roomData.participants.includes(companyUserId)) {
                if ('Notification' in window && Notification.permission === 'granted' && !isMuteActive(mutesRef.current[m.room_id])) {
                  if (document.visibilityState === 'hidden' || currentContact?.roomId !== m.room_id) {
                    supabase
                      .from('company_users')
                      .select('*, users(*)')
                      .eq('id', m.created_by)
                      .single()
                      .then(({ data: senderData }) => {
                        const senderName = senderData 
                          ? `${senderData.users?.first_name || ''} ${senderData.users?.last_name || ''}`.trim()
                          : 'Someone';
                          
                        const bodyText = m.type === 'file' ? '📁 Sent a file' : m.message;
                        const desktopNotif = new Notification(senderName, {
                          body: bodyText,
                          icon: '/favicon.ico'
                        });

                        desktopNotif.onclick = () => {
                          window.focus();
                          setContacts(latestContacts => {
                            const target = latestContacts.find(c => c.roomId === m.room_id || c.id === m.created_by);
                            if (target) {
                              setTimeout(() => handleSelect(target), 0);
                            }
                            return latestContacts;
                          });
                        };
                      });
                  }
                }
              }
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const m = payload.new;
          setContacts(prev => {
            const updated = prev.map(c => {
              if (c.roomId === m.room_id && c.rawTimestamp === m.created_at) {
                let isForwarded = m.is_forwarded || false;
                let text = m.message;
                if (m.type === 'file') {
                  try {
                    const fileMeta = typeof m.message === 'string' ? JSON.parse(m.message) : m.message;
                    const isImg = fileMeta?.type?.startsWith('image/');
                    text = `sent a ${isImg ? 'image' : 'file'}`;
                  } catch (e) {
                    text = 'sent a file';
                  }
                } else {
                  if (!isForwarded && text) {
                    try {
                      const parsed = JSON.parse(text);
                      if (parsed && typeof parsed === 'object' && 'isForwarded' in parsed) {
                        text = parsed.text || '';
                        isForwarded = true;
                      }
                    } catch (e) {
                      if (text && text.startsWith('[Forwarded]\n')) {
                        text = text.substring(12);
                        isForwarded = true;
                      }
                    }
                  }
                  text = pollPreview(text || '')
                    .replace(/\*([^*]+)\*/g, '$1')
                    .replace(/_([^_]+)_/g, '$1');
                }
                
                if (c.isChannel) {
                  const sender = prev.find(x => x.id === m.created_by) || (m.created_by === companyUserId ? currentUser : null);
                  const senderName = sender ? (m.created_by === companyUserId ? 'You' : sender.name.split(' ')[0]) : 'Someone';
                  text = `${senderName}: ${text}`;
                } else if (m.created_by === companyUserId) {
                  text = `You: ${text}`;
                }
                
                return {
                  ...c,
                  lastMessage: text,
                };
              }
              return c;
            });
            return updated;
          });
        }
      )
      .subscribe();

    return () => supabase.removeChannel(globalChannel);
  }, [currentUser, currentContact, companyUserId, handleSelect]);

  // Realtime rooms
  useEffect(() => {
    if (!companyUserId) return;
    const roomsChannel = supabase
      .channel('realtime-rooms')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_rooms' },
        async (payload) => {
          const newRoom = payload.new;
          if (newRoom.participants.includes(companyUserId)) {
            if (newRoom.type === 'group') {
              const newGC = {
                id: newRoom.id,
                roomId: newRoom.id,
                name: newRoom.name || 'Group Chat',
                initials: (newRoom.name || 'GC').split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2),
                color: getUserColor(newRoom.id),
                status: null,
                role: 'Channel',
                lastMessage: 'No messages yet',
                timestamp: '',
                rawTimestamp: newRoom.created_at,
                unread: 0,
                pinned: false,
                isChannel: true,
              };
              setContacts(prev => sortContacts([newGC, ...prev]));
            } else {
              const otherId = newRoom.participants.find(p => p !== companyUserId);
              if (otherId) {
                setContacts(prev => prev.map(c => {
                  if (c.id === otherId) return { ...c, roomId: newRoom.id };
                  return c;
                }));
              }
            }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(roomsChannel);
  }, [companyUserId]);

  // Realtime notifications
  useEffect(() => {
    if (!companyUserId) return;
    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${companyUserId}` },
        async (payload) => {
          if (payload.eventType === 'UPDATE') {
            setNotifications(prev => prev.map(n => n.id === payload.new.id ? { ...n, isRead: payload.new.is_read } : n));
            return;
          }

          if (payload.eventType === 'INSERT') {
            const newNotif = payload.new;
            // Someone read my messages: update "Seen by" / ticks live
            if (newNotif.action === RECEIPT_ACTION) {
              setPeerReceipts(prev => addReceipt(prev, newNotif));
              return;
            }
            const act = (newNotif.action || '').toLowerCase();
            if (!act.includes('mention') && !act.includes('react')) return;

            try {
              const { data: senderData } = await supabase
                .from('company_users')
                .select('*, users(*)')
                .eq('id', newNotif.sender_id)
                .single();

              let previewText = newNotif.preview;
              if (previewText && previewText.trim().startsWith('{')) {
                try {
                  const parsed = JSON.parse(previewText);
                  previewText = parsed.text || parsed.name || previewText;
                } catch (e) {}
              }

              const formatted = {
                id: newNotif.id,
                name: `${senderData?.users?.first_name || 'Someone'}`,
                action: newNotif.action,
                preview: previewText,
                time: formatMessageTime(newNotif.created_at),
                color: getUserColor(newNotif.sender_id),
                initial: `${senderData?.users?.first_name?.[0] || '?'}${senderData?.users?.last_name?.[0] || ''}`.toUpperCase(),
                emoji: newNotif.emoji || '🔔',
                isRead: newNotif.is_read,
                linkId: newNotif.link_id,
                createdAt: newNotif.created_at,
              };

              setNotifications(prev => [formatted, ...prev]);

            // Trigger Chrome notification for mentions/reactions
            // Muted chats still notify for @mentions, but not for reactions
            const mutedReaction = act.includes('react') && isMuteActive(mutesRef.current[newNotif.link_id]);
            if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState === 'hidden' && !mutedReaction) {
              const bodyText = `${formatted.emoji} ${formatted.action}: "${formatted.preview}"`;
              const desktopNotif = new Notification(formatted.name, {
                body: bodyText,
                icon: '/favicon.ico'
              });
              desktopNotif.onclick = () => {
                window.focus();
                setTimeout(() => {
                  setActiveNav('notifications');
                }, 0);
              };
            }
          } catch (err) {
            console.error("Error formatting real-time notification:", err);
          }
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [companyUserId, setActiveNav]);

  const handleSendPoll = async ({ question, options, multi }) => {
    await handleSend(buildPollMessage({ question, options, multi }), []);
  };

  // Votes are stored as { user_id, reaction: "poll:<idx>" } entries in reaction_by_users.
  // Single-choice polls keep one entry per user; multi-choice polls keep one per chosen option.
  const handleVotePoll = async (messageId, optionIdx) => {
    try {
      const { data: msg, error: fetchErr } = await supabase
        .from('chat_messages')
        .select('reaction_by_users, message')
        .eq('id', messageId)
        .single();
      if (fetchErr) throw fetchErr;

      const poll = parsePoll(msg.message);
      if (!poll || optionIdx < 0 || optionIdx >= poll.options.length) return;

      const key = `${POLL_VOTE_PREFIX}${optionIdx}`;
      const entries = (msg.reaction_by_users || []).map(r => (typeof r === 'string' ? JSON.parse(r) : r));
      const isMyVote = (r) => r?.user_id === companyUserId && String(r?.reaction).startsWith(POLL_VOTE_PREFIX);
      const alreadyVoted = entries.some(r => isMyVote(r) && r.reaction === key);

      let updated;
      if (alreadyVoted) {
        updated = entries.filter(r => !(isMyVote(r) && r.reaction === key));
      } else if (poll.multi) {
        updated = [...entries, { user_id: companyUserId, reaction: key, reacted_at: new Date().toISOString() }];
      } else {
        updated = [
          ...entries.filter(r => !isMyVote(r)),
          { user_id: companyUserId, reaction: key, reacted_at: new Date().toISOString() },
        ];
      }

      const { error: updateErr } = await supabase
        .from('chat_messages')
        .update({ reaction_by_users: updated })
        .eq('id', messageId);
      if (updateErr) throw updateErr;

      setAllMessages(prev => prev.map(m => (m.id === messageId ? { ...m, reactions: updated } : m)));
    } catch (err) {
      console.error('Error voting on poll:', err);
      setChatAlert({ message: 'Could not save your vote. Please try again.' });
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    try {
      const { data: msg, error: fetchErr } = await supabase
        .from('chat_messages')
        .select('reaction_by_users, created_by, room_id, message, type')
        .eq('id', messageId)
        .single();

      if (fetchErr) throw fetchErr;

      let currentReactions = msg.reaction_by_users || [];
      
      const existingIdx = currentReactions.findIndex(r => {
        const parsed = typeof r === 'string' ? JSON.parse(r) : r;
        return parsed?.user_id === companyUserId;
      });

      let updatedReactions = [];
      if (existingIdx !== -1) {
        const parsed = typeof currentReactions[existingIdx] === 'string'
          ? JSON.parse(currentReactions[existingIdx])
          : currentReactions[existingIdx];

        if (parsed?.reaction === emoji) {
          updatedReactions = currentReactions.filter((_, idx) => idx !== existingIdx);
        } else {
          updatedReactions = [...currentReactions];
          updatedReactions[existingIdx] = { user_id: companyUserId, reaction: emoji, reacted_at: new Date().toISOString() };
        }
      } else {
        updatedReactions = [...currentReactions, { user_id: companyUserId, reaction: emoji, reacted_at: new Date().toISOString() }];
      }

      const { error: updateErr } = await supabase
        .from('chat_messages')
        .update({ reaction_by_users: updatedReactions })
        .eq('id', messageId);

      if (updateErr) throw updateErr;

      setAllMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, reactions: updatedReactions };
        }
        return m;
      }));

      // Insert notification if reaction was added (and not by the message author)
      if (existingIdx === -1 && msg.created_by && msg.created_by !== companyUserId) {
        let msgPreview = msg.message;
        if (msgPreview && msgPreview.trim().startsWith('{')) {
          try {
            const meta = JSON.parse(msgPreview);
            msgPreview = meta.text || meta.name || msgPreview;
          } catch (e) {}
        }

        if (msg.type === 'file') {
           try {
             const meta = JSON.parse(msg.message);
             msgPreview = meta.name || 'a file';
           } catch(e) { msgPreview = 'a file'; }
        } else {
           msgPreview = (msgPreview || '').substring(0, 100);
        }
        
        supabase.from('notifications').insert({
          recipient_id: msg.created_by,
          sender_id: companyUserId,
          action: 'Reacted To Your Message',
          preview: msgPreview,
          emoji: emoji,
          link_id: msg.room_id || currentContact?.roomId
        }).then(({error}) => {
          if (error) console.error("Error inserting reaction notification", error);
        });
      }

    } catch (err) {
      console.error("Error in handleToggleReaction:", err);
    }
  };

  const handleEditMessage = async (messageId, newText) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ message: newText, is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) throw error;

      setAllMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, text: newText, isEdited: true };
        }
        return m;
      }));
    } catch (err) {
      console.error("Error editing message:", err);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          is_pinned: false
        })
        .eq('id', messageId);

      if (error) throw error;

      setAllMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, isDeleted: true, isPinned: false };
        }
        return m;
      }));
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  // Disappearing messages: the timer is a system message (see utils/disappearing.js); set it for this chat.
  const handleSetDisappearing = async (secs) => {
    await handleSend(buildDisappearingMessage(secs), [], { skipQuote: true });
  };

  // Sender-side cleanup: soft-delete my own messages once they expire so they vanish for everyone (even after reload).
  // Every client also hides expired messages on its own, so this only matters for permanence.
  const [expiryTick, setExpiryTick] = useState(0);
  const failedExpiryIdsRef = useRef(new Set());
  useEffect(() => {
    const { expiresAt } = computeExpiries(allMessages);
    const mine = allMessages.filter(m => m.senderId === 'me' && !m.isDeleted && expiresAt.has(m.id) && !failedExpiryIdsRef.current.has(m.id));
    if (mine.length === 0) return;

    const now = Date.now();
    const due = mine.filter(m => expiresAt.get(m.id) <= now).map(m => m.id);
    if (due.length > 0) {
      supabase
        .from('chat_messages')
        .update({ is_deleted: true, deleted_at: new Date().toISOString(), is_pinned: false })
        .in('id', due)
        .then(({ error }) => {
          if (error) {
            console.error('Error expiring messages:', error);
            due.forEach(id => failedExpiryIdsRef.current.add(id));
            return;
          }
          setAllMessages(prev => prev.map(m => (due.includes(m.id) ? { ...m, isDeleted: true, isPinned: false } : m)));
        });
      return;
    }

    const next = Math.min(...mine.map(m => expiresAt.get(m.id)));
    const timer = setTimeout(() => setExpiryTick(t => t + 1), Math.min(Math.max(next - now + 100, 100), 2147483647));
    return () => clearTimeout(timer);
  }, [allMessages, expiryTick]);

  const handleToggleStar = async (messageId) => {
    try {
      const { data: msg, error: fetchErr } = await supabase
        .from('chat_messages')
        .select('star_by_users')
        .eq('id', messageId)
        .single();

      if (fetchErr) throw fetchErr;

      let currentStars = msg.star_by_users || [];
      const exists = currentStars.some(s => {
        const parsed = typeof s === 'string' ? JSON.parse(s) : s;
        return parsed?.user_id === companyUserId;
      });

      let updatedStars = [];
      if (exists) {
        updatedStars = currentStars.filter(s => {
          const parsed = typeof s === 'string' ? JSON.parse(s) : s;
          return parsed?.user_id !== companyUserId;
        });
      } else {
        updatedStars = [...currentStars, { user_id: companyUserId }];
      }

      const { error: updateErr } = await supabase
        .from('chat_messages')
        .update({ star_by_users: updatedStars })
        .eq('id', messageId);

      if (updateErr) throw updateErr;

      setAllMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, isStarred: !exists };
        }
        return m;
      }));

      setChatAlert({
        type: 'success',
        message: exists ? 'Message unstarred' : 'Message starred'
      });
    } catch (err) {
      console.error("Error toggling star:", err);
    }
  };

  const handleTogglePin = async (messageId) => {
    try {
      const currentRoomId = currentContact?.roomId;
      if (!currentRoomId) return;

      const msgToToggle = allMessages.find(m => m.id === messageId);
      if (!msgToToggle) return;

      const isCurrentlyPinned = msgToToggle.isPinned;
      const originalMessages = [...allMessages];

      // Optimistic update
      setAllMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, isPinned: !isCurrentlyPinned };
        } else if (m.isPinned) {
          return { ...m, isPinned: false };
        }
        return m;
      }));

      // Call RPC function atomically
      const { error } = await supabase.rpc('toggle_pinned_message', {
        p_room_id: currentRoomId,
        p_message_id: messageId
      });

      if (error) {
        // Rollback on error
        setAllMessages(originalMessages);
        throw error;
      }

      setChatAlert({
        type: 'success',
        message: isCurrentlyPinned ? 'Message unpinned' : 'Message pinned'
      });
    } catch (err) {
      console.error("Error toggling pin:", err);
      setChatAlert({
        type: 'error',
        message: 'Failed to update pin status'
      });
    }
  };

  const handleCreateGroup = async (name, participantIds) => {
    try {
      const { data: newRoom, error } = await supabase
        .from('chat_rooms')
        .insert({
          type: 'group',
          name,
          participants: [companyUserId, ...participantIds],
          created_by: companyUserId,
          typing_participants: []
        })
        .select()
        .single();
      
      if (error) throw error;
      return newRoom;
    } catch (err) {
      console.error("Error creating group:", err);
      throw err;
    }
  };

  const handleAddParticipantToGroup = async (roomId, userId) => {
    try {
      const room = contacts.find(c => c.roomId === roomId);
      if (!room || !room.isChannel) return;
      
      const updatedParticipants = [...(room.participants || []), userId];
      
      const { error } = await supabase
        .from('chat_rooms')
        .update({ participants: updatedParticipants })
        .eq('id', roomId);
        
      if (error) throw error;
      
      // Update local state
      setContacts(prev => prev.map(c => 
        c.roomId === roomId 
          ? { ...c, participants: updatedParticipants }
          : c
      ));
      
      setChatAlert({ type: 'success', message: 'User added to chat' });
    } catch (err) {
      console.error("Error adding participant:", err);
      setChatAlert({ type: 'error', message: 'Failed to add user to chat' });
    }
  };

  const value = {
    companyUserId,
    activeNav, setActiveNav,
    contacts, setContacts,
    activeContact, setActiveContact,
    activeTab, setActiveTab,
    allMessages,
    loading,
    notifications, setNotifications,
    viewingFile, setViewingFile,
    currentUser, currentContact,
    activeRoomTypingUsers,
    chatAlert, setChatAlert,
    isSearchOpen, setIsSearchOpen,
    editingMessage, setEditingMessage,
    showEditTimeLimitModal, setShowEditTimeLimitModal,
    quoteMessage, setQuoteMessage,
    forwardingMessage, setForwardingMessage,
    isFetchingChat, setIsFetchingChat,
    scrollToMessageId, setScrollToMessageId,
    uploadingFiles,
    onlineUsers,
    unreadMarker,
    drafts, saveDraft,
    markNotificationAsRead, markAllNotificationsAsRead,
    handleMarkUnread, handleMarkRead, getMessageReceipts,
    isRoomMuted, handleMuteChat,
    selectedIds, startSelect, toggleSelect, clearSelect,
    handleSendPoll, handleVotePoll, handleSetDisappearing,
    handleSend, handleFileUpload, handleSelect, sendTypingStatus, handleCreateGroup, handleToggleReaction,
    handleEditMessage, handleDeleteMessage, handleToggleStar, handleForwardMessage, handleTogglePin, handleAddParticipantToGroup,
    globalSharedFile, setGlobalSharedFile
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
