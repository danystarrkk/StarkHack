// Root layout for the real router (replaces the old activeTab state machine).
// The screen a URL shows is decided by the route table in src/lib/router.tsx
// and rendered through <Outlet />; this component keeps the shell exactly as
// it was: background layers, Navbar, Footer and the Mainframe terminal modal.
import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { MainframeTerminalModal } from './components/MainframeTerminalModal';
import { TerminalContext } from './lib/terminal';

export default function App() {
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const location = useLocation();

  // Preserves the old handleNavigate behaviour: every navigation returns to
  // the top of the page.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const terminal = useMemo(
    () => ({ openTerminal: () => setIsTerminalOpen(true) }),
    []
  );

  return (
    <TerminalContext.Provider value={terminal}>
      <div className="min-h-screen bg-[#0b0e15] text-[#e0e2ec] font-mono selection:bg-[#39bae6]/30 selection:text-[#6ad5ff] flex flex-col justify-between relative overflow-x-hidden">
        {/* Background ambient cyber subtle blueprint & cyan glow */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <div className="absolute inset-0 bg-blueprint-grid opacity-60" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-gradient-to-b from-[#39bae6]/[0.045] via-transparent to-transparent blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[600px] h-[450px] bg-gradient-to-tl from-[#39bae6]/[0.03] via-transparent to-transparent blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col min-h-screen">
          {/* Navigation Bar */}
          <Navbar onOpenTerminal={() => setIsTerminalOpen(true)} />

          {/* Routed screen (Home, Writeups, Projects, Certifications, About,
              detail pages or the 404 state) */}
          <Outlet />

          {/* Bottom Telemetry Bar */}
          <Footer />
        </div>

        <MainframeTerminalModal
          isOpen={isTerminalOpen}
          onClose={() => setIsTerminalOpen(false)}
        />
      </div>
    </TerminalContext.Provider>
  );
}
