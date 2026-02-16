import { useContext } from "react";
import { Link, useNavigate } from 'react-router-dom';
import { 
  Book, Sparkles, Shield, User, Scroll, 
  Sword, Skull, Home, Layout, LogOut 
} from 'lucide-react';
import { SocketContext } from "../socket.io/context";

export default function Header_Menu() {
  const socket = useContext(SocketContext);
  const navigate = useNavigate();
  const sessionID = sessionStorage.getItem("session_ID");

  const sessionRoute = (path) => {
    if (!sessionID) return "/login";
    return `/ISK/${sessionID}${path}`;
  };

  const handleSignOut = () => {
    const playerID = localStorage.getItem("player_ID");
    if (playerID) {
      socket.emit("playerData_logOff", { playerID });
    }

    localStorage.removeItem("player_ID");
    localStorage.removeItem("player_username");
    sessionStorage.removeItem("session_ID");
    sessionStorage.removeItem("adminPermission");
    sessionStorage.removeItem("lastLocation");
    navigate("/login");
  };

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
          <Link to={sessionRoute("/lore/classes")} className={itemClass}>
            <Shield size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Classes</span>
          </Link>
          <Link to={sessionRoute("/lore/backgrounds")} className={itemClass}>
            <User size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Backgrounds</span>
          </Link>
          <Link to={sessionRoute("/lore/races")} className={itemClass}>
            <Sparkles size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Races</span>
          </Link>
          <Link to={sessionRoute("/lore/spells")} className={itemClass}>
            <Scroll size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Spells</span>
          </Link>
          <Link to={sessionRoute("/lore/items")} className={itemClass}>
            <Sword size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Items</span>
          </Link>
          <Link to={sessionRoute("/lore")} className={itemClass}>
            <Book size={16} className="text-website-specials-500 opacity-70 group-hover:opacity-100" />
            <span>Lore</span>
          </Link>
          <Link to={sessionRoute("/lore/enemies")} className={itemClass}>
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
          <Link to={sessionRoute("/home")} className={itemClass}>
            <Home size={16} className="text-website-neutral-400 group-hover:text-website-specials-400" />
            <span>Home</span>
          </Link>
          <Link to={sessionRoute("/lobby")} className={itemClass}>
            <Layout size={16} className="text-website-neutral-400 group-hover:text-website-specials-400" />
            <span>Lobby</span>
          </Link>
          <Link to={sessionRoute("/settings")} className={itemClass}>
            <User size={16} className="text-website-neutral-400 group-hover:text-website-specials-400" />
            <span>Settings</span>
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className={`${itemClass} w-full text-left text-website-specials-600 hover:text-website-specials-400 mt-4 pt-4 border-t border-website-default-800`}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </nav>
      </section>
    </div>
  );
}
