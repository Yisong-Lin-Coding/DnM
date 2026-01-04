import { User, Heart, Zap, Droplet } from "lucide-react";
import IndexCardFolder from "./indexCard";
import { SocketContext } from "../socket.io/context";
import { useContext, useState, useEffect } from "react";
import { useNavigate } from 'react-router-dom';

export default function CharacterCard({ character, to, onClick }) {
  const hp = character.HP || { current: 0, max: 0, temp: 0 };
  const sta = character.STA || { current: 0, max: 0 };
  const mp = character.MP || { current: 0, max: 0 };
  const stats = character.stats || {};
  const customization = character.customization || {};

  const [classTable,setClassTable] = useState([])
  const [backgroundTable, setBackgroundTable] = useState([])
  const [raceTable, setRaceTable] = useState([])
  const [subraceTable] = useState([])

  

  const socket = useContext(SocketContext);



  useEffect(() => {
      socket.emit(
        'database_query',
        {
          collection: 'classes',
          operation: 'findAll',
        },
        (response) => {
          if (response.success) {
            setClassTable(response.data);
            console.log(response.data);
          }
        }
      );
      socket.emit(
        'database_query',
        {
          collection: 'races',
          operation: 'findAll',
        },
        (response) => {
          if (response.success) {
            setRaceTable(response.data);
            console.log(response.data);
          }
        }
      );
      socket.emit(
        'database_query',
        {
          collection: 'backgrounds',
          operation: 'findAll',
        },
        (response) => {
          if (response.success) {
            setBackgroundTable(response.data);
            console.log(response.data);
          }
        }
      );
    }, [socket]);

  


  return (
    <IndexCardFolder.File to={to} onClick={onClick} className="!grid-rows-1 !p-0 overflow-hidden">
      {/* Single scrollable container */}
      <div 
        className="overflow-y-auto overflow-x-hidden h-full px-5 py-5" 
        style={{
          scrollbarWidth: 'none',
          scrollbarColor: '#475569 transparent'
        }}
      >
        {/* Character Header with enhanced gradient */}
        <div className="relative bg-gradient-to-r rounded-xl from-purple-600 via-purple-500 to-indigo-600 -mx-5 -mt-5 p-4 pb-12 mb-2 overflow-hidden">
          {/* Animated background pattern */}
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.3),transparent)]"></div>
          
          <div className="relative z-10">
            {/* Level Badge - Top Right */}
            <div className="flex justify-end mb-2">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/30 shadow-lg">
                <div className="text-sm font-bold text-white">Lv {character.level || 1}</div>
              </div>
            </div>
            
            {/* Name - Centered */}
            <div className="text-center mb-3">
              <h2 className="text-xl font-bold text-white drop-shadow-lg px-4">
                {character.name || "Unnamed Character"}
              </h2>
            </div>
            
            {/* Race/Class - Bottom, smaller text to avoid PFP overlap */}
            <div className="flex items-center justify-center gap-2 text-purple-100 text-xs px-4">
              <span className="font-medium truncate max-w-[45%]">{classTable.find(u => u._id === character.class)?.name || "No Class"}</span>
              <span className="text-purple-300 flex-shrink-0">•</span>
              <span className="truncate max-w-[45%]">{raceTable.find(u => u._id === character.race)?.name || "No Race"}</span>
            </div>
          </div>
        </div>

        {/* Enhanced Avatar - Overlapping header */}
        <div className="flex justify-center -mt-12 mb-4 relative z-20">
          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 blur-md opacity-75 animate-pulse"></div>
            {/* Main avatar */}
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 p-1 shadow-xl shadow-purple-500/50 ring-4 ring-slate-900">
              <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center">
                <User className="w-10 h-10 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Vital Stats with enhanced bars */}
        <div className="space-y-2 mb-4">
          <StatBar 
            icon={<Heart className="w-3.5 h-3.5" />}
            label="HP"
            current={hp.current}
            max={hp.max}
            temp={hp.temp}
            color="red"
          />
          <StatBar 
            icon={<Zap className="w-3.5 h-3.5" />}
            label="STA"
            current={sta.current}
            max={sta.max}
            color="yellow"
          />
          <StatBar 
            icon={<Droplet className="w-3.5 h-3.5" />}
            label="MP"
            current={mp.current}
            max={mp.max}
            color="blue"
          />
        </div>

        {/* Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700/50" />
          </div>
          <div className="relative flex justify-center">
            <div className="bg-gradient-to-r from-transparent via-purple-500/20 to-transparent h-px w-1/2" />
          </div>
        </div>

        {/* Attribute Grid with hover effects */}
        {Object.keys(stats).length > 0 && (
          <div className="grid grid-cols-3 gap-2 w-full mb-4">
            {Object.entries(stats).map(([stat, value]) => {
              // Handle both simple numbers and complex objects
              const statValue = typeof value === 'object' ? (value.total || 0) : (value || 0);
              
              return (
                <div 
                  key={stat} 
                  className="group/stat relative bg-slate-800/60 rounded-lg p-2 border border-slate-700/50 text-center hover:border-purple-500/50 hover:bg-slate-800/80 transition-all duration-200"
                >
                  {/* Hover glow effect */}
                  <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-500/0 to-blue-500/0 group-hover/stat:from-purple-500/10 group-hover/stat:to-blue-500/10 transition-all duration-200"></div>
                  
                  <div className="relative">
                    <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">{stat}</div>
                    <div className="text-lg font-bold text-white my-0.5 group-hover/stat:text-purple-300 transition-colors">{statValue}</div>
                    <div className="text-xs text-purple-400 font-semibold">{getModifier(statValue)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Enhanced Appearance section */}
        {(customization.skinColor || customization.eyeColor || customization.hairColor) && (
          <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg p-3 border border-slate-700/30 w-full mb-4">
            <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-700"></div>
              <span>Appearance</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-700"></div>
            </h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {customization.skinColor && (
                <div className="text-center">
                  <div className="text-slate-500 mb-1 text-[10px] uppercase tracking-wider">Skin</div>
                  <div className="text-slate-200 font-medium truncate">{customization.skinColor}</div>
                </div>
              )}
              {customization.eyeColor && (
                <div className="text-center">
                  <div className="text-slate-500 mb-1 text-[10px] uppercase tracking-wider">Eyes</div>
                  <div className="text-slate-200 font-medium truncate">{customization.eyeColor}</div>
                </div>
              )}
              {customization.hairColor && (
                <div className="text-center">
                  <div className="text-slate-500 mb-1 text-[10px] uppercase tracking-wider">Hair</div>
                  <div className="text-slate-200 font-medium truncate">{customization.hairColor}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom padding for scroll */}
        <div className="h-4"></div>
      </div>
    </IndexCardFolder.File>
  );
}

function StatBar({ icon, label, current, max, temp = 0, color }) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isLow = percentage < 30;
  const isCritical = percentage < 15;
  
  const colorClasses = {
    red: "from-red-600 via-red-500 to-red-600",
    yellow: "from-yellow-600 via-yellow-500 to-yellow-600",
    blue: "from-blue-600 via-blue-500 to-blue-600"
  };

  const textColorClasses = {
    red: "text-red-400",
    yellow: "text-yellow-400",
    blue: "text-blue-400"
  };

  const glowClasses = {
    red: "shadow-red-500/50",
    yellow: "shadow-yellow-500/50",
    blue: "shadow-blue-500/50"
  };

  return (
    <div className={`
      bg-slate-800/60 rounded-lg p-2 border border-slate-700/50 
      hover:border-slate-600/50 transition-all duration-200
      ${isCritical ? 'animate-pulse border-red-500/50' : ''}
    `}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`${textColorClasses[color]} ${isCritical ? 'animate-pulse' : ''}`}>
            {icon}
          </div>
          <span className="text-sm font-medium text-slate-300">{label}</span>
        </div>
        <div className="text-sm font-bold text-white">
          <span className={isCritical ? 'text-red-400' : ''}>{current}</span>
          {temp > 0 && <span className="text-cyan-400">+{temp}</span>}
          <span className="text-slate-500">/{max}</span>
        </div>
      </div>
      <div className="relative h-2 bg-slate-900/50 rounded-full overflow-hidden ring-1 ring-slate-700/50">
        {/* Background shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
        
        {/* Main bar */}
        <div 
          className={`
            h-full bg-gradient-to-r ${colorClasses[color]} 
            transition-all duration-500 ease-out 
            shadow-lg ${glowClasses[color]}
            ${isLow ? 'animate-pulse' : ''}
          `}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

function getModifier(stat) {
  const modifier = Math.floor((stat - 10) / 2);
  return modifier >= 0 ? `+${modifier}` : `${modifier}`;
}