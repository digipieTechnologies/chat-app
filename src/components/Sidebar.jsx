import {
  MessageSquare, Bell, Star,
  FolderOpen, Settings, LogOut,
} from 'lucide-react';
import clsx from 'clsx';
import { Avatar } from './ui/Avatar';
import { supabase } from '../lib/supabase';

const NAV = [
  { id: 'chats', icon: MessageSquare, label: 'Messages' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'starred', icon: Star, label: 'Starred' },
  { id: 'files', icon: FolderOpen, label: 'Files' },
];

export function Sidebar({ activeNav, onNavChange, currentUser, unreadNotifications = 0, onOpenProfile }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <aside
      className="flex flex-row md:flex-col items-center justify-between md:justify-start 
                 w-full h-[60px] md:w-[64px] md:h-[100dvh] 
                 px-4 md:px-0 py-0 md:py-4 md:gap-2 
                 bg-white border-t md:border-t-0 md:border-r border-[#e2e8f0]"
    >
      {/* Logo */}
      <div className="hidden md:flex mb-4 flex-shrink-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer select-none shadow-sm"
          style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
        >
          <span className="text-white font-bold text-[16px] leading-none">C</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-row md:flex-col items-center justify-around md:justify-start gap-1 md:gap-1.5 flex-1 md:flex-none w-full md:px-2">
        {NAV.map(({ id, icon: Icon, label }) => {
          const badgeValue = id === 'notifications' ? unreadNotifications : 0;
          return (
            <button
              key={id}
              title={label}
              onClick={() => onNavChange(id)}
              className={clsx('nav-btn w-12 md:w-full flex justify-center', activeNav === id && 'active')}
            >
              <Icon size={20} strokeWidth={1.8} />
              {badgeValue > 0 && (
                <span
                  className="absolute -top-1 -right-1 ubadge border-2 border-white"
                  style={{ fontSize: '9px', minWidth: '16px', height: '16px' }}
                >
                  {badgeValue}
                </span>
              )}
            </button>
          );
        })}

        {/* Profile Avatar on Mobile */}
        <button 
          title="My Profile"
          onClick={onOpenProfile} 
          className="md:hidden nav-btn w-12 flex justify-center cursor-pointer focus:outline-none shrink-0"
        >
          {currentUser && (
            <Avatar
              initials={currentUser.initials}
              color={currentUser.color}
              status={currentUser.status}
              size="sm"
              borderColor="#ffffff"
            />
          )}
        </button>
      </nav>

      {/* Bottom */}
      <div className="hidden md:flex flex-col items-center gap-2 w-full px-2 mt-auto">
        {/* <button title="Settings" className="nav-btn w-full">
          <Settings size={18} strokeWidth={1.8} />
        </button> */}
        <button title="Sign Out" onClick={handleSignOut} className="nav-btn w-full hover:text-red-500">
          <LogOut size={18} strokeWidth={1.8} />
        </button>
        <button 
          title="My Profile"
          onClick={onOpenProfile} 
          className="mt-1 cursor-pointer hover:opacity-90 transition-opacity focus:outline-none shrink-0"
        >
          {currentUser && (
            <Avatar
              initials={currentUser.initials}
              color={currentUser.color}
              status={currentUser.status}
              size="sm"
              borderColor="#ffffff"
            />
          )}
        </button>
      </div>
    </aside>
  );
}
