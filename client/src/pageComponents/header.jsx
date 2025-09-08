import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import getImage from "../handlers/getImage";
import Header_Menu from "./header_menu";
import Header_Mail from "./header_mail";
import Header_PFP from "./header_pfp";
import { Menu, Mail, CircleUserRound   } from 'lucide-react';

/**
 * Header
 * - Consolidates panel state into one `openPanel` value: 'menu' | 'mail' | 'profile' | null
 * - Accessible triggers (buttons) with aria-expanded/controls/haspopup
 * - Closes on outside click, Escape key, and on route change
 * - Uses className instead of class; adds pointer-events handling on hidden popovers
 * - Derives a robust title from the current URL
 */
export default function Header() {
  // 'menu' | 'mail' | 'profile' | null
  const [openPanel, setOpenPanel] = useState(null);
  const locate = useLocation();
  const headerRef = useRef(null);

  const isMenuOpen = openPanel === "menu";
  const isMailOpen = openPanel === "mail";
  const isProfileOpen = openPanel === "profile";

  const togglePanel = (panel) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  // Close when clicking outside the header (including any popovers)
  useEffect(() => {
    function onDocMouseDown(e) {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") setOpenPanel(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close when route changes
  useEffect(() => {
    setOpenPanel(null);
  }, [locate.key]);

  // Derive a readable page title from the current path
  const pageTitle = useMemo(() => {
    const path = locate?.pathname || "/";
    const parts = path.split("/").filter(Boolean);
    if (parts.length === 0) return "Home";
    const last = decodeURIComponent(parts[parts.length - 1]);
    if (!last) return "Home";
    return last.charAt(0).toUpperCase() + last.slice(1);
  }, [locate?.pathname]);

  // Utility to toggle visibility classes and pointer-events for hidden popovers
  const popoverClasses = (isOpen, side = "left") =>
    [
      "absolute top-full p-4 bg-black shadow-lg transition-opacity duration-200 text-left flex flex-col space-y-8 border-b border-white",
      side === "left" ? "left-0 border-r" : "right-0 border-l",
      isOpen
        ? "opacity-100 visible pointer-events-auto"
        : "invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100",
    ].join(" ");

  return (
    <div
      ref={headerRef}
      className="bg-website-default-900 w-full h-full text-white text-center flex justify-between p-0 items-stretch sticky top-0 border-website-specials-400 border-b z-50"
    >
      {/* Left: Menu */}
      <div className="relative inline-block group">
        <button
          id="menu-button"
          type="button"
          className="p-4 text-white cursor-pointer text-center"
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-controls="menu-popover"
          onClick={() => togglePanel("menu")}
        >
          <Menu />
          <span className="sr-only">{isMenuOpen ? "Close menu" : "Open menu"}</span>
        </button>

        <div
          id="menu-popover"
          role="menu"
          aria-labelledby="menu-button"
          className={`${popoverClasses(isMenuOpen, "left")} w-[140px]`}
        >
          <Header_Menu />
        </div>
      </div>

      {/* Center: Page Title */}
      <div className="absolute left-1/2 -translate-x-1/2 inline-block text-xl">
        <div className="p-4">{pageTitle}</div>
      </div>

      {/* Right: Mail + Profile */}
      <div className="inline-block">
        <div className="p-4 flex flex-row space-x-8 relative">
          {/* Mail */}
          <div className="group inline-block relative">
            <button
              id="mail-button"
              type="button"
              className="text-center relative cursor-pointer"
              aria-haspopup="dialog"
              aria-expanded={isMailOpen}
              aria-controls="mail-popover"
              onClick={() => togglePanel("mail")}
            >
              <Mail />
              <div className="h-4 w-4 bg-red-600 rounded-full absolute -bottom-1 -right-1 text-[10px] leading-4 text-center">
                99+
              </div>
              <span className="sr-only">{isMailOpen ? "Close inbox" : "Open inbox"}</span>
            </button>

            <div
              id="mail-popover"
              role="dialog"
              aria-labelledby="mail-button"
              className={`${popoverClasses(isMailOpen, "right")} w-[350px]`}
            >
              <Header_Mail />
            </div>
          </div>

          {/* Profile */}
          <div className="group inline-block relative">
            <button
              id="profile-button"
              type="button"
              className="text-white cursor-pointer text-center"
              aria-haspopup="menu"
              aria-expanded={isProfileOpen}
              aria-controls="profile-popover"
              onClick={() => togglePanel("profile")}
            >
              <CircleUserRound />
              <span className="sr-only">{isProfileOpen ? "Close profile menu" : "Open profile menu"}</span>
            </button>

            <div
              id="profile-popover"
              role="menu"
              aria-labelledby="profile-button"
              className={`${popoverClasses(isProfileOpen, "right")} w-[250px]`}
            >
              <Header_PFP />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}