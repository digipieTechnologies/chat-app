import { useState, useEffect } from 'react';
import { Star, FolderOpen, MessageSquare, Search, ChevronLeft, Timer, Check } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from './ui/Avatar';
import { ContactDetailsDrawer } from './chat/ContactDetailsDrawer';
import { useChat } from '../context/ChatContext';
import { supabase } from '../lib/supabase';
import { DISAPPEAR_OPTIONS, computeExpiries, durationLabel } from '../utils/disappearing';

const TABS = [
  { id: 'chat',    icon: MessageSquare, label: 'Chat'    },
  { id: 'files',   icon: FolderOpen,    label: 'Files'   },
  { id: 'starred', icon: Star,          label: 'Starred' },
];

const STATUS_LABEL = { online: 'Active now', busy: 'Do not disturb', away: 'Away', offline: 'Offline' };
const STATUS_COLOR = { online: 'text-[#2eb67d]', busy: 'text-[#e01e5a]', away: 'text-[#ecb22e]', offline: 'text-[#94a3b8]' };

export function ChatHeader({ contact, activeTab, onTabChange }) {
  const [showDetails, setShowDetails] = useState(false);
  const { isSearchOpen, setIsSearchOpen, setActiveContact, onlineUsers, allMessages, handleSetDisappearing } = useChat();
  const [timerMenuOpen, setTimerMenuOpen] = useState(false);
  const disappearSecs = computeExpiries(allMessages).currentSecs;

  useEffect(() => {
    if (!timerMenuOpen) return;
    const close = () => setTimerMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [timerMenuOpen]);

  const [lastSeen, setLastSeen] = useState(null);
  const [hrmsStatus, setHrmsStatus] = useState(null);
  const [isLoadingPresence, setIsLoadingPresence] = useState(true);

  useEffect(() => {
    if (!contact || contact.isChannel) return;

    let isMounted = true;
    setIsLoadingPresence(true);
    async function fetchUserData() {
      try {
        const { data: user } = await supabase
          .from('company_users')
          .select('last_seen')
          .eq('id', contact.id)
          .single();
        
        if (isMounted && user?.last_seen) {
          setLastSeen(user.last_seen);
        }

        const { data: att } = await supabase
          .from('attendance')
          .select('status')
          .eq('company_user_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (isMounted && att && att.length > 0) {
          setHrmsStatus(att[0].status);
        } else if (isMounted) {
          setHrmsStatus('Not Clocked In');
        }
      } catch (err) {
        console.error("Error fetching presence/HRMS info:", err);
      } finally {
        if (isMounted) setIsLoadingPresence(false);
      }
    }

    fetchUserData();

    // Optionally set up realtime subscriptions for these tables here
    return () => { isMounted = false; };
  }, [contact]);

  if (!contact) return null;

  const formatLastSeen = (dateString) => {
    if (!dateString) return 'Offline';
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear();

    const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (isToday) return `Last seen today at ${timeString}`;
    if (isYesterday) return `Last seen yesterday at ${timeString}`;
    return `Last seen ${date.toLocaleDateString([], { day: 'numeric', month: 'short', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })} at ${timeString}`;
  };

  const isOnline = contact.isChannel ? false : (onlineUsers && onlineUsers[contact.id]);

  let displayStatus = '';
  if (contact.isChannel) {
    displayStatus = `${contact.name} · Channel`;
  } else if (isOnline) {
    displayStatus = 'Online';
  } else if (isLoadingPresence) {
    displayStatus = 'Updating...';
  } else {
    displayStatus = formatLastSeen(lastSeen);
  }

  const getHrmsBadgeColor = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'clocked in': return 'bg-emerald-100 text-emerald-700';
      case 'clocked out': return 'bg-red-100 text-red-700';
      case 'on break': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="flex flex-col border-b border-[#e2e8f0] bg-white flex-shrink-0">
      {/* Top Info */}
      <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-2 hover:bg-[#f8fafc] transition-colors rounded-t-xl cursor-pointer">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button 
            className="md:hidden p-1 -ml-2 mr-1 text-[#64748b] hover:bg-[#e2e8f0] rounded-lg transition-colors flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setActiveContact(null);
            }}
          >
            <ChevronLeft size={22} />
          </button>
          
          <div 
            className="flex items-center gap-2 md:gap-3 min-w-0"
            onClick={() => setShowDetails(true)}
          >
        <Avatar
          initials={contact.initials}
          color={contact.color}
          status={contact.status}
          size="md"
          borderColor="#ffffff"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-bold text-[#0f172a] truncate leading-tight">
              {contact.name}
            </h2>
            {contact.role && (
              <>
                <span className="text-[#cbd5e1] text-[10px]">·</span>
                <span className="text-[12px] text-[#64748b] truncate hidden sm:block font-medium">{contact.role}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 min-w-0">
            <p className={clsx('text-[11px] font-medium truncate', isOnline ? 'text-[#2eb67d]' : 'text-[#94a3b8]')}>
              {displayStatus}
            </p>
            {!contact.isChannel && hrmsStatus && (
              <span className={clsx("px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider flex-shrink-0", getHrmsBadgeColor(hrmsStatus))}>
                {hrmsStatus}
              </span>
            )}
          </div>
        </div>
        </div>
        </div>
        
        <div className="flex items-center gap-1 ml-2 md:ml-4">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTimerMenuOpen(v => !v);
              }}
              title={disappearSecs > 0 ? `Disappearing messages: ${durationLabel(disappearSecs)}` : 'Disappearing messages'}
              className={clsx(
                "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                disappearSecs > 0 || timerMenuOpen ? "bg-[#eef2ff] text-[#4f46e5]" : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]"
              )}
            >
              <Timer size={17} strokeWidth={2.5} />
            </button>

            {timerMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 z-50 w-[210px] bg-white border border-[#e2e8f0] rounded-lg shadow-lg py-1 animate-scale-in cursor-default"
              >
                <div className="px-3 pt-1.5 pb-1">
                  <p className="text-[12px] font-bold text-[#0f172a]">Disappearing messages</p>
                  <p className="text-[11px] text-[#64748b] leading-snug mt-0.5">New messages in this chat will disappear after the time you pick.</p>
                </div>
                {DISAPPEAR_OPTIONS.map(opt => (
                  <button
                    key={opt.secs}
                    onClick={() => {
                      setTimerMenuOpen(false);
                      if (opt.secs !== disappearSecs) handleSetDisappearing(opt.secs);
                    }}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-left text-[12px] text-[#475569] hover:bg-slate-50 transition-colors font-medium"
                  >
                    {opt.label}
                    {opt.secs === disappearSecs && <Check size={13} className="text-[#4f46e5]" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSearchOpen(!isSearchOpen);
              if (!isSearchOpen && activeTab !== 'chat') {
                onTabChange('chat');
              }
            }}
            className={clsx(
              "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
              isSearchOpen ? "bg-[#eef2ff] text-[#4f46e5]" : "text-[#64748b] hover:text-[#0f172a] hover:bg-[#e2e8f0]"
            )}
          >
            <Search size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5">
        {TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold border-b-[2px] transition-all duration-150 cursor-pointer',
              activeTab === id
                ? 'border-[#4f46e5] text-[#4f46e5]'
                : 'border-transparent text-[#64748b] hover:text-[#0f172a]'
            )}
          >
            <Icon size={14} strokeWidth={2.5} />
            {label}
          </button>
        ))}
      </div>

      <ContactDetailsDrawer 
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        contact={contact}
      />
    </div>
  );
}
