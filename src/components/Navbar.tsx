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
      {/* Full-bleed bar: no max-width cap, the header spans the whole viewport. */}
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Left Zone: brand logo (console easter egg) + wordmark (home) */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Fun bit: the brand logo deploys the interactive shell. */}
          <button
            onClick={onOpenTerminal}
            className="group flex items-center transition-transform focus:outline-none"
            title="Abrir Shell Interactivo"
            aria-label="Abrir Shell Interactivo"
          >
            <img
              src="/ui/logo-general.png"
              alt="StarkHack"
              className="h-8 w-8 rounded border border-[#39bae6]/40 bg-[#10141c] object-contain p-0.5 shadow-[0_0_12px_rgba(57,186,230,0.25)] transition-all group-hover:border-[#39bae6] group-hover:shadow-[0_0_16px_rgba(57,186,230,0.5)]"
            />
          </button>

          <button
            onClick={() => navigate('/')}
            className="group font-mono text-base font-bold tracking-wider text-[#e0e2ec] transition-colors focus:outline-none"
            title="Ir al inicio"
          >
            STARK<span className="text-[#39bae6]">HACK</span>
          </button>
        </div>

        {/* Right Zone: nav links + online badge + mobile hamburger */}
        <div className="flex min-w-0 items-center justify-end gap-6">
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

          <div className="hidden items-center md:flex">
            <div className="flex items-center gap-2 rounded border border-[#1b1f29] bg-[#10141c] px-3 py-1 font-mono text-[11px] text-[#7edc73]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7edc73] shadow-[0_0_6px_#7edc73]" />
              <span className="font-semibold tracking-wider">STARK</span>
              <span className="text-[#3d484e]">•</span>
              <span className="font-semibold tracking-wider text-[#7edc73]">ONLINE</span>
            </div>
          </div>

          {/* Mobile Hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded border border-[#1b1f29] p-2 text-[#bdc8cf] hover:text-[#39bae6] md:hidden"
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
