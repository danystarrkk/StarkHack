import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Terminal, Code, FileText, Award, User } from 'lucide-react';

interface NavbarProps {
  onOpenTerminal: () => void;
}

// Router-driven navigation: every item is a real URL (NavLink gives the same
// active-state styling the tabbed shell had). Paths match the route table in
// src/lib/router.tsx.
const navItems = [
  { id: 'home', label: 'Home', to: '/', icon: Terminal },
  { id: 'writeups', label: 'Writeups', to: '/writeups', icon: FileText },
  { id: 'projects', label: 'Projects', to: '/projects', icon: Code },
  { id: 'certifications', label: 'Certifications', to: '/certifications', icon: Award },
  { id: 'about', label: 'About', to: '/about', icon: User },
] as const;

export const Navbar: React.FC<NavbarProps> = ({ onOpenTerminal }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#1b1f29] bg-[#0b0e15]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Zone */}
        <button
          onClick={() => navigate('/')}
          className="group flex items-center gap-2.5 transition-colors focus:outline-none"
        >
          {/* Custom cyber skull / mask icon matching screenshot */}
          <div className="flex h-7 w-7 items-center justify-center rounded border border-[#39bae6]/40 bg-[#10141c] text-[#39bae6] shadow-[0_0_12px_rgba(57,186,230,0.25)] group-hover:border-[#39bae6]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <circle cx="8" cy="9" r="1.5" fill="currentColor" />
              <circle cx="16" cy="9" r="1.5" fill="currentColor" />
              <path d="M5 14v1a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-1" />
              <line x1="10" y1="16" x2="10" y2="18" />
              <line x1="14" y1="16" x2="14" y2="18" />
              <path d="M4 8l3-3m13 3l-3-3" />
            </svg>
          </div>
          <span className="font-mono text-base font-bold tracking-wider text-[#e0e2ec] group-hover:text-[#6ad5ff] transition-colors">
            STARK<span className="text-[#39bae6]">HACK</span>
          </span>
        </button>

        {/* Desktop Nav Zone */}
        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `relative py-1 font-mono text-xs tracking-wider transition-colors hover:text-[#6ad5ff] ${
                  isActive ? 'font-medium text-[#39bae6]' : 'text-[#879299]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#39bae6] shadow-[0_0_8px_rgba(57,186,230,0.6)]" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Right Status Badge matching screenshot: • STARK • ONLINE */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1 font-mono text-[11px] text-[#7edc73]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
            <span className="font-semibold tracking-wider">STARK</span>
            <span className="text-[#3d484e]">•</span>
            <span className="font-semibold tracking-wider text-[#7edc73]">ONLINE</span>
          </div>

          <button
            onClick={onOpenTerminal}
            className="flex items-center gap-1.5 rounded border border-[#242936] bg-[#10141c] px-2.5 py-1 font-mono text-[11px] text-[#bdc8cf] transition-all hover:border-[#39bae6] hover:text-[#6ad5ff] hover:shadow-[0_0_10px_rgba(57,186,230,0.2)]"
            title="Abrir Shell Interactivo"
          >
            <Terminal className="h-3.5 w-3.5 text-[#39bae6]" />
            <span>&gt;_</span>
          </button>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded border border-[#1b1f29] p-2 text-[#bdc8cf] hover:text-[#39bae6]"
            aria-label="Abrir menú"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="border-b border-[#1b1f29] bg-[#10141c] px-4 py-3 md:hidden">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded px-3 py-2 text-left font-mono text-xs tracking-wider ${
                      isActive
                        ? 'bg-[#1b1f29] text-[#39bae6]'
                        : 'text-[#bdc8cf] hover:bg-[#141821] hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <div className="flex items-center justify-between border-t border-[#1b1f29] pt-2 mt-1 px-3 text-xs text-[#7edc73]">
              <span>• STARK • ONLINE</span>
              <button
                onClick={() => {
                  onOpenTerminal();
                  setMobileMenuOpen(false);
                }}
                className="text-[#39bae6] font-bold"
              >
                &gt;_ PTY/0
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
