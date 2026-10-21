import { useState, useEffect } from 'react';
import { X, Users, Mail, Building2, UserCircle2, Phone, BadgeInfo, Heart, MessageSquare, Copy, UserMinus, UserPlus, Search } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import clsx from 'clsx';
import { supabase } from '../../lib/supabase';
import { Avatar } from '../ui/Avatar';
import { getUserColor } from '../../utils/helpers';

export function ContactDetailsDrawer({ isOpen, onClose, contact }) {
  const { contacts } = useChat();
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [userDetails, setUserDetails] = useState(null);
  
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');

  const handleRemoveMember = async (memberId) => {
    if (!contact?.roomId) return;
    try {
      // Create new array of participant IDs excluding the removed member
      const currentIds = participants.map(p => p.id);
      const newParticipantIds = currentIds.filter(id => id !== memberId);
      
      const { error } = await supabase
        .from('chat_rooms')
        .update({ participants: newParticipantIds })
        .eq('id', contact.roomId);

      if (error) throw error;

      // Optimistically update the UI
      setParticipants(prev => prev.filter(p => p.id !== memberId));
    } catch (err) {
      console.error("Failed to remove member:", err);
      alert("Failed to remove member. Please try again.");
    }
  };

  const handleAddMember = async (memberId) => {
    if (!contact?.roomId) return;
    try {
      const currentIds = participants.map(p => p.id);
      if (currentIds.includes(memberId)) return;
      
      const newParticipantIds = [...currentIds, memberId];
      
      const { error } = await supabase
        .from('chat_rooms')
        .update({ participants: newParticipantIds })
        .eq('id', contact.roomId);

      if (error) throw error;

      // Optimistically update the UI by finding the user in contacts
      const userToAdd = contacts.find(c => c.id === memberId);
      if (userToAdd) {
        setParticipants(prev => [...prev, {
          id: userToAdd.id,
          name: userToAdd.name,
          initials: userToAdd.initials,
          color: userToAdd.color,
          role: userToAdd.role || 'Member',
          status: userToAdd.status
        }]);
      }
      setIsAddingMember(false);
      setAddSearchQuery('');
    } catch (err) {
      console.error("Failed to add member:", err);
      alert("Failed to add member. Please try again.");
    }
  };

  useEffect(() => {
    if (!isOpen || !contact) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        if (contact.isChannel && contact.roomId) {
          const { data: room } = await supabase
            .from('chat_rooms')
            .select('participants')
            .eq('id', contact.roomId)
            .single();

          if (room && room.participants) {
            const { data: users } = await supabase
              .from('company_users')
              .select('*, users(*)')
              .in('id', room.participants);
            
            if (users) {
              const formattedUsers = users.map(cu => ({
                id: cu.id,
                name: `${cu.users?.first_name || ''} ${cu.users?.last_name || ''}`.trim() || 'Colleague',
                initials: `${cu.users?.first_name?.[0] || ''}${cu.users?.last_name?.[0] || ''}`.toUpperCase() || '?',
                color: getUserColor(cu.id),
                role: cu.department || cu.designation || 'Member',
                status: cu.is_active ? 'online' : 'offline',
              }));
              setParticipants(formattedUsers);
            }
          }
        } else if (!contact.isChannel && contact.id) {
          // Fetch additional details for single user
          const { data: cu } = await supabase
            .from('company_users')
            .select('*, users(*)')
            .eq('id', contact.id)
            .single();
            
          if (cu) {
            setUserDetails({
              email: cu.users?.email,
              mobile: cu.users?.mobile_number,
              empCode: cu.employee_code,
              department: cu.department,
              designation: cu.designation,
              empType: cu.employee_type
            });
          }
        }
      } catch (error) {
        console.error("Failed to fetch details:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [isOpen, contact]);

  if (!isOpen || !contact) return null;

  return (
    <>
      <div 
        className="fixed inset-0 z-40 bg-black/5 animate-fade-in"
        onClick={onClose}
      />
      
      <div className="fixed top-0 right-0 h-full w-full max-w-full md:max-w-[360px] z-50 bg-[#f8fafc] shadow-2xl flex flex-col animate-slide-in-right border-l border-[#e2e8f0]">
        
        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc] relative">
          
          {/* Patterned Header */}
          <div 
            className="h-28 w-full flex justify-end p-4"
            style={{
              backgroundColor: '#757c9a',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 11V7h2v4h4v2h-4v4h-2v-4H7v-2h4z\' fill=\'%23ffffff\' fill-opacity=\'0.15\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")'
            }}
          >
            <button 
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-black/10 text-white hover:bg-black/20 border border-white/20 transition-all backdrop-blur-sm"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          {/* Main Info with Overlapping Avatar */}
          <div className="bg-white px-6 pb-6 pt-0 flex flex-col items-center border-b border-[#e2e8f0]">
            <div className="-mt-10 mb-3 rounded-full bg-white p-1.5 shadow-sm">
              <Avatar 
                initials={contact.initials} 
                color={contact.color} 
                size="lg" 
                status={contact.isChannel ? null : contact.status}
                borderColor="#ffffff"
              />
            </div>
            <h3 className="text-[17px] font-bold text-[#0f172a] text-center leading-tight">{contact.name}</h3>
            <p className="text-[12px] text-[#64748b] mt-0.5 font-medium">{contact.role}</p>

          </div>

          {/* Details Section */}
          <div className="p-5">
            {!contact.isChannel ? (
              <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5 flex flex-col gap-6">
                {/* Status */}
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#f1f5f9] flex items-center justify-center shrink-0">
                    <UserCircle2 size={18} className="text-[#64748b]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">Status</span>
                    <span className="text-[13px] font-semibold text-[#0f172a] capitalize">{contact.lastSeen || 'Unknown'}</span>
                  </div>
                </div>
                
                {/* Role / Dept */}
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#f1f5f9] flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-[#64748b]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">Role</span>
                    <span className="text-[13px] font-semibold text-[#0f172a]">{contact.role}</span>
                  </div>
                </div>

                {loading && (
                  <>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 shrink-0 shimmer" />
                        <div className="flex flex-col flex-1 gap-2">
                          <div className="h-2 shimmer rounded w-12" />
                          <div className="h-3 shimmer rounded w-32" />
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Email */}
                {!loading && userDetails?.email && (
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[#f1f5f9] flex items-center justify-center shrink-0">
                      <Mail size={18} className="text-[#64748b]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">Email</span>
                      <span className="text-[13px] font-semibold text-[#0f172a]">{userDetails.email}</span>
                    </div>
                  </div>
                )}

                {/* Mobile */}
                {userDetails?.mobile && (
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[#f1f5f9] flex items-center justify-center shrink-0">
                      <Phone size={18} className="text-[#64748b]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">Phone</span>
                      <span className="text-[13px] font-semibold text-[#0f172a]">{userDetails.mobile}</span>
                    </div>
                  </div>
                )}

                {/* Employee Code */}
                {userDetails?.empCode && (
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[#f1f5f9] flex items-center justify-center shrink-0">
                      <BadgeInfo size={18} className="text-[#64748b]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-0.5">Emp Code</span>
                      <span className="text-[13px] font-semibold text-[#0f172a]">{userDetails.empCode}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-[#0f172a]">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#4f46e5]" />
                    <h4 className="text-[14px] font-bold">Members <span className="text-[#64748b] font-medium text-[12px]">({participants.length})</span></h4>
                  </div>
                  
                  <button 
                    onClick={() => setIsAddingMember(!isAddingMember)}
                    className={clsx(
                      "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-bold transition-colors border",
                      isAddingMember 
                        ? "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200" 
                        : "bg-[#eef2ff] text-[#4f46e5] border-[#c7d2fe] hover:bg-[#e0e7ff]"
                    )}
                  >
                    {isAddingMember ? <X size={13} /> : <UserPlus size={13} />}
                    {isAddingMember ? 'Cancel' : 'Add'}
                  </button>
                </div>
                
                <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden flex flex-col">
                  {/* Add Member Dropdown Area */}
                  {isAddingMember && (
                    <div className="p-3 border-b border-[#e2e8f0] bg-[#f8fafc]">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white border border-[#cbd5e1] rounded-lg focus-within:border-[#4f46e5] transition-colors mb-2">
                        <Search size={14} className="text-[#94a3b8]" />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search to add..."
                          value={addSearchQuery}
                          onChange={e => setAddSearchQuery(e.target.value)}
                          className="flex-1 bg-transparent text-[12px] outline-none text-[#0f172a] placeholder:text-[#94a3b8]"
                        />
                      </div>
                      <div className="max-h-[160px] overflow-y-auto flex flex-col gap-1">
                        {contacts
                          .filter(c => !c.isChannel && !participants.some(p => p.id === c.id))
                          .filter(c => c.name.toLowerCase().includes(addSearchQuery.toLowerCase()))
                          .map(c => (
                            <button
                              key={c.id}
                              onClick={() => handleAddMember(c.id)}
                              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-[#e2e8f0] text-left transition-colors"
                            >
                              <Avatar initials={c.initials} color={c.color} size="sm" />
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-[12px] font-bold text-[#0f172a] truncate">{c.name}</span>
                                <span className="text-[10px] text-[#64748b] truncate">{c.role}</span>
                              </div>
                              <UserPlus size={14} className="text-[#4f46e5] opacity-0 group-hover:opacity-100" />
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="p-1">
                    {loading ? (
                      <div className="flex flex-col gap-0.5">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-50 shrink-0 shimmer" />
                            <div className="flex flex-col flex-1 gap-2 min-w-0">
                              <div className="h-3 shimmer rounded w-24" />
                              <div className="h-2 shimmer rounded w-16" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : participants.length === 0 ? (
                      <div className="p-4 text-center text-[#94a3b8] text-[13px] font-medium">No members found</div>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {participants.map(p => (
                          <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f8fafc] transition-colors group">
                            <Avatar initials={p.initials} color={p.color} size="sm" status={p.status} />
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[13px] font-semibold text-[#0f172a] truncate">{p.name}</span>
                              <span className="text-[11px] text-[#64748b] truncate">{p.role}</span>
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveMember(p.id);
                              }}
                              title="Remove Member"
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-all shrink-0"
                            >
                              <UserMinus size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
