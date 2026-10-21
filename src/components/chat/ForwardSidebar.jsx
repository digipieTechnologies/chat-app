import { useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { Avatar } from '../ui/Avatar';
import clsx from 'clsx';

export function ForwardSidebar() {
  const { 
    contacts, 
    forwardingMessage, 
    setForwardingMessage,
    handleForwardMessage,
    clearSelect
  } = useChat();

  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState([]);

  if (!forwardingMessage) return null;

  // Filter contacts by search query
  const filtered = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleSelect = (contact) => {
    setSelected(prev => {
      const exists = prev.some(x => x.id === contact.id);
      if (exists) {
        return prev.filter(x => x.id !== contact.id);
      } else {
        return [...prev, contact];
      }
    });
  };

  const handleRemoveChip = (contactId) => {
    setSelected(prev => prev.filter(x => x.id !== contactId));
  };

  // forwardingMessage is one message, or { __multi: true, messages: [...] } when forwarding a selection
  const isMulti = !!forwardingMessage.__multi;

  const handleSendForward = async () => {
    if (selected.length === 0) return;
    const targets = selected;
    const toSend = isMulti ? forwardingMessage.messages : [forwardingMessage];
    setForwardingMessage(null);
    setSelected([]);
    if (isMulti) clearSelect();
    // Sequential, oldest first, so the forwarded messages keep their order
    for (const message of toSend) {
      await handleForwardMessage(message, targets);
    }
  };

  return (
    <div className="w-full md:w-[320px] bg-white border-l border-[#e2e8f0] h-[100dvh] flex flex-col flex-shrink-0 animate-slide-left z-40 relative shadow-md">
      
      {/* Title Header */}
      <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-[#0f172a]">
          {isMulti ? `Forward ${forwardingMessage.messages.length} messages` : 'Forward Message'}
        </h2>
        <button 
          onClick={() => setForwardingMessage(null)}
          className="text-[#94a3b8] hover:text-[#475569] transition-colors p-1 rounded-lg hover:bg-slate-50"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#f8fafc] border border-[#e2e8f0] rounded-xl pl-9 pr-4 py-2 text-[13px] text-[#0f172a] outline-none focus:border-indigo-400 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Selected Chips Horizontal Row */}
      {selected.length > 0 && (
        <div className="px-4 py-2 border-b border-[#e2e8f0]/80 flex gap-2.5 overflow-x-auto no-scrollbar max-h-[85px] bg-[#f8fafc]/50">
          {selected.map(contact => (
            <div key={contact.id} className="flex flex-col items-center flex-shrink-0 relative group w-12 pt-1">
              <div className="relative">
                <Avatar 
                  initials={contact.initials} 
                  color={contact.color} 
                  size="sm" 
                  borderColor="#ffffff" 
                />
                <button
                  onClick={() => handleRemoveChip(contact.id)}
                  className="absolute -top-1 -right-1 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center shadow-xs transition-transform hover:scale-105"
                >
                  <X size={8} strokeWidth={3} />
                </button>
              </div>
              <span className="text-[9px] text-[#64748b] font-medium truncate w-full text-center mt-1">
                {contact.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Scrollable Contacts List */}
      <div className="flex-1 overflow-y-auto py-2">
        {filtered.length === 0 ? (
          <div className="text-center text-[12px] text-[#94a3b8] py-8">
            No contacts found
          </div>
        ) : (
          filtered.map(contact => {
            const isSelected = selected.some(x => x.id === contact.id);
            return (
              <div
                key={contact.id}
                onClick={() => handleToggleSelect(contact)}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar 
                    initials={contact.initials} 
                    color={contact.color} 
                    size="sm" 
                    borderColor="#ffffff" 
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#0f172a] truncate">{contact.name}</p>
                    <p className="text-[10px] text-[#94a3b8] truncate mt-0.5">{contact.role}</p>
                  </div>
                </div>

                {/* Checkmark Selection Circle */}
                <div 
                  className={clsx(
                    "w-5 h-5 rounded-full flex items-center justify-center transition-all border shrink-0 select-none",
                    isSelected 
                      ? "bg-emerald-500 border-emerald-500 text-white" 
                      : "border-slate-200 bg-white text-transparent hover:border-slate-400"
                  )}
                >
                  <Check size={10} strokeWidth={3} className={clsx(!isSelected && "opacity-0")} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Controls */}
      <div className="p-4 border-t border-[#e2e8f0] flex items-center gap-3 bg-white">
        <button
          onClick={() => {
            setForwardingMessage(null);
            setSelected([]);
          }}
          className="flex-1 border border-[#e2e8f0] hover:bg-slate-50 text-[#475569] font-semibold text-[13px] py-2 rounded-xl transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSendForward}
          disabled={selected.length === 0}
          className={clsx(
            "flex-1 font-semibold text-[13px] py-2 rounded-xl text-white transition-all",
            selected.length === 0 
              ? "bg-[#cbd5e1] cursor-not-allowed" 
              : "bg-[#007eff] hover:bg-[#006edf] hover:scale-101 shadow-sm"
          )}
        >
          Send
        </button>
      </div>

    </div>
  );
}
