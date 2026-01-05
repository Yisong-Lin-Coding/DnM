import { MailPlus, Search, SlidersHorizontal, ChevronRight, Inbox } from 'lucide-react';
import Mail_Card from './mail_card';

export default function Header_Mail() {
  // Mock data for display
  const messages = [
    { id: 1, unread: true, sender: { name: "The Guild Master" }, subject: "Quest: The Frozen Peak", snippet: "Meet me at the tavern before sundown..." },
    { id: 2, unread: false, sender: { name: "Merchant's Row" }, subject: "Invoice #882", snippet: "Your order of 50x Health Potions has..." },
    { id: 3, unread: true, sender: { name: "System" }, subject: "Level Up!", snippet: "Congratulations! You have reached level 12." },
  ];

  return (
    <div className="flex flex-col h-[500px] w-full font-body bg-website-default-900">
      {/* 1. Header & Primary Actions */}
      <div className="p-4 border-b border-website-default-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox size={18} className="text-website-specials-400" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-website-neutral-50">Messenger</h2>
          </div>
          <button 
            title="Compose Message"
            className="p-2 rounded-full bg-website-specials-500 hover:bg-website-specials-400 text-white transition-all transform hover:scale-110 active:scale-95 shadow-lg shadow-website-specials-900/40"
          >
            <MailPlus size={18} />
          </button>
        </div>

        {/* 2. Search & Filter Bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-website-neutral-600" size={14} />
            <input 
              type="text" 
              placeholder="Search scroll..." 
              className="w-full bg-website-default-800 border border-website-default-700 rounded-lg py-1.5 pl-9 pr-3 text-xs text-website-neutral-200 placeholder:text-website-neutral-600 focus:outline-none focus:border-website-highlights-500 transition-colors"
            />
          </div>
          <button className="p-2 bg-website-default-800 border border-website-default-700 rounded-lg text-website-neutral-400 hover:text-website-neutral-100 transition-colors">
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {/* 3. Sub-tabs */}
        <div className="flex gap-4 text-[10px] uppercase font-bold tracking-wider pt-2">
          <button className="text-website-specials-500 border-b-2 border-website-specials-500 pb-1">All</button>
          <button className="text-website-neutral-500 hover:text-website-neutral-300 pb-1">Unread (2)</button>
          <button className="text-website-neutral-500 hover:text-website-neutral-300 pb-1">Archive</button>
        </div>
      </div>

      {/* 4. Message List Area */}
      <div className="flex-1 overflow-y-auto scrollbar-transparent p-2 space-y-1">
        {messages.length > 0 ? (
          messages.map((msg) => (
            <Mail_Card 
              key={msg.id}
              unread={msg.unread}
              sender={msg.sender}
              subject={msg.subject}
              snippet={msg.snippet}
              date={new Date()}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-website-neutral-600 space-y-2 opacity-50">
            <Inbox size={48} strokeWidth={1} />
            <p className="text-xs uppercase tracking-widest">No messages found</p>
          </div>
        )}
      </div>

      {/* 5. Footer: View All Link */}
      <button className="group flex items-center justify-center gap-2 p-3 border-t border-website-default-800 bg-website-default-900/80 hover:bg-website-default-800 transition-all">
        <span className="text-xs font-bold uppercase tracking-widest text-website-neutral-400 group-hover:text-website-neutral-100">
          Open Full Inbox
        </span>
        <ChevronRight size={14} className="text-website-neutral-500 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}