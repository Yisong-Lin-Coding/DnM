import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Header_Menu from "./header_menu";
import Header_Mail from "./header_mail";
import Header_PFP from "./header_pfp";
import { Menu, Mail, CircleUserRound, X } from 'lucide-react';

export default function Header({ className = "", title }) {
  const [openPanel, setOpenPanel] = useState(null);
  const locate = useLocation();
  const headerRef = useRef(null);

  const isMenuOpen = openPanel === "menu";
  const isMailOpen = openPanel === "mail";
  const isProfileOpen = openPanel === "profile";

  const togglePanel = (panel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  useEffect(() => {
    function onDocMouseDown(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setOpenPanel(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setOpenPanel(null);
  }, [locate.key]);

  const pageTitle = useMemo(() => {
    const path = locate?.pathname || "/";
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "Home";
    const last = decodeURIComponent(parts[parts.length - 1]);
    return last.charAt(0).toUpperCase() + last.slice(1);
  }, [locate?.pathname]);

  // Refined Popover Classes
  const popoverClasses = (isOpen, side = "left") =>
    [
      "absolute top-full bg-website-default-900/95 backdrop-blur-md shadow-2xl transition-all duration-300 border-t-2 border-website-specials-500 z-50",
      side === "left" ? "left-0 border-r border-website-default-700" : "right-0 border-l border-website-default-700",
      isOpen
        ? "opacity-100 translate-y-0 visible"
        : "opacity-0 -translate-y-2 invisible pointer-events-none",
    ].join(" ");

  // Shared Button Style
  const btnStyle = (isActive) => 
    `p-4 transition-colors duration-200 hover:bg-website-default-800 flex items-center justify-center ${
      isActive ? "text-website-specials-500 bg-website-default-800" : "text-website-neutral-100"
    }`;

  return (
    <header
      ref={headerRef}
      className={`font-body bg-website-default-900 w-full h-16 text-white flex justify-between items-stretch sticky top-0 border-b border-website-default-700 z-50 ${className}`}
    >
      {/* Left: Menu */}
      <div className="relative flex">
        <button
          type="button"
          className={btnStyle(isMenuOpen)}
          onClick={() => togglePanel("menu")}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={`${popoverClasses(isMenuOpen, "left")} w-64 p-2`}>
          <Header_Menu />
        </div>
      </div>

      {/* Center: Page Title */}
      <div className="flex items-center justify-center">
        <h1 className="text-lg font-semibold tracking-wide uppercase text-website-neutral-50">
          {title || pageTitle}
        </h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-stretch">
        {/* Mail */}
        <div className="relative flex">
          <button
            type="button"
            className={btnStyle(isMailOpen)}
            onClick={() => togglePanel("mail")}
          >
            <div className="relative">
              <Mail size={24} />
              <span className="absolute -top-2 -right-2 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-website-specials-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-website-specials-500 text-[10px] items-center justify-center font-bold">
                  9
                </span>
              </span>
            </div>
          </button>

          <div className={`${popoverClasses(isMailOpen, "right")} w-[350px] p-4 max-h-[80vh] overflow-y-auto scrollbar-transparent`}>
            <Header_Mail />
          </div>
        </div>

        {/* Profile */}
        <div className="relative flex border-l border-website-default-800">
          <button
            type="button"
            className={btnStyle(isProfileOpen)}
            onClick={() => togglePanel("profile")}
          >
            <CircleUserRound size={24} />
          </button>

          <div className={`${popoverClasses(isProfileOpen, "right")} w-64 p-4`}>
            <Header_PFP />
          </div>
        </div>
      </div>
    </header>
  );
}