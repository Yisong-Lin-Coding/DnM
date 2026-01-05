import { User, Settings, ShieldCheck, LogOut, TreasureChest, Star } from 'lucide-react';

export default function Header_PFP() {
  const user = {
    name: "Eldrin the Wise",
    role: "Dungeon Master",
    level: 12,
    avatarUrl: null, // Fallback to initials
  };

  const actionLink = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:bg-website-default-800 group";

  return (
    <div className="flex flex-col w-full font-body">
      {/* User Header Section */}
      <div className="flex items-center gap-4 mb-6 p-1">
        <div className="relative">
          <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-website-highlights-600 to-website-specials-500 p-0.5">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-website-default-900 text-lg font-bold">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="avatar" className="rounded-full" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
          </div>
          {/* Online Status Glow */}
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-website-highlights-500 border-2 border-website-default-900 shadow-[0_0_8px_rgba(15,52,96,0.8)]"></span>
        </div>
        
        <div className="flex flex-col">
          <span className="text-sm font-bold text-website-neutral-50 leading-tight">
            {user.name}
          </span>
          <span className="text-[11px] text-website-highlights-400 font-medium uppercase tracking-wider">
            {user.role}
          </span>
        </div>
      </div>

      {/* Mini Stats Grid */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="flex flex-col items-center p-2 rounded-lg bg-website-default-800/50 border border-website-default-700">
          <span className="text-[10px] uppercase text-website-neutral-500">Level</span>
          <span className="text-sm font-bold text-website-specials-400">{user.level}</span>
        </div>
        <div className="flex flex-col items-center p-2 rounded-lg bg-website-default-800/50 border border-website-default-700">
          <span className="text-[10px] uppercase text-website-neutral-500">Reputation</span>
          <span className="text-sm font-bold text-website-highlights-400">98</span>
        </div>
      </div>

      {/* Action List */}
      <nav className="flex flex-col space-y-1 mb-6">
        <a href="/profile" className={actionLink}>
          <User size={18} className="text-website-neutral-500 group-hover:text-website-specials-500" />
          <span className="text-website-neutral-200 group-hover:text-website-neutral-50">Public Profile</span>
        </a>
        <a href="/security" className={actionLink}>
          <ShieldCheck size={18} className="text-website-neutral-500 group-hover:text-website-specials-500" />
          <span className="text-website-neutral-200 group-hover:text-website-neutral-50">Security</span>
        </a>
        <a href="/settings" className={actionLink}>
          <Settings size={18} className="text-website-neutral-500 group-hover:text-website-specials-500" />
          <span className="text-website-neutral-200 group-hover:text-website-neutral-50">Settings</span>
        </a>
      </nav>

      {/* Footer Button */}
      <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-website-specials-500 hover:bg-website-specials-600 text-white text-xs font-bold uppercase tracking-widest transition-colors shadow-lg shadow-website-specials-900/20">
        <LogOut size={14} />
        Sign Out
      </button>
    </div>
  );
}