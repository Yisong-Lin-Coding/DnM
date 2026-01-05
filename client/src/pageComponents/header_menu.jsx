import { Link } from 'react-router-dom';
import { 
  Book, Sparkles, Shield, User, Scroll, 
  Sword, Skull, Home, Layout, LogOut 
} from 'lucide-react';

export default function Header_Menu() {
  // Shared link styling for consistency
  const itemClass = "group flex items-center gap-3 text-website-neutral-100 hover:text-website-specials-400 transition-all duration-200 transform hover:translate-x-1";
  
  const sectionHeader = "text-[10px] uppercase tracking-[0.2em] text-website-neutral-400 font-bold flex items-center justify-between";

  return (
    <div className='flex flex-col space-y-10 p-2'>
      {/* Lookup Section */}
      <section>
        <h3 className={sectionHeader}>
          Lookup
          <span className="h-px flex-1 ml-4 bg-gradient-to-r from-website-specials-500/50 to-transparent"></span>
        </h3>
        
        <nav className="flex flex-col space-y-3 mt-4">
          <Link to="/classes" className={itemClass}>
            <Shield size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Classes</span>
          </Link>
          <Link to="/backgrounds" className={itemClass}>
            <User size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Backgrounds</span>
          </Link>
          <Link to="/races" className={itemClass}>
            <Sparkles size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Races</span>
          </Link>
          <Link to="/spells" className={itemClass}>
            <Scroll size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Spells</span>
          </Link>
          <Link to="/items" className={itemClass}>
            <Sword size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Items</span>
          </Link>
          <Link to="/lore" className={itemClass}>
            <Book size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Lore</span>
          </Link>
          <Link to="/enemies" className={itemClass}>
            <Skull size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Enemies</span>
          </Link>
        </nav>
      </section>

      {/* Navigation Section */}
      <section>
        <h3 className={sectionHeader}>
          System
          <span className="h-px flex-1 ml-4 bg-gradient-to-r from-website-specials-500/50 to-transparent"></span>
        </h3>
        
        <nav className="flex flex-col space-y-3 mt-4">
          <Link to={`/ISK/${sessionStorage.getItem('session_ID')}/home`} className={itemClass}>
            <Home size={16} className="text-website-neutral-400 group-hover:text-website-specials-400" />
            <span>Home</span>
          </Link>
          <Link to="/lobby" className={itemClass}>
            <Layout size={16} className="text-website-neutral-400 group-hover:text-website-specials-400" />
            <span>Lobby</span>
          </Link>
          <button className={`${itemClass} w-full text-left text-website-specials-600 hover:text-website-specials-400 mt-4 pt-4 border-t border-website-default-800`}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </nav>
      </section>
    </div>
  );
}