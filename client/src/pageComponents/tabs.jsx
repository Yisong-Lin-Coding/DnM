import React, { useState, createContext, useContext } from 'react';
import { Check } from 'lucide-react';

// Tab Context for sharing state
const TabContext = createContext();

// Main Tab Container (like your Skeleton pattern)
export function Tabs({ children, defaultTab = 0, onTabChange, className = "" }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  
  const handleTabChange = (index) => {
    setActiveTab(index);
    if (onTabChange) onTabChange(index);
  };

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={`w-full min-h-0 ${className}`}>
        {children}
      </div>
    </TabContext.Provider>
  );
}

// Tab Navigation Bar
Tabs.Nav = function TabNav({ children, className = "" }) {
  return (
    <div className={`flex border-b border-website-200 bg-website-default-900 ${className}`}>
      {children}
    </div>
  );
};

// Individual Tab Button
Tabs.Tab = function Tab({
  children,
  label = "",
  index,
  disabled = false,
  completed = false,
  className = "",
}) {
  const { activeTab, setActiveTab } = useContext(TabContext);
  const isActive = activeTab === index;

  const hasLabel = typeof label === "string" && label.trim().length > 0;
  const baseClasses = "flex items-center gap-2 px-3 py-2 font-medium text-sm transition-colors duration-200 border-b-2 whitespace-nowrap";
  const activeClasses = isActive 
    ? "text-website-highlights-100 border-website-highlights-500 bg-gradient-to-t from-website-highlights-500/20 to-transparent" 
    : "text-website-highlights-100 border-transparent hover:text-website-specials-200 hover:border-website-highlights-300";
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";
  const completedClasses = completed && !isActive ? "text-green-600" : "";

  return (
    <button
      className={`${baseClasses} ${activeClasses} ${disabledClasses} ${completedClasses} ${className}`}
      onClick={() => !disabled && setActiveTab(index)}
      disabled={disabled}
    >
      {children}
      {hasLabel && <span className="text-[11px] tracking-wide uppercase">{label}</span>}
      {completed && !isActive && <Check className="w-4 h-4 text-green-500" />}
    </button>
  );
};

// Prev/Next Controls
Tabs.Prev = function TabPrev({ min = 0, className = "", disabled: disabledProp, children }) {
  const { activeTab, setActiveTab } = useContext(TabContext);
  const disabled = disabledProp ?? (activeTab <= min);
  return (
    <button
      type="button"
      aria-label="Previous tab"
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(Math.max(min, activeTab - 1))}
      className={`p-2 rounded-full border border-website-specials-500 bg-website-default-800/80 text-website-default-100 hover:bg-website-default-700 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children ?? '<'}
    </button>
  );
};

Tabs.Next = function TabNext({ max, className = "", disabled: disabledProp, children }) {
  const { activeTab, setActiveTab } = useContext(TabContext);
  const disabled = disabledProp ?? (typeof max === 'number' ? activeTab >= max : true);
  return (
    <button
      type="button"
      aria-label="Next tab"
      disabled={disabled}
      onClick={() => !disabled && setActiveTab(Math.min(max, activeTab + 1))}
      className={`p-2 rounded-full border border-website-specials-500 bg-website-default-800/80 text-website-default-100 hover:bg-website-default-700 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children ?? '>'}
    </button>
  );
};

// Tab Content Panels
Tabs.Panels = function TabPanels({ children, className = "" }) {
  return (
    <div className={`bg-website-default-900 h-full min-h-0 ${className}`}>
      {children}
    </div>
  );
};

// Individual Tab Panel
Tabs.Panel = function TabPanel({ children, index, className = "" }) {
  const { activeTab } = useContext(TabContext);
  
  if (activeTab !== index) return null;
  
  return (
    <div className={`p-6 h-full min-h-0 ${className}`}>
      {children}
    </div>
  );
};
