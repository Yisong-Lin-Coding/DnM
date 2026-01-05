import { Link } from "react-router-dom";
import { Github, Linkedin, HelpCircle, Home } from 'lucide-react';

export default function Footer({ className = "" }) {
  const linkClass = "flex items-center gap-2 px-4 py-1 text-website-neutral-100 hover:text-website-specials-500 transition-colors duration-200";
  
  return (
    <footer className={`w-full bg-website-default-900 border-t border-website-default-700 font-body py-10 px-4 ${className}`}>
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-8">
        
        {/* Navigation Links */}
        <nav className="flex flex-wrap justify-center items-center divide-x divide-website-default-700 uppercase tracking-widest text-xs font-semibold">
          <Link to="/" className={linkClass}>
            <Home size={14} />
            Home
          </Link>
          
          <a 
            href="https://github.com/Yisong-Lin-Coding/DnM" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={linkClass}
          >
            <HelpCircle size={14} />
            Help
          </a>
          
          <a 
            href="https://github.com/Yisong-Lin-Coding/DnM" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={linkClass}
          >
            <Github size={14} />
            Github
          </a>
          
          <a 
            href="https://www.linkedin.com/in/yisong-lin-8605a3357/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={linkClass}
          >
            <Linkedin size={14} />
            Linkedin
          </a>
        </nav>

        {/* Separator Line */}
        <div className="w-16 h-px bg-website-specials-500/50" />

        {/* Legal / Copyright */}
        <div className="max-w-2xl text-center">
          <p className="text-website-neutral-500 text-[11px] leading-relaxed uppercase tracking-tighter opacity-80">
            All game mechanics and content from the System Reference Document are Open Game Content 
            under the <span className="text-website-neutral-300">Open Game License v1.0a</span>. 
            All other content is Product Identity of <span className="text-website-specials-400">Yisong Lin</span> 
            &copy; {new Date().getFullYear()} and may not be used without permission.
          </p>
        </div>
      </div>
    </footer>
  );
}