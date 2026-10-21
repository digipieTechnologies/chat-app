import { useState } from 'react';
import { X, Search, Check, Users } from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from '../ui/Avatar';

export function CreateGroupModal({ isOpen, onClose, contacts, onCreate }) {
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Filter out channels so we only show direct contacts (company users)
  const users = contacts.filter(c => !c.isChannel);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name");
      return;
    }
    if (selectedIds.length === 0) {
      alert("Please select at least one participant");
      return;
    }
    
    setLoading(true);
    try {
      await onCreate(groupName.trim(), selectedIds);
      onClose();
      setGroupName('');
      setSelectedIds([]);
      setSearchQuery('');
    } catch (error) {
      console.error("Failed to create group:", error);
      alert("Failed to create group. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-full md:max-w-[420px] z-50 bg-white shadow-2xl flex flex-col animate-slide-in-right border-l border-[#e2e8f0]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e2e8f0]">
          <h2 className="text-[16px] font-bold text-[#0f172a] flex items-center gap-2">
            <Users size={18} className="text-[#4f46e5]" />
            New Group Chat
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 overflow-hidden p-6 gap-6">
          {/* Group Name Input */}
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-[#0f172a]">Channel Name</label>
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. Marketing Team"
              className="w-full px-3 py-2.5 bg-white border border-[#cbd5e1] rounded-lg text-[13px] text-[#0f172a]
                         placeholder:text-[#94a3b8] focus:outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] transition-all"
            />
          </div>

          {/* Members Selection */}
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-3">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-semibold text-[#0f172a]">Add Members</label>
              <span className="text-[12px] font-medium text-[#64748b]">{selectedIds.length} selected</span>
            </div>
            
            {/* Search Box */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg focus-within:border-[#4f46e5] transition-colors">
              <Search size={15} className="text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Search colleagues..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[13px] outline-none text-[#0f172a] placeholder:text-[#94a3b8]"
              />
            </div>

            {/* User List */}
            <div className="flex-1 min-h-0 overflow-y-auto border border-[#e2e8f0] rounded-lg mt-1 p-1">
              {filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#94a3b8]">
                  <span className="text-[13px]">No users found</span>
                </div>
              ) : (
                filteredUsers.map(user => {
                  const isSelected = selectedIds.includes(user.id);
                  return (
                    <div 
                      key={user.id}
                      onClick={() => toggleSelect(user.id)}
                      className={clsx(
                        'flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors border-b border-transparent',
                        isSelected ? 'bg-[#f1f5f9]' : 'hover:bg-[#f8fafc] border-b-[#f1f5f9]'
                      )}
                    >
                      <Avatar initials={user.initials} color={user.color} size="sm" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[13.5px] font-semibold text-[#0f172a] truncate">{user.name}</span>
                        <span className="text-[12px] text-[#64748b] truncate">{user.role}</span>
                      </div>
                      <div className={clsx(
                        'w-5 h-5 rounded-full flex items-center justify-center border transition-all',
                        isSelected ? 'bg-[#4f46e5] border-[#4f46e5] text-white' : 'border-[#cbd5e1] bg-white'
                      )}>
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-[#e2e8f0] bg-[#f8fafc] flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-[13px] font-semibold text-[#475569] bg-white border border-[#cbd5e1] hover:bg-[#f8fafc] hover:text-[#0f172a] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-6 py-2 rounded-lg text-[13px] font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] transition-colors
                       disabled:opacity-70 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>

      </div>
    </>
  );
}
