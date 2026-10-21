import { Mail, LogOut, ChevronLeft, Phone, Power } from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { supabase } from '../../lib/supabase';
import { useChat } from '../../context/ChatContext';

export function UserProfileDrawer({ isOpen, onClose, currentUser }) {
  const { setChatAlert } = useChat();

  if (!isOpen || !currentUser) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[90] bg-black/20 animate-fade-in backdrop-blur-[1px]"
        onClick={onClose}
      />
      
      {/* Drawer Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-full md:max-w-[360px] z-[100] bg-[#f8fafc] shadow-2xl flex flex-col animate-slide-in-right border-l border-[#e2e8f0]">
        
        {/* Header Block */}
        <div className="bg-[#007eff] pt-6 pb-6 px-4 flex flex-col items-center relative text-white">
          {/* Back/Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 left-4 text-white hover:opacity-80 transition-opacity focus:outline-none bg-transparent border-none cursor-pointer"
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          
          {/* Avatar */}
          <div className="mb-3 rounded-full bg-white/10 p-1">
            <Avatar 
              initials={currentUser.initials} 
              color={currentUser.color} 
              size="lg" 
              borderColor="#ffffff"
            />
          </div>
          
          {/* Name */}
          <h3 className="text-[17px] font-bold text-white text-center leading-tight">
            {currentUser.name}
          </h3>
          
          {/* Subtext */}
          <p className="text-[12px] text-white/90 mt-1 font-semibold text-center uppercase tracking-wider">
            {currentUser.role}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-white relative no-scrollbar divide-y divide-slate-100">
          
          {/* Status Settings */}
          <div className="py-1">
            {/* Clock In */}
            <div className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-[#22c55e] flex items-center justify-center shrink-0" />
                <span className="text-[13.5px] font-semibold text-slate-700">Clock In</span>
              </div>
            </div>
          </div>

          {/* User Details */}
          <div className="py-2 space-y-1">
            {/* Email */}
            {currentUser.email && (
              <div className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <span className="text-[13.5px] font-semibold text-slate-600 truncate">{currentUser.email}</span>
              </div>
            )}
            
            {/* Phone */}
            {currentUser.mobile && (
              <div className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <span className="text-[13.5px] font-semibold text-slate-600">{currentUser.mobile}</span>
              </div>
            )}
          </div>

          {/* Log Out Button */}
          <div className="py-1">
            <button 
              onClick={handleSignOut}
              className="w-full px-5 py-3 flex items-center gap-3 hover:bg-red-50/50 text-[#ef4444] transition-colors border-none text-left cursor-pointer bg-white"
            >
              <Power size={16} className="text-[#ef4444]" />
              <span className="text-[13.5px] font-bold">Log Out</span>
            </button>
          </div>

        </div>

      </div>
    </>
  );
}
